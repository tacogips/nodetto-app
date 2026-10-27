// Column definitions: portable type mapping, defaults and generated values.

import type { ErdColumn } from "@nodetto/ir";
import { type DatabaseDialect, DIALECT_LABEL } from "./dialect.ts";
import {
  dialectIncompatibility,
  expressionProblem,
  scanExpression,
} from "./expressions.ts";

export function typeFor(
  column: ErdColumn,
  dialect: DatabaseDialect,
  warnings: string[],
  tableName: string,
): string {
  let raw = column.dataType.trim();
  let normalized = raw.toLowerCase().replace(/\s+/g, " ");
  // PostgreSQL's documented alternative spellings share canonical mappings.
  const aliases: Readonly<Record<string, string>> = {
    dec: "decimal",
    "char varying": "character varying",
    nchar: "character",
    "national char": "character",
    "national character": "character",
    "nchar varying": "character varying",
    "national char varying": "character varying",
    "national character varying": "character varying",
    int2: "smallint",
    int4: "integer",
    int8: "bigint",
    float4: "real",
    float8: "double precision",
    bool: "boolean",
    varchar: "character varying",
    char: "character",
    varbit: "bit varying",
    timestamptz: "timestamp with time zone",
    timetz: "time with time zone",
    serial2: "smallserial",
    serial4: "serial",
    serial8: "bigserial",
  };
  normalized = normalized.replace(
    /^(time|timestamp)(\([^)]*\))( with(?:out)? time zone)$/,
    "$1$3$2",
  );
  const spelling =
    /^([a-z][a-z0-9_ ]*?)(\(\s*\d+(?:\s*,\s*\d+)?\s*\))?((?:\[\])*)$/.exec(
      normalized,
    );
  if (spelling) {
    let base = aliases[spelling[1] ?? ""] ?? spelling[1] ?? "";
    const parameters = (spelling[2] ?? "").replace(/\s+/g, "");
    const array = spelling[3] ?? "";
    // Bare bpchar has unlimited length; only bpchar(n) aliases character(n).
    if (base === "bpchar" && parameters) base = "character";
    if (aliases[spelling[1] ?? ""] || base !== spelling[1])
      raw = `${base}${parameters}${array}`;
    // Native PostgreSQL types (including arrays) are not user-defined types.
    const builtins = new Set([
      "smallint",
      "integer",
      "bigint",
      "real",
      "double precision",
      "float",
      "numeric",
      "decimal",
      "boolean",
      "bpchar",
      "character",
      "character varying",
      "text",
      "bit",
      "bit varying",
      "date",
      "time",
      "time with time zone",
      "time without time zone",
      "timestamp",
      "timestamp with time zone",
      "timestamp without time zone",
      "interval",
      "smallserial",
      "serial",
      "bigserial",
      "bytea",
      "uuid",
      "json",
      "jsonb",
      "xml",
      "box",
      "circle",
      "line",
      "lseg",
      "path",
      "point",
      "polygon",
      "cidr",
      "inet",
      "macaddr",
      "macaddr8",
      "money",
      "pg_lsn",
      "pg_snapshot",
      "tsquery",
      "tsvector",
      "int4range",
      "int8range",
      "numrange",
      "tsrange",
      "tstzrange",
      "daterange",
      "int4multirange",
      "int8multirange",
      "nummultirange",
      "tsmultirange",
      "tstzmultirange",
      "datemultirange",
    ]);
    if (dialect === "postgresql" && builtins.has(base)) {
      if (!parameters && !array && base === "timestamp with time zone")
        return "TIMESTAMPTZ";
      if (base === "character varying") return `VARCHAR${parameters}${array}`;
      if (base === "character") return `CHAR${parameters}${array}`;
      if (!parameters && base === "float") return `DOUBLE PRECISION${array}`;
      if (!parameters && !array && base === "json") return "JSONB";
      if (base === "numeric" || base === "decimal")
        return `DECIMAL${parameters}${array}`;
      const temporal =
        /^(time|timestamp)( with time zone| without time zone)$/.exec(base);
      return temporal
        ? `${temporal[1]}${parameters}${temporal[2]}${array}`.toUpperCase()
        : `${base}${parameters}${array}`.toUpperCase();
    }
    normalized = `${base}${parameters}${array}`;
    if (
      !array &&
      /^(time|timestamp)( with time zone| without time zone)?$/.test(base)
    )
      normalized = base;
  }
  const portable: Record<string, readonly [string, string, string]> = {
    uuid: ["UUID", "CHAR(36)", "TEXT"],
    int: ["INTEGER", "INTEGER", "INTEGER"],
    integer: ["INTEGER", "INTEGER", "INTEGER"],
    bigint: ["BIGINT", "BIGINT", "INTEGER"],
    smallint: ["SMALLINT", "SMALLINT", "INTEGER"],
    text: ["TEXT", "TEXT", "TEXT"],
    string: ["TEXT", "VARCHAR(255)", "TEXT"],
    boolean: ["BOOLEAN", "BOOLEAN", "INTEGER"],
    bool: ["BOOLEAN", "BOOLEAN", "INTEGER"],
    timestamp: ["TIMESTAMP", "TIMESTAMP", "TEXT"],
    datetime: ["TIMESTAMP", "DATETIME", "TEXT"],
    date: ["DATE", "DATE", "TEXT"],
    json: ["JSONB", "JSON", "TEXT"],
    jsonb: ["JSONB", "JSON", "TEXT"],
    real: ["REAL", "DOUBLE", "REAL"],
    float: ["DOUBLE PRECISION", "DOUBLE", "REAL"],
    double: ["DOUBLE PRECISION", "DOUBLE", "REAL"],
    "double precision": ["DOUBLE PRECISION", "DOUBLE", "REAL"],
    "character varying": ["VARCHAR", "VARCHAR(255)", "TEXT"],
    character: ["CHAR", "CHAR", "TEXT"],
    bit: ["BIT", "BIT", "TEXT"],
    "bit varying": ["VARBIT", "VARBINARY(255)", "TEXT"],
    time: ["TIME", "TIME", "TEXT"],
    "time with time zone": ["TIMETZ", "TIME", "TEXT"],
    "time without time zone": ["TIME", "TIME", "TEXT"],
    "timestamp with time zone": ["TIMESTAMPTZ", "TIMESTAMP", "TEXT"],
    "timestamp without time zone": ["TIMESTAMP", "TIMESTAMP", "TEXT"],
    decimal: ["DECIMAL", "DECIMAL", "NUMERIC"],
    numeric: ["NUMERIC", "DECIMAL", "NUMERIC"],
    blob: ["BYTEA", "BLOB", "BLOB"],
    bytes: ["BYTEA", "BLOB", "BLOB"],
  };
  const mapped = portable[normalized];
  if (mapped)
    return mapped[dialect === "postgresql" ? 0 : dialect === "mysql" ? 1 : 2];
  const parameterized =
    /^(varchar|char|character|character varying|bit|bit varying|decimal|numeric)\((\d+)(?:\s*,\s*(\d+))?\)$/.exec(
      normalized,
    );
  if (parameterized) {
    const numeric =
      parameterized[1] === "decimal" || parameterized[1] === "numeric";
    if (dialect === "sqlite") return numeric ? "NUMERIC" : "TEXT";
    return `${numeric ? "DECIMAL" : parameterized[1] === "char" || parameterized[1] === "character" ? "CHAR" : parameterized[1] === "bit" ? "BIT" : parameterized[1] === "bit varying" ? "VARBINARY" : "VARCHAR"}(${parameterized[2]}${parameterized[3] ? `,${parameterized[3]}` : ""})`;
  }
  if (
    /^[a-z][a-z0-9_]*(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\[\])?$/i.test(raw)
  ) {
    if (dialect !== "sqlite")
      warnings.push(
        `${tableName}.${column.name}: custom type "${raw}" was preserved; verify dialect support.`,
      );
    return raw;
  }
  warnings.push(
    `${tableName}.${column.name}: unsafe or empty type was replaced with TEXT.`,
  );
  return "TEXT";
}

