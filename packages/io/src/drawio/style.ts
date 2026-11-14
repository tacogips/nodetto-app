// draw.io style strings and the shape vocabulary shared by import and export.
//
// A draw.io cell style is `name;key=value;key=value;`: bare tokens are named
// styles (`ellipse`, `rhombus`, `text`, `swimlane`), and keyed entries carry
// shape and paint settings. Keys are case-sensitive and later entries win.

import type { GeoKind } from "@nodetto/ir";

export interface DrawioStyle {
  /** Bare named-style tokens, in order. */
  readonly names: readonly string[];
  readonly values: ReadonlyMap<string, string>;
}

export function parseStyle(source: string | undefined): DrawioStyle {
  const names: string[] = [];
  const values = new Map<string, string>();
  for (const raw of (source ?? "").split(";")) {
    const entry = raw.trim();
    if (!entry) continue;
    const equals = entry.indexOf("=");
    if (equals < 0) names.push(entry);
    else values.set(entry.slice(0, equals).trim(), entry.slice(equals + 1));
  }
  return { names, values };
}

/** Serialize entries in order; `undefined` values are skipped. */
export function formatStyle(
  names: readonly string[],
  entries: readonly (readonly [string, string | number | undefined])[],
): string {
  return [
    ...names,
    ...entries.flatMap(([key, value]) =>
      value === undefined ? [] : [`${key}=${value}`],
    ),
  ]
    .map((entry) => `${entry};`)
    .join("");
}

