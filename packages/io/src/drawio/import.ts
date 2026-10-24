// draw.io (diagrams.net) import: `.drawio` / `.dio` / exported `.xml` files.
//
// Each `<diagram>` becomes a freeform page. Vertices become geometric shapes,
// text notes or frames (swimlanes); edges become generic connectors that keep
// their endpoints, waypoints, arrowheads, routing style and line jumps. Cell
// order is z-order in both formats, so it is kept. Anything without a
// nodetto equivalent (images, stencils from other libraries, rich HTML) is
// approximated and reported as a warning rather than silently dropped.

import {
  type ConnectorWaypoint,
  connectorWaypointFromPage,
  type Document,
  type Element,
  type ElementId,
  type FillGradient,
  type GeoKind,
  MAX_CONNECTOR_WAYPOINTS,
  SCHEMA_VERSION,
  type VisualStyle,
  assertValidDocument,
} from "@nodetto/ir";
import { BpmnParseError, parseXml, type XmlElement } from "../bpmn/xml.ts";
import {
  decodeBase64,
  decodeUtf8,
  InflateError,
  inflateRaw,
} from "./inflate.ts";
import {
  arrowheadFor,
  DRAWIO_SHAPES,
  type DrawioDirection,
  type DrawioStyle,
  htmlLabelText,
  NODETTO_GEO_KEY,
  parseStyle,
  styleColor,
  styleFlag,
  styleNumber,
} from "./style.ts";

const MAX_DRAWIO_BYTES = 16 * 1024 * 1024;
const MAX_INFLATED_BYTES = 64 * 1024 * 1024;

export interface DrawioImportOptions {
  readonly documentId?: string;
  readonly title?: string;
}

export interface DrawioImportWarning {
  readonly page: string;
  readonly cell?: string;
  readonly message: string;
}

export interface DrawioImportReport {
  readonly document: Document;
  readonly warnings: readonly DrawioImportWarning[];
}

export class DrawioParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawioParseError";
  }
}

