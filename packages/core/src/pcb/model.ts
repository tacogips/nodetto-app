// A board-agnostic PCB description, the input of the fabrication writers.
//
// Everything in this folder depends only on files in this folder, so it can
// move into its own package. Units are millimetres with the origin at the
// board's bottom-left corner as seen from the top, y pointing up.

export interface PcbPoint {
  readonly x: number;
  readonly y: number;
}

export type PadShape = "circle" | "square";

/** Sizes shared by every pad, hole and legend stroke of one design. */
export interface PcbDesignRules {
  /** Copper pad diameter, or side for a square pad. */
  readonly pad: number;
  /** Solder mask opening diameter, or side for a square pad. */
  readonly maskOpening: number;
  /** Plated hole diameter. */
  readonly drill: number;
  /** Silkscreen line width. */
  readonly legendLine: number;
  /** Board outline line width. */
  readonly edgeLine: number;
}

/** A plated through hole with a pad on both copper layers. */
export interface PcbPad {
  readonly at: PcbPoint;
  readonly shape: PadShape;
}

export interface PcbTrace {
  readonly width: number;
  readonly points: readonly PcbPoint[];
}

export interface PcbLegendStroke {
  readonly points: readonly PcbPoint[];
  /**
   * Strokes that share a group are kept or dropped together when the outline
   * is trimmed (a board label, say). Ungrouped strokes belong to the design
   * and decide the trimmed outline.
   */
  readonly group?: number;
}

export interface PcbDesign {
  /** Rectangular outline size. */
  readonly width: number;
  readonly height: number;
  readonly rules: PcbDesignRules;
  readonly pads: readonly PcbPad[];
  readonly topTraces: readonly PcbTrace[];
  readonly bottomTraces: readonly PcbTrace[];
  /** Top silkscreen, already clear of pads and of the board edge. */
  readonly legend: readonly PcbLegendStroke[];
}

export interface PcbFile {
  readonly path: string;
  readonly text: string;
}
