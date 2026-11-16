import type { MdInline } from "./ast.ts";

type Delimiter = { marker: string; nodes: MdInline[] };

/** Parse the supported inline subset without unbounded delimiter backtracking. */
export function parseInline(source: string): MdInline[] {
  return parse(source, 0);
}

function parse(source: string, depth: number): MdInline[] {
  const root: MdInline[] = [];
  const stack: Delimiter[] = [{ marker: "", nodes: root }];
  let buffer = "";
  const current = () => stack[stack.length - 1]?.nodes ?? root;
  const flush = () => {
    if (buffer) current().push({ kind: "text", text: buffer });
    buffer = "";
  };
  // Pair equal-length backtick runs in one pass from right to left.
  const nextTicks = new Map<number, number>();
  const ticks = new Map<number, number>();
  for (let p = source.length - 1; p >= 0; ) {
    if (source[p] !== "`") {
      p--;
      continue;
    }
    const end = p + 1;
    while (p >= 0 && source[p] === "`") p--;
    const start = p + 1;
    const length = end - start;
    const next = ticks.get(length);
    if (next !== undefined) nextTicks.set(start, next);
    ticks.set(length, start);
  }
  for (let i = 0; i < source.length; ) {
    const ch = source[i] ?? "";
    if (ch === "\\" && i + 1 < source.length) {
      const next = source[i + 1] ?? "";
      if (next === "\n") {
        flush();
        current().push({ kind: "break" });
        i += 2;
        continue;
      }
      if (/^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(next)) {
        buffer += next;
        i += 2;
        continue;
      }
    }
    if (ch === "\n") {
      if (buffer.endsWith("  ")) {
        buffer = buffer.slice(0, -2);
        flush();
        current().push({ kind: "break" });
      } else buffer += " ";
      i++;
      continue;
    }
    if (ch === "`") {
      let end = i + 1;
      while (source[end] === "`") end++;
      const close = nextTicks.get(i);
      if (close !== undefined) {
        flush();
        let value = source.slice(end, close).replace(/\n/g, " ");
        if (value.startsWith(" ") && value.endsWith(" ") && value.trim())
          value = value.slice(1, -1);
        current().push({ kind: "code", text: value });
        i = close + end - i;
        continue;
      }
      buffer += source.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "&") {
      const match = /^&(amp|lt|gt|quot|#[0-9]+|#x[0-9a-fA-F]+);/.exec(
        source.slice(i, i + 20),
      );
      if (match?.[1]) {
        const entity = match[1];
        const named: Record<string, string> = {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
        };
        let value = named[entity];
        if (value === undefined) {
          const number =
            entity[1] === "x"
              ? Number.parseInt(entity.slice(2), 16)
              : Number.parseInt(entity.slice(1), 10);
          value =
            number > 0 &&
            number <= 0x10ffff &&
            !(number >= 0xd800 && number <= 0xdfff)
              ? String.fromCodePoint(number)
              : "\ufffd";
        }
        buffer += value;
        i += match[0].length;
        continue;
      }
    }
    // Bound lookahead and recursion for malformed or deeply nested links.
    if ((ch === "[" || (ch === "!" && source[i + 1] === "[")) && depth < 32) {
      const image = ch === "!";
      const open = i + (image ? 1 : 0);
      const limit = Math.min(source.length, i + 4096);
      const relativeEnd = source.slice(open + 1, limit).indexOf("](");
      const endLabel = relativeEnd < 0 ? -1 : open + 1 + relativeEnd;
      if (endLabel >= 0 && endLabel < limit) {
        let end = endLabel + 2;
        let parentheses = 0;
        while (end < limit) {
          if (source[end] === "\\") {
            end += 2;
            continue;
          }
          if (source[end] === "(") parentheses++;
          if (source[end] === ")") {
            if (parentheses === 0) break;
            parentheses--;
          }
          end++;
        }
        if (end < limit) {
          if (image) buffer += source.slice(i, end + 1);
          else {
            const target = source.slice(endLabel + 2, end).trim();
            const href = target.replace(/\s+["'][^"']*["']\s*$/, "");
            flush();
            current().push({
              kind: "link",
              href,
              children: parse(source.slice(open + 1, endLabel), depth + 1),
            });
          }
          i = end + 1;
          continue;
        }
      }
    }
    if (ch === "<") {
      const match = /^<([a-zA-Z][a-zA-Z0-9+.-]*:[^<>\s]+)>/.exec(
        source.slice(i, i + 4096),
      );
      if (match?.[1]) {
        flush();
        current().push({
          kind: "link",
          href: match[1],
          children: [{ kind: "text", text: match[1] }],
        });
        i += match[0].length;
        continue;
      }
    }
    if (ch === "*" || ch === "_" || ch === "~") {
      let end = i + 1;
      while (source[end] === ch) end++;
      let remaining = end - i;
      while (remaining > 0) {
        const top = stack[stack.length - 1];
        const before = source[i - 1] ?? " ";
        const closeLength =
          top?.marker[0] === ch && !/\s/.test(before) ? top.marker.length : 0;
        const count =
          closeLength > 0 && closeLength <= remaining
            ? closeLength
            : remaining >= 2
              ? 2
              : 1;
        const marker = ch.repeat(count);
        if (ch === "~" && count === 1) {
          buffer += marker;
          remaining--;
          continue;
        }
        const after = source[end] ?? " ";
        if (top?.marker === marker && !/\s/.test(before)) {
          flush();
          stack.pop();
          current().push({
            kind: count === 2 ? (ch === "~" ? "strike" : "strong") : "emph",
            children: top.nodes,
          });
        } else if (
          stack.length < 64 &&
          !/\s/.test(after) &&
          !(
            ch === "_" &&
            /[a-zA-Z0-9]/.test(before) &&
            /[a-zA-Z0-9]/.test(after)
          )
        ) {
          flush();
          stack.push({ marker, nodes: [] });
        } else buffer += marker;
        remaining -= count;
      }
      i = end;
      continue;
    }
    buffer += ch;
    i++;
  }
  flush();
  while (stack.length > 1) {
    const unfinished = stack.pop();
    if (unfinished)
      current().push(
        { kind: "text", text: unfinished.marker },
        ...unfinished.nodes,
      );
  }
  return root;
}
