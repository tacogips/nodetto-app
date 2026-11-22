import { expect, test } from "bun:test";
import { CAPTURE_DEFAULT_BOX, captureRasterPlan } from "../index.ts";

test("default fit keeps small viewports at their original scale", () => {
  expect(captureRasterPlan({ width: 640.3, height: 360.5 }, {})).toEqual({
    scale: 1,
    width: 641,
    height: 361,
  });
});

test("default fit applies the side and megapixel limits", () => {
  expect(captureRasterPlan({ width: 2000, height: 400 }, {})).toEqual({
    scale: 0.784,
    width: 1568,
    height: 314,
  });
  expect(captureRasterPlan({ width: 2000, height: 2000 }, {})).toEqual({
    scale: 0.536,
    width: 1072,
    height: 1072,
  });
});

test("whole-pixel rounding preserves the fit limits", () => {
  const plan = captureRasterPlan({ width: 1072.1, height: 1072.5 }, {});
  expect(plan).toEqual({ scale: 0.999, width: 1072, height: 1072 });
  expect(plan.width * plan.height).toBeLessThanOrEqual(
    CAPTURE_DEFAULT_BOX.maxPixels,
  );

  const fractionalBox = { width: 50.5, height: 50.5 };
  expect(
    captureRasterPlan({ width: 100, height: 100 }, { box: fractionalBox }),
  ).toEqual({ scale: 0.5, width: 50, height: 50 });
});

test("explicit size replaces the default box and megapixel budget without upscaling", () => {
  const box = { width: 1600, height: 1200 };
  expect(captureRasterPlan({ width: 2000, height: 1600 }, { box })).toEqual({
    scale: 0.75,
    width: 1500,
    height: 1200,
  });
  expect(captureRasterPlan({ width: 100, height: 50 }, { box })).toEqual({
    scale: 1,
    width: 100,
    height: 50,
  });
});

test("explicit scale overrides fit and rounds down to three decimals", () => {
  const viewport = { width: 1000, height: 500 };
  expect(
    captureRasterPlan(viewport, {
      scale: 1.2349,
      box: { width: 10, height: 10 },
    }),
  ).toEqual({ scale: 1.234, width: 1234, height: 617 });
  expect(captureRasterPlan(viewport, { scale: 1.001 }).scale).toBe(1.001);
  expect(captureRasterPlan(viewport, { scale: 0.01 }).scale).toBe(0.01);
  expect(captureRasterPlan(viewport, { scale: 4 }).scale).toBe(4);
});

test("invalid dimensions and scales are rejected", () => {
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => captureRasterPlan({ width, height: 100 }, {})).toThrow(
      RangeError,
    );
    expect(() =>
      captureRasterPlan(
        { width: 100, height: 100 },
        { box: { width, height: 10 } },
      ),
    ).toThrow("--size");
  }
  for (const scale of [0, 0.009, 4.001, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() =>
      captureRasterPlan({ width: 100, height: 100 }, { scale }),
    ).toThrow("--scale");
  }
});

test("positive viewports still produce at least one pixel on each side", () => {
  expect(
    captureRasterPlan(
      { width: Number.MIN_VALUE, height: 0.1 },
      { scale: 0.01 },
    ),
  ).toEqual({ scale: 0.01, width: 1, height: 1 });
});

test("an image can reach the raster limit, but oversized images get actionable errors", () => {
  expect(
    captureRasterPlan({ width: 8192, height: 100 }, { scale: 1 }).width,
  ).toBe(8192);
  for (const viewport of [
    { width: 8193, height: 100 },
    { width: 6000, height: 6000 },
  ]) {
    expect(() => captureRasterPlan(viewport, { scale: 1 })).toThrow(
      /--size.*--scale.*--element/,
    );
  }
});

test("a fit that needs less than the minimum scale gets actionable errors", () => {
  expect(captureRasterPlan({ width: 156800, height: 100 }, {})).toEqual({
    scale: 0.01,
    width: 1568,
    height: 1,
  });
  expect(() => captureRasterPlan({ width: 156801, height: 100 }, {})).toThrow(
    /--size.*--scale.*--element/,
  );
  expect(() =>
    captureRasterPlan(
      { width: 10000, height: 100 },
      { box: { width: 50, height: 50 } },
    ),
  ).toThrow(/--size.*--scale.*--element/);
});

test("the default stays within 1568 visual tokens for 1000 seeded viewports", () => {
  let state = 0xd4c56a7b;
  const nextSide = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return 10 + (state % 19991);
  };
  for (let index = 0; index < 1000; index += 1) {
    const plan = captureRasterPlan(
      { width: nextSide(), height: nextSide() },
      {},
    );
    expect(plan.width).toBeLessThanOrEqual(CAPTURE_DEFAULT_BOX.width);
    expect(plan.height).toBeLessThanOrEqual(CAPTURE_DEFAULT_BOX.height);
    expect(plan.width * plan.height).toBeLessThanOrEqual(
      CAPTURE_DEFAULT_BOX.maxPixels,
    );
    expect(
      Math.ceil(plan.width / 28) * Math.ceil(plan.height / 28),
    ).toBeLessThanOrEqual(1568);
  }
});
