// SQL dialects, identifier quoting and comment/string literal escaping.

export const DATABASE_DIALECTS = ["postgresql", "mysql", "sqlite"] as const;
export type DatabaseDialect = (typeof DATABASE_DIALECTS)[number];

export const DIALECT_LABEL: Readonly<Record<DatabaseDialect, string>> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

export function quoteIdentifier(
  value: string,
  dialect: DatabaseDialect,
): string {
  return dialect === "mysql"
    ? `\`${value.replaceAll("`", "``")}\``
    : `"${value.replaceAll('"', '""')}"`;
}

export function constraintStem(value: string): string {
  const stem = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return (stem || "constraint").slice(0, 55);
}

/** Flatten text for a `--` line comment: any line break would end it. */
export function comment(value: string): string {
  return value.replace(/[\n\r\v\f\u0085\u2028\u2029]+/g, " ");
}

/** Replace control characters other than tab and line feed with spaces. */
function withoutControlCharacters(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    out +=
      code === 9 || code === 10 || (code >= 32 && code !== 127)
        ? character
        : " ";
  }
  return out;
}

/**
 * Authored documentation as `--` lines, one per authored line, so no line
 * break can end a comment early. Blank text yields no lines.
 */
export function commentLines(
  value: string | undefined,
  indent: string,
): string[] {
  const text = value?.trim();
  if (!text) return [];
  return text.split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/).map((line) => {
    const clean = withoutControlCharacters(line).trimEnd();
    return clean ? `${indent}-- ${clean}` : `${indent}--`;
  });
}

/** Trimmed text with LF line breaks and no control characters but tab. */
export function commentText(value: string): string {
  return withoutControlCharacters(
    value.trim().replace(/\r\n?|[\v\f\u0085\u2028\u2029]/g, "\n"),
  );
}

/**
 * A PostgreSQL string literal. Text with a backslash or line break uses an
 * escape string, whose meaning does not depend on standard_conforming_strings.
 */
export function postgresqlString(value: string): string {
  const text = commentText(value).replaceAll("'", "''");
  return /[\\\n]/.test(text)
    ? `E'${text.replaceAll("\\", "\\\\").replaceAll("\n", "\\n")}'`
    : `'${text}'`;
}

/**
 * A MySQL string literal. Escaping the backslash keeps the literal closed
 * whether or not NO_BACKSLASH_ESCAPES is set.
 */
export function mysqlString(value: string): string {
  return `'${commentText(value).replaceAll("\\", "\\\\").replaceAll("'", "''").replaceAll("\n", "\\n")}'`;
}

/** MySQL's documented comment length limits, in characters. */
export const MYSQL_COMMENT_LIMIT = { table: 2048, column: 1024 } as const;
