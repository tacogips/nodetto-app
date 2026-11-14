// Gerber RS-274X reader. It interprets a Gerber file into the graphics
// objects it draws (flashes, draws, arcs and regions), in file order with
// their polarity, in millimetres with y pointing up. Geometry lives in
// gerber-outline.ts.

import type { PcbPoint } from "./model.ts";

/** One primitive of an aperture macro, with its expressions evaluated. */
export type MacroPrimitive =
  | {
      readonly kind: "circle";
      readonly exposure: boolean;
      readonly diameter: number;
      readonly center: PcbPoint;
      readonly rotation: number;
    }
  | {
      readonly kind: "vectorLine";
      readonly exposure: boolean;
      readonly width: number;
      readonly start: PcbPoint;
      readonly end: PcbPoint;
      readonly rotation: number;
    }
  | {
      readonly kind: "centerLine";
      readonly exposure: boolean;
      readonly width: number;
      readonly height: number;
      readonly center: PcbPoint;
      readonly rotation: number;
    }
  | {
      readonly kind: "outline";
      readonly exposure: boolean;
      readonly points: readonly PcbPoint[];
      readonly rotation: number;
    }
  | {
      readonly kind: "polygon";
      readonly exposure: boolean;
      readonly vertices: number;
      readonly center: PcbPoint;
      readonly diameter: number;
      readonly rotation: number;
    }
  | {
      readonly kind: "thermal";
      readonly center: PcbPoint;
      readonly outer: number;
      readonly inner: number;
      readonly gap: number;
      readonly rotation: number;
    };

/** A standard aperture's optional round hole; it is clear, not drawn. */
export type GerberAperture =
  | {
      readonly kind: "circle";
      readonly diameter: number;
      readonly hole?: number;
    }
  | {
      readonly kind: "rectangle";
      readonly width: number;
      readonly height: number;
      readonly hole?: number;
    }
  | {
      readonly kind: "obround";
      readonly width: number;
      readonly height: number;
      readonly hole?: number;
    }
  | {
      readonly kind: "polygon";
      readonly diameter: number;
      readonly vertices: number;
      readonly rotation: number;
      readonly hole?: number;
    }
  | {
      readonly kind: "macro";
      readonly name: string;
      readonly primitives: readonly MacroPrimitive[];
    };

export type GerberPolarity = "dark" | "clear";

/** A circular arc from the previous point; `clockwise` as seen from the top. */
export interface GerberArc {
  readonly center: PcbPoint;
  readonly clockwise: boolean;
}

export interface GerberSegment {
  readonly to: PcbPoint;
  readonly arc?: GerberArc;
}

export interface GerberContour {
  readonly start: PcbPoint;
  readonly segments: readonly GerberSegment[];
}

export type GerberObject =
  | {
      readonly kind: "flash";
      readonly polarity: GerberPolarity;
      readonly aperture: GerberAperture;
      readonly at: PcbPoint;
    }
  | {
      readonly kind: "draw";
      readonly polarity: GerberPolarity;
      readonly aperture: GerberAperture;
      readonly from: PcbPoint;
      readonly to: PcbPoint;
      readonly arc?: GerberArc;
    }
  | {
      readonly kind: "region";
      readonly polarity: GerberPolarity;
      readonly contours: readonly GerberContour[];
    };

export interface GerberImage {
  /** `%TF` file attributes (and KiCad's `G04 #@! TF.` comments), by name. */
  readonly attributes: ReadonlyMap<string, readonly string[]>;
  readonly objects: readonly GerberObject[];
  /** Unsupported or malformed content that was skipped. */
  readonly warnings: readonly string[];
}

export class GerberReadError extends Error {
  override readonly name = "GerberReadError";
}

const INCH = 25.4;

