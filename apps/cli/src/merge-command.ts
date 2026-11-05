import { validateDocument } from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import {
  mergeDocumentVersions,
  type VersionConflict,
} from "@nodetto/core";
import {
  type CommandIo,
  type CommandResult,
  fail,
  formatIssue,
  loadDocument,
  parseArgs,
  writeOutput,
} from "./commands.ts";

export const MERGE_USAGE =
  "Usage: nodetto-cli merge <base> <ours> <theirs> [--output <file>]";

function displayValue(value: unknown): string {
  if (value === undefined) return "(absent)";
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function conflictLine(c: VersionConflict): string {
  const label = `${c.kind} ${c.id}${c.type ? ` (${c.type})` : ""}`;
  if (c.reason === "deleted-in-ours")
    return `conflict: ${label}: deleted in ours, changed in theirs (kept deletion)`;
  if (c.reason === "deleted-in-theirs")
    return `conflict: ${label}: deleted in theirs, changed in ours (kept ours)`;
  return `conflict: ${label} ${c.path}: base ${displayValue(c.base)} | ours ${displayValue(c.ours)} | theirs ${displayValue(c.theirs)} (kept ours)`;
}

export function mergeCommand(
  io: CommandIo,
  args: readonly string[],
): CommandResult {
  const parsed = parseArgs(args, new Set(["--output"]), new Set());
  if (typeof parsed === "string") return fail(`${parsed}\n${MERGE_USAGE}`);
  if (parsed.positional.length !== 3) return fail(MERGE_USAGE);
  const [basePath, oursPath, theirsPath] = parsed.positional as [
    string,
    string,
    string,
  ];
  const base = loadDocument(io, basePath);
  if (typeof base === "string") return fail(base);
  const ours = loadDocument(io, oursPath);
  if (typeof ours === "string") return fail(ours);
  const theirs = loadDocument(io, theirsPath);
  if (typeof theirs === "string") return fail(theirs);
  if (
    base.document.id !== ours.document.id ||
    base.document.id !== theirs.document.id
  )
    return fail(
      `${basePath}, ${oursPath} and ${theirsPath} are not versions of the same document.`,
    );
  const merged = mergeDocumentVersions(
    base.document,
    ours.document,
    theirs.document,
  );
  const errors = validateDocument(merged.document).filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length) return fail(errors.map(formatIssue).join("\n"));
  const text = serializeDocument(merged.document);
  const output = parsed.options.get("--output");
  if (output !== undefined) {
    const error = writeOutput(io, output, text);
    if (error) return fail(error);
  }
  const stderr = merged.conflicts.length
    ? `${merged.conflicts.map(conflictLine).join("\n")}\nmerged with ${merged.conflicts.length} conflict(s); conflicting fields keep ours.\n`
    : "";
  return {
    exitCode: merged.conflicts.length ? 1 : 0,
    stdout: output === undefined ? text : "",
    stderr,
  };
}
