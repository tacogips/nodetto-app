// draw.io (diagrams.net) export: an uncompressed `.drawio` file.
//
// Every page becomes a `<diagram>`. Geometric shapes use draw.io's own
// shapes with matching proportions and carry a `nodettoGeo` style key so a
// round trip restores the exact kind; text notes, frames, generic nodes and
// state nodes use their natural draw.io counterparts; ERD tables and UML
// classes become draw.io's stacked list containers with one row per column
// or member. Connectors keep endpoints, ports, manual waypoints, routing
// style, arrowheads, rounded bends and line jumps. Connectors are written
// before shapes, matching nodetto's painting order. Types without a draw.io
// counterpart are written as labelled rectangles and reported.

import {
  comparePageOrder,
  type ConnectorWaypoint,
  connectorWaypointToPage,
  type Document,
  type Element,
  type ErdTableSemantic,
  type FillGradient,
  type GeoKind,
  getElementTypeDefinition,
  stateTransitionLabel,
  type UmlClassSemantic,
  type VisualStyle,
} from "@nodetto/ir";
import { serializeXml, type XmlElement } from "../bpmn/xml.ts";
import {
  DRAWIO_ARROWS,
  formatStyle,
  NODETTO_GEO_KEY,
  textToHtmlLabel,
} from "./style.ts";

export interface DrawioExportWarning {
  readonly elementId?: string;
  readonly message: string;
}

export interface DrawioExportReport {
  readonly xml: string;
  readonly warnings: readonly DrawioExportWarning[];
}

export interface DrawioExportOptions {
  /** Export only these pages; all pages when omitted. */
  readonly pageIds?: readonly string[];
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type Entry = readonly [string, string | number | undefined];

type Endpoint =
  | { readonly cell: string; readonly center: Point }
  | { readonly point: Point };

interface Point {
  readonly x: number;
  readonly y: number;
}

const ROW_HEIGHT = 26;
const PORT_ANCHORS: Readonly<Record<string, readonly [number, number]>> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
};
/** Types that carry no artwork of their own. */
const SILENT_TYPES = new Set([
  "design.token",
  "design.guide",
  "design.text-style",
  "review.comment",
  "group",
]);

