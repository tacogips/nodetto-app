// Gerber RS-274X writer with X2 file attributes, for PCB image layers.
// Coordinates are millimetres with y pointing up.

import type { PadShape, PcbPoint } from "./model.ts";

export type GerberApertureShape =
  | { readonly kind: "circle"; readonly diameter: number }
  | {
      readonly kind: "rectangle";
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "obround";
      readonly width: number;
      readonly height: number;
    };

export interface GerberContourSegment {
  readonly to: PcbPoint;
  readonly arc?: { readonly center: PcbPoint; readonly clockwise: boolean };
}

export interface GerberRegionContour {
  readonly start: PcbPoint;
  readonly segments: readonly GerberContourSegment[];
}

/** Gerber 4.6 format: integer nanometres. */
function coordinate(value: number): string {
  return String(Math.round(value * 1_000_000));
}

function millimetres(value: number): string {
  return value.toFixed(6);
}

function xy(point: PcbPoint): string {
  return `X${coordinate(point.x)}Y${coordinate(point.y)}`;
}

/** One Gerber image layer, built with flashes and strokes. */
export class GerberLayer {
  private readonly apertures = new Map<string, number>();
  private readonly body: string[] = [];
  private selected: number | undefined;
  private multiQuadrant = false;

  constructor(
    private readonly fileFunction: string,
    private readonly polarity: "Positive" | "Negative" = "Positive",
  ) {}

  private use(template: string): void {
    let code = this.apertures.get(template);
    if (code === undefined) {
      code = 10 + this.apertures.size;
      this.apertures.set(template, code);
    }
    if (this.selected === code) return;
    this.body.push(`D${code}*`);
    this.selected = code;
  }

  private beginArc(clockwise: boolean): void {
    if (!this.multiQuadrant) {
      this.body.push("G75*");
      this.multiQuadrant = true;
    }
    this.body.push(clockwise ? "G02*" : "G03*");
  }

  private arcBlock(
    from: PcbPoint,
    to: PcbPoint,
    center: PcbPoint,
    clockwise: boolean,
  ): void {
    this.beginArc(clockwise);
    // Gerber I/J are offsets from the start point, rounded independently like X/Y.
    this.body.push(
      `${xy(to)}I${coordinate(center.x - from.x)}J${coordinate(center.y - from.y)}D01*`,
      "G01*",
    );
  }

  /** A pad: a circle of `size` diameter, or a square of `size` sides. */
  flash(shape: PadShape, size: number, at: PcbPoint): void {
    this.use(
      shape === "circle"
        ? `C,${millimetres(size)}`
        : `R,${millimetres(size)}X${millimetres(size)}`,
    );
    this.body.push(`${xy(at)}D03*`);
  }

  /** Flash a standard circle, rectangle, or obround aperture. */
  flashAperture(aperture: GerberApertureShape, at: PcbPoint): void {
    const template =
      aperture.kind === "circle"
        ? `C,${millimetres(aperture.diameter)}`
        : `${aperture.kind === "rectangle" ? "R" : "O"},${millimetres(aperture.width)}X${millimetres(aperture.height)}`;
    this.use(template);
    this.body.push(`${xy(at)}D03*`);
  }

  /** Fill one or more contours, optionally using circular arc segments. */
  region(contours: readonly GerberRegionContour[]): void {
    // Regions do not use an aperture, but independent readers expect a selection.
    if (this.selected === undefined) this.use(`C,${millimetres(0.01)}`);
    this.body.push("G36*");
    for (const contour of contours) {
      this.body.push(`${xy(contour.start)}D02*`);
      let from = contour.start;
      for (const segment of contour.segments) {
        if (segment.arc)
          this.arcBlock(
            from,
            segment.to,
            segment.arc.center,
            segment.arc.clockwise,
          );
        else this.body.push(`${xy(segment.to)}D01*`);
        from = segment.to;
      }
    }
    this.body.push("G37*");
  }

  /** Draw a circular arc using a round aperture `width` wide. */
  arc(
    width: number,
    from: PcbPoint,
    to: PcbPoint,
    center: PcbPoint,
    clockwise: boolean,
  ): void {
    this.use(`C,${millimetres(width)}`);
    this.body.push(`${xy(from)}D02*`);
    this.arcBlock(from, to, center, clockwise);
  }

  /** A polyline drawn with a round aperture `width` wide. */
  stroke(width: number, points: readonly PcbPoint[]): void {
    const [first, ...rest] = points;
    if (!first || rest.length === 0) return;
    this.use(`C,${millimetres(width)}`);
    this.body.push(`${xy(first)}D02*`);
    for (const point of rest) this.body.push(`${xy(point)}D01*`);
  }

  get empty(): boolean {
    return this.body.length === 0;
  }

  text(generator: string): string {
    const apertures = [...this.apertures].map(
      ([template, code]) => `%ADD${code}${template}*%`,
    );
    return [
      `%TF.GenerationSoftware,${generator}*%`,
      "%TF.SameCoordinates,Original*%",
      `%TF.FileFunction,${this.fileFunction}*%`,
      `%TF.FilePolarity,${this.polarity}*%`,
      "%FSLAX46Y46*%",
      "%MOMM*%",
      "%LPD*%",
      "G01*",
      ...apertures,
      ...this.body,
      "M02*",
      "",
    ].join("\n");
  }
}
