/** sRGB channels in the range 0 to 255. */
export type Rgb = readonly [red: number, green: number, blue: number];

export const CAD_THEME_TOKENS = {
  background: "--nodetto-canvas-bg",
  grid: "--nodetto-canvas-grid",
  body: "--nodetto-canvas-ruler-surface",
  line: "--nodetto-canvas-ruler-text",
  highlight: "--nodetto-canvas-overlay",
} as const;

export interface CadTheme {
  readonly background: Rgb;
  readonly grid: Rgb;
  readonly body: Rgb;
  readonly line: Rgb;
  readonly highlight: Rgb;
}

const CSS_NUMBER = /^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?$/i;

export function parseCssColor(text: string): Rgb | null {
  const value = text.trim();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value)?.[1];
  if (hex !== undefined) {
    const packed = Number.parseInt(hex, 16);
    if (hex.length === 3) {
      return [
        ((packed >> 8) & 15) * 17,
        ((packed >> 4) & 15) * 17,
        (packed & 15) * 17,
      ];
    }
    return [packed >> 16, (packed >> 8) & 255, packed & 255];
  }

  const rgb = /^rgb\(([^()]*)\)$/i.exec(value)?.[1];
  if (rgb === undefined) return null;
  const channels = rgb.includes(",")
    ? rgb.split(",").map((channel) => channel.trim())
    : rgb.trim().split(/\s+/);
  if (
    channels.length !== 3 ||
    !channels.every((channel) => CSS_NUMBER.test(channel))
  ) {
    return null;
  }
  const [red, green, blue] = channels.map(Number);
  return [red, green, blue].every((channel) => channel >= 0 && channel <= 255)
    ? [red, green, blue]
    : null;
}

export function readCadTheme(read: (token: string) => string): CadTheme {
  function parse(token: string): Rgb {
    const color = parseCssColor(read(token));
    if (color === null)
      throw new Error(`Invalid CAD canvas color for ${token}`);
    return color;
  }

  return {
    background: parse(CAD_THEME_TOKENS.background),
    grid: parse(CAD_THEME_TOKENS.grid),
    body: parse(CAD_THEME_TOKENS.body),
    line: parse(CAD_THEME_TOKENS.line),
    highlight: parse(CAD_THEME_TOKENS.highlight),
  };
}

function linearChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb): number {
  return (
    0.2126 * linearChannel(red) +
    0.7152 * linearChannel(green) +
    0.0722 * linearChannel(blue)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
