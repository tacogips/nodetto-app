// Line-end marker artwork shared by the canvas and every exporter.

/** The line ends a connector is drawn with, independent of the renderer. */
export type MarkerKind =
  | "arrow"
  | "triangle"
  | "diamondOpen"
  | "diamondFilled"
  | "dot"
  | "openArrow"
  | "circle"
  | "bar"
  | "crowFoot";

/** How a marker part is painted: solid ink, surface with an ink rim, or ink line. */
export type MarkerPaint = "filled" | "hollow" | "line";

export interface MarkerPart {
  readonly element: "path" | "circle";
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly paint: MarkerPaint;
}

export interface MarkerGeometry {
  readonly viewBox: string;
  readonly refX: number;
  readonly refY: number;
  readonly width: number;
  readonly height: number;
  readonly parts: readonly MarkerPart[];
}

const DIAMOND_PATH = "M 0 5 L 8 0 L 16 5 L 8 10 z";

/**
 * Marker artwork shared by the canvas and every exporter, in user-space
 * units and drawn for the end of a connector: +x points along the line into
 * the shape, and `refX` is where the artwork touches the shape's border.
 */
export const MARKER_GEOMETRY: Readonly<Record<MarkerKind, MarkerGeometry>> = {
  arrow: {
    viewBox: "0 0 10 10",
    refX: 9,
    refY: 5,
    width: 8,
    height: 8,
    parts: [
      {
        element: "path",
        attributes: { d: "M 0 1 L 10 5 L 0 9 z" },
        paint: "filled",
      },
    ],
  },
  triangle: {
    viewBox: "0 0 12 12",
    refX: 11,
    refY: 6,
    width: 14,
    height: 14,
    parts: [
      {
        element: "path",
        attributes: { d: "M 0 0 L 12 6 L 0 12 z" },
        paint: "hollow",
      },
    ],
  },
  diamondOpen: {
    viewBox: "0 0 16 10",
    refX: 15.5,
    refY: 5,
    width: 16,
    height: 10,
    parts: [
      { element: "path", attributes: { d: DIAMOND_PATH }, paint: "hollow" },
    ],
  },
  diamondFilled: {
    viewBox: "0 0 16 10",
    refX: 15.5,
    refY: 5,
    width: 16,
    height: 10,
    parts: [
      { element: "path", attributes: { d: DIAMOND_PATH }, paint: "filled" },
    ],
  },
  dot: {
    viewBox: "0 0 8 8",
    refX: 4,
    refY: 4,
    width: 7,
    height: 7,
    parts: [
      {
        element: "circle",
        attributes: { cx: 4, cy: 4, r: 3 },
        paint: "filled",
      },
    ],
  },
  openArrow: {
    viewBox: "0 0 12 12",
    refX: 11,
    refY: 6,
    width: 12,
    height: 12,
    parts: [
      {
        element: "path",
        attributes: { d: "M 1 1 L 11 6 L 1 11" },
        paint: "line",
      },
    ],
  },
  circle: {
    viewBox: "0 0 10 10",
    refX: 9.5,
    refY: 5,
    width: 10,
    height: 10,
    parts: [
      {
        element: "circle",
        attributes: { cx: 5, cy: 5, r: 4 },
        paint: "hollow",
      },
    ],
  },
  bar: {
    viewBox: "0 0 6 14",
    refX: 3,
    refY: 7,
    width: 6,
    height: 14,
    parts: [
      { element: "path", attributes: { d: "M 3 0 L 3 14" }, paint: "line" },
    ],
  },
  crowFoot: {
    viewBox: "0 0 14 14",
    refX: 14,
    refY: 7,
    width: 14,
    height: 14,
    parts: [
      {
        element: "path",
        attributes: { d: "M 0 7 L 14 0 M 0 7 L 14 7 M 0 7 L 14 14" },
        paint: "line",
      },
    ],
  },
};

export type MarkerEnd = "start" | "end";

/**
 * One marker element for one connector end. `orient="auto-start-reverse"` is
 * not implemented by every SVG renderer the exports reach (resvg ignores
 * it), so the start-side variant is pre-mirrored and both use plain `auto`.
 */
export interface MarkerVariant {
  readonly id: string;
  readonly refX: number;
  /** Mirror applied to the parts of a start-side marker. */
  readonly transform?: string;
}

export function markerVariant(kind: MarkerKind, end: MarkerEnd): MarkerVariant {
  const geometry = MARKER_GEOMETRY[kind];
  if (end === "end") return { id: MARKER_IDS[kind], refX: geometry.refX };
  const width = Number(geometry.viewBox.split(" ")[2]);
  return {
    id: `${MARKER_IDS[kind]}-start`,
    refX: width - geometry.refX,
    transform: `translate(${width} 0) scale(-1 1)`,
  };
}

/** Stable SVG ids for each marker kind; renderers may add a prefix. */
export const MARKER_IDS: Readonly<Record<MarkerKind, string>> = {
  arrow: "nodetto-arrow",
  triangle: "nodetto-triangle",
  diamondOpen: "nodetto-diamond-open",
  diamondFilled: "nodetto-diamond-filled",
  dot: "nodetto-dot",
  openArrow: "nodetto-open-arrow",
  circle: "nodetto-circle",
  bar: "nodetto-bar",
  crowFoot: "nodetto-crow-foot",
};
