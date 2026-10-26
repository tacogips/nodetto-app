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

/** One Gerber image layer, built with flashes and strokes. */
export class GerberLayer {
  private readonly apertures = new Map<string, number>();
  private readonly body: string[] = [];
  private selected: number | undefined;

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

  /** A pad: a circle of `size` diameter, or a square of `size` sides. */
  flash(shape: PadShape, size: number, at: PcbPoint): void {
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
