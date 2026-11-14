// ERD table and relation payloads.

import type { ElementId } from "../types.ts";
import type { ConnectorRoutingSemantic } from "./connectors.ts";

export const CARDINALITIES = ["1:1", "1:*", "*:1", "*:*"] as const;
export type Cardinality = (typeof CARDINALITIES)[number];

export const REFERENTIAL_ACTIONS = [
  "no-action",
  "restrict",
  "cascade",
  "set-null",
  "set-default",
] as const;
export type ReferentialAction = (typeof REFERENTIAL_ACTIONS)[number];

export const FOREIGN_KEY_DEFERRABILITIES = [
  "not-deferrable",
  "initially-immediate",
  "initially-deferred",
] as const;
export type ForeignKeyDeferrability =
  (typeof FOREIGN_KEY_DEFERRABILITIES)[number];

export interface ErdColumn {
  readonly id: string;
  readonly name: string;
  readonly dataType: string;
  readonly pk?: boolean;
  readonly nullable?: boolean;
  /** Portable, single integer primary-key identity. */
  readonly autoIncrement?: boolean;
  /** PostgreSQL identity policy; omitted means by-default. Requires autoIncrement. */
  readonly identityGeneration?: "always" | "by-default";
  /** Portable SQL expression emitted after DEFAULT when it is safe. */
  readonly defaultExpression?: string;
  /** Portable computed expression emitted as a stored generated column. */
  readonly generatedExpression?: string;
  /** Free-form documentation, exported as a DDL column comment. */
  readonly comment?: string;
}

export interface ErdIndex {
  readonly id: string;
  readonly name?: string;
  /** Stable column ids, in index-key order. */
  readonly columns: readonly string[];
  readonly unique?: boolean;
  /** Portable SQL predicate of a partial index, without the WHERE keyword. */
  readonly where?: string;
}

export interface ErdCheckConstraint {
  readonly id: string;
  readonly name?: string;
  /** Portable SQL predicate, without the surrounding CHECK parentheses. */
  readonly expression: string;
}

/** SQLite-only table options; other dialects ignore them. */
export interface ErdSqliteTableOptions {
  /** `STRICT`: column types are enforced (INT, INTEGER, REAL, TEXT, BLOB, ANY). */
  readonly strict?: boolean;
  /** `WITHOUT ROWID`: the primary key is the storage key. */
  readonly withoutRowid?: boolean;
}

export interface ErdTableSemantic {
  readonly tableName: string;
  /** Free-form documentation, exported as a DDL table comment. */
  readonly comment?: string;
  readonly columns: readonly ErdColumn[];
  readonly indexes?: readonly ErdIndex[];
  readonly checks?: readonly ErdCheckConstraint[];
  readonly sqlite?: ErdSqliteTableOptions;
}

/** Column-anchored endpoint; `column` omitted means "the table as a whole". */
export interface ErdEndpoint {
  readonly table: ElementId;
  /** Legacy/compact spelling for one anchored foreign-key column. */
  readonly column?: string;
  /** Ordered columns for a composite foreign-key endpoint. */
  readonly columns?: readonly string[];
}

/** Read either endpoint spelling as one ordered column list. */
export function erdEndpointColumnIds(endpoint: ErdEndpoint): readonly string[] {
  return endpoint.columns?.length
    ? endpoint.columns
    : endpoint.column
      ? [endpoint.column]
      : [];
}

export interface ErdRelationSemantic extends ConnectorRoutingSemantic {
  readonly from: ErdEndpoint;
  readonly to: ErdEndpoint;
  readonly cardinality: Cardinality;
  /** Action applied to dependent rows when the referenced key is deleted. */
  readonly onDelete?: ReferentialAction;
  /** Action applied to dependent rows when the referenced key is updated. */
  readonly onUpdate?: ReferentialAction;
  /** Transaction-time enforcement for engines that support deferred keys. */
  readonly deferrability?: ForeignKeyDeferrability;
  /**
   * A logical reference: drawn and documented like a foreign key but not
   * enforced by the database, so DDL export emits no constraint for it.
   */
  readonly logical?: boolean;
  readonly label?: string;
}
