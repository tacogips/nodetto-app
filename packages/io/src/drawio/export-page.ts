// Per-page cell writer: vertices, stacked lists (ERD tables, UML classes)
// and connectors with their notation.

import {
  type ConnectorWaypoint,
  connectorWaypointToPage,
  type Element,
  type ErdTableSemantic,
  type GeoKind,
  stateTransitionLabel,
  type UmlClassSemantic,
} from "@nodetto/ir";
import type { XmlElement } from "../bpmn/xml.ts";
import {
  DRAWIO_ARROWS,
  formatStyle,
  NODETTO_GEO_KEY,
  textToHtmlLabel,
} from "./style.ts";
import {
  type Box,
  type DrawioExportWarning,
  type Entry,
  geometry,
  type Point,
  record,
  round,
  text,
  xml,
} from "./export-common.ts";
import { geoStyle, paintEntries } from "./export-shape-style.ts";

type Endpoint =
  | { readonly cell: string; readonly center: Point }
  | { readonly point: Point };

const ROW_HEIGHT = 26;
const PORT_ANCHORS: Readonly<Record<string, readonly [number, number]>> = {
  top: [0.5, 0],
  right: [1, 0.5],
  bottom: [0.5, 1],
  left: [0, 0.5],
};

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

export class PageWriter {
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
      case "usecase.node": {
        const kind = text(semantic["kind"]);
        const entries: Entry[] =
          kind === "actor"
            ? [
                ["shape", "umlActor"],
                ["verticalLabelPosition", "bottom"],
                ["verticalAlign", "top"],
              ]
            : kind === "system"
              ? [
                  ["rounded", 0],
                  ["fillColor", "none"],
                  ["verticalAlign", "top"],
                  ["container", 1],
                ]
              : [];
        this.vertex(
          element,
          box,
          textToHtmlLabel(text(semantic["name"])),
          formatStyle(kind === "usecase" ? ["ellipse"] : [], [
            ...entries,
            ...common,
            ...paint,
          ]),
        );
        return;
      }
      case "uml.component":
      case "uml.interface":
      case "uml.port": {
        const entries: Entry[] =
          element.type === "uml.component"
            ? [
                ["shape", "component"],
                ["align", "left"],
                ["spacingLeft", 36],
              ]
            : element.type === "uml.interface" &&
                text(semantic["kind"]) === "required"
              ? [["shape", "requiredInterface"]]
              : element.type === "uml.port"
                ? [["rounded", 0]]
                : [];
        const names =
          element.type === "uml.interface" &&
          text(semantic["kind"]) !== "required"
            ? ["ellipse"]
            : [];
        this.vertex(
          element,
          box,
          textToHtmlLabel(text(semantic["name"])),
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
      case "usecase.relationship": {
        const kind = text(semantic["kind"]);
        const stereotype =
          kind === "include"
            ? "«include»"
            : kind === "extend"
              ? "«extend»"
              : "";
        return {
          start: "none",
          end:
            kind === "generalization"
              ? "triangle"
              : stereotype
                ? "open"
                : "none",
          dashed: stereotype !== "",
          label: [stereotype, label].filter(Boolean).join("\n"),
        };
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
