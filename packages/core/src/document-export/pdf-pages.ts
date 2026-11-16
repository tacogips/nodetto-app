import { AVERAGE_GLYPH_WIDTH } from "../text-layout.ts";
import { LIBERATION_SANS_ADVANCES } from "../text-metrics/advances.generated.ts";
import { isWideCodePoint } from "../wide-text-width.ts";

export type PdfFontClass = "sans" | "sans-bold" | "mono";
export interface PdfTextRun {
  x: number;
  y: number;
  size: number;
  text: string;
  font: PdfFontClass;
}
export interface PdfPageLayout {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PdfPageSpec {
  width: number;
  height: number;
  layout: PdfPageLayout;
  textRuns: readonly PdfTextRun[];
}
export interface PdfType3Font {
  name: string;
  firstChar: 1;
  lastChar: number;
  widths: number[];
  glyphProcs: { glyph: string; content: string }[];
  differences: string[];
  toUnicode: string;
}
export interface PdfTextLayer {
  fonts: PdfType3Font[];
  pages: { fontNames: string[]; content: string }[];
}

const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
const number = (n: number) => n.toFixed(3).replace(/\.?0+$/, "") || "0";
function width(ch: string, font: PdfFontClass): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (font === "mono") return isWideCodePoint(cp) ? 1200 : 600;
  const table =
    font === "sans-bold"
      ? LIBERATION_SANS_ADVANCES.bold
      : LIBERATION_SANS_ADVANCES.regular;
  const metricCp = cp === 9 ? 32 : cp;
  const advance =
    metricCp >= 32 && metricCp <= 255 ? table[metricCp - 32] : undefined;
  return Math.round(
    advance !== undefined && advance >= 0
      ? (advance * 1000) / LIBERATION_SANS_ADVANCES.unitsPerEm
      : isWideCodePoint(cp)
        ? 1000
        : AVERAGE_GLYPH_WIDTH * 1000,
  );
}
function unicode(ch: string): string {
  let result = "";
  for (let i = 0; i < ch.length; i++)
    result += ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  return result;
}
interface FontState {
  font: PdfType3Font;
  chars: string[];
}
export function buildPdfTextLayer(specs: readonly PdfPageSpec[]): PdfTextLayer {
  const states: FontState[] = [];
  const classes: Record<
    PdfFontClass,
    Map<string, { state: FontState; code: number }>
  > = { sans: new Map(), "sans-bold": new Map(), mono: new Map() };
  const groups: Record<PdfFontClass, FontState[]> = {
    sans: [],
    "sans-bold": [],
    mono: [],
  };
  const pages = specs.map((spec) => {
    const fontNames: string[] = [];
    const blocks: string[] = [];
    for (const run of spec.textRuns) {
      if (!run.text) continue;
      const chunks: { state: FontState; codes: string }[] = [];
      for (const ch of run.text) {
        let entry = classes[run.font].get(ch);
        if (!entry) {
          let state = groups[run.font].at(-1);
          if (!state || state.chars.length === 255) {
            const name = `NT${run.font === "mono" ? "m" : run.font === "sans-bold" ? "b" : "s"}${groups[run.font].length + 1}`;
            state = {
              font: {
                name,
                firstChar: 1,
                lastChar: 0,
                widths: [],
                glyphProcs: [],
                differences: [],
                toUnicode: "",
              },
              chars: [],
            };
            groups[run.font].push(state);
            states.push(state);
          }
          const code = state.chars.length + 1;
          state.chars.push(ch);
          const w = width(ch, run.font);
          const glyph = `g${code}`;
          state.font.lastChar = code;
          state.font.widths.push(w);
          state.font.differences.push(glyph);
          state.font.glyphProcs.push({ glyph, content: `${w} 0 d0` });
          entry = { state, code };
          classes[run.font].set(ch, entry);
        }
        if (!fontNames.includes(entry.state.font.name))
          fontNames.push(entry.state.font.name);
        const last = chunks.at(-1);
        if (last?.state === entry.state) last.codes += hex(entry.code);
        else chunks.push({ state: entry.state, codes: hex(entry.code) });
      }
      const l = spec.layout;
      const x = l.x + (run.x * l.width) / spec.width;
      const y = l.pageHeight - (l.y + (run.y * l.height) / spec.height);
      const size = (run.size * l.height) / spec.height;
      blocks.push(
        `BT 3 Tr 1 0 0 1 ${number(x)} ${number(y)} Tm ${chunks.map((c) => `/${c.state.font.name} ${number(size)} Tf <${c.codes}> Tj`).join(" ")} ET`,
      );
    }
    return {
      fontNames,
      content: blocks.length ? `q\n${blocks.join("\n")}\nQ` : "",
    };
  });
  for (const { font, chars } of states) {
    const groupsText: string[] = [];
    for (let i = 0; i < chars.length; i += 100) {
      const chunk = chars.slice(i, i + 100);
      groupsText.push(
        `${chunk.length} beginbfchar\n${chunk.map((ch, j) => `<${hex(i + j + 1)}> <${unicode(ch)}>`).join("\n")}\nendbfchar`,
      );
    }
    font.toUnicode = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CMapName /Nodetto-${font.name} def\n/CMapType 2 def\n1 begincodespacerange <01> <FF> endcodespacerange\n${groupsText.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
  }
  return { fonts: states.map((s) => s.font), pages };
}
export function nativePdfSpec(
  layer: PdfTextLayer,
  pages: { pngLength: number; layout: PdfPageLayout }[],
): string {
  if (pages.length !== layer.pages.length)
    throw new Error("PDF page count mismatch");
  return JSON.stringify({
    pages: pages.map((page, i) => ({ ...page, ...layer.pages[i] })),
    fonts: layer.fonts,
  });
}
