import type { MdBlock, MdInline } from "./ast.ts";
import { parseInline } from "./inline.ts";

type ListMatch = {
  indent: number;
  offset: number;
  ordered: boolean;
  start: number;
  content: string;
};
function listMatch(line: string): ListMatch | undefined {
  const match = /^( *)([-+*]|[0-9]+[.)]) +(.+|)$/.exec(line);
  if (!match || (match[1]?.length ?? 0) >= 4) return undefined;
  const marker = match[2] ?? "-";
  return {
    indent: match[1]?.length ?? 0,
    offset: line.length - (match[3]?.length ?? 0),
    ordered: /^[0-9]/.test(marker),
    start: Number.parseInt(marker, 10) || 1,
    content: match[3] ?? "",
  };
}
function cells(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);
  const result: string[] = [];
  let cell = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && value[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (value[i] === "|") {
      result.push(cell.trim());
      cell = "";
    } else cell += value[i];
  }
  result.push(cell.trim());
  return result;
}
function alignment(
  line: string,
): ("left" | "center" | "right" | null)[] | undefined {
  const parts = cells(line);
  if (!parts.every((part) => /^:?-+:?$/.test(part))) return undefined;
  return parts.map((part) =>
    part.startsWith(":")
      ? part.endsWith(":")
        ? "center"
        : "left"
      : part.endsWith(":")
        ? "right"
        : null,
  );
}
function rule(line: string): boolean {
  return /^ {0,3}(?:(?:\* *){3,}|(?:- *){3,}|(?:_ *){3,})$/.test(line);
}
function fence(line: string): RegExpExecArray | null {
  return /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
}
function startsBlock(line: string): boolean {
  return (
    /^ {0,3}(?:#{1,6}(?:\s|$)|>)/.test(line) ||
    !!fence(line) ||
    !!listMatch(line) ||
    rule(line)
  );
}
export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }
    const open = fence(line);
    if (open) {
      const marker = open[1] ?? "```";
      const language = (open[2] ?? "").trim().split(/\s+/)[0] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const candidate = (lines[i] ?? "").trim();
        let n = 0;
        while (candidate[n] === marker[0]) n++;
        if (n >= marker.length && !candidate.slice(n).trim()) {
          i++;
          break;
        }
        body.push(lines[i] ?? "");
        i++;
      }
      blocks.push({ kind: "code", language, text: body.join("\n") });
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:\s+|$)(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: (heading[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        inlines: parseInline(
          (heading[2] ?? "").replace(/\s+#+\s*$/, "").trim(),
        ),
      });
      i++;
      continue;
    }
    if (/^ {0,3}>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i] ?? "")) {
        quoted.push((lines[i] ?? "").replace(/^ {0,3}> ?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", blocks: parseMarkdown(quoted.join("\n")) });
      continue;
    }
    if (rule(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    const first = listMatch(line);
    if (first) {
      const items: { task?: boolean; blocks: MdBlock[] }[] = [];
      while (i < lines.length) {
        const item = listMatch(lines[i] ?? "");
        if (
          !item ||
          item.indent !== first.indent ||
          item.ordered !== first.ordered
        )
          break;
        let content = item.content;
        const task = /^\[([ xX])\] +/.exec(content);
        if (task) content = content.slice(task[0].length);
        const body = [content];
        i++;
        while (i < lines.length) {
          const next = lines[i] ?? "";
          if (!next.trim()) break;
          const spaces = /^ */.exec(next)?.[0].length ?? 0;
          if (spaces < item.offset) break;
          body.push(next.slice(item.offset));
          i++;
        }
        const result: { task?: boolean; blocks: MdBlock[] } = {
          blocks: parseMarkdown(body.join("\n")),
        };
        if (task) result.task = task[1]?.toLowerCase() === "x";
        items.push(result);
      }
      blocks.push({
        kind: "list",
        ordered: first.ordered,
        start: first.start,
        items,
      });
      continue;
    }
    const align =
      i + 1 < lines.length ? alignment(lines[i + 1] ?? "") : undefined;
    if (
      align &&
      cells(line).length === align.length &&
      (line.includes("|") || /[|:]/.test(lines[i + 1] ?? ""))
    ) {
      const header = cells(line).map(parseInline);
      const rows: MdInline[][][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").trim()) {
        const row = cells(lines[i] ?? "");
        rows.push(align.map((_, index) => parseInline(row[index] ?? "")));
        i++;
      }
      blocks.push({ kind: "table", align, header, rows });
      continue;
    }
    const paragraph = [line];
    let setext = false;
    i++;
    while (i < lines.length && (lines[i] ?? "").trim()) {
      const next = lines[i] ?? "";
      if (/^ {0,3}(?:=+|-+)\s*$/.test(next)) {
        blocks.push({
          kind: "heading",
          level: next.trim()[0] === "=" ? 1 : 2,
          inlines: parseInline(paragraph.join("\n")),
        });
        setext = true;
        i++;
        break;
      }
      if (startsBlock(next)) break;
      paragraph.push(next);
      i++;
    }
    if (!setext)
      blocks.push({
        kind: "paragraph",
        inlines: parseInline(paragraph.join("\n")),
      });
  }
  return blocks;
}