interface Cell {
  readonly id: string;
  readonly parent?: string;
  readonly value: string;
  readonly style: DrawioStyle;
  readonly vertex: boolean;
  readonly edge: boolean;
  readonly source?: string;
  readonly target?: string;
  readonly visible: boolean;
  readonly geometry?: XmlElement;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

function attribute(element: XmlElement, name: string): string | undefined {
  return element.attributes.find((item) => item.name === name)?.value;
}

function numberAttribute(
  element: XmlElement | undefined,
  name: string,
): number {
  const value = element ? Number(attribute(element, name)) : Number.NaN;
  return Number.isFinite(value) ? value : 0;
}

function childElements(element: XmlElement): XmlElement[] {
  return element.children.filter(
    (child): child is XmlElement => !("kind" in child),
  );
}

function textContent(element: XmlElement): string {
  return element.children
    .map((child) => ("kind" in child ? child.text : textContent(child)))
    .join("");
}

function parse(text: string): XmlElement {
  try {
    return parseXml(text);
  } catch (error) {
    if (error instanceof BpmnParseError)
      throw new DrawioParseError(error.message);
    throw error;
  }
}

/** The `<mxGraphModel>` of one `<diagram>`, inflating compressed pages. */
function diagramModel(diagram: XmlElement): XmlElement | null {
  const inline = childElements(diagram).find(
    (child) => child.local === "mxGraphModel",
  );
  if (inline) return inline;
  const content = textContent(diagram).trim();
  if (!content) return null;
  if (content.startsWith("<")) return parse(content);
  const bytes = decodeBase64(content);
  if (!bytes) throw new DrawioParseError("page data is not base64");
  let inflated: string;
  try {
    inflated = decodeUtf8(inflateRaw(bytes, MAX_INFLATED_BYTES));
  } catch (error) {
    if (error instanceof InflateError)
      throw new DrawioParseError(
        `compressed page is corrupt: ${error.message}`,
      );
    throw error;
  }
  let xml = inflated;
  try {
    xml = decodeURIComponent(inflated);
  } catch {
    // Very old files deflate the XML itself rather than its URI encoding.
  }
  const model = parse(xml);
  if (model.local !== "mxGraphModel")
    throw new DrawioParseError("compressed page is not an mxGraphModel");
  return model;
}

function readCells(model: XmlElement): Cell[] {
  const root = childElements(model).find((child) => child.local === "root");
  if (!root) return [];
  return childElements(root).flatMap((node): Cell[] => {
    // UserObject / object wrap an mxCell and carry its id and label.
    const wrapped = node.local === "mxCell" ? undefined : node;
    const cell = wrapped
      ? childElements(wrapped).find((child) => child.local === "mxCell")
      : node;
    if (!cell) return [];
    const id = attribute(wrapped ?? cell, "id") ?? attribute(cell, "id");
    if (id === undefined) return [];
    const parent = attribute(cell, "parent");
    const source = attribute(cell, "source");
    const target = attribute(cell, "target");
    const geometry = childElements(cell).find(
      (child) => child.local === "mxGeometry",
    );
    return [
      {
        id,
        ...(parent === undefined ? {} : { parent }),
        value:
          (wrapped ? attribute(wrapped, "label") : attribute(cell, "value")) ??
          "",
        style: parseStyle(attribute(cell, "style")),
        vertex: attribute(cell, "vertex") === "1",
        edge: attribute(cell, "edge") === "1",
        ...(source === undefined ? {} : { source }),
        ...(target === undefined ? {} : { target }),
        visible: attribute(cell, "visible") !== "0",
        ...(geometry ? { geometry } : {}),
      },
    ];
  });
}

function labelOf(cell: Cell): string {
  const raw = cell.value;
  return (styleFlag(cell.style, "html") ? htmlLabelText(raw) : raw).trim();
}

/** Text and paint settings common to vertices and edges. */
function paint(style: DrawioStyle, edge: boolean): VisualStyle {
  const out: Record<string, unknown> = {};
  if (!edge) {
    const fill = styleColor(style, "fillColor");
    if (fill) out["fill"] = fill;
    const gradient = styleColor(style, "gradientColor");
    if (fill && fill !== "none" && gradient && gradient !== "none") {
      const angle =
        { north: 0, east: 90, south: 180, west: 270 }[
          style.values.get("gradientDirection") ?? "south"
        ] ?? 180;
      out["fillGradient"] = {
        type: "linear",
        angle,
        stops: [
          { offset: 0, color: fill },
          { offset: 1, color: gradient },
        ],
      } satisfies FillGradient;
    }
  }
  const stroke = styleColor(style, "strokeColor");
  if (stroke) out["stroke"] = stroke;
  const strokeWidth = styleNumber(style, "strokeWidth");
  if (strokeWidth !== undefined && strokeWidth >= 0)
    out["strokeWidth"] = strokeWidth;
  if (styleFlag(style, "dashed")) {
    const pattern = (style.values.get("dashPattern") ?? "")
      .split(/\s+/)
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (pattern.length > 0 && pattern.some((value) => value > 0))
      out["strokeDashArray"] = pattern;
    else out["dash"] = "dashed";
  }
  const opacity = styleNumber(style, "opacity");
  if (opacity !== undefined && opacity < 100)
    out["opacity"] = Math.max(0, opacity) / 100;
  const color = styleColor(style, "fontColor");
  if (color && color !== "none") out["color"] = color;
  const fontSize = styleNumber(style, "fontSize");
  if (fontSize !== undefined && fontSize > 0) out["fontSize"] = fontSize;
  const fontFamily = style.values.get("fontFamily")?.trim();
  if (fontFamily) out["fontFamily"] = fontFamily;
  const fontStyle = styleNumber(style, "fontStyle") ?? 0;
  if (fontStyle & 1) out["fontWeight"] = 700;
  if (fontStyle & 2) out["fontStyle"] = "italic";
  const decoration = [
    ...(fontStyle & 4 ? ["underline"] : []),
    ...(fontStyle & 8 ? ["line-through"] : []),
  ].join(" ");
  if (decoration) out["textDecoration"] = decoration;
  const align = style.values.get("align");
  if (align === "left") out["textAlign"] = "start";
  else if (align === "right") out["textAlign"] = "end";
  const verticalAlign = style.values.get("verticalAlign");
  if (verticalAlign === "top" || verticalAlign === "bottom")
    out["verticalAlign"] = verticalAlign;
  if (styleFlag(style, "shadow"))
    out["shadow"] = { x: 3, y: 3, blur: 2, color: "#000000", opacity: 0.25 };
  return out as VisualStyle;
}

function shapeName(style: DrawioStyle): string | undefined {
  return (
    style.values.get("shape") ??
    style.names.find((name) => name in DRAWIO_SHAPES)
  );
}

const TURNS: Readonly<Record<DrawioDirection, number>> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
};

