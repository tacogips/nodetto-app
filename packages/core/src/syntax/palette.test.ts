import { expect, test } from "bun:test";
import { CODE_PALETTES, codePaletteFor } from "./palette.ts";
const lum = (color: string) => {
  const c = [1, 3, 5].map((i) => {
    const n = Number.parseInt(color.slice(i, i + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return (c[0] ?? 0) * 0.2126 + (c[1] ?? 0) * 0.7152 + (c[2] ?? 0) * 0.0722;
};
test("foregrounds contrast on both surfaces", () => {
  for (const p of Object.values(CODE_PALETTES))
    for (const fg of [
      p.plain,
      p.keyword,
      p.string,
      p.comment,
      p.number,
      p.punctuation,
      p.markup,
      p.lineNumber,
      p.link,
    ])
      for (const bg of [p.background, p.inlineCodeBackground]) {
        const a = lum(fg);
        const b = lum(bg);
        expect(
          (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        ).toBeGreaterThanOrEqual(4.5);
      }
});
test("palette selection follows fill luminance", () => {
  expect(codePaletteFor(undefined).mode).toBe("light");
  expect(codePaletteFor("#1f2427").mode).toBe("dark");
  expect(codePaletteFor("#fffdf8").mode).toBe("light");
  expect(codePaletteFor("none").mode).toBe("light");
  expect(codePaletteFor("#000f").mode).toBe("light");
  expect(codePaletteFor("#000000ff").mode).toBe("dark");
});
