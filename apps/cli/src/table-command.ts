import { parseCsv, parseTsv, tableSheetFromGrid } from "@nodetto/core";
import {
  TABLE_SHEET_COLUMN_TYPES,
  type TableSheetColumnType,
} from "@nodetto/ir";
import {
  type CommandIo,
  type CommandResult,
  fail,
  parseArgs,
} from "./commands.ts";
import { runOperations } from "./edit-command.ts";
import type { JsonObject } from "./edit/operation-input.ts";
import { TABLE_HELP } from "./table-help.ts";

export { TABLE_HELP };

const usage = (message?: string): CommandResult =>
  fail(message ? `${message}\n\n${TABLE_HELP}` : TABLE_HELP);

function create(io: CommandIo, args: readonly string[]): CommandResult {
  const parsed = parseArgs(
    args,
    new Set([
      "--csv",
      "--tsv",
      "--data",
      "--page",
      "--id",
      "--x",
      "--y",
      "--types",
      "--widths",
      "--format",
    ]),
    new Set(["--no-header"]),
  );
  if (typeof parsed === "string") return usage(parsed);
  const { options, flags, positional } = parsed;
  const sources = ["--csv", "--tsv", "--data"].filter((key) =>
    options.has(key),
  );
  if (
    positional.length !== 1 ||
    sources.length !== 1 ||
    options.has("--x") !== options.has("--y")
  )
    return usage();
  const format = options.get("--format") ?? "text";
  if (format !== "text" && format !== "json")
    return usage(`Unsupported format "${format}".`);
  let grid: string[][];
  try {
    const source = sources[0] as string;
    const value = options.get(source) as string;
    if (source === "--data") {
      const data: unknown = JSON.parse(value);
      if (
        !Array.isArray(data) ||
        !data.every(
          (row) =>
            Array.isArray(row) &&
            row.every(
              (cell: unknown) =>
                ["string", "number", "boolean"].includes(typeof cell) &&
                (typeof cell !== "number" || Number.isFinite(cell)),
            ),
        )
      )
        return usage(
          "--data must be an array of arrays of strings, numbers or booleans.",
        );
      grid = data.map((row: unknown[]) => row.map(String));
    } else {
      const text = io.readText(value).replace(/^\ufeff/u, "");
      grid = source === "--csv" ? parseCsv(text) : parseTsv(text);
    }
  } catch (cause) {
    return fail(
      `Cannot read table data: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  const types = options.get("--types")?.split(",");
  if (
    types?.some(
      (type) =>
        !TABLE_SHEET_COLUMN_TYPES.includes(type as TableSheetColumnType),
    )
  )
    return usage("Invalid column type.");
  const widthStrings = options.get("--widths")?.split(",");
  if (
    widthStrings?.some(
      (width) => !width.trim() || !Number.isFinite(Number(width)),
    )
  )
    return usage("Invalid column width.");
  const widths = widthStrings?.map(Number);
  const x = options.get("--x");
  const y = options.get("--y");
  if (
    x !== undefined &&
    y !== undefined &&
    (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y)))
  )
    return usage("Invalid position.");
  const result = tableSheetFromGrid(grid, {
    header: !flags.has("--no-header"),
    ...(types ? { types: types as TableSheetColumnType[] } : {}),
    ...(widths ? { widths } : {}),
  });
  if (!result.ok) return fail(result.message);
  const operation: JsonObject = {
    op: "add",
    type: "table.sheet",
    semantic: result.semantic as unknown as JsonObject,
    ...(options.has("--page") ? { page: options.get("--page") } : {}),
    ...(options.has("--id") ? { id: options.get("--id") } : {}),
    ...(x !== undefined && y !== undefined
      ? { visual: { x: Number(x), y: Number(y) } }
      : {}),
  };
  return runOperations(io, positional[0] as string, [operation], {
    arrange: false,
    dryRun: false,
    format,
  });
}

function set(io: CommandIo, args: readonly string[]): CommandResult {
  const positional: string[] = [];
  const cells: JsonObject[] = [];
  let pending: string | undefined;
  let format = "text";
  let formatSeen = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    const equals = arg.indexOf("=");
    const name = equals >= 0 ? arg.slice(0, equals) : arg;
    if (name === "--cell" || name === "--value" || name === "--format") {
      const value = equals >= 0 ? arg.slice(equals + 1) : args[++i];
      if (value === undefined || (equals < 0 && value.startsWith("--")))
        return usage(`${name} requires a value.`);
      if (name === "--format") {
        if (formatSeen || !value) return usage();
        formatSeen = true;
        format = value;
      } else if (name === "--cell") {
        if (pending !== undefined || !value) return usage();
        pending = value;
      } else {
        if (pending === undefined) return usage();
        const colon = pending.indexOf(":");
        if (colon <= 0 || colon === pending.length - 1) return usage();
        const ref = (s: string): string | number =>
          /^\d+$/u.test(s) ? Number(s) : s;
        cells.push({
          row: ref(pending.slice(0, colon)),
          column: ref(pending.slice(colon + 1)),
          value,
        });
        pending = undefined;
      }
    } else if (arg.startsWith("--")) return usage(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (
    positional.length !== 2 ||
    !cells.length ||
    pending !== undefined ||
    (format !== "text" && format !== "json")
  )
    return usage();
  return runOperations(
    io,
    positional[0] as string,
    [{ op: "set-cells", id: positional[1], cells }],
    { arrange: false, dryRun: false, format },
  );
}
export function tableCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const [subcommand, ...rest] = args;
  if (subcommand === "create") return create(io, rest);
  if (subcommand === "set") return set(io, rest);
  return usage("table expects the create or set subcommand");
}