export function styleNumber(
  style: DrawioStyle,
  key: string,
): number | undefined {
  const raw = style.values.get(key);
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function styleFlag(style: DrawioStyle, key: string): boolean {
  const raw = style.values.get(key);
  return raw !== undefined && raw !== "0" && raw !== "false";
}

/** A CSS-safe colour, or `undefined` for draw.io's `none`/`default`/junk. */
export function styleColor(
  style: DrawioStyle,
  key: string,
): string | "none" | undefined {
  const raw = style.values.get(key)?.trim();
  if (!raw || raw === "default" || raw === "inherit") return undefined;
  if (raw === "none") return "none";
  if (/^#[\da-f]{3}$/i.test(raw) || /^#[\da-f]{6}$/i.test(raw))
    return raw.toLowerCase();
  if (/^#[\da-f]{8}$/i.test(raw)) return raw.slice(0, 7).toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(raw);
  if (rgb)
    return `#${rgb
      .slice(1, 4)
      .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0"))
      .join("")}`;
  return NAMED_COLORS[raw.toLowerCase()];
}

const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  gray: "#808080",
  grey: "#808080",
  orange: "#ffa500",
  purple: "#800080",
  transparent: "none",
};

/** Natural pointing direction of a shape as drawn in draw.io. */
export type DrawioDirection = "north" | "east" | "south" | "west";

export interface DrawioShape {
  readonly geo: GeoKind;
  /** draw.io's default direction for this shape, when it is directional. */
  readonly direction?: DrawioDirection;
  /** The nodetto kind is the closest match rather than the same symbol. */
  readonly approximate?: boolean;
}

/**
 * draw.io shape names (the `shape=` value or a named style) onto geo kinds.
 * Flowchart stencils from the `mxgraph.flowchart` library map by meaning.
 */
export const DRAWIO_SHAPES: Readonly<Record<string, DrawioShape>> = {
  rect: { geo: "rect" },
  rectangle: { geo: "rect" },
  label: { geo: "rect" },
  ellipse: { geo: "ellipse" },
  doubleEllipse: { geo: "ellipse" },
  rhombus: { geo: "diamond" },
  triangle: { geo: "triangle", direction: "east" },
  hexagon: { geo: "hexagon" },
  parallelogram: { geo: "parallelogram" },
  trapezoid: { geo: "trapezoid" },
  cylinder: { geo: "cylinder" },
  cylinder2: { geo: "cylinder" },
  cylinder3: { geo: "cylinder" },
  datastore: { geo: "cylinder" },
  cloud: { geo: "cloud" },
  document: { geo: "document" },
  tape: { geo: "tape" },
  dataStorage: { geo: "stored-data" },
  display: { geo: "display" },
  loopLimit: { geo: "loop-limit" },
  collate: { geo: "collate" },
  sortShape: { geo: "sort" },
  sumEllipse: { geo: "summing-junction" },
  orEllipse: { geo: "or" },
  tapeData: { geo: "sequential-data" },
  doubleArrow: { geo: "double-arrow", direction: "east" },
  actor: { geo: "person" },
  umlActor: { geo: "actor" },
  mermaidPerson: { geo: "person" },
  folder: { geo: "package" },
  wedgeCallout: { geo: "callout" },
  ext: { geo: "rect", approximate: true },
  note: { geo: "note" },
  note2: { geo: "note" },
  cube: { geo: "cube" },
  card: { geo: "card" },
  process: { geo: "predefined-process" },
  process2: { geo: "predefined-process" },
  internalStorage: { geo: "internal-storage" },
  manualInput: { geo: "manual-input" },
  delay: { geo: "delay" },
  // draw.io's "And" gate is drawn with the same D outline as a delay.
  or: { geo: "delay" },
  offPageConnector: { geo: "off-page", direction: "south" },
  step: { geo: "chevron", direction: "east" },
  singleArrow: { geo: "arrow", direction: "east" },
  cross: { geo: "cross" },
  callout: { geo: "callout" },
  "mxgraph.basic.star": { geo: "star" },
  "mxgraph.basic.pentagon": { geo: "pentagon" },
  "mxgraph.basic.octagon2": { geo: "octagon" },
  "mxgraph.basic.octagon": { geo: "octagon" },
  "mxgraph.basic.orthogonal_triangle": { geo: "right-triangle" },
  "mxgraph.basic.4_point_star_2": { geo: "star", approximate: true },
  "mxgraph.basic.6_point_star": { geo: "star", approximate: true },
  "mxgraph.basic.8_point_star": { geo: "star", approximate: true },
  "mxgraph.arrows2.arrow": { geo: "arrow", direction: "east" },
  "mxgraph.flowchart.process": { geo: "rect" },
  "mxgraph.flowchart.decision": { geo: "diamond" },
  "mxgraph.flowchart.data": { geo: "parallelogram" },
  "mxgraph.flowchart.database": { geo: "cylinder" },
  "mxgraph.flowchart.document": { geo: "document" },
  "mxgraph.flowchart.document2": { geo: "document" },
  "mxgraph.flowchart.multi-document": { geo: "multi-document" },
  "mxgraph.flowchart.stored_data": { geo: "stored-data" },
  "mxgraph.flowchart.display": { geo: "display" },
  "mxgraph.flowchart.loop_limit": { geo: "loop-limit" },
  "mxgraph.flowchart.collate": { geo: "collate" },
  "mxgraph.flowchart.sort": { geo: "sort" },
  "mxgraph.flowchart.summing_junction": { geo: "summing-junction" },
  "mxgraph.flowchart.or_2": { geo: "or" },
  "mxgraph.flowchart.direct_data": { geo: "direct-data" },
  "mxgraph.flowchart.sequential_data": { geo: "sequential-data" },
  "mxgraph.flowchart.paper_tape": { geo: "tape" },
  "mxgraph.flowchart.extract_or_measurement": {
    geo: "triangle",
    direction: "north",
  },
  "mxgraph.flowchart.merge_or_storage": { geo: "triangle", direction: "south" },
  "mxgraph.flowchart.manual_operation": {
    geo: "trapezoid",
    direction: "south",
  },
  "mxgraph.flowchart.delay": { geo: "delay" },
  "mxgraph.flowchart.manual_input": { geo: "manual-input" },
  "mxgraph.flowchart.predefined_process": { geo: "predefined-process" },
  "mxgraph.flowchart.internal_storage": { geo: "internal-storage" },
  "mxgraph.flowchart.off-page_reference": { geo: "off-page" },
  "mxgraph.flowchart.card": { geo: "card" },
  "mxgraph.flowchart.preparation": { geo: "hexagon" },
  "mxgraph.flowchart.start_1": { geo: "ellipse" },
  "mxgraph.flowchart.start_2": { geo: "ellipse" },
  "mxgraph.flowchart.on-page_reference": { geo: "ellipse" },
  "mxgraph.flowchart.terminator": { geo: "rect" },
};

/**
 * Style key nodetto writes so its own shapes survive a draw.io round trip
 * exactly; draw.io keeps unknown keys untouched.
 */
export const NODETTO_GEO_KEY = "nodettoGeo";

/** draw.io arrow names onto nodetto arrowheads, honouring `*Fill=0`. */
export function arrowheadFor(
  name: string | undefined,
  filled: boolean,
): string | null {
  switch (name) {
    case undefined:
      return null;
    case "none":
    case "":
      return "none";
    case "classic":
    case "classicThin":
    case "block":
    case "blockThin":
      return filled ? "arrow" : "triangle";
    case "open":
    case "openThin":
    case "openAsync":
    case "async":
      return "open";
    case "oval":
    case "dot":
      return filled ? "dot" : "circle";
    case "diamond":
    case "diamondThin":
      return filled ? "diamond" : "diamond-open";
    case "dash":
    case "ERone":
    case "ERmandOne":
      return "bar";
    case "ERmany":
    case "ERoneToMany":
    case "ERzeroToMany":
      return "crow-foot";
    case "ERzeroToOne":
      return "circle";
    default:
      return "arrow";
  }
}

/** nodetto arrowheads onto draw.io arrow name and fill. */
export const DRAWIO_ARROWS: Readonly<Record<string, readonly [string, 0 | 1]>> =
  {
    none: ["none", 1],
    arrow: ["classic", 1],
    triangle: ["block", 0],
    dot: ["oval", 1],
    open: ["open", 1],
    diamond: ["diamond", 1],
    "diamond-open": ["diamond", 0],
    circle: ["oval", 0],
    bar: ["ERone", 1],
    "crow-foot": ["ERmany", 1],
  };

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Plain text of an HTML label: block breaks become newlines, tags drop. */
export function htmlLabelText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#")) {
        const code =
          entity[1]?.toLowerCase() === "x"
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n+$/, "");
}

/** HTML label for plain text, so draw.io keeps line breaks and wrapping. */
export function textToHtmlLabel(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}
