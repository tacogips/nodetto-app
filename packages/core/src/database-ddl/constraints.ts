// Foreign-key clauses and key matching for table constraints.

import type {
  ErdTableSemantic,
  ForeignKeyDeferrability,
  ReferentialAction,
} from "@nodetto/ir";
import type { DatabaseDialect } from "./dialect.ts";

const ACTION_SQL: Readonly<Record<ReferentialAction, string>> = {
  "no-action": "NO ACTION",
  restrict: "RESTRICT",
  cascade: "CASCADE",
  "set-null": "SET NULL",
  "set-default": "SET DEFAULT",
};

export function referentialActionClause(
  action: ReferentialAction | undefined,
  kind: "DELETE" | "UPDATE",
  dialect: DatabaseDialect,
  relationId: string,
  warnings: string[],
): string {
  if (!action || action === "no-action") return "";
  if (dialect === "mysql" && action === "set-default") {
    warnings.push(
      `${relationId}: MySQL does not support ON ${kind} SET DEFAULT; the action was omitted.`,
    );
    return "";
  }
  return ` ON ${kind} ${ACTION_SQL[action]}`;
}

export function deferrabilityClause(
  value: ForeignKeyDeferrability | undefined,
  dialect: DatabaseDialect,
  relationId: string,
  warnings: string[],
): string {
  if (!value || value === "not-deferrable") return "";
  if (dialect === "mysql") {
    warnings.push(
      `${relationId}: MySQL does not support deferrable foreign keys; the constraint timing was omitted.`,
    );
    return "";
  }
  return value === "initially-deferred"
    ? " DEFERRABLE INITIALLY DEFERRED"
    : " DEFERRABLE INITIALLY IMMEDIATE";
}

function sameColumnIds(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((columnId, index) => columnId === right[index])
  );
}

export function isUniqueKey(
  table: ErdTableSemantic,
  columnIds: readonly string[],
): boolean {
  const primary = table.columns
    .filter((column) => column.pk)
    .map((column) => column.id);
  return (
    sameColumnIds(primary, columnIds) ||
    (table.indexes ?? []).some(
      (index) => index.unique && sameColumnIds(index.columns, columnIds),
    )
  );
}
