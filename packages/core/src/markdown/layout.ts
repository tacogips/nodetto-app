import { graphemes } from "../text-layout.ts";
import { measureTextWidth } from "../text-measure.ts";
import { isWideCodePoint } from "../wide-text-width.ts";
import type { MdBlock, MdInline } from "./ast.ts";

export const MARKDOWN_PADDING = 16;
export const MARKDOWN_MIN_HEIGHT = 32;
export interface MdCodeSegment {
  readonly text: string;
  readonly kind: string;
}
export type MdHighlighter = (
  code: string,
  language: string,
) => readonly (readonly MdCodeSegment[])[];
export interface MdRun {
  x: number;
  y: number;
  size: number;
  text: string;
  weight: 400 | 700;
  italic: boolean;
  mono: boolean;
  strike: boolean;
  underline: boolean;
  role: string;
  href?: string;
}
export interface MdBox {
  kind:
    | "codePanel"
    | "inlineCode"
    | "quoteBar"
    | "rule"
    | "cell"
    | "headerCell"
    | "bullet"
    | "task";
  x: number;
  y: number;
  width: number;
  height: number;
  checked?: boolean;
  level?: number;
}
export interface MdLayout {
  width: number;
  height: number;
  boxes: readonly MdBox[];
  runs: readonly MdRun[];
}

type Style = Pick<
  MdRun,
  | "size"
  | "weight"
  | "italic"
  | "mono"
  | "strike"
  | "underline"
  | "role"
  | "href"
>;
type Part = { text: string; style: Style } | { br: true };
const body: Style = {
  size: 14,
  weight: 400,
  italic: false,
  mono: false,
  strike: false,
  underline: false,
  role: "plain",
};
const safeHref = (href: string): boolean => /^(https?:|mailto:)/i.test(href);
function flatten(
  inlines: readonly MdInline[],
  style: Style,
  parts: Part[],
): void {
  for (const node of inlines) {
    switch (node.kind) {
      case "text":
        parts.push({ text: node.text, style });
        break;
      case "code":
        parts.push({
          text: node.text,
          style: { ...style, mono: true, size: style.size * 0.9 },
        });
        break;
      case "break":
        parts.push({ br: true });
        break;
      case "strong":
        flatten(node.children, { ...style, weight: 700 }, parts);
        break;
      case "emph":
        flatten(node.children, { ...style, italic: true }, parts);
        break;
      case "strike":
        flatten(node.children, { ...style, strike: true }, parts);
        break;
      case "link":
        flatten(
          node.children,
          {
            ...style,
            role: "link",
            underline: true,
            ...(safeHref(node.href)
              ? { href: node.href }
              : { href: undefined }),
          },
          parts,
        );
        break;
    }
  }
}
function advance(text: string, style: Style): number {
  if (!style.mono)
    return measureTextWidth(
      text,
      { fontSize: style.size, fontWeight: style.italic ? 400 : style.weight },
      "proportional",
    );
  return graphemes(text).reduce(
    (n, g) =>
      n + style.size * 0.6 * (isWideCodePoint(g.codePointAt(0) ?? 0) ? 2 : 1),
    0,
  );
}

