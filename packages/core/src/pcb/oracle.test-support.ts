// Test support: reads fabrication files back with tracespace's gerber-parser,
// an independent implementation, so tests compare what another tool sees
// with what the design meant. Not part of the module's public API.

import gerberParser from "gerber-parser";

interface ParsedTool {
  readonly shape: string;
  readonly params: readonly number[];
}

type Command =
  | { readonly type: "set"; readonly prop: string; readonly value: unknown }
  | { readonly type: "tool"; readonly code: string; readonly tool: ParsedTool }
  | {
      readonly type: "op";
      readonly op: "flash" | "int" | "move" | "last";
      readonly coord: { readonly x?: number; readonly y?: number };
    }
  | { readonly type: string };

interface SyncParser {
  readonly format: { readonly places: readonly number[] };
  on(event: "warning", listener: (warning: { message: string }) => void): void;
  parseSync(text: string): readonly Command[];
}

export interface IndependentPoint {
  readonly x: number;
  readonly y: number;
}

export interface IndependentRead {
  readonly units: unknown;
  readonly places: readonly number[];
  readonly flashes: readonly { at: IndependentPoint; tool: ParsedTool }[];
  readonly segments: readonly {
    from: IndependentPoint;
    to: IndependentPoint;
    tool: ParsedTool;
  }[];
  /** Warnings other than the expected ones listed in `readIndependently`. */
  readonly warnings: readonly string[];
}

/**
 * Expected warnings: gerber-parser 4 predates Gerber X2 and skips `%TF`
 * attributes, and it notes that the drill file declares no zero suppression,
 * which decimal-point coordinates do not need.
 */
const EXPECTED_WARNING =
  /^block "%TF\.[^"]*" was not recognized and was ignored$|^zero suppression missing; (detected|assuming) (leading|trailing) suppression$/;

export function readIndependently(
  text: string,
  filetype: "gerber" | "drill",
): IndependentRead {
  const parser = gerberParser({ filetype }) as unknown as SyncParser;
  const warnings: string[] = [];
  parser.on("warning", ({ message }) => {
    if (!EXPECTED_WARNING.test(message)) warnings.push(message);
  });
  const commands = parser.parseSync(text);
  const tools = new Map<string, ParsedTool>();
  const flashes: { at: IndependentPoint; tool: ParsedTool }[] = [];
  const segments: {
    from: IndependentPoint;
    to: IndependentPoint;
    tool: ParsedTool;
  }[] = [];
  let units: unknown;
  let tool: ParsedTool | undefined;
  let current: IndependentPoint = { x: 0, y: 0 };
  for (const command of commands) {
    if (command.type === "set" && "prop" in command) {
      if (command.prop === "units") units = command.value;
      if (command.prop === "tool") tool = tools.get(String(command.value));
    } else if (command.type === "tool" && "tool" in command)
      tools.set(command.code, command.tool);
    else if (command.type === "op" && "op" in command) {
      const at = {
        x: command.coord.x ?? current.x,
        y: command.coord.y ?? current.y,
      };
      if (!tool) {
        warnings.push(`operation before a tool at (${at.x}, ${at.y})`);
      } else if (command.op === "flash") flashes.push({ at, tool });
      else if (command.op === "int")
        segments.push({ from: current, to: at, tool });
      current = at;
    }
  }
  return { units, places: parser.format.places, flashes, segments, warnings };
}
