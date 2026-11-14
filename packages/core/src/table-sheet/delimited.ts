function parse(text: string, separator: string): string[][] {
  if (text === "") return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let ended = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    ended = false;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      ended = true;
    } else field += c;
  }
  if (!ended) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
export function parseTsv(text: string): string[][] {
  return parse(text, "\t");
}
export function parseCsv(text: string): string[][] {
  return parse(text.startsWith("\ufeff") ? text.slice(1) : text, ",");
}
export function serializeTsv(grid: readonly (readonly string[])[]): string {
  return grid
    .map((row) =>
      row
        .map((field) =>
          /[\t\r\n"]/u.test(field) || (field === "" && row.length === 1)
            ? `"${field.replaceAll('"', '""')}"`
            : field,
        )
        .join("\t"),
    )
    .join("\n");
}
