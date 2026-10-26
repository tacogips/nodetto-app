import { expect, test } from "bun:test";
import { strokeFontSupports, strokeText, strokeTextWidth } from "./font.ts";

test("the stroke font covers legend text and centres it", () => {
  for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+- ")
    expect(strokeFontSupports(character)).toBe(true);
  expect(strokeFontSupports("e")).toBe(true);
  expect(strokeFontSupports("?")).toBe(false);
  expect(strokeTextWidth("", 1)).toBe(0);
  const strokes = strokeText("H8", 10, 5, 1.2);
  const xs = strokes.flat().map((point) => point.x);
  const ys = strokes.flat().map((point) => point.y);
  expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(20, 6);
  expect(Math.min(...ys)).toBeCloseTo(4.4, 6);
  expect(Math.max(...ys)).toBeCloseTo(5.6, 6);
  expect(strokeText("R?", 0, 0, 1)).toHaveLength(
    strokeText("R", 0, 0, 1).length,
  );
});
