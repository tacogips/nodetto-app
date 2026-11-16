import { expect, test } from "bun:test";
import {
  buildPdfTextLayer,
  nativePdfSpec,
  type PdfPageSpec,
} from "./pdf-pages.ts";
const layout = {
  pageWidth: 200,
  pageHeight: 200,
  x: 10,
  y: 20,
  width: 100,
  height: 100,
};
const spec: PdfPageSpec = {
  width: 100,
  height: 100,
  layout,
  textRuns: [
    { x: 4, y: 5, size: 12, font: "mono", text: 'const label = "日本語";' },
    { x: 2, y: 15, size: 12, font: "sans", text: "Ünïcode 太字 😀 𠮷" },
  ],
};
test("deterministic Unicode fonts, metrics, and native contract", () => {
  const layer = buildPdfTextLayer([spec]);
  expect(buildPdfTextLayer([spec])).toEqual(layer);
  expect(layer.fonts.map((f) => f.name)).toEqual(["NTm1", "NTs1"]);
  expect(layer.fonts[1].toUnicode).toContain("<D842DFB7>");
  const match = /<([0-9A-F]{2})> <65E5>/.exec(layer.fonts[0].toUnicode);
  expect(match).not.toBeNull();
  expect(
    layer.fonts[0].widths[Number.parseInt(match?.[1] ?? "0", 16) - 1],
  ).toBe(1200);
  expect(layer.pages[0].content).toContain("14 175 Tm");
  expect(
    JSON.parse(nativePdfSpec(layer, [{ pngLength: 123, layout }])),
  ).toEqual({
    pages: [{ pngLength: 123, layout, ...layer.pages[0] }],
    fonts: layer.fonts,
  });
});
test("splits after 255 and limits CMap blocks to 100", () => {
  const text = Array.from({ length: 300 }, (_, i) =>
    String.fromCodePoint(0x400 + i),
  ).join("");
  const layer = buildPdfTextLayer([
    { ...spec, textRuns: [{ ...spec.textRuns[0], text }] },
  ]);
  expect(layer.fonts.map((f) => f.lastChar)).toEqual([255, 45]);
  for (const font of layer.fonts)
    for (const m of font.toUnicode.matchAll(/(\d+) beginbfchar/g))
      expect(Number(m[1])).toBeLessThanOrEqual(100);
});
