import {
  applyTableSheetEdit,
  coerceCellText,
  setCellStyle,
  setCellValue,
  setColumnOptions,
} from "@nodetto/core";
import {
  isPlainObject,
  tableSheetValueMatches,
  type TableSheetAlign,
  type TableSheetSemantic,
} from "@nodetto/ir";
import type { Batch } from "../batch.ts";
import { OperationError, type JsonObject } from "../operation-input.ts";

export function setCells(
  batch: Batch,
  operation: JsonObject,
  index: number,
): void {
  const ref =
    operation["id"] ??
    (typeof operation["ref"] === "string" ? `@${operation["ref"]}` : undefined);
  const element = batch.element(ref, index);
  if (element.type !== "table.sheet")
    throw new OperationError(index, '"set-cells" needs a table.sheet element');
  const cells = operation["cells"];
  if (!Array.isArray(cells) || !cells.length)
    throw new OperationError(index, '"cells" must be a non-empty array');
  let semantic = element.semantic as TableSheetSemantic;
  for (const cell of cells) {
    if (!isPlainObject(cell))
      throw new OperationError(index, "cell must be an object");
    const rowRef = cell["row"];
    const colRef = cell["column"];
    const row =
      typeof rowRef === "string"
        ? semantic.rows.find((r) => r.id === rowRef)
        : typeof rowRef === "number" && Number.isInteger(rowRef) && rowRef >= 0
          ? semantic.rows[rowRef]
          : undefined;
    if (!row)
      throw new OperationError(index, `Unknown row ${JSON.stringify(rowRef)}`);
    let column =
      typeof colRef === "string"
        ? semantic.columns.find((c) => c.id === colRef)
        : typeof colRef === "number" && Number.isInteger(colRef) && colRef >= 0
          ? semantic.columns[colRef]
          : undefined;
    if (!column && typeof colRef === "string") {
      const matches = semantic.columns.filter((c) => c.name === colRef);
      if (matches.length > 1)
        throw new OperationError(
          index,
          `Ambiguous column ${JSON.stringify(colRef)}`,
        );
      column = matches[0];
    }
    if (!column)
      throw new OperationError(
        index,
        `Unknown column ${JSON.stringify(colRef)}`,
      );
    const take = (result: ReturnType<typeof setCellValue>) => {
      if (!result.ok) throw new OperationError(index, result.message);
      semantic = result.semantic;
    };
    if (Object.hasOwn(cell, "value")) {
      const raw = cell["value"];
      if (typeof raw === "string") {
        const converted = coerceCellText(column, raw);
        if (!converted.ok)
          throw new OperationError(
            index,
            `cell (${String(rowRef)}, ${String(colRef)}): ${JSON.stringify(raw)} is not a valid ${column.type}`,
          );
        if (converted.newOption !== undefined)
          take(
            setColumnOptions(semantic, column.id, [
              ...(column.options ?? []),
              converted.newOption,
            ]),
          );
        take(setCellValue(semantic, row.id, column.id, converted.value));
      } else if (raw === null)
        take(setCellValue(semantic, row.id, column.id, undefined));
      else if (
        (typeof raw === "number" || typeof raw === "boolean") &&
        tableSheetValueMatches(column, raw)
      )
        take(setCellValue(semantic, row.id, column.id, raw));
      else
        throw new OperationError(
          index,
          `cell (${String(rowRef)}, ${String(colRef)}): value is not a valid ${column.type}`,
        );
    }
    const bold = cell["bold"];
    const align = cell["align"];
    const fill = cell["fill"];
    if (bold !== undefined && bold !== null && typeof bold !== "boolean")
      throw new OperationError(index, '"bold" must be boolean or null');
    if (
      align !== undefined &&
      align !== null &&
      align !== "left" &&
      align !== "center" &&
      align !== "right"
    )
      throw new OperationError(
        index,
        '"align" must be left, center, right or null',
      );
    if (fill !== undefined && fill !== null && typeof fill !== "string")
      throw new OperationError(index, '"fill" must be string or null');
    take(
      setCellStyle(semantic, row.id, column.id, {
        bold: bold as boolean | null | undefined,
        align: align as TableSheetAlign | null | undefined,
        fill: fill as string | null | undefined,
      }),
    );
  }
  const result = applyTableSheetEdit(batch.editor, element.id, () => ({
    ok: true,
    semantic,
    skipped: 0,
  }));
  if (!result.ok) throw new OperationError(index, result.message);
  batch.touchedPages.add(element.page);
}
