// Row highlighting for erd.table: kept out of ErdTableView.tsx so tests can
// import it without loading Solid JSX.

import type { ErdColumn } from "@nodetto/ir";

export function erdRowHighlighted(
  highlightedColumnIds: ReadonlySet<string> | undefined,
  column: ErdColumn,
): boolean {
  return highlightedColumnIds?.has(column.id) === true;
}
