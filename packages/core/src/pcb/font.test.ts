import { expect, test } from "bun:test";
import {
  strokeFontSupports,
  strokeText,
  strokeTextBlock,
  strokeTextWidth,
} from "./font.ts";

test("the stroke font covers legend text and centres it", () => {
  for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+- .,:/_()[]=*#'\"!?<>%~")
    expect(strokeFontSupports(character)).toBe(true);
  expect(strokeFontSupports("e")).toBe(true);
  expect(strokeFontSupports("@")).toBe(false);
  expect(strokeTextWidth("", 1)).toBe(0);
  const strokes = strokeText("H8", 10, 5, 1.2);
  const xs = strokes.flat().map((point) => point.x);
  const ys = strokes.flat().map((point) => point.y);
  expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(20, 6);
  expect(Math.min(...ys)).toBeCloseTo(4.4, 6);
  expect(Math.max(...ys)).toBeCloseTo(5.6, 6);
  expect(strokeText("R@", 0, 0, 1)).toHaveLength(
    strokeText("R", 0, 0, 1).length,
  );
});

test("multi-line text stacks centred lines and aligns each line", () => {
  const strokes = strokeTextBlock("H\nH", 1);
  const ys = strokes.flat().map((point) => point.y);
  expect(Math.min(...ys)).toBeCloseTo(-1.3, 6);
  expect(Math.max(...ys)).toBeCloseTo(1.3, 6);
  expect(strokes).toHaveLength(strokeText("HH", 0, 0, 1).length);
  const left = strokeTextBlock("H\nHH", 1, "left");
  const top = left.filter((line) => line.every((point) => point.y > 0));
  const bottom = left.filter((line) => line.every((point) => point.y < 0));
  expect(Math.min(...top.flat().map((point) => point.x))).toBeCloseTo(0, 6);
  expect(Math.min(...bottom.flat().map((point) => point.x))).toBeCloseTo(0, 6);
  const right = strokeTextBlock("H\nHH", 1, "right");
  for (const line of right)
    for (const point of line) expect(point.x).toBeLessThanOrEqual(1e-9);
});
