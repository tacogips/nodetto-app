import { expandContainers } from "./frame-tree.ts";
import { databaseObjectsDdl } from "./database-objects-ddl.ts";
import type {
  Element,
  ErdColumn,
  ErdRelationSemantic,
  ErdTableSemantic,
  ForeignKeyDeferrability,
  PageId,
  ReferentialAction,
} from "@nodetto/ir";
import { erdEndpointColumnIds } from "@nodetto/ir";
import type { Editor } from "./editor.ts";

export const DATABASE_DIALECTS = ["postgresql", "mysql", "sqlite"] as const;
export type DatabaseDialect = (typeof DATABASE_DIALECTS)[number];

export interface DatabaseDdl {
  readonly dialect: DatabaseDialect;
  readonly sql: string;
  readonly warnings: readonly string[];
  readonly tableCount: number;
  readonly objectCount: number;
  readonly relationCount: number;
  readonly indexCount: number;
  readonly checkCount: number;
}

interface TableModel {
  readonly element: Element;
  readonly semantic: ErdTableSemantic;
  readonly constraints: string[];
  readonly foreignConstraints: string[];
}

function quoteIdentifier(value: string, dialect: DatabaseDialect): string {
  return dialect === "mysql"
    ? `\`${value.replaceAll("`", "``")}\``
    : `"${value.replaceAll('"', '""')}"`;
}

function constraintStem(value: string): string {
  const stem = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return (stem || "constraint").slice(0, 55);
}

