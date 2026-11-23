const CHUNK = 16_384;

/**
 * `text.split("\n")` for whole documents.
 *
 * The native CLI's interpreter searches a string in time proportional to
 * the string's full length for every separator it finds, so one split of a
 * 2 MB document with 10,000 lines takes seconds. Splitting bounded chunks
 * and joining the line that straddles each boundary keeps the work linear.
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