/** Gerber's finest step is a nanometre; rounding there drops unit-conversion noise. */
function nanometres(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

interface CoordinateFormat {
  readonly integers: number;
  readonly decimals: number;
  readonly trailingZerosOmitted: boolean;
  readonly incremental: boolean;
}

type Interpolation = "linear" | "clockwise" | "counterclockwise";

/** Splits a Gerber file into data blocks and `%` extended commands. */
function* blocks(
  text: string,
): Generator<{ readonly extended: boolean; readonly body: string }> {
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === "%") {
      const end = text.indexOf("%", index + 1);
      if (end < 0) throw new GerberReadError("unterminated % extended command");
      yield { extended: true, body: text.slice(index + 1, end) };
      index = end + 1;
    } else if (char === "\r" || char === "\n" || char === " " || char === "\t")
      index += 1;
    else {
      const end = text.indexOf("*", index);
      if (end < 0) {
        if (text.slice(index).trim())
          throw new GerberReadError("data block without a closing *");
        return;
      }
      yield { extended: false, body: text.slice(index, end) };
      index = end + 1;
    }
  }
}

/** Arithmetic of aperture macro expressions: + - x / and parentheses. */
function evaluate(expression: string, variables: Map<number, number>): number {
  const source = expression.replace(/\s+/g, "").replace(/X/g, "x");
  let position = 0;
  const fail = (): never => {
    throw new GerberReadError(`invalid macro expression "${expression}"`);
  };
  const primary = (): number => {
    const char = source[position];
    if (char === "(") {
      position += 1;
      const value = sum();
      if (source[position] !== ")") fail();
      position += 1;
      return value;
    }
    if (char === "-" || char === "+") {
      position += 1;
      const value = primary();
      return char === "-" ? -value : value;
    }
    if (char === "$") {
      const match = /^\$(\d+)/.exec(source.slice(position));
      if (!match?.[1]) return fail();
      position += match[0].length;
      return variables.get(Number(match[1])) ?? 0;
    }
    const match = /^(\d+\.?\d*|\.\d+)/.exec(source.slice(position));
    if (!match?.[1]) return fail();
    position += match[0].length;
    return Number(match[1]);
  };
  const product = (): number => {
    let value = primary();
    for (;;) {
      const char = source[position];
      if (char !== "x" && char !== "/") return value;
      position += 1;
      const right = primary();
      value = char === "x" ? value * right : value / right;
    }
  };
  const sum = (): number => {
    let value = product();
    for (;;) {
      const char = source[position];
      if (char !== "+" && char !== "-") return value;
      position += 1;
      const right = product();
      value = char === "+" ? value + right : value - right;
    }
  };
  const value = sum();
  if (position !== source.length) fail();
  return value;
}

/** An `%AM` body: its primitive and variable-definition statements. */
type MacroTemplate = readonly string[];

function instantiate(
  name: string,
  template: MacroTemplate,
  parameters: readonly number[],
  scale: number,
  warn: (message: string) => void,
): GerberAperture {
  const variables = new Map(
    parameters.map((value, index) => [index + 1, value]),
  );
  const primitives: MacroPrimitive[] = [];
  for (const statement of template) {
    const assignment = /^\$(\d+)=(.+)$/.exec(statement);
    if (assignment?.[1] && assignment[2] !== undefined) {
      variables.set(Number(assignment[1]), evaluate(assignment[2], variables));
      continue;
    }
    const [code, ...rest] = statement.split(",");
    const values = rest.map((part) => evaluate(part, variables));
    const value = (index: number): number => values[index] ?? 0;
    const length = (index: number): number => value(index) * scale;
    const point = (index: number): PcbPoint => ({
      x: length(index),
      y: length(index + 1),
    });
    const exposure = value(0) !== 0;
    switch (code) {
      case "1":
        primitives.push({
          kind: "circle",
          exposure,
          diameter: length(1),
          center: point(2),
          rotation: value(4),
        });
        break;
      case "2":
      case "20":
        primitives.push({
          kind: "vectorLine",
          exposure,
          width: length(1),
          start: point(2),
          end: point(4),
          rotation: value(6),
        });
        break;
      case "21":
        primitives.push({
          kind: "centerLine",
          exposure,
          width: length(1),
          height: length(2),
          center: point(3),
          rotation: value(5),
        });
        break;
      case "4": {
        const count = Math.round(value(1));
        const points: PcbPoint[] = [];
        for (let index = 0; index <= count; index++)
          points.push(point(2 + index * 2));
        primitives.push({
          kind: "outline",
          exposure,
          points,
          rotation: value(2 + (count + 1) * 2),
        });
        break;
      }
      case "5":
        primitives.push({
          kind: "polygon",
          exposure,
          vertices: Math.round(value(1)),
          center: point(2),
          diameter: length(4),
          rotation: value(5),
        });
        break;
      case "7":
        primitives.push({
          kind: "thermal",
          center: { x: value(0) * scale, y: value(1) * scale },
          outer: length(2),
          inner: length(3),
          gap: length(4),
          rotation: value(5),
        });
        break;
      default:
        warn(`aperture macro ${name}: primitive ${code} is not supported`);
    }
  }
  return { kind: "macro", name, primitives };
}

