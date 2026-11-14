import type { TableSheetColumnType, TableSheetSemantic } from "@nodetto/ir";

export function parseOptionLines(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);
}
export function formatOptionLines(options?: readonly string[]): string {
  return (options ?? []).join("\n");
}
export function rowToDelete(
  s: TableSheetSemantic,
  activeRowId?: string,
): string | undefined {
  return s.rows.find((row) => row.id === activeRowId)?.id ?? s.rows.at(-1)?.id;
}
export function columnTypeLabel(type: TableSheetColumnType): string {
  return {
    text: "Text",
    number: "Number",
    checkbox: "Checkbox",
    select: "Select",
    date: "Date",
  }[type];
}
