// Safety scan and dialect compatibility checks for CHECK, generated-column
// and partial-index expressions.

import { type DatabaseDialect, DIALECT_LABEL } from "./dialect.ts";

/**
 * Longest CHECK or generated-column expression the exporter emits. The cap
 * bounds the safety scan only; every supported database accepts far longer
 * expressions.
 */
export const MAX_SQL_EXPRESSION_LENGTH = 65536;

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
export function scanExpression(raw: string): ScannedExpression | undefined {
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
 * PostgreSQL additionally accepts "::" casts, the "~" regular-expression
 * operators and balanced "[ ]" (ARRAY[...] and subscripts).
 */
export function expressionProblem(
  raw: string,
  dialect: DatabaseDialect,
): string | undefined {
  if (!raw) return "is empty";
  if (raw.length > MAX_SQL_EXPRESSION_LENGTH)
    return `is ${raw.length} characters long, over the ${MAX_SQL_EXPRESSION_LENGTH}-character limit`;
  // MySQL treats backslash as a literal escape by default, so a backslash
  // would let MySQL and this scanner disagree about where a literal ends.
  if (raw.includes("\\"))
    return 'contains "\\"; backslash escapes differ between dialects';
  const scanned = scanExpression(raw);
  if (scanned === undefined) return "has an unterminated string literal";
  const { literals } = scanned;
  const postgresql = dialect === "postgresql";
  // "::" is only ever a cast, so blanking it keeps a lone ":" rejected.
  const outside = postgresql
    ? scanned.outside.replaceAll("::", "  ")
    : scanned.outside;
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
  const unsupported = (
    postgresql
      ? /[^A-Za-z0-9_ \t\n\r(),.+\-*/%<>=!|&~[\]]/
      : /[^A-Za-z0-9_ \t\n\r(),.+\-*/%<>=!|&]/
  ).exec(outside)?.[0];
  if (unsupported)
    return unsupported === ":"
      ? postgresql
        ? 'contains ":" outside a "::" cast'
        : `contains ":"; "::" casts are PostgreSQL-only, so write CAST(value AS type) for ${DIALECT_LABEL[dialect]}`
      : unsupported === "~"
        ? `contains "~"; regular-expression operators are PostgreSQL-only`
        : unsupported === "[" || unsupported === "]"
          ? `contains "${unsupported}"; arrays and subscripts are PostgreSQL-only`
          : `contains the unsupported character "${unsupported}"`;
  for (const [open, close, name] of [
    ["(", ")", "parentheses"],
    ["[", "]", "brackets"],
  ] as const) {
    let depth = 0;
    for (const character of outside) {
      if (character === open) depth += 1;
      if (character === close && --depth < 0) return `has unbalanced ${name}`;
    }
    if (depth !== 0) return `has unbalanced ${name}`;
  }
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
export function dialectIncompatibility(
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
