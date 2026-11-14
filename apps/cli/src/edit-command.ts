// `nodetto-cli edit`: apply a batch of drawing operations through the editor's
// command layer, so validation, reference cascades and derived state are the
// same as when a person edits in the app.
//
// The batch is all-or-nothing. Before the atomic write the file is read again;
// if someone (typically the person in the desktop app) saved meanwhile, the
// batch is applied again to the new contents instead of overwriting them.

import {
  type CommandIo,
  type CommandResult,
  fail,
  ok,
  parseArgs,
} from "./commands.ts";
import { helpFor } from "./help.ts";
import { applyBatch } from "./edit/apply-batch.ts";
import {
  type JsonObject,
  OperationError,
  parseOperations,
} from "./edit/operation-input.ts";
import { formatEditReport } from "./edit/report.ts";
import type { BatchResult } from "./edit/types.ts";

const EDIT_OPTIONS = new Set(["--ops", "--format", "--snapshot"]);
const EDIT_FLAGS = new Set(["--arrange", "--dry-run"]);
/** The file kept changing while the batch was being written. */
export const EXIT_CONTENDED = 4;
const MAX_ATTEMPTS = 3;

export function editCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, EDIT_OPTIONS, EDIT_FLAGS);
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("edit")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `edit expects exactly one document path.\n\n${helpFor("edit")}`,
    );
  const path = parsed.positional[0] as string;
  const format = parsed.options.get("--format") ?? "text";
  if (format !== "text" && format !== "json")
    return fail(`Unsupported format "${format}". Choose text or json.`);
  const source = parsed.options.get("--ops");
  if (source === undefined)
    return fail(`edit requires --ops <file.json|->.\n\n${helpFor("edit")}`);
  let operations: readonly JsonObject[];
  try {
    const opsText =
      source === "-" ? (io.readStdin?.() ?? "") : io.readText(source);
    operations = parseOperations(opsText);
  } catch (cause) {
    if (cause instanceof OperationError)
      return fail(`Operation ${cause.index}: ${cause.message}`);
    return fail(
      `Cannot read operations: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  return runOperations(io, path, operations, {
    arrange: parsed.flags.has("--arrange"),
    dryRun: parsed.flags.has("--dry-run"),
    format,
    ...(parsed.options.has("--snapshot")
      ? { snapshot: parsed.options.get("--snapshot") as string }
      : {}),
  });
}

export interface RunOptions {
  readonly arrange: boolean;
  readonly dryRun: boolean;
  readonly format: string;
  /** Also write the result here, as a baseline for a later diff. */
  readonly snapshot?: string;
}

/**
 * Apply operations to the file at `path` and report them; the batch is
 * re-applied when the file changes during the write.
 */
export function runOperations(
  io: CommandIo,
  path: string,
  operations: readonly JsonObject[],
  options: RunOptions,
): CommandResult {
  const { arrange, format } = options;
  if (format !== "text" && format !== "json")
    return fail(`Unsupported format "${format}". Choose text or json.`);
  let result: BatchResult | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let current: string;
    try {
      current = io.readText(path);
    } catch (cause) {
      return fail(
        `Cannot read ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    try {
      result = applyBatch(current, operations, arrange);
    } catch (cause) {
      if (cause instanceof OperationError)
        return fail(
          `Operation ${cause.index} (${String(operations[cause.index]?.["op"])}): ${cause.message}\nNothing was written.`,
        );
      return fail(
        `${cause instanceof Error ? cause.message : String(cause)}\nNothing was written.`,
      );
    }
    if (options.dryRun) break;
    let latest: string;
    try {
      latest = io.readText(path);
    } catch {
      latest = current;
    }
    if (latest !== current) {
      result = undefined;
      continue;
    }
    try {
      io.writeText(path, result.text);
    } catch (cause) {
      return fail(
        `Cannot write ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    const snapshot = options.snapshot;
    if (snapshot !== undefined)
      try {
        io.writeText(snapshot, result.text);
      } catch (cause) {
        return fail(
          `Wrote ${path}, but cannot write the snapshot ${snapshot}: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    break;
  }
  if (!result)
    return {
      exitCode: EXIT_CONTENDED,
      stdout: "",
      stderr: `${path} kept changing while the batch was applied (${MAX_ATTEMPTS} attempts); nothing was written. Retry later.\n`,
    };

  return ok(formatEditReport(result, path, options.dryRun, format));
}

export { parseOperations, deepMerge } from "./edit/operation-input.ts";
export { applyBatch } from "./edit/apply-batch.ts";
export type { EditWarning } from "./edit/types.ts";
