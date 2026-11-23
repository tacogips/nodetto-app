const CHUNK = 16_384;

/**
 * `text.split("\n")` in linear time on every engine; see
 * `splitLines` in `@nodetto/ir`. Kept as a copy because this folder
 * imports only itself, so that it can become a package.
 */
export function splitLines(text: string): string[] {
  if (text.length <= CHUNK) return text.split("\n");
  const lines: string[] = [];
  let carry = "";
  for (let at = 0; at < text.length; at += CHUNK) {
    const parts = text.slice(at, at + CHUNK).split("\n");
    parts[0] = carry + (parts[0] ?? "");
    carry = parts.pop() ?? "";
    for (const part of parts) lines.push(part);
  }
  lines.push(carry);
  return lines;
}