export function markdownLayout(
  blocks: readonly MdBlock[],
  width: number,
  options: { highlight?: MdHighlighter } = {},
): MdLayout {
  const boxes: MdBox[] = [];
  const runs: MdRun[] = [];
  const contentWidth = Math.max(1, width - MARKDOWN_PADDING * 2);
  let y = MARKDOWN_PADDING;
  const text = (
    inlines: readonly MdInline[],
    x: number,
    top: number,
    maxWidth: number,
    style: Style,
    lineHeight: number,
  ): number => {
    const parts: Part[] = [];
    flatten(inlines, style, parts);
    let lineX = x;
    let lineY = top;
    const right = x + Math.max(1, maxWidth);
    const newline = (): void => {
      lineX = x;
      lineY += lineHeight;
    };
    const emit = (value: string, s: Style): void => {
      if (!value) return;
      const w = advance(value, s);
      if (s.mono)
        boxes.push({
          kind: "inlineCode",
          x: lineX,
          y: lineY,
          width: w,
          height: lineHeight,
        });
      runs.push({ ...s, x: lineX, y: lineY + lineHeight * 0.8, text: value });
      lineX += w;
    };
    for (const part of parts) {
      if ("br" in part) {
        newline();
        continue;
      }
      for (const token of part.text.split(/( +)/)) {
        if (!token) continue;
        const space = token[0] === " ";
        const tokenWidth = advance(token, part.style);
        if (lineX > x && lineX + tokenWidth > right) {
          newline();
          if (space) continue;
        }
        if (tokenWidth <= right - x) {
          if (!(space && lineX === x)) emit(token, part.style);
          continue;
        }
        for (const g of graphemes(token)) {
          if (lineX > x && lineX + advance(g, part.style) > right) newline();
          emit(g, part.style);
        }
      }
    }
    return lineY + lineHeight;
  };
  const render = (
    items: readonly MdBlock[],
    x: number,
    available: number,
    level: number,
    role: string,
  ): void => {
    items.forEach((block, index) => {
      if (index > 0) y += 10;
      switch (block.kind) {
        case "paragraph":
          y = text(block.inlines, x, y, available, { ...body, role }, 21);
          break;
        case "heading": {
          const size = [26, 22, 18, 16, 14, 13][block.level - 1] ?? 14;
          y = text(
            block.inlines,
            x,
            y,
            available,
            { ...body, role, size, weight: 700 },
            Math.round(size * 1.3),
          );
          break;
        }
        case "rule":
          y += 12;
          boxes.push({ kind: "rule", x, y, width: available, height: 1 });
          y += 13;
          break;
        case "quote": {
          const top = y;
          render(
            block.blocks,
            x + 14,
            Math.max(1, available - 14),
            level,
            "comment",
          );
          boxes.push({
            kind: "quoteBar",
            x,
            y: top,
            width: 3,
            height: y - top,
          });
          break;
        }
        case "list": {
          block.items.forEach((item, i) => {
            if (i > 0) y += 0;
            if (item.task !== undefined)
              boxes.push({
                kind: "task",
                x,
                y: y + 4,
                width: 12,
                height: 12,
                checked: item.task,
              });
            else if (block.ordered)
              runs.push({
                ...body,
                role,
                x,
                y: y + 17,
                text: `${block.start + i}.`,
              });
            else
              boxes.push({
                kind: "bullet",
                x: x + 3,
                y: y + 8,
                width: 5,
                height: 5,
                level: level + 1,
              });
            render(
              item.blocks,
              x + 22,
              Math.max(1, available - 22),
              level + 1,
              role,
            );
          });
          break;
        }
        case "code": {
          const top = y;
          const panel: MdBox = {
            kind: "codePanel",
            x,
            y,
            width: available,
            height: 0,
          };
          boxes.push(panel);
          const lines =
            options.highlight?.(block.text, block.language) ??
            block.text
              .split("\n")
              .map((line) => [{ text: line, kind: "plain" }]);
          let cy = y + 8;
          const left = x + 8;
          const right = x + Math.max(8, available - 8);
          for (const line of lines) {
            let cx = left;
            for (const segment of line) {
              let chunk = "";
              const flush = (): void => {
                if (chunk) {
                  runs.push({
                    ...body,
                    size: 12,
                    mono: true,
                    role: segment.kind,
                    x: cx - advance(chunk, { ...body, size: 12, mono: true }),
                    y: cy + 14,
                    text: chunk,
                  });
                  chunk = "";
                }
              };
              for (const g of graphemes(segment.text)) {
                const w = advance(g, { ...body, size: 12, mono: true });
                if (cx > left && cx + w > right) {
                  flush();
                  cx = left;
                  cy += 18;
                }
                chunk += g;
                cx += w;
              }
              flush();
            }
            cy += 18;
          }
          y = cy + 8;
          panel.height = y - top;
          break;
        }
        case "table": {
          const count = block.header.length;
          if (!count) break;
          const columns = Array.from({ length: count }, (_, i) => {
            const cells = [
              block.header[i] ?? [],
              ...block.rows.map((row) => row[i] ?? []),
            ];
            return Math.max(
              48,
              ...cells.map((cell) => {
                const parts: Part[] = [];
                flatten(cell, body, parts);
                return (
                  parts.reduce(
                    (n, p) => n + ("text" in p ? advance(p.text, p.style) : 0),
                    0,
                  ) + 16
                );
              }),
            );
          });
          const sum = columns.reduce((a, b) => a + b, 0);
          const widths = columns.map((v) =>
            sum > available ? Math.max(48, (v * available) / sum) : v,
          );
          const rows = [block.header, ...block.rows];
          for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri] ?? [];
            const top = y;
            let cellX = x;
            let bottom = top + 21 + 16;
            const rowBoxes: MdBox[] = [];
            for (let i = 0; i < count; i++) {
              const cellWidth = widths[i] ?? 48;
              const start = runs.length;
              const end = text(
                row[i] ?? [],
                cellX + 8,
                top + 8,
                Math.max(1, cellWidth - 16),
                { ...body, role, weight: ri === 0 ? 700 : 400 },
                21,
              );
              bottom = Math.max(bottom, end + 8);
              const align = block.align[i];
              if (align === "center" || align === "right") {
                const byLine = new Map<number, MdRun[]>();
                for (const run of runs.slice(start)) {
                  const line = byLine.get(run.y) ?? [];
                  line.push(run);
                  byLine.set(run.y, line);
                }
                for (const line of byLine.values()) {
                  const last = line[line.length - 1];
                  if (!last) continue;
                  const remaining = Math.max(
                    0,
                    cellX + cellWidth - 8 - (last.x + advance(last.text, last)),
                  );
                  const shift = align === "center" ? remaining / 2 : remaining;
                  for (const run of line) run.x += shift;
                }
              }
              const box: MdBox = {
                kind: ri === 0 ? "headerCell" : "cell",
                x: cellX,
                y: top,
                width: cellWidth,
                height: 0,
              };
              boxes.push(box);
              rowBoxes.push(box);
              cellX += cellWidth;
            }
            for (const box of rowBoxes) box.height = bottom - top;
            y = bottom;
          }
          break;
        }
      }
    });
  };
  render(blocks, MARKDOWN_PADDING, contentWidth, 0, "plain");
  return {
    width,
    height: Math.max(MARKDOWN_MIN_HEIGHT, y + MARKDOWN_PADDING),
    boxes,
    runs,
  };
}
