import { expect, test } from "bun:test";
import { fitSlide } from "./fit.ts";
test("letterbox and pillarbox retain aspect ratio", () => {
  const fit = fitSlide(
    { width: 200, height: 100 },
    { width: 1000, height: 1000 },
  );
  expect(fit).toEqual({ scale: 4.76, width: 952, height: 476, x: 24, y: 262 });
  const tall = fitSlide(
    { width: 100, height: 200 },
    { width: 1000, height: 500 },
  );
  expect(tall.x).toBeGreaterThan(24);
  expect(tall.width / tall.height).toBe(0.5);
});
test("margin collapses, negatives clamp and upscaling works", () => {
  expect(fitSlide({ width: 10, height: 10 }, { width: 40, height: 40 }).x).toBe(
    10,
  );
  expect(
    fitSlide({ width: 10, height: 10 }, { width: 500, height: 500 }).scale,
  ).toBeGreaterThan(1);
  expect(
    fitSlide({ width: 10, height: 10 }, { width: 100, height: 100 }, -1).x,
  ).toBe(0);
});
test("invalid inputs yield finite degenerate box", () => {
  for (const result of [
    fitSlide({ width: 0, height: 1 }, { width: 100, height: 100 }),
    fitSlide({ width: 1, height: 1 }, { width: Number.NaN, height: 100 }),
    fitSlide({ width: 1, height: 1 }, { width: 100, height: 100 }, Number.NaN),
  ]) {
    expect(result.scale).toBe(0);
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  }
});