function typeFor(
  column: ErdColumn,
  dialect: DatabaseDialect,
  warnings: string[],
  tableName: string,
): string {
  let raw = column.dataType.trim();
  let normalized = raw.toLowerCase().replace(/\s+/g, " ");
  // PostgreSQL's documented alternative spellings share canonical mappings.
  const aliases: Readonly<Record<string, string>> = {
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
    /^([a-z][a-z0-9_ ]*?)(\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(\[\])?$/.exec(
      normalized,
    );
  if (spelling) {
    const base = aliases[spelling[1] ?? ""] ?? spelling[1] ?? "";
    const parameters = (spelling[2] ?? "").replace(/\s+/g, "");
    const array = spelling[3] ?? "";
    if (aliases[spelling[1] ?? ""]) raw = `${base}${parameters}${array}`;
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

/** Flatten text for a `--` line comment: any line break would end it. */
function comment(value: string): string {
  return value.replace(/[\n\r\v\f\u0085\u2028\u2029]+/g, " ");
}

const ACTION_SQL: Readonly<Record<ReferentialAction, string>> = {
  "no-action": "NO ACTION",
  restrict: "RESTRICT",
  cascade: "CASCADE",
  "set-null": "SET NULL",
  "set-default": "SET DEFAULT",
};

function referentialActionClause(
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

function deferrabilityClause(
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

function isUniqueKey(
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

const DIALECT_LABEL: Readonly<Record<DatabaseDialect, string>> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

/** PostgreSQL session-user defaults (SQL-standard, written without parentheses). */
const SESSION_USER_DEFAULT = /^(?:current_user|session_user|current_role)$/i;

function defaultFor(
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

function generatedFor(
  column: ErdColumn,
  dialect: DatabaseDialect,
  warnings: string[],
  tableName: string,
): string | undefined {
  const raw = column.generatedExpression?.trim();
  if (!raw) return undefined;
  const subject = `${tableName}.${column.name}: generated expression`;
  const problem = expressionProblem(raw);
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

/**
 * Longest CHECK or generated-column expression the exporter emits. The cap
 * bounds the safety scan only; every supported database accepts far longer
 * expressions.
 */
export const MAX_SQL_EXPRESSION_LENGTH = 8192;

interface ScannedExpression {
  /** The expression with each string literal replaced by one space. */
  readonly outside: string;
  readonly literals: readonly string[];
  /**
   * The emitted form: whitespace runs containing a tab or line break collapse
   * to one space outside literals, so authored multi-line expressions export
   * on one line while single-line expressions stay byte-for-byte unchanged.
   */
  readonly normalized: string;
}

/** Split out string literals; undefined when a literal is unterminated. */
function scanExpression(raw: string): ScannedExpression | undefined {
  let outside = "";
  let normalized = "";
  const literals: string[] = [];
  let segment = "";
  const flushSegment = () => {
    normalized += segment.replace(/ *[\t\n\r][\t\n\r ]*/g, " ");
    segment = "";
  };
  for (let i = 0; i < raw.length; i += 1) {
    const character = raw[i] as string;
    if (character === "'") {
      const start = i;
      i += 1;
      while (i < raw.length) {
        if (raw[i] === "'" && raw[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (raw[i] === "'") break;
        i += 1;
      }
      if (i >= raw.length) return undefined;
      const literal = raw.slice(start, i + 1);
      literals.push(literal);
      flushSegment();
      normalized += literal;
      outside += " ";
      continue;
    }
    outside += character;
    segment += character;
  }
  flushSegment();
  return { outside, literals, normalized: normalized.trim() };
}

/** Whether text has a control character; tab, LF and CR count only when not allowed. */
function hasControlCharacter(text: string, allowWhitespace: boolean): boolean {
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (allowWhitespace && (code === 9 || code === 10 || code === 13)) continue;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Why a CHECK or generated expression cannot be emitted safely, phrased to
 * follow "it", or undefined when it is one row-local expression. Only text
 * outside string literals is restricted to the portable character set;
 * literal contents are free apart from backslashes and control characters.
 */
function expressionProblem(raw: string): string | undefined {
  if (!raw) return "is empty";
  if (raw.length > MAX_SQL_EXPRESSION_LENGTH)
    return `is ${raw.length} characters long, over the ${MAX_SQL_EXPRESSION_LENGTH}-character limit`;
  // MySQL treats backslash as a literal escape by default, so a backslash
  // would let MySQL and this scanner disagree about where a literal ends.
  if (raw.includes("\\"))
    return 'contains "\\"; backslash escapes differ between dialects';
  const scanned = scanExpression(raw);
  if (scanned === undefined) return "has an unterminated string literal";
  const { outside, literals } = scanned;
  if (literals.some((literal) => hasControlCharacter(literal, false)))
    return "contains a line break or control character inside a string literal";
  if (hasControlCharacter(outside, true)) return "contains a control character";
  if (
    outside.includes(";") ||
    outside.includes("--") ||
    outside.includes("/*") ||
    outside.includes("*/")
  )
    return "contains a statement separator or SQL comment";
  const unsupported = /[^A-Za-z0-9_ \t\n\r(),.+\-*/%<>=!|&]/.exec(outside)?.[0];
  if (unsupported)
    return unsupported === ":"
      ? 'contains ":"; write casts as CAST(value AS type)'
      : `contains the unsupported character "${unsupported}"`;
  let depth = 0;
  for (const character of outside) {
    if (character === "(") depth += 1;
    if (character === ")" && --depth < 0) return "has unbalanced parentheses";
  }
  if (depth !== 0) return "has unbalanced parentheses";
  const statement =
    /\b(?:select|insert|update|delete|drop|alter|create|attach|detach|pragma|union|with)\b/i.exec(
      outside,
    )?.[0];
  return statement
    ? `contains ${statement.toUpperCase()}; only row-local expressions are allowed`
    : undefined;
}

/** Keywords that may precede "(" without naming a function. */
const PARENTHESIZED_KEYWORDS = new Set([
  "all",
  "and",
  "any",
  "as",
  "between",
  "case",
  "cast",
  "else",
  "end",
  "escape",
  "exists",
  "glob",
  "ilike",
  "in",
  "is",
  "like",
  "not",
  "null",
  "or",
  "regexp",
  "rlike",
  "some",
  "then",
  "when",
]);

/** SQLite's built-in scalar functions; anything else must be registered by the host. */
const SQLITE_FUNCTIONS = new Set(
  [
    // Core functions.
    "abs changes char coalesce concat concat_ws format hex if ifnull iif instr",
    "last_insert_rowid length likelihood likely lower ltrim max min nullif",
    "octet_length printf quote random randomblob replace round rtrim sign",
    "soundex substr substring total_changes trim typeof unhex unicode",
    "unlikely upper zeroblob",
    // Math functions.
    "acos acosh asin asinh atan atan2 atanh ceil ceiling cos cosh degrees exp",
    "floor ln log log10 log2 mod pi pow power radians sin sinh sqrt tan tanh",
    "trunc",
    // Date and time functions.
    "date time datetime julianday unixepoch strftime timediff",
    // JSON functions.
    "json jsonb json_array jsonb_array json_array_length json_error_position",
    "json_extract jsonb_extract json_insert jsonb_insert json_object",
    "jsonb_object json_patch jsonb_patch json_pretty json_quote json_remove",
    "jsonb_remove json_replace jsonb_replace json_set jsonb_set json_type",
    "json_valid",
  ]
    .join(" ")
    .split(" "),
);

/**
 * Functions known from another dialect that this one lacks. PostgreSQL and
 * MySQL allow user-defined functions in checks, so they use a deny list
 * rather than SQLite's closed built-in set.
 */
const MISSING_FUNCTIONS: Readonly<
  Record<Exclude<DatabaseDialect, "sqlite">, ReadonlySet<string>>
> = {
  postgresql: new Set([
    "datetime",
    "hex",
    "if",
    "ifnull",
    "iif",
    "instr",
    "isnull",
    "json_extract",
    "json_valid",
    "julianday",
    "locate",
    "printf",
    "randomblob",
    "strftime",
    "typeof",
    "unhex",
    "unixepoch",
    "zeroblob",
  ]),
  mysql: new Set([
    "age",
    "array_length",
    "btrim",
    "cardinality",
    "date_part",
    "iif",
    "json_array_length",
    "json_typeof",
    "jsonb_array_length",
    "jsonb_typeof",
    "julianday",
    "num_nonnulls",
    "num_nulls",
    "printf",
    "regexp_match",
    "regexp_matches",
    "split_part",
    "starts_with",
    "strftime",
    "to_char",
    "typeof",
    "unixepoch",
  ]),
};

/** Operators supported only by some dialects. */
const DIALECT_OPERATORS: readonly {
  readonly pattern: RegExp;
  readonly label: string;
  readonly dialects: readonly DatabaseDialect[];
}[] = [
  { pattern: /\bilike\b/i, label: "ILIKE", dialects: ["postgresql"] },
  {
    pattern: /\bsimilar\s+to\b/i,
    label: "SIMILAR TO",
    dialects: ["postgresql"],
  },
  { pattern: /\bglob\b/i, label: "GLOB", dialects: ["sqlite"] },
  // SQLite's REGEXP calls a regexp() function that is not built in.
  { pattern: /\b(?:regexp|rlike)\b/i, label: "REGEXP", dialects: ["mysql"] },
  {
    pattern: /\bis\s+(?:not\s+)?distinct\s+from\b/i,
    label: "IS DISTINCT FROM",
    dialects: ["postgresql", "sqlite"],
  },
];

/**
 * A warning for a safe expression that calls functions or operators the
 * target dialect does not provide. The expression is still emitted: dropping
 * an authored constraint silently is worse than a failing migration.
 */
function dialectIncompatibility(
  raw: string,
  dialect: DatabaseDialect,
  subject: string,
): string | undefined {
  const outside = scanExpression(raw)?.outside ?? raw;
  const found = new Set<string>();
  for (const match of outside.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    const name = (match[1] as string).toLowerCase();
    if (PARENTHESIZED_KEYWORDS.has(name)) continue;
    // CAST(value AS VARCHAR(10)) names a type, not a function.
    if (/\bas\s*$/i.test(outside.slice(0, match.index))) continue;
    const missing =
      dialect === "sqlite"
        ? !SQLITE_FUNCTIONS.has(name)
        : MISSING_FUNCTIONS[dialect].has(name);
    if (missing) found.add(`${name}()`);
  }
  for (const operator of DIALECT_OPERATORS)
    if (!operator.dialects.includes(dialect) && operator.pattern.test(outside))
      found.add(operator.label);
  if (!found.size) return undefined;
  const label = DIALECT_LABEL[dialect];
  return `${subject} uses ${[...found].join(", ")}, which ${label} does not support; the database will reject this DDL unless the expression is rewritten for ${label}.`;
}

/** Deterministic, read-only SQL schema export for one ERD page. */
export function generateDatabaseDdl(
  editor: Editor,
  pageId: PageId,
  dialect: DatabaseDialect,
  options: { readonly frameId?: string } = {},
): DatabaseDdl {
  const warnings: string[] = [];
  // Schema output never follows canvas stacking order. Composite/column order
  // remains authored because those positions carry database semantics.
  const compare = (a: string, b: string): number =>
    a < b ? -1 : a > b ? 1 : 0;
  const pageElements = editor.store.getPageElements(pageId);
  let elements = [...pageElements];
  if (options.frameId !== undefined) {
    const frame = editor.store.get(options.frameId);
    if (frame?.type !== "frame" || frame.page !== pageId)
      throw new Error("DDL scope must be a frame on the selected page.");
    const included = new Set(
      expandContainers(editor.store, [frame.id], editor.createShapeContext(1)),
    );
    elements = elements.filter((element) => {
      if (included.has(element.id)) return true;
      if (element.type !== "erd.relation") return false;
      const relation = element.semantic as ErdRelationSemantic;
      return (
        included.has(relation.from.table) || included.has(relation.to.table)
      );
    });
  }
  const tableSemantic = new Map(
    elements
      .filter((element) => element.type === "erd.table")
      .map((element) => [element.id, element.semantic as ErdTableSemantic]),
  );
  const schemaKey = (element: Element): string => {
    if (element.type === "erd.table")
      return (element.semantic as ErdTableSemantic).tableName;
    if (element.type !== "erd.relation") return element.type;
    const relation = element.semantic as ErdRelationSemantic;
    const endpoint = (end: ErdRelationSemantic["from"]) => {
      const table = tableSemantic.get(end.table);
      return [
        table?.tableName ?? end.table,
        erdEndpointColumnIds(end).map(
          (id) => table?.columns.find((column) => column.id === id)?.name ?? id,
        ),
      ];
    };
    return JSON.stringify([
      endpoint(relation.from),
      endpoint(relation.to),
      relation.cardinality,
      relation.onDelete ?? "",
      relation.onUpdate ?? "",
      relation.deferrability ?? "",
    ]);
  };
  elements.sort(
    (a, b) => compare(schemaKey(a), schemaKey(b)) || compare(a.id, b.id),
  );
  const tables: TableModel[] = elements
    .filter((element) => element.type === "erd.table")
    .map((element) => ({
      element,
      semantic: element.semantic as ErdTableSemantic,
      constraints: [],
      foreignConstraints: [],
    }));
  const relations = elements.filter(
    (element) => element.type === "erd.relation",
  );
  const tablesById = new Map(tables.map((table) => [table.element.id, table]));
  const tableNames = new Set<string>();
  for (const table of tables) {
    const key = table.semantic.tableName.toLocaleLowerCase("en-US");
    if (tableNames.has(key))
      warnings.push(`Duplicate table name: ${table.semantic.tableName}.`);
    tableNames.add(key);
    const columnNames = new Set<string>();
    for (const column of table.semantic.columns) {
      const columnKey = column.name.toLocaleLowerCase("en-US");
      if (columnNames.has(columnKey))
        warnings.push(
          `${table.semantic.tableName}: duplicate column name ${column.name}.`,
        );
      columnNames.add(columnKey);
    }
  }

  const usedConstraintNames = new Set<string>();
  const constraintName = (preferred: string, explicit = false): string => {
    if (explicit) {
      const key = preferred.toLocaleLowerCase("en-US");
      if (usedConstraintNames.has(key))
        warnings.push(`Duplicate constraint name: ${preferred}.`);
      if (
        dialect === "postgresql" &&
        new TextEncoder().encode(preferred).length > 63
      )
        warnings.push(
          `Constraint name ${preferred} exceeds PostgreSQL's 63-byte identifier limit and may be truncated by the database.`,
        );
      usedConstraintNames.add(key);
      return quoteIdentifier(preferred, dialect);
    }
    const base = constraintStem(preferred);
    let candidate = base;
    let suffix = 2;
    while (usedConstraintNames.has(candidate)) {
      candidate = `${base.slice(0, 55 - String(suffix).length - 1)}_${suffix}`;
      suffix += 1;
    }
    usedConstraintNames.add(candidate);
    return quoteIdentifier(candidate, dialect);
  };

  for (const table of tables) {
    for (const check of [...(table.semantic.checks ?? [])].sort(
      (a, b) =>
        compare(a.name ?? a.expression, b.name ?? b.expression) ||
        compare(a.expression, b.expression),
    )) {
      const expression = check.expression.trim();
      const subject = `${table.semantic.tableName}: check ${check.name?.trim() || check.id}`;
      const problem = expressionProblem(expression);
      if (problem) {
        warnings.push(
          `${subject} was omitted because its expression ${problem}.`,
        );
        continue;
      }
      const incompatibility = dialectIncompatibility(
        expression,
        dialect,
        subject,
      );
      if (incompatibility) warnings.push(incompatibility);
      table.constraints.push(
        `CONSTRAINT ${constraintName(check.name?.trim() || `ck_${table.semantic.tableName}_${check.id}`, Boolean(check.name?.trim()))} CHECK (${scanExpression(expression)?.normalized ?? expression})`,
      );
    }
  }

  for (const relation of relations) {
    const semantic = relation.semantic as ErdRelationSemantic;
    // Logical references document a join path the database does not
    // enforce; they deliberately produce no constraint.
    if (semantic.logical === true) continue;
    if (semantic.cardinality === "*:*") {
      warnings.push(
        `${relation.id}: many-to-many relation requires an explicit junction table.`,
      );
      continue;
    }
    const localEnd =
      semantic.cardinality === "*:1" ? semantic.from : semantic.to;
    const remoteEnd =
      semantic.cardinality === "*:1" ? semantic.to : semantic.from;
    const local = tablesById.get(localEnd.table);
    const remote = tablesById.get(remoteEnd.table);
    // The constraint belongs to the referencing table, not its target.
    if (options.frameId !== undefined && !local) continue;
    if (!local || !remote) {
      warnings.push(
        `${relation.id}: relation references a table outside ${options.frameId === undefined ? "this page" : "the selected frame"}; constraint omitted.`,
      );
      continue;
    }
    const localColumnIds = erdEndpointColumnIds(localEnd);
    const remoteColumnIds = erdEndpointColumnIds(remoteEnd);
    if (!localColumnIds.length || !remoteColumnIds.length) {
      warnings.push(
        `${relation.id}: relation needs a column at both endpoints.`,
      );
      continue;
    }
    if (
      new Set(localColumnIds).size !== localColumnIds.length ||
      new Set(remoteColumnIds).size !== remoteColumnIds.length
    ) {
      warnings.push(
        `${relation.id}: foreign-key endpoints repeat a column; the constraint was omitted.`,
      );
      continue;
    }
    if (localColumnIds.length !== remoteColumnIds.length) {
      warnings.push(
        `${relation.id}: foreign-key endpoints contain different numbers of columns.`,
      );
      continue;
    }
    const localColumns = localColumnIds
      .map((id) => local.semantic.columns.find((column) => column.id === id))
      .filter((column): column is ErdColumn => column !== undefined);
    const remoteColumns = remoteColumnIds
      .map((id) => remote.semantic.columns.find((column) => column.id === id))
      .filter((column): column is ErdColumn => column !== undefined);
    if (
      localColumns.length !== localColumnIds.length ||
      remoteColumns.length !== remoteColumnIds.length
    ) {
      warnings.push(`${relation.id}: relation references a missing column.`);
      continue;
    }
    for (const localColumn of localColumns) {
      if (semantic.onDelete === "set-null" && !localColumn.nullable)
        warnings.push(
          `${relation.id}: ON DELETE SET NULL targets non-nullable column ${local.semantic.tableName}.${localColumn.name}.`,
        );
      if (semantic.onUpdate === "set-null" && !localColumn.nullable)
        warnings.push(
          `${relation.id}: ON UPDATE SET NULL targets non-nullable column ${local.semantic.tableName}.${localColumn.name}.`,
        );
      if (
        (semantic.onDelete === "set-default" ||
          semantic.onUpdate === "set-default") &&
        !localColumn.defaultExpression?.trim()
      )
        warnings.push(
          `${relation.id}: SET DEFAULT targets ${local.semantic.tableName}.${localColumn.name}, which has no authored default expression.`,
        );
    }
    if (!isUniqueKey(remote.semantic, remoteColumnIds))
      warnings.push(
        `${relation.id}: referenced columns ${remote.semantic.tableName}.(${remoteColumns.map((column) => column.name).join(", ")}) are not a primary or matching unique key.`,
      );
    const name = constraintName(
      `fk_${local.semantic.tableName}_${localColumns.map((column) => column.name).join("_")}_${remote.semantic.tableName}`,
    );
    local.foreignConstraints.push(
      `CONSTRAINT ${name} FOREIGN KEY (${localColumns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")}) REFERENCES ${quoteIdentifier(remote.semantic.tableName, dialect)} (${remoteColumns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})${referentialActionClause(semantic.onDelete, "DELETE", dialect, relation.id, warnings)}${referentialActionClause(semantic.onUpdate, "UPDATE", dialect, relation.id, warnings)}${deferrabilityClause(semantic.deferrability, dialect, relation.id, warnings)}`,
    );
    if (
      semantic.cardinality === "1:1" &&
      !isUniqueKey(local.semantic, localColumnIds)
    )
      local.constraints.push(
        `CONSTRAINT ${constraintName(`uq_${local.semantic.tableName}_${localColumns.map((column) => column.name).join("_")}`)} UNIQUE (${localColumns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})`,
      );
  }

  const statements = tables.map((table) => {
    if (!table.semantic.columns.length) {
      warnings.push(`${table.semantic.tableName}: table has no columns.`);
      return `-- Skipped empty table ${comment(quoteIdentifier(table.semantic.tableName, dialect))}.`;
    }
    const definitions = table.semantic.columns.map((column) => {
      const parts = [
        quoteIdentifier(column.name, dialect),
        typeFor(column, dialect, warnings, table.semantic.tableName),
      ];
      if (column.autoIncrement) {
        if (dialect === "sqlite")
          parts.splice(1, 1, "INTEGER PRIMARY KEY AUTOINCREMENT");
        else
          parts.push(
            dialect === "mysql"
              ? "AUTO_INCREMENT"
              : column.identityGeneration === "always"
                ? "GENERATED ALWAYS AS IDENTITY"
                : "GENERATED BY DEFAULT AS IDENTITY",
          );
      }
      if (!column.nullable || column.pk) parts.push("NOT NULL");
      const generatedExpression = generatedFor(
        column,
        dialect,
        warnings,
        table.semantic.tableName,
      );
      if (generatedExpression) {
        parts.push("GENERATED ALWAYS AS", `(${generatedExpression})`, "STORED");
        if (column.defaultExpression?.trim())
          warnings.push(
            `${table.semantic.tableName}.${column.name}: default expression was omitted because the column is generated.`,
          );
      } else {
        const defaultExpression = defaultFor(
          column,
          dialect,
          warnings,
          table.semantic.tableName,
        );
        if (defaultExpression) parts.push("DEFAULT", defaultExpression);
      }
      return `  ${parts.join(" ")}`;
    });
    const primary = table.semantic.columns.filter((column) => column.pk);
    if (
      primary.length &&
      !(dialect === "sqlite" && primary.some((column) => column.autoIncrement))
    )
      definitions.push(
        `  CONSTRAINT ${constraintName(`pk_${table.semantic.tableName}`)} PRIMARY KEY (${primary.map((column) => quoteIdentifier(column.name, dialect)).join(", ")})`,
      );
    definitions.push(...table.constraints.map((value) => `  ${value}`));
    if (dialect === "sqlite")
      definitions.push(
        ...table.foreignConstraints.map((value) => `  ${value}`),
      );
    const suffix = dialect === "mysql" ? " ENGINE=InnoDB" : "";
    return `CREATE TABLE ${quoteIdentifier(table.semantic.tableName, dialect)} (\n${definitions.join(",\n")}\n)${suffix};`;
  });
  const foreignKeys =
    dialect === "sqlite"
      ? []
      : tables.flatMap((table) =>
          table.foreignConstraints.map(
            (constraint) =>
              `ALTER TABLE ${quoteIdentifier(table.semantic.tableName, dialect)} ADD ${constraint};`,
          ),
        );
  const usedIndexNames = new Set<string>();
  const allocateIndexName = (preferred: string, explicit: boolean): string => {
    if (explicit) {
      const key = preferred.toLocaleLowerCase("en-US");
      if (usedIndexNames.has(key))
        warnings.push(`Duplicate index name: ${preferred}.`);
      if (
        dialect === "postgresql" &&
        new TextEncoder().encode(preferred).length > 63
      )
        warnings.push(
          `Index name ${preferred} exceeds PostgreSQL's 63-byte identifier limit and may be truncated by the database.`,
        );
      usedIndexNames.add(key);
      return preferred;
    }
    const base = constraintStem(preferred);
    let candidate = base;
    let suffix = 2;
    while (usedIndexNames.has(candidate)) {
      candidate = `${base.slice(0, 55 - String(suffix).length - 1)}_${suffix}`;
      suffix += 1;
    }
    usedIndexNames.add(candidate);
    return candidate;
  };
  const indexes = tables.flatMap((table) =>
    [...(table.semantic.indexes ?? [])]
      .sort((a, b) => {
        const key = (index: typeof a) =>
          JSON.stringify([
            index.name ?? "",
            index.columns.map(
              (id) =>
                table.semantic.columns.find((column) => column.id === id)
                  ?.name ?? id,
            ),
            !!index.unique,
          ]);
        return compare(key(a), key(b));
      })
      .flatMap((index) => {
        const seenColumns = new Set<string>();
        const columns = index.columns.flatMap((columnId) => {
          if (seenColumns.has(columnId)) {
            warnings.push(
              `${table.semantic.tableName}: index ${index.name || index.id} repeats column ${columnId}; the duplicate was omitted.`,
            );
            return [];
          }
          seenColumns.add(columnId);
          const column = table.semantic.columns.find(
            (candidate) => candidate.id === columnId,
          );
          if (!column)
            warnings.push(
              `${table.semantic.tableName}: index ${index.name || index.id} references missing column ${columnId}.`,
            );
          return column ? [column] : [];
        });
        if (!columns.length) {
          warnings.push(
            `${table.semantic.tableName}: index ${index.name || index.id} has no usable columns and was skipped.`,
          );
          return [];
        }
        const primary = table.semantic.columns
          .filter((column) => column.pk)
          .map((column) => column.id);
        if (
          primary.length === index.columns.length &&
          primary.every((columnId, at) => columnId === index.columns[at])
        ) {
          warnings.push(
            `${table.semantic.tableName}: index ${index.name || index.id} duplicates the primary key and was skipped.`,
          );
          return [];
        }
        const explicitName = index.name?.trim() || undefined;
        const preferred =
          explicitName ||
          `${index.unique ? "uq" : "idx"}_${table.semantic.tableName}_${columns
            .map((column) => column.name)
            .join("_")}`;
        const name = allocateIndexName(preferred, explicitName !== undefined);
        return [
          `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(name, dialect)} ON ${quoteIdentifier(table.semantic.tableName, dialect)} (${columns.map((column) => quoteIdentifier(column.name, dialect)).join(", ")});`,
        ];
      }),
  );
  const objects = databaseObjectsDdl(
    elements,
    dialect,
    (name) => quoteIdentifier(name, dialect),
    (dataType, name) =>
      typeFor({ id: name, name, dataType }, dialect, warnings, name),
  );
  warnings.push(...objects.warnings);
  if (!tables.length && !objects.count)
    warnings.push(
      "This page contains no ERD tables or database objects with exportable definitions.",
    );
  const header = [
    `-- Generated by nodetto for ${dialect}.`,
    "-- Review this migration before applying it to a database.",
    ...warnings.map((warning) => `-- Warning: ${comment(warning)}`),
  ];
  const sql = [
    ...header,
    ...(dialect === "sqlite" && tables.length
      ? ["", "PRAGMA foreign_keys = ON;"]
      : []),
    ...(statements.length ? ["", statements.join("\n\n")] : []),
    ...(indexes.length ? ["", indexes.join("\n")] : []),
    ...(foreignKeys.length ? ["", foreignKeys.join("\n")] : []),
    ...(objects.statements.length ? ["", objects.statements.join("\n\n")] : []),
    "",
  ].join("\n");
  return {
    dialect,
    sql,
    warnings,
    tableCount: tables.length,
    objectCount: objects.count,
    relationCount: relations.length,
    indexCount: tables.reduce(
      (count, table) => count + (table.semantic.indexes?.length ?? 0),
      0,
    ),
    checkCount: tables.reduce(
      (count, table) => count + (table.semantic.checks?.length ?? 0),
      0,
    ),
  };
}
