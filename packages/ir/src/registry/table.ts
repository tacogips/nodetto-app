import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  TABLE_SHEET_ALIGNS,
  TABLE_SHEET_COLUMN_TYPES,
  TABLE_SHEET_ID_PATTERN,
  TABLE_SHEET_LIMITS,
  tableSheetValueMatches,
  type TableSheetColumn,
} from "../semantics/table.ts";
import { noReferences, type ElementTypeDefinition } from "./definition.ts";

export const TABLE_SHEET: ElementTypeDefinition = {
  type: "table.sheet",
  category: "node",
  onReferenceDeleted: "detach",
  references: noReferences,
  keyOrder: {
    keys: ["columns", "rows", "headerRow", "striped"],
    children: {
      columns: { keys: ["id", "name", "type", "width", "align", "options"] },
      rows: { keys: ["id", "height", "cells"] },
    },
  },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    const issue = (code: string, at: string, message: string) =>
      out.push(error(code, at, message));
    const id = (value: unknown, at: string, seen: Set<string>) => {
      if (!checkString(out, value, at)) return;
      const text = value as string;
      if (!TABLE_SHEET_ID_PATTERN.test(text))
        issue("table.id", at, "invalid table id");
      if (seen.has(text)) issue("id.duplicate", at, "duplicate id");
      seen.add(text);
    };
    const size = (
      value: unknown,
      at: string,
      min: number,
      max: number,
      optional = false,
    ) => {
      if (value === undefined && optional) return;
      if (
        checkNumber(out, value, at) &&
        (!Number.isInteger(value) ||
          (value as number) < min ||
          (value as number) > max)
      )
        issue("table.size", at, `expected an integer from ${min} to ${max}`);
    };
    checkBoolean(out, semantic["headerRow"], `${path}.headerRow`, {
      optional: true,
    });
    checkBoolean(out, semantic["striped"], `${path}.striped`, {
      optional: true,
    });
    const columns = semantic["columns"];
    const byId = new Map<string, TableSheetColumn>();
    if (checkArray(out, columns, `${path}.columns`)) {
      if (!columns.length)
        issue(
          "table.noColumns",
          `${path}.columns`,
          "at least one column is required",
        );
      if (columns.length > TABLE_SHEET_LIMITS.maxColumns)
        issue("table.limit", `${path}.columns`, "maximum 100 columns");
      const seen = new Set<string>();
      for (const [i, column] of columns.entries()) {
        const at = `${path}.columns[${i}]`;
        if (!checkObject(out, column, at)) continue;
        id(column["id"], `${at}.id`, seen);
        checkString(out, column["name"], `${at}.name`, { allowEmpty: true });
        if (typeof column["name"] === "string" && column["name"].length > 200)
          issue("table.limit", `${at}.name`, "maximum 200 characters");
        checkEnum(out, column["type"], `${at}.type`, TABLE_SHEET_COLUMN_TYPES);
        size(column["width"], `${at}.width`, 24, 2000);
        checkEnum(out, column["align"], `${at}.align`, TABLE_SHEET_ALIGNS, {
          optional: true,
        });
        const options = column["options"];
        if (options !== undefined) {
          if (column["type"] !== "select")
            issue(
              "table.options",
              `${at}.options`,
              "options require a select column",
            );
          if (checkArray(out, options, `${at}.options`)) {
            if (options.length > 100)
              issue("table.limit", `${at}.options`, "maximum 100 options");
            const values = new Set<string>();
            for (const [j, option] of options.entries()) {
              const op = `${at}.options[${j}]`;
              if (checkString(out, option, op, { allowEmpty: true })) {
                const text = option as string;
                if (text.length < 1 || text.length > 200)
                  issue(
                    "table.limit",
                    op,
                    "option length must be 1 to 200 characters",
                  );
                if (!text || values.has(text))
                  issue(
                    "table.options",
                    op,
                    "options must be nonempty and unique",
                  );
                values.add(text);
              }
            }
          }
        }
        if (typeof column["id"] === "string")
          byId.set(column["id"], column as unknown as TableSheetColumn);
      }
    }
    const rows = semantic["rows"];
    if (checkArray(out, rows, `${path}.rows`)) {
      if (rows.length > 1000)
        issue("table.limit", `${path}.rows`, "maximum 1000 rows");
      const seen = new Set<string>();
      for (const [i, row] of rows.entries()) {
        const at = `${path}.rows[${i}]`;
        if (!checkObject(out, row, at)) continue;
        id(row["id"], `${at}.id`, seen);
        size(row["height"], `${at}.height`, 20, 2000, true);
        const cells = row["cells"];
        if (!checkObject(out, cells, `${at}.cells`)) continue;
        for (const key of Object.keys(cells)) {
          const cellPath = `${at}.cells.${key}`;
          const column = byId.get(key);
          if (!column) issue("table.unknownColumn", cellPath, "unknown column");
          const cell = cells[key];
          if (!checkObject(out, cell, cellPath)) continue;
          if (!Object.keys(cell).length)
            issue("table.cellEmpty", cellPath, "empty cell object");
          const value = cell["value"];
          if (typeof value === "string" && value.length > 10000)
            issue(
              "table.limit",
              `${cellPath}.value`,
              "maximum 10000 characters",
            );
          if (
            value !== undefined &&
            column &&
            (!Array.isArray(column.options) && column.type === "select"
              ? true
              : !tableSheetValueMatches(column, value))
          )
            issue(
              "table.cellType",
              `${cellPath}.value`,
              "value does not match column type",
            );
          checkBoolean(out, cell["bold"], `${cellPath}.bold`, {
            optional: true,
          });
          checkEnum(
            out,
            cell["align"],
            `${cellPath}.align`,
            TABLE_SHEET_ALIGNS,
            { optional: true },
          );
          if (
            cell["fill"] !== undefined &&
            (typeof cell["fill"] !== "string" ||
              !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
                cell["fill"],
              ))
          )
            issue("table.cellFill", `${cellPath}.fill`, "expected a hex color");
        }
      }
    }
    return out;
  },
};