function standardAperture(
  template: string,
  parameters: readonly number[],
): GerberAperture | undefined {
  const [first = 0, second = 0, third, fourth] = parameters;
  switch (template) {
    case "C":
      return {
        kind: "circle",
        diameter: first,
        ...(second > 0 ? { hole: second } : {}),
      };
    case "R":
    case "O":
      return {
        kind: template === "R" ? "rectangle" : "obround",
        width: first,
        height: second,
        ...(third !== undefined && third > 0 ? { hole: third } : {}),
      };
    case "P":
      return {
        kind: "polygon",
        diameter: first,
        vertices: Math.round(second),
        rotation: third ?? 0,
        ...(fourth !== undefined && fourth > 0 ? { hole: fourth } : {}),
      };
    default:
      return undefined;
  }
}

/** Interprets a Gerber RS-274X file. Throws GerberReadError when unreadable. */
export function readGerber(text: string): GerberImage {
  const attributes = new Map<string, readonly string[]>();
  const objects: GerberObject[] = [];
  const warnings: string[] = [];
  const reported = new Set<string>();
  const warn = (message: string): void => {
    if (reported.has(message)) return;
    reported.add(message);
    warnings.push(message);
  };
  const macros = new Map<string, MacroTemplate>();
  const apertures = new Map<number, GerberAperture>();
  let format: CoordinateFormat | undefined;
  let scale: number | undefined;
  let polarity: GerberPolarity = "dark";
  let interpolation: Interpolation = "linear";
  let multiQuadrant: boolean | undefined;
  let aperture: GerberAperture | undefined;
  let current: PcbPoint = { x: 0, y: 0 };
  let region: GerberContour[] | undefined;
  let contour: { start: PcbPoint; segments: GerberSegment[] } | undefined;
  let ended = false;
  let lastOperation = 1;

  const units = (): number => {
    if (scale === undefined) {
      warn("no %MO unit command; assuming millimetres");
      scale = 1;
    }
    return scale;
  };
  const closeContour = (): void => {
    if (region && contour && contour.segments.length > 0) region.push(contour);
    contour = undefined;
  };
  const coordinate = (raw: string): number => {
    if (raw.includes(".")) return nanometres(Number(raw) * units());
    if (!format) throw new GerberReadError("coordinates before %FS format");
    const negative = raw.startsWith("-");
    let digits = raw.replace(/^[+-]/, "");
    if (format.trailingZerosOmitted)
      digits = digits.padEnd(format.integers + format.decimals, "0");
    const value = Number(digits) / 10 ** format.decimals;
    return nanometres((negative ? -value : value) * units());
  };
  const attribute = (body: string): void => {
    const [name, ...values] = body.split(",");
    if (name) attributes.set(name, values);
  };

  const extended = (body: string): void => {
    const commands = body.split("*").filter((part) => part.trim() !== "");
    const first = commands[0]?.trim() ?? "";
    if (first.startsWith("AM")) {
      macros.set(
        first.slice(2),
        commands
          .slice(1)
          .map((statement) => statement.trim())
          .filter((statement) => !/^0(\s|$)/.test(statement))
          .map((statement) => statement.replace(/\s+/g, "")),
      );
      return;
    }
    // Old files put several parameters in one block, e.g. %FSLAX24Y24*MOIN*%.
    for (const command of commands) parameter(command.trim());
  };

  const parameter = (head: string): void => {
    const code = head.slice(0, 2);
    switch (code) {
      case "FS": {
        const match = /^FS([LTD]?)([AI])X(\d)(\d)Y(\d)(\d)$/.exec(head);
        if (!match) throw new GerberReadError(`unreadable format "${head}"`);
        if (match[3] !== match[5] || match[4] !== match[6])
          warn("X and Y coordinate formats differ; using the X format");
        format = {
          integers: Number(match[3]),
          decimals: Number(match[4]),
          trailingZerosOmitted: match[1] === "T",
          incremental: match[2] === "I",
        };
        if (format.incremental)
          warn("incremental coordinates (%FS..I) are read as is");
        return;
      }
      case "MO":
        if (head === "MOMM") scale = 1;
        else if (head === "MOIN") scale = INCH;
        else throw new GerberReadError(`unknown unit "${head}"`);
        return;
      case "LP":
        polarity = head === "LPC" ? "clear" : "dark";
        return;
      case "AD": {
        const match = /^ADD(\d+)([^,]+)(?:,(.*))?$/.exec(head);
        if (!match?.[1] || !match[2])
          throw new GerberReadError(`unreadable aperture "${head}"`);
        const parameters = (match[3] ?? "")
          .split("X")
          .filter((part) => part !== "")
          .map(Number);
        const template = match[2];
        const macro = macros.get(template);
        const definition = macro
          ? instantiate(template, macro, parameters, units(), warn)
          : standardAperture(
              template,
              parameters.map((value, index) =>
                // Polygon rotation and vertex count are not lengths.
                template === "P" && (index === 1 || index === 2)
                  ? value
                  : value * units(),
              ),
            );
        if (!definition) {
          warn(`aperture template ${template} is not defined`);
          return;
        }
        apertures.set(Number(match[1]), definition);
        return;
      }
      case "TF":
        attribute(head.slice(2));
        return;
      case "TA":
      case "TO":
      case "TD":
      case "IN":
      case "LN":
      case "IP":
        if (head === "IPNEG")
          warn("negative image polarity (%IPNEG) is ignored");
        return;
      case "SR":
        if (head !== "SR")
          warn("step and repeat (%SR) is not supported; drawn once");
        return;
      case "LM":
      case "LR":
      case "LS":
        if (!/^(LMN|LR0(\.0*)?|LS1(\.0*)?)$/.test(head))
          warn(`aperture transformation %${head} is not supported`);
        return;
      default:
        warn(`extended command %${code} is not supported`);
    }
  };

  const operation = (raw: string): void => {
    let body = raw;
    // Mode codes that may precede coordinates in the same block.
    for (;;) {
      const match = /^G0*(\d+)/.exec(body);
      if (!match?.[1]) break;
      const code = Number(match[1]);
      if (code === 4) {
        const comment = body.slice(match[0].length).trim();
        const x2 = /^#@!\s*TF\.?(.*)$/.exec(comment);
        if (x2?.[1]) attribute(`.${x2[1].replace(/^\./, "")}`);
        return;
      }
      body = body.slice(match[0].length);
      if (code === 1) interpolation = "linear";
      else if (code === 2) interpolation = "clockwise";
      else if (code === 3) interpolation = "counterclockwise";
      else if (code === 36) {
        region = [];
        contour = undefined;
      } else if (code === 37) {
        closeContour();
        if (region?.length)
          objects.push({ kind: "region", polarity, contours: region });
        region = undefined;
      } else if (code === 74) multiQuadrant = false;
      else if (code === 75) multiQuadrant = true;
      else if (code === 70) scale = INCH;
      else if (code === 71) scale = 1;
      else if (code === 54 || code === 55 || code === 90) continue;
      else if (code === 91) warn("incremental notation (G91) is not supported");
      else warn(`G${code} is not supported`);
    }
    if (/^M0*[02]$/.test(body)) {
      ended = true;
      return;
    }
    if (body === "") return;
    const match =
      /^(?:X([+-]?[\d.]+))?(?:Y([+-]?[\d.]+))?(?:I([+-]?[\d.]+))?(?:J([+-]?[\d.]+))?(?:D0*(\d+))?$/.exec(
        body,
      );
    if (!match) {
      warn(`unreadable block "${raw}"`);
      return;
    }
    const [, x, y, i, j, d] = match;
    const dCode = d === undefined ? undefined : Number(d);
    if (dCode !== undefined && dCode >= 10) {
      aperture = apertures.get(dCode);
      if (!aperture) warn(`aperture D${dCode} is not defined`);
      return;
    }
    const target: PcbPoint = {
      x: x === undefined ? current.x : coordinate(x),
      y: y === undefined ? current.y : coordinate(y),
    };
    // A coordinate block without a D code repeats the last one (deprecated).
    const op = dCode ?? lastOperation;
    lastOperation = op;
    if (op === 2) {
      if (region) {
        closeContour();
        contour = { start: target, segments: [] };
      }
      current = target;
      return;
    }
    if (op === 3) {
      if (region) warn("flash inside a region is ignored");
      else if (aperture)
        objects.push({ kind: "flash", polarity, aperture, at: target });
      current = target;
      return;
    }
    if (op !== 1) {
      warn(`D${op} is not supported`);
      return;
    }
    let arc: GerberArc | undefined;
    if (interpolation !== "linear") {
      if (multiQuadrant === undefined) {
        warn("arc without G74 or G75; assuming multi-quadrant (G75)");
        multiQuadrant = true;
      }
      const offset = {
        x: i === undefined ? 0 : coordinate(i),
        y: j === undefined ? 0 : coordinate(j),
      };
      const clockwise = interpolation === "clockwise";
      arc = {
        center: multiQuadrant
          ? { x: current.x + offset.x, y: current.y + offset.y }
          : singleQuadrantCenter(current, target, offset, clockwise),
        clockwise,
      };
    }
    if (region) {
      if (!contour) contour = { start: current, segments: [] };
      contour.segments.push(arc ? { to: target, arc } : { to: target });
    } else if (aperture) {
      objects.push({
        kind: "draw",
        polarity,
        aperture,
        from: current,
        to: target,
        ...(arc ? { arc } : {}),
      });
    } else warn("draw before any aperture is selected");
    current = target;
  };

  for (const block of blocks(text)) {
    if (ended) break;
    if (block.extended) extended(block.body);
    else operation(block.body.trim());
  }
  if (!ended) warn("the file does not end with M02");
  return { attributes, objects, warnings };
}

/**
 * G74 arcs give unsigned centre offsets and span at most 90 degrees; the
 * centre is the sign combination that fits both end points best.
 */
function singleQuadrantCenter(
  from: PcbPoint,
  to: PcbPoint,
  offset: PcbPoint,
  clockwise: boolean,
): PcbPoint {
  let best: { center: PcbPoint; error: number } | undefined;
  for (const sx of [1, -1])
    for (const sy of [1, -1]) {
      const center = {
        x: from.x + sx * Math.abs(offset.x),
        y: from.y + sy * Math.abs(offset.y),
      };
      const start = Math.atan2(from.y - center.y, from.x - center.x);
      const end = Math.atan2(to.y - center.y, to.x - center.x);
      let sweep = clockwise ? start - end : end - start;
      while (sweep < 0) sweep += 2 * Math.PI;
      if (sweep > Math.PI / 2 + 1e-6) continue;
      const error = Math.abs(
        Math.hypot(from.x - center.x, from.y - center.y) -
          Math.hypot(to.x - center.x, to.y - center.y),
      );
      if (!best || error < best.error) best = { center, error };
    }
  return best?.center ?? { x: from.x + offset.x, y: from.y + offset.y };
}
