// Gerber RS-274X writer with X2 file attributes, for PCB image layers.
// Coordinates are millimetres with y pointing up.

import type { PadShape, PcbPoint } from "./model.ts";

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

/**
 * One edge of a region: a straight line to `to`, or with `center` a circular
 * arc around it, clockwise or counterclockwise with y pointing up.
 */
export interface RegionSegment {
  readonly to: PcbPoint;
  readonly center?: PcbPoint;
  readonly clockwise?: boolean;
}

/** One Gerber image layer, built with flashes and strokes. */
export class GerberLayer {
  private readonly apertures = new Map<string, number>();
  private readonly body: string[] = [];
  private selected: number | undefined;
  private currentPolarity: "dark" | "clear" = "dark";
  private mode: "G01" | "G02" | "G03" = "G01";
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

  private setPolarity(polarity: "dark" | "clear"): void {
    if (polarity === this.currentPolarity) return;
    this.body.push(polarity === "dark" ? "%LPD*%" : "%LPC*%");
    this.currentPolarity = polarity;
  }

  private setMode(mode: "G01" | "G02" | "G03"): void {
    if (mode === this.mode) return;
    this.body.push(`${mode}*`);
    this.mode = mode;
  }

  /** A pad: a circle of `size` diameter, or a square of `size` sides. */
  flash(shape: PadShape, size: number, at: PcbPoint): void {
    this.setPolarity("dark");
    this.use(
      shape === "circle"
        ? `C,${millimetres(size)}`
        : `R,${millimetres(size)}X${millimetres(size)}`,
    );
    this.body.push(`${xy(at)}D03*`);
  }

  /** A polyline drawn with a round aperture `width` wide. */
  stroke(width: number, points: readonly PcbPoint[]): void {
    const [first, ...rest] = points;
    if (!first || rest.length === 0) return;
    this.setPolarity("dark");
    this.setMode("G01");
    this.use(`C,${millimetres(width)}`);
    this.body.push(`${xy(first)}D02*`);
    for (const point of rest) this.body.push(`${xy(point)}D01*`);
  }

  /** A path of lines and arcs drawn with a round aperture `width` wide. */
  path(
    width: number,
    start: PcbPoint,
    segments: readonly RegionSegment[],
  ): void {
    if (segments.length === 0) return;
    this.setPolarity("dark");
    this.use(`C,${millimetres(width)}`);
    this.body.push(`${xy(start)}D02*`);
    this.trace(start, segments);
  }

  private trace(start: PcbPoint, segments: readonly RegionSegment[]): void {
    let from = start;
    for (const segment of segments) {
      if (segment.center) {
        if (!this.multiQuadrant) {
          this.body.push("G75*");
          this.multiQuadrant = true;
        }
        this.setMode(segment.clockwise ? "G02" : "G03");
        this.body.push(
          `${xy(segment.to)}I${coordinate(segment.center.x - from.x)}J${coordinate(segment.center.y - from.y)}D01*`,
        );
      } else {
        this.setMode("G01");
        this.body.push(`${xy(segment.to)}D01*`);
      }
      from = segment.to;
    }
  }

  /**
   * A filled area (G36/G37 region) from `start` along `segments` back to
   * `start`. Clear polarity removes it from everything drawn before; the
   * layer stays clear until set dark again.
   */
  region(
    start: PcbPoint,
    segments: readonly RegionSegment[],
    polarity: "dark" | "clear" = "dark",
  ): void {
    if (segments.length < 2) return;
    this.setPolarity(polarity);
    this.body.push("G36*", `${xy(start)}D02*`);
    this.trace(start, segments);
    this.body.push("G37*");
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
