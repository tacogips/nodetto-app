import type { Document, ValidationIssue } from "@nodetto/ir";
import type { CommandResult } from "./commands.ts";

export function collapseWarnings(
  lines: readonly string[],
  keys?: readonly string[],
): string[] {
  const groups = new Map<string, { line: string; count: number }>();
  lines.forEach((line, index) => {
    const key = keys?.[index] ?? line;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { line, count: 1 });
  });
  return [...groups.values()].map(({ line, count }) =>
    count > 1 ? `${line} (and ${count - 1} more like this)` : line,
  );
}
export function issueWarningKey(
  issue: ValidationIssue,
  document: Document,
): string {
  if (!issue.code) return issue.message;
  const match = /^elements\[(\d+)\]\.?(.*)$/.exec(issue.path);
  const type = match ? (document.elements[Number(match[1])]?.type ?? "") : "";
  return `${issue.code}|${type}|${match?.[2] ?? issue.path}`;
}
export function extractQuiet(args: readonly string[]): {
  args: string[];
  quiet: boolean;
} {
  const result: string[] = [];
  let quiet = false;
  let positional = false;
  for (const arg of args) {
    if (arg === "--") positional = true;
    if (!positional && arg === "--quiet") quiet = true;
    else result.push(arg);
  }
  return { args: result, quiet };
}
export function applyQuiet(
  command: string,
  result: CommandResult,
): CommandResult {
  const filter = (text: string, prefix: string) =>
    text
      .split("\n")
      .filter((line) => !line.startsWith(prefix))
      .join("\n");
  return {
    ...result,
    stderr: filter(result.stderr, "warning: "),
    stdout:
      command === "edit" || command === "draw"
        ? filter(result.stdout, "  warning operation ")
        : result.stdout,
  };
}
