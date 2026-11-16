import { graphemes } from "../text-layout.ts";
import { isWideCodePoint } from "../wide-text-width.ts";
import {
  codePaletteFor,
  resolveSyntaxKind,
  tokenizeCode,
  type CodePalette,
  type SegmentKind,
} from "../syntax/index.ts";
export const CODE_FONT_STACK = "ui-monospace, SFMono-Regular, Menlo, monospace";
export interface CodeLayoutInput {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  wrap?: boolean;
  width?: number;
  fontSize?: number;
  fill?: string;
}
export interface CodeRun {
  x: number;
  text: string;
  source: string;
  kind: SegmentKind;
  columns: number;
}
export interface CodeLine {
  y: number;
  number?: number;
  runs: readonly CodeRun[];
}
export interface CodeLayout {
  width: number;
  height: number;
  padding: number;
  gutterWidth: number;
  fontSize: number;
  lineHeight: number;
  advance: number;
  mode: "light" | "dark";
  palette: CodePalette;
  panelFill: string;
  lines: readonly CodeLine[];
}
export function codeSnippetLayout(input: CodeLayoutInput): CodeLayout {
  const fontSize = input.fontSize ?? 13;
  const lineHeight = Math.round(fontSize * 1.5);
  const advance = fontSize * 0.6;
  const padding = 12;
  const width = Math.max(80, input.width ?? 480);
  const tokens = tokenizeCode(
    input.code,
    resolveSyntaxKind(input.language) ?? "plain",
  );
  const gutterWidth = input.showLineNumbers
    ? (String(tokens.length).length + 1) * advance + 8
    : 0;
  const maxColumns = Math.max(
    1,
    Math.floor((width - 2 * padding - gutterWidth) / advance),
  );
  const lines: CodeLine[] = [];
  for (const [index, segments] of tokens.entries()) {
    let runs: CodeRun[] = [];
    let column = 0;
    let sourceColumn = 0;
    let first = true;
    const flush = () => {
      lines.push({
        y: padding + lines.length * lineHeight + Math.round(lineHeight * 0.72),
        ...(first && input.showLineNumbers ? { number: index + 1 } : {}),
        runs,
      });
      runs = [];
      column = 0;
      first = false;
    };
    for (const segment of segments)
      for (const unit of graphemes(segment.text)) {
        const columns =
          unit === "\t"
            ? 4 - (sourceColumn % 4)
            : isWideCodePoint(unit.codePointAt(0) ?? 0)
              ? 2
              : 1;
        if (input.wrap && column > 0 && column + columns > maxColumns) flush();
        const text = unit === "\t" ? " ".repeat(columns) : unit;
        const previous = runs[runs.length - 1];
        if (previous?.kind === segment.kind) {
          previous.text += text;
          previous.source += unit;
          previous.columns += columns;
        } else
          runs.push({
            x: padding + gutterWidth + column * advance,
            text,
            source: unit,
            kind: segment.kind,
            columns,
          });
        column += columns;
        sourceColumn += columns;
      }
    flush();
  }
  return {
    width,
    height: 2 * padding + Math.max(1, lines.length) * lineHeight,
    padding,
    gutterWidth,
    fontSize,
    lineHeight,
    advance,
    ...codePaletteFor(input.fill),
    lines,
  };
}
