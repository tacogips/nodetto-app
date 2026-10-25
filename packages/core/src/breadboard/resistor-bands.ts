import { parseComponentValue } from "@nodetto/ir";

export type BandColor =
  | "black"
  | "brown"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "violet"
  | "grey"
  | "white"
  | "gold"
  | "silver";

const DIGIT_COLORS: readonly BandColor[] = [
  "black",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "violet",
  "grey",
  "white",
];
const MULTIPLIER_COLORS: Readonly<Record<number, BandColor>> = {
  [-2]: "silver",
  [-1]: "gold",
  0: "black",
  1: "brown",
  2: "red",
  3: "orange",
  4: "yellow",
  5: "green",
  6: "blue",
  7: "violet",
  8: "grey",
  9: "white",
};
const TOLERANCE_COLORS: Readonly<Record<number, BandColor>> = {
  0.05: "grey",
  0.1: "violet",
  0.25: "blue",
  0.5: "green",
  1: "brown",
  2: "red",
  5: "gold",
  10: "silver",
};

function toleranceColor(tolerance: number | undefined): BandColor | undefined {
  if (tolerance === 20) return undefined;
  return TOLERANCE_COLORS[tolerance ?? 5];
}

export function resistorBands(
  value: string,
  bands: 4 | 5,
  tolerance?: number,
): readonly BandColor[] | null {
  const ohms = parseComponentValue(value);
  if (ohms === undefined || ohms < 0) return null;
  if (ohms === 0) return ["black"];

  const significantDigits = bands === 4 ? 2 : 3;
  const toleranceBand = toleranceColor(tolerance ?? (bands === 4 ? 5 : 1));
  if (tolerance !== 20 && toleranceBand === undefined) return null;

  for (let multiplier = -2; multiplier <= 9; multiplier += 1) {
    const scaled = ohms / 10 ** multiplier;
    const rounded = Math.round(scaled);
    const epsilon = Math.max(Math.abs(scaled), 1) * 1e-9;
    const minimum = 10 ** (significantDigits - 1);
    const maximum = 10 ** significantDigits - 1;
    if (
      Math.abs(scaled - rounded) > epsilon ||
      rounded < minimum ||
      rounded > maximum
    )
      continue;
    const digits = String(rounded)
      .padStart(significantDigits, "0")
      .split("")
      .map(Number);
    const digitBands = digits.map((digit) => DIGIT_COLORS[digit]);
    const multiplierBand = MULTIPLIER_COLORS[multiplier];
    if (digitBands.some((color) => color === undefined) || !multiplierBand)
      return null;
    const result: BandColor[] = [
      ...(digitBands as BandColor[]),
      multiplierBand,
    ];
    if (toleranceBand) result.push(toleranceBand);
    return result;
  }
  return null;
}