function xml(
  name: string,
  attributes: Readonly<Record<string, string | number | undefined>>,
  children: readonly XmlElement[] = [],
): XmlElement {
  return {
    name,
    local: name,
    attributes: Object.entries(attributes).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [{ name: key, local: key, value: String(value) }],
    ),
    children,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function geometry(box: Box, children: readonly XmlElement[] = []): XmlElement {
  return xml(
    "mxGeometry",
    {
      x: round(box.x),
      y: round(box.y),
      width: round(box.width),
      height: round(box.height),
      as: "geometry",
    },
    children,
  );
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function gradientDirection(gradient: FillGradient): string {
  if (gradient.type !== "linear") return "south";
  const quarter = Math.round((((gradient.angle % 360) + 360) % 360) / 90) % 4;
  return ["north", "east", "south", "west"][quarter] ?? "south";
}

/** Paint, text and transform entries shared by every vertex. */
function paintEntries(visual: Element["visual"]): Entry[] {
  const style: VisualStyle = visual.style ?? {};
  const gradient = style.fillGradient;
  const stops = gradient?.stops ?? [];
  const fontStyle =
    ((style.fontWeight ?? 400) >= 600 ? 1 : 0) +
    (style.fontStyle === "italic" ? 2 : 0) +
    (style.textDecoration?.includes("underline") ? 4 : 0) +
    (style.textDecoration?.includes("line-through") ? 8 : 0);
  const dashArray =
    style.strokeDashArray && style.strokeDashArray.length > 0
      ? style.strokeDashArray.join(" ")
      : style.dash === "dotted"
        ? "1 4"
        : undefined;
  const shadow =
    style.shadow !== undefined ||
    (style.effects ?? []).some(
      (effect) => effect.type === "drop-shadow" && effect.enabled !== false,
    );
  return [
    ["fillColor", stops[0]?.color ?? style.fill],
    ...(gradient && stops.length > 1
      ? ([
          ["gradientColor", stops.at(-1)?.color],
          ["gradientDirection", gradientDirection(gradient)],
        ] as Entry[])
      : []),
    ["strokeColor", style.stroke],
    ["strokeWidth", style.strokeWidth],
    ...(style.dash === "dashed" || style.dash === "dotted" || dashArray
      ? ([
          ["dashed", 1],
          ["dashPattern", dashArray],
        ] as Entry[])
      : []),
    [
      "opacity",
      style.opacity === undefined ? undefined : round(style.opacity * 100),
    ],
    ["fontColor", style.color],
    ["fontSize", style.fontSize],
    ["fontFamily", style.fontFamily],
    ["fontStyle", fontStyle || undefined],
    [
      "align",
      style.textAlign === "start"
        ? "left"
        : style.textAlign === "end"
          ? "right"
          : undefined,
    ],
    [
      "verticalAlign",
      style.verticalAlign === "middle" ? undefined : style.verticalAlign,
    ],
    ["shadow", shadow ? 1 : undefined],
    ["rotation", visual.rotation ? round(visual.rotation) : undefined],
  ];
}

/** Normalized polygon coordinates of a regular outline for draw.io. */
function polyCoords(points: readonly (readonly [number, number])[]): string {
  return `[${points.map(([x, y]) => `[${round(x)},${round(y)}]`).join(",")}]`;
}

function starCoords(): string {
  return polyCoords(
    Array.from({ length: 10 }, (_, index) => {
      const angle = (Math.PI / 5) * index - Math.PI / 2;
      const scale = index % 2 === 0 ? 0.5 : 0.2;
      return [0.5 + Math.cos(angle) * scale, 0.5 + Math.sin(angle) * scale];
    }),
  );
}

/** Named styles and shape entries reproducing one geo kind in draw.io. */
function geoStyle(
  geo: GeoKind,
  box: Box,
  visual: Element["visual"],
): { names: string[]; entries: Entry[] } {
  const short = Math.min(box.width, box.height);
  const flipX = visual.flipX === true;
  const flipY = visual.flipY === true;
  const flips: Entry[] = [
    ["flipH", flipX ? 1 : undefined],
    ["flipV", flipY ? 1 : undefined],
  ];
  const shape = (
    name: string,
    entries: Entry[] = [],
    flipped: Entry[] = flips,
  ): { names: string[]; entries: Entry[] } => ({
    names: [],
    entries: [["shape", name], ...entries, ...flipped],
  });
  const polygon = (coords: string) =>
    shape("mxgraph.basic.polygon", [
      ["polyCoords", coords],
      ["polyline", 0],
    ]);
  switch (geo) {
    case "rect": {
      const radius =
        visual.style?.cornerRadius ?? visual.style?.cornerRadii?.topLeft ?? 0;
      return {
        names: [],
        entries: [
          ...(radius > 0
            ? ([
                ["rounded", 1],
                ["absoluteArcSize", 1],
                ["arcSize", round(radius * 2)],
              ] as Entry[])
            : ([["rounded", 0]] as Entry[])),
          ...flips,
        ],
      };
    }
    // Symmetric outlines: flips change nothing visible but round-trip.
    case "ellipse":
      return { names: ["ellipse"], entries: flips };
    case "diamond":
      return { names: ["rhombus"], entries: flips };
    case "triangle":
      return {
        names: ["triangle"],
        entries: [
          ["direction", flipY ? "south" : "north"],
          ["flipH", flipX ? 1 : undefined],
        ],
      };
    case "hexagon":
      return shape("hexagon", [
        ["perimeter", "hexagonPerimeter2"],
        ["fixedSize", 0],
        ["size", 0.25],
      ]);
    case "parallelogram":
      return shape("parallelogram", [
        ["perimeter", "parallelogramPerimeter"],
        ["fixedSize", 0],
        ["size", 0.25],
      ]);
    case "cylinder":
      // nodetto never mirrors a cylinder; draw.io would turn it upside down.
      return shape(
        "cylinder3",
        [
          ["boundedLbl", 1],
          ["backgroundOutline", 1],
          ["size", round(Math.min(box.height * 0.15, 18))],
        ],
        [],
      );
    case "star":
      return polygon(starCoords());
    case "trapezoid":
      return shape("trapezoid", [
        ["perimeter", "trapezoidPerimeter"],
        ["fixedSize", 0],
        ["size", 0.2],
      ]);
    case "pentagon":
      return polygon(
        polyCoords([
          [0.5, 0],
          [1, 0.38],
          [0.81, 1],
          [0.19, 1],
          [0, 0.38],
        ]),
      );
    case "octagon": {
      const cx = (short * 0.29) / box.width;
      const cy = (short * 0.29) / box.height;
      return polygon(
        polyCoords([
          [cx, 0],
          [1 - cx, 0],
          [1, cy],
          [1, 1 - cy],
          [1 - cx, 1],
          [cx, 1],
          [0, 1 - cy],
          [0, cy],
        ]),
      );
    }
    case "cross":
      return polygon(
        polyCoords([
          [0.33, 0],
          [0.67, 0],
          [0.67, 0.33],
          [1, 0.33],
          [1, 0.67],
          [0.67, 0.67],
          [0.67, 1],
          [0.33, 1],
          [0.33, 0.67],
          [0, 0.67],
          [0, 0.33],
          [0.33, 0.33],
        ]),
      );
    case "arrow":
      return shape(
        "singleArrow",
        [
          ["arrowWidth", 0.4],
          [
            "arrowSize",
            round(Math.min(box.width * 0.4, box.height) / box.width),
          ],
          ["direction", flipX ? "west" : undefined],
        ],
        [],
      );
    case "chevron":
      return shape(
        "step",
        [
          ["perimeter", "stepPerimeter"],
          ["fixedSize", 1],
          ["size", round(Math.min(box.width * 0.25, box.height / 2))],
          ["direction", flipX ? "west" : undefined],
        ],
        [],
      );
    case "cloud":
      return { names: ["ellipse"], entries: [["shape", "cloud"], ...flips] };
    case "callout":
      return shape("callout", [
        ["perimeter", "calloutPerimeter"],
        ["size", round(box.height * 0.25)],
        ["position", 0.3],
        ["position2", 0.25],
        ["base", round(box.width * 0.15)],
      ]);
    case "note":
      return shape("note", [["size", round(Math.min(short * 0.2, 24))]]);
    case "cube":
      return shape("cube", [["size", round(Math.min(short * 0.2, 24))]]);
    case "document": {
      const wave = Math.min(box.height * 0.1, 12);
      return shape("document", [["size", round((wave * 2) / box.height)]]);
    }
    case "manual-input":
      return shape("manualInput", [["size", round(box.height * 0.3)]]);
    case "delay":
      return shape("delay");
    case "predefined-process":
      return shape("process", [
        ["size", round(Math.min(box.width * 0.1, 14) / box.width)],
      ]);
    case "internal-storage": {
      const inset = round(Math.min(short * 0.2, 16));
      return shape("internalStorage", [
        ["dx", inset],
        ["dy", inset],
      ]);
    }
    case "off-page":
      return shape("offPageConnector", [["size", 0.4]]);
    case "card":
      return shape("card", [["size", round(Math.min(short * 0.25, 24))]]);
    case "tape":
      // draw.io's quadratic wave peaks at 0.45 of its `size` band.
      return shape("tape", [
        ["size", round(Math.min(box.height * 0.09, 10) / 0.45 / box.height)],
      ]);
    case "stored-data":
      return shape("dataStorage", [
        ["fixedSize", 1],
        ["size", round(Math.min(box.width * 0.15, 20))],
      ]);
    case "display":
      return shape("display", [
        ["size", round(Math.min(box.width * 0.25, box.height) / box.width)],
      ]);
    case "loop-limit":
      return shape("loopLimit", [["size", round(Math.min(short * 0.25, 20))]]);
    case "collate":
      return shape("collate");
    case "sort":
      return shape("sortShape", [["perimeter", "rhombusPerimeter"]]);
    case "summing-junction":
      return shape("sumEllipse", [["perimeter", "ellipsePerimeter"]]);
    case "or":
      return shape("orEllipse", [["perimeter", "ellipsePerimeter"]]);
    case "multi-document":
      return shape("mxgraph.flowchart.multi-document", [["boundedLbl", 1]]);
    case "direct-data":
      return shape("mxgraph.flowchart.direct_data");
    case "sequential-data":
      return shape("tapeData", [["perimeter", "ellipsePerimeter"]]);
    case "double-arrow":
      return shape("doubleArrow", [
        ["arrowWidth", 0.4],
        [
          "arrowSize",
          round(
            Math.min(box.width * 0.3, box.height, box.width / 2) / box.width,
          ),
        ],
      ]);
    case "right-triangle":
      return shape("mxgraph.basic.orthogonal_triangle");
    case "person":
      return shape("actor");
  }
  return { names: [], entries: [["rounded", 0]] };
}

/** Row label of an ERD column, e.g. `id: uuid PK`. */
function columnRow(column: ErdTableSemantic["columns"][number]): string {
  return `${column.name}: ${column.dataType}${column.nullable ? "?" : ""}${column.pk ? " PK" : ""}`;
}

function memberRows(semantic: UmlClassSemantic): {
  attributes: string[];
  methods: string[];
} {
  return {
    attributes: semantic.attributes.map(
      (attribute) =>
        `${attribute.visibility ?? ""}${attribute.name}${attribute.type ? `: ${attribute.type}` : ""}`,
    ),
    methods: semantic.methods.map(
      (method) =>
        `${method.visibility ?? ""}${method.name}(${(method.parameters ?? [])
          .map((parameter) =>
            parameter.type
              ? `${parameter.name}: ${parameter.type}`
              : parameter.name,
          )
          .join(", ")})${method.returnType ? `: ${method.returnType}` : ""}`,
    ),
  };
}

const LIST_STYLE: Entry[] = [
  ["childLayout", "stackLayout"],
  ["horizontal", 1],
  ["startSize", ROW_HEIGHT],
  ["horizontalStack", 0],
  ["resizeParent", 1],
  ["resizeParentMax", 0],
  ["resizeLast", 0],
  ["collapsible", 1],
  ["marginBottom", 0],
  ["html", 1],
];
const ROW_STYLE = formatStyle(
  ["text"],
  [
    ["strokeColor", "none"],
    ["fillColor", "none"],
    ["align", "left"],
    ["verticalAlign", "top"],
    ["spacingLeft", 4],
    ["spacingRight", 4],
    ["overflow", "hidden"],
    ["rotatable", 0],
    ["points", "[[0,0.5],[1,0.5]]"],
    ["portConstraint", "eastwest"],
    ["whiteSpace", "wrap"],
    ["html", 1],
  ],
);
const DIVIDER_STYLE = formatStyle(
  ["line"],
  [
    ["strokeWidth", 1],
    ["fillColor", "none"],
    ["align", "left"],
    ["verticalAlign", "middle"],
    ["spacingTop", -1],
    ["spacingLeft", 3],
    ["spacingRight", 3],
    ["rotatable", 0],
    ["labelPosition", "right"],
    ["points", "[]"],
    ["portConstraint", "eastwest"],
  ],
);

function labelOf(element: Element): string {
  const semantic = record(element.semantic);
  return (
    text(semantic["label"]) ||
    text(semantic["name"]) ||
    text(semantic["tableName"]) ||
    text(semantic["text"]) ||
    text(semantic["title"]) ||
    (element.visual.layerName ?? "")
  );
}

class PageWriter {
  readonly cells: XmlElement[] = [];
  readonly boxes = new Map<string, Box>();
  private readonly ids = new Map<string, string>();

  constructor(
    private readonly warnings: DrawioExportWarning[],
    private readonly fallbacks: Map<string, number>,
  ) {}

  cellId(elementId: string): string {
    const known = this.ids.get(elementId);
    if (known) return known;
    const id =
      elementId === "0" || elementId === "1" ? `n-${elementId}` : elementId;
    this.ids.set(elementId, id);
    return id;
  }

  vertex(
    element: Element,
    box: Box,
    value: string,
    style: string,
    parent = "1",
    id = this.cellId(element.id),
  ): void {
    this.cells.push(
      xml(
        "mxCell",
        {
          id,
          value,
          style,
          vertex: 1,
          parent,
          visible: element.visual.hidden ? 0 : undefined,
        },
        [geometry(box)],
      ),
    );
  }

  /** A stacked list (ERD table, UML class): header plus fixed-height rows. */
  list(
    element: Element,
    title: string,
    sections: readonly (readonly string[])[],
  ): void {
    const x = element.visual.x ?? 0;
    const y = element.visual.y ?? 0;
    const width = element.visual.width ?? 240;
    const rows = sections.flat().length;
    const dividers = Math.max(0, sections.length - 1);
    const height = ROW_HEIGHT * (rows + 1) + dividers * 8;
    const box = { x, y, width, height };
    this.boxes.set(element.id, box);
    const id = this.cellId(element.id);
    this.vertex(
      element,
      box,
      textToHtmlLabel(title),
      formatStyle(
        ["swimlane"],
        [
          ["fontStyle", 1],
          ["align", "center"],
          ["verticalAlign", "top"],
          ...LIST_STYLE,
          ...paintEntries(element.visual).filter(
            ([key]) => key !== "fontStyle" && key !== "align",
          ),
        ],
      ),
    );
    let top = ROW_HEIGHT;
    sections.forEach((section, index) => {
      if (index > 0) {
        this.cells.push(
          xml(
            "mxCell",
            {
              id: `${id}-divider-${index}`,
              value: "",
              style: DIVIDER_STYLE,
              vertex: 1,
              parent: id,
            },
            [geometry({ x: 0, y: top, width, height: 8 })],
          ),
        );
        top += 8;
      }
      section.forEach((row, rowIndex) => {
        this.cells.push(
          xml(
            "mxCell",
            {
              id: `${id}-row-${index}-${rowIndex}`,
              value: textToHtmlLabel(row),
              style: ROW_STYLE,
              vertex: 1,
              parent: id,
            },
            [geometry({ x: 0, y: top, width, height: ROW_HEIGHT })],
          ),
        );
        top += ROW_HEIGHT;
      });
    });
  }

  node(element: Element): void {
    const visual = element.visual;
    const semantic = record(element.semantic);
    if (element.type === "erd.table") {
      const table = element.semantic as ErdTableSemantic;
      this.list(element, table.tableName, [table.columns.map(columnRow)]);
      return;
    }
    if (element.type === "uml.class") {
      const umlClass = element.semantic as UmlClassSemantic;
      const { attributes, methods } = memberRows(umlClass);
      this.list(
        element,
        umlClass.stereotype
          ? `«${umlClass.stereotype}»\n${umlClass.name}`
          : umlClass.name,
        [attributes, methods],
      );
      return;
    }
    if (
      visual.x === undefined ||
      visual.y === undefined ||
      visual.width === undefined ||
      visual.height === undefined
    ) {
      this.fallback(element, "has no fixed geometry and was skipped");
      return;
    }
    const box = {
      x: visual.x,
      y: visual.y,
      width: visual.width,
      height: visual.height,
    };
    this.boxes.set(element.id, box);
    const paint = paintEntries(visual);
    const common: Entry[] = [
      ["whiteSpace", "wrap"],
      ["html", 1],
    ];
    switch (element.type) {
      case "shape.geo": {
        const geo = (text(semantic["geo"]) || "rect") as GeoKind;
        const { names, entries } = geoStyle(geo, box, visual);
        this.vertex(
          element,
          box,
          textToHtmlLabel(text(semantic["label"])),
          formatStyle(names, [
            ...entries,
            ...common,
            ...paint,
            [NODETTO_GEO_KEY, geo],
          ]),
        );
        return;
      }
      case "text.note":
        this.vertex(
          element,
          box,
          textToHtmlLabel(text(semantic["text"])),
          formatStyle(
            ["text"],
            [
              ...common,
              ["align", "left"],
              ["verticalAlign", "top"],
              ["strokeColor", "none"],
              ["fillColor", "none"],
              ...paint,
            ],
          ),
        );
        return;
      case "frame":
        this.vertex(
          element,
          box,
          textToHtmlLabel(text(semantic["name"])),
          formatStyle(
            [],
            [
              ["rounded", 0],
              ...common,
              ["fillColor", "none"],
              ["verticalAlign", "top"],
              ["align", "left"],
              ["spacingLeft", 6],
              ["container", 1],
              ...paint,
            ],
          ),
        );
        return;
      case "node.generic":
        this.vertex(
          element,
          box,
          textToHtmlLabel(text(semantic["label"])),
          formatStyle([], [["rounded", 1], ...common, ...paint]),
        );
        return;
      case "state.node": {
        const kind = text(semantic["kind"]);
        const name = text(semantic["name"]);
        const names =
          kind === "initial"
            ? ["ellipse"]
            : kind === "final"
              ? ["ellipse"]
              : kind === "choice"
                ? ["rhombus"]
                : [];
        const entries: Entry[] =
          kind === "initial"
            ? [
                ["fillColor", "#000000"],
                ["verticalLabelPosition", "bottom"],
                ["verticalAlign", "top"],
              ]
            : kind === "final"
              ? [
                  ["shape", "doubleEllipse"],
                  ["fillColor", "#000000"],
                  ["verticalLabelPosition", "bottom"],
                  ["verticalAlign", "top"],
                ]
              : kind === "choice"
                ? [
                    ["verticalLabelPosition", "bottom"],
                    ["verticalAlign", "top"],
                  ]
                : [
                    ["rounded", 1],
                    ["arcSize", 30],
                  ];
        this.vertex(
          element,
          box,
          textToHtmlLabel(name),
          formatStyle(names, [...entries, ...common, ...paint]),
        );
        return;
      }
      default:
        this.fallback(element, "was exported as a labelled rectangle");
        this.vertex(
          element,
          box,
          textToHtmlLabel(labelOf(element)),
          formatStyle([], [["rounded", 0], ...common, ...paint]),
        );
    }
  }

  fallback(element: Element, message: string): void {
    const key = `${element.type}\u0000${message}`;
    const count = (this.fallbacks.get(key) ?? 0) + 1;
    this.fallbacks.set(key, count);
    if (count === 1)
      this.warnings.push({
        elementId: element.id,
        message: `${element.type} ${message}.`,
      });
  }

  edge(element: Element): void {
    const semantic = record(element.semantic);
    const endpoint = (side: "from" | "to"): Endpoint | null => {
      const raw = semantic[side];
      const reference =
        typeof raw === "string" ? raw : text(record(raw)["table"]) || undefined;
      const point = record(semantic[`${side}Point`]);
      const box = reference ? this.boxes.get(reference) : undefined;
      if (reference && box)
        return {
          cell: this.cellId(reference),
          center: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        };
      if (typeof point["x"] === "number" && typeof point["y"] === "number")
        return { point: { x: point["x"], y: point["y"] } };
      return null;
    };
    const from = endpoint("from");
    const to = endpoint("to");
    if (!from || !to) {
      this.fallback(
        element,
        "connects to something not exported and was skipped",
      );
      return;
    }
    const { start, end, dashed, label } = this.notation(element);
    const routing = text(semantic["routing"]);
    const fromCenter = "cell" in from ? from.center : from.point;
    const toCenter = "cell" in to ? to.center : to.point;
    const waypoints =
      routing === "manual" && Array.isArray(semantic["routingWaypoints"])
        ? (semantic["routingWaypoints"] as ConnectorWaypoint[]).map(
            (waypoint) =>
              connectorWaypointToPage(waypoint, fromCenter, toCenter),
          )
        : [];
    const ports = (side: "from" | "to", prefix: "exit" | "entry"): Entry[] => {
      const anchor = PORT_ANCHORS[text(semantic[`${side}Port`])];
      return anchor
        ? [
            [`${prefix}X`, anchor[0]],
            [`${prefix}Y`, anchor[1]],
            [`${prefix}Dx`, 0],
            [`${prefix}Dy`, 0],
          ]
        : [];
    };
    const style = element.visual.style ?? {};
    const [startName, startFill] = DRAWIO_ARROWS[start] ?? ["none", 1];
    const [endName, endFill] = DRAWIO_ARROWS[end] ?? ["classic", 1];
    const children: XmlElement[] = [
      ...("point" in from
        ? [
            xml("mxPoint", {
              x: round(from.point.x),
              y: round(from.point.y),
              as: "sourcePoint",
            }),
          ]
        : []),
      ...("point" in to
        ? [
            xml("mxPoint", {
              x: round(to.point.x),
              y: round(to.point.y),
              as: "targetPoint",
            }),
          ]
        : []),
      ...(waypoints.length > 0
        ? [
            xml(
              "Array",
              { as: "points" },
              waypoints.map((point) =>
                xml("mxPoint", { x: round(point.x), y: round(point.y) }),
              ),
            ),
          ]
        : []),
    ];
    this.cells.push(
      xml(
        "mxCell",
        {
          id: this.cellId(element.id),
          value: textToHtmlLabel(label),
          style: formatStyle(
            [],
            [
              [
                "edgeStyle",
                routing === "orthogonal" ? "orthogonalEdgeStyle" : undefined,
              ],
              ["rounded", (style.cornerRadius ?? 0) > 0 ? 1 : 0],
              ["jumpStyle", style.lineJumps],
              ["html", 1],
              ["startArrow", startName],
              ["startFill", startFill],
              ["endArrow", endName],
              ["endFill", endFill],
              ...ports("from", "exit"),
              ...ports("to", "entry"),
              ["strokeColor", style.stroke],
              ["strokeWidth", style.strokeWidth],
              [
                "dashed",
                dashed || style.dash === "dashed" || style.dash === "dotted"
                  ? 1
                  : undefined,
              ],
              [
                "dashPattern",
                style.strokeDashArray?.length
                  ? style.strokeDashArray.join(" ")
                  : style.dash === "dotted"
                    ? "1 4"
                    : undefined,
              ],
              [
                "opacity",
                style.opacity === undefined
                  ? undefined
                  : round(style.opacity * 100),
              ],
              ["fontColor", style.color],
              ["fontSize", style.fontSize],
            ],
          ),
          edge: 1,
          parent: "1",
          source: "cell" in from ? from.cell : undefined,
          target: "cell" in to ? to.cell : undefined,
          visible: element.visual.hidden ? 0 : undefined,
        },
        [xml("mxGeometry", { relative: 1, as: "geometry" }, children)],
      ),
    );
  }

  /** Arrowheads, dash and label a connector type draws with. */
  private notation(element: Element): {
    start: string;
    end: string;
    dashed: boolean;
    label: string;
  } {
    const semantic = record(element.semantic);
    const label = text(semantic["label"]);
    switch (element.type) {
      case "erd.relation": {
        const [left, right] = text(semantic["cardinality"]).split(":");
        return {
          start: left === "*" ? "crow-foot" : "bar",
          end: right === "*" ? "crow-foot" : "bar",
          dashed: semantic["logical"] === true,
          label,
        };
      }
      case "uml.association": {
        const kind = text(semantic["kind"]);
        return kind === "inherit"
          ? { start: "none", end: "triangle", dashed: false, label: "" }
          : kind === "aggregate"
            ? { start: "diamond-open", end: "none", dashed: false, label }
            : kind === "compose"
              ? { start: "diamond", end: "none", dashed: false, label }
              : { start: "none", end: "none", dashed: false, label };
      }
      case "uml.component-relationship": {
        const kind = text(semantic["kind"]);
        return kind === "realization"
          ? { start: "none", end: "triangle", dashed: true, label }
          : kind === "dependency"
            ? { start: "none", end: "open", dashed: true, label }
            : { start: "none", end: "none", dashed: false, label };
      }
      case "state.transition":
        return {
          start: "none",
          end: "arrow",
          dashed: false,
          label: stateTransitionLabel(semantic),
        };
      case "bpmn.messageFlow":
        return {
          start: "circle",
          end: "triangle",
          dashed: true,
          label: text(semantic["name"]),
        };
      case "bpmn.association":
      case "bpmn.dataAssociation":
        return {
          start: "none",
          end: element.type === "bpmn.dataAssociation" ? "open" : "none",
          dashed: true,
          label: "",
        };
      case "bpmn.sequenceFlow":
        return {
          start: "none",
          end: "arrow",
          dashed: false,
          label: text(semantic["name"]),
        };
      default: {
        const heads = record(semantic["arrowheads"]);
        return {
          start: text(heads["start"]) || "none",
          end: text(heads["end"]) || "arrow",
          dashed: false,
          label,
        };
      }
    }
  }
}

/** Serialize a nodetto document as an uncompressed draw.io file. */
export function exportDrawio(
  document: Document,
  options: DrawioExportOptions = {},
): DrawioExportReport {
  const warnings: DrawioExportWarning[] = [];
  const wanted = options.pageIds ? new Set(options.pageIds) : null;
  const pages = [...document.pages]
    .sort(comparePageOrder)
    .filter((page) => !wanted || wanted.has(page.id));
  const diagrams = pages.map((page) => {
    const fallbacks = new Map<string, number>();
    const writer = new PageWriter(warnings, fallbacks);
    const elements = document.elements
      .filter((element) => element.page === page.id)
      .sort((left, right) =>
        left.index < right.index
          ? -1
          : left.index > right.index
            ? 1
            : left.id < right.id
              ? -1
              : 1,
      );
    const edges: Element[] = [];
    for (const element of elements) {
      const category = getElementTypeDefinition(element.type)?.category;
      if (SILENT_TYPES.has(element.type) || category === "resource") continue;
      if (category === "edge") {
        if (element.type === "sequence.message")
          writer.fallback(element, "has no fixed geometry and was skipped");
        else edges.push(element);
        continue;
      }
      writer.node(element);
    }
    const vertexCells = [...writer.cells];
    writer.cells.length = 0;
    for (const edge of edges) writer.edge(edge);
    for (const [key, count] of fallbacks)
      if (count > 1) {
        const [type, message] = key.split("\u0000");
        warnings.push({
          message: `${count - 1} more ${type} element(s) ${message}.`,
        });
      }
    return xml("diagram", { id: page.id, name: page.name }, [
      xml(
        "mxGraphModel",
        {
          grid: 1,
          gridSize: 10,
          guides: 1,
          tooltips: 1,
          connect: 1,
          arrows: 1,
          fold: 1,
          page: 0,
          pageScale: 1,
          math: 0,
          shadow: 0,
        },
        [
          xml("root", {}, [
            xml("mxCell", { id: "0" }),
            xml("mxCell", { id: "1", parent: "0" }),
            // Connectors paint beneath shapes in nodetto.
            ...writer.cells,
            ...vertexCells,
          ]),
        ],
      ),
    ]);
  });
  return {
    xml: serializeXml(
      xml("mxfile", { host: "nodetto", agent: "nodetto" }, diagrams),
    ),
    warnings,
  };
}