class Builder {
  readonly elements: Element[] = [];
  readonly warnings: DrawioImportWarning[] = [];
  private readonly used = new Set<string>();
  private readonly reported = new Set<string>();
  private index = 0;

  id(cellId: string): ElementId {
    const stem = `drawio-${cellId.replace(/[^\w-]+/g, "-") || "cell"}`;
    let id = stem;
    let suffix = 2;
    while (this.used.has(id)) id = `${stem}-${suffix++}`;
    this.used.add(id);
    return id;
  }

  add(element: Omit<Element, "index">): void {
    this.index += 1;
    this.elements.push({
      ...element,
      index: `a${String(this.index).padStart(6, "0")}`,
    } as Element);
  }

  warn(page: string, message: string, cell?: string): void {
    this.warnings.push({ page, message, ...(cell ? { cell } : {}) });
  }

  /** One warning per page and message, however many cells hit it. */
  warnOnce(page: string, message: string): void {
    const key = `${page}\u0000${message}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.warn(page, message);
  }
}

function importPage(
  model: XmlElement,
  pageId: string,
  pageName: string,
  builder: Builder,
): void {
  const cells = readCells(model);
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  const roots = new Set(
    cells.filter((cell) => cell.parent === undefined).map((cell) => cell.id),
  );
  const isLayer = (cell: Cell | undefined): boolean =>
    cell !== undefined &&
    !cell.vertex &&
    !cell.edge &&
    cell.parent !== undefined &&
    roots.has(cell.parent);
  const hidden = (cell: Cell): boolean => {
    for (
      let current: Cell | undefined = cell;
      current;
      current =
        current.parent === undefined ? undefined : byId.get(current.parent)
    )
      if (!current.visible) return true;
    return false;
  };
  // Children of vertices (containers, groups) are positioned relative to
  // their parent; layers and the root contribute nothing.
  const offsets = new Map<string, Point>();
  const offsetOf = (id: string | undefined, depth = 0): Point => {
    if (id === undefined || depth > 256) return { x: 0, y: 0 };
    const known = offsets.get(id);
    if (known) return known;
    const cell = byId.get(id);
    let offset: Point = { x: 0, y: 0 };
    if (cell?.vertex) {
      const parent = offsetOf(cell.parent, depth + 1);
      offset = {
        x: parent.x + numberAttribute(cell.geometry, "x"),
        y: parent.y + numberAttribute(cell.geometry, "y"),
      };
    }
    offsets.set(id, offset);
    return offset;
  };
  const boxOf = (cell: Cell): Box => {
    const origin = offsetOf(cell.parent);
    return {
      x: origin.x + numberAttribute(cell.geometry, "x"),
      y: origin.y + numberAttribute(cell.geometry, "y"),
      width: numberAttribute(cell.geometry, "width"),
      height: numberAttribute(cell.geometry, "height"),
    };
  };

  // Edge labels are vertices parented to an edge; fold them into its label.
  const edgeLabels = new Map<string, string[]>();
  for (const cell of cells)
    if (cell.vertex && cell.parent && byId.get(cell.parent)?.edge) {
      const text = labelOf(cell);
      if (text)
        edgeLabels.set(cell.parent, [
          ...(edgeLabels.get(cell.parent) ?? []),
          text,
        ]);
    }

  const pending: { order: number; element: Omit<Element, "index"> }[] = [];
  let current = 0;
  const emit = (element: Omit<Element, "index">): void => {
    pending.push({ order: current, element });
  };

  const nodeIds = new Map<string, ElementId>();
  const nodeBoxes = new Map<string, Box>();
  const edgeIds = new Map<string, ElementId>();
  for (const cell of cells) {
    if (cell.vertex && !(cell.parent && byId.get(cell.parent)?.edge))
      nodeIds.set(cell.id, builder.id(cell.id));
    else if (cell.edge) edgeIds.set(cell.id, builder.id(cell.id));
  }

  const vertex = (cell: Cell, id: ElementId): void => {
    const style = cell.style;
    const box = boxOf(cell);
    if (box.width <= 0 || box.height <= 0) return;
    const label = labelOf(cell);
    const shape = shapeName(style);
    const common = { id, page: pageId };
    const hiddenVisual = hidden(cell) ? { hidden: true } : {};
    const rotation = styleNumber(style, "rotation") ?? 0;
    if (style.names.includes("group") || shape === "group") return;
    if (style.names.includes("image") || shape === "image") {
      builder.warnOnce(pageName, "Images were skipped.");
      return;
    }
    if (style.names.includes("line") || shape === "line") {
      const y = box.y + box.height / 2;
      emit({
        ...common,
        type: "edge.generic",
        semantic: {
          fromPoint: { x: box.x, y },
          toPoint: { x: box.x + box.width, y },
          arrowheads: { end: "none" },
        },
        visual: { ...hiddenVisual, style: paint(style, true) },
      });
      return;
    }
    nodeBoxes.set(cell.id, box);
    if (style.names.includes("text") || shape === "text") {
      emit({
        ...common,
        type: "text.note",
        semantic: { text: label },
        visual: {
          ...box,
          ...hiddenVisual,
          ...(rotation ? { rotation } : {}),
          style: paint(style, false),
        },
      });
      return;
    }
    if (style.names.includes("swimlane") || shape === "swimlane") {
      const fill = styleColor(style, "swimlaneFillColor") ?? "none";
      emit({
        ...common,
        type: "frame",
        semantic: { name: label || "Container" },
        visual: {
          ...box,
          ...hiddenVisual,
          style: { ...paint(style, false), fill },
        },
      });
      return;
    }
    const override = style.values.get(NODETTO_GEO_KEY);
    const mapped =
      shape === undefined ? DRAWIO_SHAPES["rect"] : DRAWIO_SHAPES[shape];
    if (shape !== undefined && !mapped && !override)
      builder.warnOnce(
        pageName,
        `Shape "${shape}" has no nodetto equivalent and was imported as a rectangle.`,
      );
    const geo = (override ?? mapped?.geo ?? "rect") as GeoKind;
    const visualStyle: Record<string, unknown> = { ...paint(style, false) };
    if (geo === "rect" && shape === "mxgraph.flowchart.terminator")
      visualStyle["cornerRadius"] = Math.min(box.width, box.height) / 2;
    else if (geo === "rect" && styleFlag(style, "rounded")) {
      const arc = styleNumber(style, "arcSize");
      visualStyle["cornerRadius"] = Math.round(
        styleFlag(style, "absoluteArcSize")
          ? Math.min(box.width / 2, box.height / 2, (arc ?? 20) / 2)
          : Math.min(box.width, box.height) * ((arc ?? 15) / 100),
      );
    }
    // Directional shapes: nodetto draws them pointing up (triangle) or right
    // (arrows, chevrons, off-page points down); mirror or turn to match.
    let flipX = styleFlag(style, "flipH");
    let flipY = styleFlag(style, "flipV");
    let turn = 0;
    // The drawn shape's direction applies when it is the one nodetto draws.
    const natural = mapped?.geo === geo ? mapped.direction : undefined;
    if (natural) {
      const wanted =
        (style.values.get("direction") as DrawioDirection | undefined) ??
        natural;
      const nodettoNatural: DrawioDirection =
        geo === "triangle" ? "north" : geo === "off-page" ? "south" : "east";
      const delta =
        ((TURNS[wanted] ?? TURNS[natural]) - TURNS[nodettoNatural] + 4) % 4;
      if (delta === 2) {
        if (nodettoNatural === "east") flipX = !flipX;
        else flipY = !flipY;
      } else turn = delta;
    }
    // A quarter turn swaps the box about its centre.
    const placed: Box =
      turn % 2 === 1
        ? {
            x: box.x + box.width / 2 - box.height / 2,
            y: box.y + box.height / 2 - box.width / 2,
            width: box.height,
            height: box.width,
          }
        : box;
    const totalRotation = (((rotation + turn * 90) % 360) + 360) % 360;
    emit({
      ...common,
      type: "shape.geo",
      semantic: { geo, label },
      visual: {
        ...placed,
        ...(totalRotation
          ? {
              rotation:
                totalRotation > 180 ? totalRotation - 360 : totalRotation,
            }
          : {}),
        ...(flipX ? { flipX: true } : {}),
        ...(flipY ? { flipY: true } : {}),
        ...hiddenVisual,
        style: visualStyle as VisualStyle,
      },
    });
  };

  const edge = (cell: Cell, id: ElementId): void => {
    const style = cell.style;
    const origin = offsetOf(cell.parent);
    const geometry = cell.geometry;
    const pointOf = (as: string): Point | undefined => {
      const point = geometry
        ? childElements(geometry).find(
            (child) =>
              child.local === "mxPoint" && attribute(child, "as") === as,
          )
        : undefined;
      return point
        ? {
            x: origin.x + numberAttribute(point, "x"),
            y: origin.y + numberAttribute(point, "y"),
          }
        : undefined;
    };
    const pointList = geometry
      ? childElements(geometry).find(
          (child) =>
            child.local === "Array" && attribute(child, "as") === "points",
        )
      : undefined;
    const waypoints: Point[] = pointList
      ? childElements(pointList)
          .filter((child) => child.local === "mxPoint")
          .map((point) => ({
            x: origin.x + numberAttribute(point, "x"),
            y: origin.y + numberAttribute(point, "y"),
          }))
      : [];
    const endpoint = (
      reference: string | undefined,
      fallback: Point | undefined,
    ): { id: ElementId; center: Point } | { point: Point } | null => {
      const id = reference === undefined ? undefined : nodeIds.get(reference);
      const box =
        reference === undefined ? undefined : nodeBoxes.get(reference);
      if (id && box)
        return {
          id,
          center: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        };
      return fallback ? { point: fallback } : null;
    };
    const from = endpoint(cell.source, pointOf("sourcePoint") ?? waypoints[0]);
    const to = endpoint(
      cell.target,
      pointOf("targetPoint") ?? waypoints.at(-1),
    );
    if (!from || !to) {
      builder.warn(
        pageName,
        "A connector without endpoints was skipped.",
        cell.id,
      );
      return;
    }
    const label = [labelOf(cell), ...(edgeLabels.get(cell.id) ?? [])]
      .filter(Boolean)
      .join(" ");
    const startArrow = arrowheadFor(
      style.values.get("startArrow"),
      style.values.get("startFill") !== "0",
    );
    const endArrow =
      arrowheadFor(
        style.values.get("endArrow"),
        style.values.get("endFill") !== "0",
      ) ?? "arrow";
    const edgeStyle = style.values.get("edgeStyle");
    const orthogonal =
      edgeStyle !== undefined &&
      edgeStyle !== "none" &&
      edgeStyle !== "" &&
      edgeStyle !== "isometricEdgeStyle";
    const fromCenter = "id" in from ? from.center : from.point;
    const toCenter = "id" in to ? to.center : to.point;
    // Free endpoints that came from the waypoint list are not waypoints.
    const interior = waypoints.filter(
      (point) =>
        !("point" in from && from.point === point) &&
        !("point" in to && to.point === point),
    );
    let routingWaypoints: ConnectorWaypoint[] = [];
    if (!orthogonal && interior.length > 0) {
      if (interior.length > MAX_CONNECTOR_WAYPOINTS)
        builder.warn(
          pageName,
          `Only the first ${MAX_CONNECTOR_WAYPOINTS} waypoints were kept.`,
          cell.id,
        );
      routingWaypoints = interior
        .slice(0, MAX_CONNECTOR_WAYPOINTS)
        .map((point) => connectorWaypointFromPage(point, fromCenter, toCenter));
    }
    const visualStyle: Record<string, unknown> = { ...paint(style, true) };
    if (styleFlag(style, "rounded") || styleFlag(style, "curved"))
      visualStyle["cornerRadius"] = styleFlag(style, "curved") ? 24 : 10;
    const jump = style.values.get("jumpStyle");
    if (jump === "gap") visualStyle["lineJumps"] = "gap";
    else if (jump === "arc" || jump === "sharp" || jump === "line")
      visualStyle["lineJumps"] = "arc";
    emit({
      id,
      page: pageId,
      type: "edge.generic",
      semantic: {
        ...("id" in from ? { from: from.id } : { fromPoint: from.point }),
        ...("id" in to ? { to: to.id } : { toPoint: to.point }),
        ...(label ? { label } : {}),
        arrowheads: {
          ...(startArrow && startArrow !== "none" ? { start: startArrow } : {}),
          end: endArrow,
        },
        ...(orthogonal
          ? { routing: "orthogonal" }
          : routingWaypoints.length > 0
            ? { routing: "manual", routingWaypoints }
            : {}),
      },
      visual: {
        ...(hidden(cell) ? { hidden: true } : {}),
        style: visualStyle as VisualStyle,
      },
    });
  };

  // Vertices first, so every edge can resolve its endpoint boxes however
  // the file orders them; elements then take their cells' z-order.
  cells.forEach((cell, order) => {
    if (roots.has(cell.id) || isLayer(cell)) return;
    const nodeId = nodeIds.get(cell.id);
    if (nodeId) {
      current = order;
      vertex(cell, nodeId);
    }
  });
  cells.forEach((cell, order) => {
    const edgeId = edgeIds.get(cell.id);
    if (edgeId && !roots.has(cell.id)) {
      current = order;
      edge(cell, edgeId);
    }
  });
  pending.sort((left, right) => left.order - right.order);
  for (const { element } of pending) builder.add(element);
}

/** Parse a draw.io file into a nodetto document, one page per diagram. */
export function importDrawio(
  text: string,
  options: DrawioImportOptions = {},
): DrawioImportReport {
  if (text.length > MAX_DRAWIO_BYTES)
    throw new DrawioParseError("draw.io file is larger than 16 MiB");
  const root = parse(text);
  const diagrams =
    root.local === "mxfile"
      ? childElements(root).filter((child) => child.local === "diagram")
      : root.local === "mxGraphModel" || root.local === "diagram"
        ? [root]
        : null;
  if (!diagrams)
    throw new DrawioParseError(
      `expected an mxfile or mxGraphModel root, found <${root.name}>`,
    );
  if (diagrams.length === 0)
    throw new DrawioParseError("the draw.io file has no diagrams");
  const builder = new Builder();
  const pages = diagrams.map((diagram, index) => {
    const name =
      (diagram.local === "diagram"
        ? attribute(diagram, "name")
        : undefined
      )?.trim() || `Page ${index + 1}`;
    const id = `drawio-page-${index + 1}`;
    const model =
      diagram.local === "mxGraphModel" ? diagram : diagramModel(diagram);
    if (model) importPage(model, id, name, builder);
    return { id, name, kind: "freeform" as const };
  });
  const title = options.title?.trim() || pages[0]?.name || "draw.io diagram";
  const document: Document = {
    schemaVersion: SCHEMA_VERSION,
    id: options.documentId?.trim() || "drawio-document",
    title,
    pages,
    elements: builder.elements,
  };
  assertValidDocument(document);
  return { document, warnings: builder.warnings };
}
