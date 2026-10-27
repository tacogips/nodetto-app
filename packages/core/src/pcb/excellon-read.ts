// Excellon drill reader: holes and slots in millimetres, y pointing up.

import type { PcbPoint } from "./model.ts";

export interface DrillHole {
  readonly at: PcbPoint;
  readonly diameter: number;
}

/** A routed or G85 slot between two hole centres. */
export interface DrillSlot {
  readonly from: PcbPoint;
  readonly to: PcbPoint;
  readonly diameter: number;
}

export interface DrillImage {
  /** "plated", "nonPlated" or undefined when the file does not say. */
  readonly plating?: "plated" | "nonPlated";
  readonly holes: readonly DrillHole[];
  readonly slots: readonly DrillSlot[];
  readonly warnings: readonly string[];
}

export class ExcellonReadError extends Error {
  override readonly name = "ExcellonReadError";
}

const INCH = 25.4;

/** Rounds to nanometres, dropping unit-conversion noise. */
function nanometres(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** True when the text looks like an Excellon drill file. */
export function isExcellon(text: string): boolean {
  return /^\s*(?:;[^\n]*\n\s*)*M48[ \t]*(?:\r?\n|$)/.test(text);
}

/** Interprets an Excellon drill file. Throws ExcellonReadError when unreadable. */
export function readExcellon(text: string): DrillImage {
  if (!isExcellon(text))
    throw new ExcellonReadError("the file does not start with M48");
  const holes: DrillHole[] = [];
  const slots: DrillSlot[] = [];
  const warnings: string[] = [];
  const reported = new Set<string>();
  const warn = (message: string): void => {
    if (reported.has(message)) return;
    reported.add(message);
    warnings.push(message);
  };
  const tools = new Map<number, number>();
  let scale = 1;
  let unitsGiven = false;
  /** "leading": leading zeros kept (LZ); "trailing": trailing zeros kept (TZ). */
  let zeros: "leading" | "trailing" = "trailing";
  let integers: number | undefined;
  let decimals: number | undefined;
  let plating: DrillImage["plating"];
  let diameter: number | undefined;
  let incremental = false;
  let current: PcbPoint = { x: 0, y: 0 };
  let routing: { down: boolean; last?: PcbPoint } | undefined;
  let header = true;

  const number = (raw: string): number => {
    if (raw.includes(".")) return nanometres(Number(raw) * scale);
    const negative = raw.startsWith("-");
    let digits = raw.replace(/^[+-]/, "");
    const whole = integers ?? (scale === 1 ? 3 : 2);
    const fraction = decimals ?? (scale === 1 ? 3 : 4);
    if (zeros === "leading") digits = digits.padEnd(whole + fraction, "0");
    const value = nanometres((Number(digits) / 10 ** fraction) * scale);
    return negative ? -value : value;
  };
  const point = (x: string | undefined, y: string | undefined): PcbPoint => {
    const nx = x === undefined ? undefined : number(x);
    const ny = y === undefined ? undefined : number(y);
    if (incremental)
      return { x: current.x + (nx ?? 0), y: current.y + (ny ?? 0) };
    return { x: nx ?? current.x, y: ny ?? current.y };
  };
  const units = (line: string): void => {
    const [unit, ...rest] = line.split(",");
    scale = unit === "INCH" ? INCH : 1;
    unitsGiven = true;
    for (const part of rest) {
      if (part === "LZ") zeros = "leading";
      else if (part === "TZ") zeros = "trailing";
      else if (/^0*\.0*$/.test(part)) {
        const [whole = "", fraction = ""] = part.split(".");
        integers = whole.length;
        decimals = fraction.length;
      }
    }
  };
  const tool = (line: string): boolean => {
    const match = /^T0*(\d+)((?:[A-Z][-+\d.]+)*)$/.exec(line);
    if (!match?.[1]) return false;
    const code = Number(match[1]);
    const size = /C([\d.]+)/.exec(match[2] ?? "");
    if (size?.[1]) tools.set(code, nanometres(Number(size[1]) * scale));
    if (!header || !size) {
      diameter = code === 0 ? undefined : tools.get(code);
      if (code !== 0 && diameter === undefined)
        warn(`tool T${code} has no diameter`);
    }
    return true;
  };

  // A string separator: regular-expression splits are slow in some engines.
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    if (line.startsWith(";")) {
      const format =
        /FORMAT=\{?\s*(\d+):(\d+)/i.exec(line) ??
        /FILE_FORMAT=(\d+):(\d+)/i.exec(line);
      if (format?.[1] && format[2]) {
        integers = Number(format[1]);
        decimals = Number(format[2]);
      }
      if (
        /TF\.FileFunction,NonPlated/i.test(line) ||
        /TYPE=NON_PLATED/i.test(line)
      )
        plating = "nonPlated";
      else if (
        /TF\.FileFunction,Plated/i.test(line) ||
        /TYPE=PLATED/i.test(line)
      )
        plating = "plated";
      continue;
    }
    if (header) {
      if (line === "%" || line === "M95") header = false;
      else if (/^(METRIC|INCH)\b/.test(line)) units(line);
      else if (line === "M71") scale = 1;
      else if (line === "M72") scale = INCH;
      else if (
        !tool(line) &&
        !/^(M48|FMAT,\d|VER,\d|ICI,(ON|OFF)|G9[01]|DETECT,ON|ATC,ON)/.test(line)
      )
        warn(`header line "${line}" is not supported`);
      continue;
    }
    if (line === "M30" || line === "M00") break;
    if (line === "G90") {
      incremental = false;
      continue;
    }
    if (line === "G91") {
      incremental = true;
      continue;
    }
    if (line === "M71" || line === "METRIC") {
      scale = 1;
      continue;
    }
    if (line === "M72" || line === "INCH") {
      scale = INCH;
      continue;
    }
    if (/^G0?5$|^G81$/.test(line)) {
      routing = undefined;
      continue;
    }
    if (line === "M15" && routing) {
      routing.down = true;
      continue;
    }
    if ((line === "M16" || line === "M17") && routing) {
      routing.down = false;
      continue;
    }
    if (tool(line)) continue;
    const slot =
      /^(?:X([-+\d.]+))?(?:Y([-+\d.]+))?G85(?:X([-+\d.]+))?(?:Y([-+\d.]+))?$/.exec(
        line,
      );
    if (slot) {
      const from = point(slot[1], slot[2]);
      current = from;
      const to = point(slot[3], slot[4]);
      current = to;
      if (diameter !== undefined) slots.push({ from, to, diameter });
      continue;
    }
    const move =
      /^(G0?[0-3])?(?:X([-+\d.]+))?(?:Y([-+\d.]+))?(?:I([-+\d.]+)|A([-+\d.]+))?$/.exec(
        line,
      );
    if (move && (move[2] !== undefined || move[3] !== undefined || move[1])) {
      const mode = move[1]?.replace("G0", "G");
      if (mode === "G0") routing = { down: false };
      if (mode === "G2" || mode === "G3")
        warn("routed arcs (G02/G03) are drawn as straight slots");
      if (move[2] === undefined && move[3] === undefined) continue;
      const at = point(move[2], move[3]);
      if (routing && mode !== "G0") {
        if (routing.down && diameter !== undefined)
          slots.push({ from: routing.last ?? current, to: at, diameter });
      } else if (routing) {
        routing.last = at;
      } else if (diameter === undefined)
        warn("hole before any tool is selected");
      else holes.push({ at, diameter });
      if (routing) routing.last = at;
      current = at;
      continue;
    }
    warn(`line "${line}" is not supported`);
  }
  if (!unitsGiven) warn("no METRIC or INCH header; assuming millimetres");
  return { ...(plating ? { plating } : {}), holes, slots, warnings };
}
