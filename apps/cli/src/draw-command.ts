// `nodetto-cli draw`: draw one palette shape, or join two elements with a
// connector shape, by its shape ID. A one-operation `nodetto-cli edit`, so the
// write is validated, atomic and merged with edits made meanwhile in the app.

import {
  type CommandIo,
  type CommandResult,
  fail,
  parseArgs,
} from "./commands.ts";
import { runOperations } from "./edit-command.ts";
import { helpFor } from "./help.ts";

const DRAW_OPTIONS = new Set([
  "--page",
  "--label",
  "--at",
  "--size",
  "--right-of",
  "--below",
  "--from",
  "--to",
  "--format",
]);
const DRAW_FLAGS = new Set(["--dry-run"]);

function pair(value: string, separator: string): [number, number] | null {
  const parts = value.split(separator).map((part) => Number(part.trim()));
  return parts.length === 2 && parts.every(Number.isFinite)
    ? [parts[0] as number, parts[1] as number]
    : null;
}

export function drawCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, DRAW_OPTIONS, DRAW_FLAGS);
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("draw")}`);
  if (parsed.positional.length !== 2)
    return fail(
      `draw expects a document path and a shape ID.\n\n${helpFor("draw")}`,
    );
  const [path, shape] = parsed.positional as [string, string];
  const option = (name: string) => parsed.options.get(name);
  const label = option("--label");
  const from = option("--from");
  const to = option("--to");
  if ((from === undefined) !== (to === undefined))
    return fail("A connector needs both --from and --to.");

  let operation: Record<string, unknown>;
  if (from !== undefined && to !== undefined) {
    for (const name of ["--at", "--size", "--right-of", "--below", "--page"])
      if (option(name) !== undefined)
        return fail(`${name} does not apply to a connector.`);
    operation = {
      op: "connect",
      shape,
      from,
      to,
      ...(label === undefined ? {} : { label }),
    };
  } else {
    const visual: Record<string, number> = {};
    const at = option("--at");
    if (at !== undefined) {
      const point = pair(at, ",");
      if (!point) return fail("--at expects <x>,<y>, for example 120,40.");
      [visual["x"], visual["y"]] = point;
    }
    const size = option("--size");
    if (size !== undefined) {
      const dimensions = pair(size.toLowerCase(), "x");
      if (!dimensions || dimensions.some((value) => value <= 0))
        return fail(
          "--size expects <width>x<height> above zero, for example 200x80.",
        );
      [visual["width"], visual["height"]] = dimensions;
    }
    const rightOf = option("--right-of");
    const below = option("--below");
    if ([at, rightOf, below].filter((value) => value !== undefined).length > 1)
      return fail("Use only one of --at, --right-of and --below.");
    const page = option("--page");
    operation = {
      op: "add",
      shape,
      ...(page === undefined ? {} : { page }),
      ...(label === undefined ? {} : { label }),
      ...(Object.keys(visual).length ? { visual } : {}),
      ...(rightOf !== undefined ? { place: { rightOf } } : {}),
      ...(below !== undefined ? { place: { below } } : {}),
    };
  }
  return runOperations(io, path, [operation], {
    arrange: false,
    dryRun: parsed.flags.has("--dry-run"),
    format: option("--format") ?? "text",
  });
}