/** Column types a SQLite STRICT table accepts. */
export const SQLITE_STRICT_TYPES = /^(?:int|integer|real|text|blob|any)$/i;

/** PostgreSQL session-user defaults (SQL-standard, written without parentheses). */
const SESSION_USER_DEFAULT = /^(?:current_user|session_user|current_role)$/i;

export function defaultFor(
  column: ErdColumn,
  dialect: DatabaseDialect,
  warnings: string[],
  tableName: string,
): string | undefined {
  const raw = column.defaultExpression?.trim();
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");
  if (
    /^(?:null|true|false|current_date|current_time|current_timestamp)$/i.test(
      raw,
    ) ||
    /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw) ||
    /^'(?:''|[^'\r\n])*'$/.test(raw)
  )
    return raw;
  if (normalized === "now()") return "CURRENT_TIMESTAMP";
  if (
    dialect === "postgresql" &&
    /^(?:gen_random_uuid|uuid_generate_v4)\(\)$/i.test(raw)
  )
    return raw;
  if (SESSION_USER_DEFAULT.test(raw)) {
    if (dialect === "postgresql") return raw;
    warnings.push(
      `${tableName}.${column.name}: default ${raw} is PostgreSQL-only; ${DIALECT_LABEL[dialect]} does not support it as a column default, so it was omitted.`,
    );
    return undefined;
  }
  warnings.push(
    `${tableName}.${column.name}: unsupported default expression "${raw}" was omitted. Use a literal, CURRENT_DATE/TIME/TIMESTAMP, a supported UUID function or (PostgreSQL) CURRENT_USER/SESSION_USER/CURRENT_ROLE.`,
  );
  return undefined;
}

export function generatedFor(
  column: ErdColumn,
  dialect: DatabaseDialect,
  warnings: string[],
  tableName: string,
): string | undefined {
  const raw = column.generatedExpression?.trim();
  if (!raw) return undefined;
  const subject = `${tableName}.${column.name}: generated expression`;
  const problem = expressionProblem(raw, dialect);
  if (problem) {
    warnings.push(
      `${subject} "${raw}" was omitted because it ${problem}. Use one portable row-local SQL expression.`,
    );
    return undefined;
  }
  const incompatibility = dialectIncompatibility(raw, dialect, subject);
  if (incompatibility) warnings.push(incompatibility);
  return scanExpression(raw)?.normalized ?? raw;
}
