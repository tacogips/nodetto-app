import { formatMatchLines } from "./selectors.ts";
import type { BatchResult } from "./types.ts";
import { collapseWarnings } from "../warnings.ts";

export function formatEditReport(
  result: BatchResult,
  path: string,
  dryRun: boolean,
  format: "text" | "json",
): string {
  if (format === "json")
    return `${JSON.stringify(
      {
        written: !dryRun,
        operations: result.operations,
        created: result.created,
        ...(result.matches === undefined ? {} : { matches: result.matches }),
        ...(result.replaced.length ? { replaced: result.replaced } : {}),
        ...(result.converted?.length ? { converted: result.converted } : {}),
        ...(result.reconnected?.length
          ? { reconnected: result.reconnected }
          : {}),
        pages: Object.fromEntries(result.counts),
        warnings: result.warnings,
      },
      null,
      2,
    )}\n`;
  const lines = [
    `${dryRun ? "Would apply" : "Applied"} ${result.operations} operation(s) to ${path}.`,
    ...formatMatchLines(result.matches ?? []),
    ...[...result.counts].map(
      ([page, count]) =>
        `  page ${page}: +${count.added} ~${count.updated} -${count.removed}`,
    ),
    ...result.created.map(
      (item) =>
        `  created ${item.ref ? `@${item.ref} = ` : ""}${item.id} (${item.type})`,
    ),
    ...result.replaced.map(
      (item) =>
        `  replaced ${item.id} ${item.path}: ${JSON.stringify(item.before)} -> ${JSON.stringify(item.after)}`,
    ),
    ...(result.converted ?? []).flatMap((item) => [
      `  converted ${item.id} ${item.fromType} -> ${item.toType}`,
      ...item.mapped.map(
        (mapping) => `    mapped ${mapping.from} -> ${mapping.to}`,
      ),
      ...item.dropped.map((path) => `    cannot carry ${path}`),
      ...item.connectors.map(
        (connector) => `    connector ${connector.id} (${connector.type})`,
      ),
    ]),
    ...(result.reconnected ?? []).map(
      (item) =>
        `  reconnected ${item.deleted} -> ${item.to}: ${item.connectors.length} connector(s)`,
    ),
  ];
  lines.push(
    ...collapseWarnings(
      result.warnings.map(
        (warning) =>
          `  warning operation ${warning.operation} (${warning.op}): ${warning.element} (${warning.type}) ${warning.path}: ${warning.message} (${warning.code})`,
      ),
      result.warnings.map(
        (warning) => `${warning.code}|${warning.type}|${warning.path}`,
      ),
    ),
  );
  return `${lines.join("\n")}\n`;
}
