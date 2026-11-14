import { expect, test } from "bun:test";
import { geoOutline } from "./shapes/geo-outline.ts";
import {
  rectStrokeMarkup,
  rectStrokeParts,
} from "./svg-export/rect-strokes.ts";
import { boxLabelLayout } from "./label-layout.ts";

test("thin rects preserve their exact box and larger rects keep legacy inset", () => {
  for (const height of [0.5, 1, 2, 2.9])
    expect(geoOutline("rect", 100, height)).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height,
    });
  expect(geoOutline("rect", 100, 3)).toMatchObject({
    x: 1,
    y: 1,
    width: 98,
    height: 1,
  });
  expect(geoOutline("rect", 100, 40)).toMatchObject({
    x: 1,
    y: 1,
    width: 98,
    height: 38,
    rx: 4,
  });
});

test("explicit alignment and sides compute deterministic stroke geometry", () => {
  const box = { x: 0, y: 0, width: 100, height: 40 };
  expect(rectStrokeParts(box, undefined)).toBeUndefined();
  expect(
    rectStrokeParts(box, { strokeAlign: "inside", strokeWidth: 4 })?.strokeBox,
  ).toEqual({ x: 2, y: 2, width: 96, height: 36 });
  expect(
    rectStrokeParts(box, { strokeAlign: "outside", strokeWidth: 4 })?.strokeBox,
  ).toEqual({ x: -2, y: -2, width: 104, height: 44 });
  const parts = rectStrokeParts(box, {
    strokeSides: { left: 4 },
    cornerRadius: 12,
  });
  expect(parts?.strips).toEqual([{ x: 0, y: 0, width: 4, height: 40 }]);
  const markup = rectStrokeMarkup(
    parts!,
    { fill: "white", stroke: "black" },
    "unique",
  );
  expect(markup).toContain('<clipPath id="unique">');
  expect(markup).not.toContain("stroke-width=");
});

test("geo label padding changes wrapping and retains default", () => {
  const label = "abcdefgh";
  expect(
    boxLabelLayout(label, 70, { textPadding: 0 }).lines.length,
  ).toBeLessThan(boxLabelLayout(label, 70, {}).lines.length);
});
