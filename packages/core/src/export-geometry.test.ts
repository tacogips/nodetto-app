import { expect, test } from "bun:test";
import {
  snapSvgFrameToPixels,
  svgRasterDimensions,
} from "./export-geometry.ts";

const svg = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-16 -16 ${width} ${height}" font-size="13">\n<rect x="-16" y="-16" width="${width}" height="${height}" fill="#ffffff" />\n</svg>\n`;

test("the frame grows to whole pixels and the background reaches past it", () => {
  const snapped = snapSvgFrameToPixels(svg(133, 109), 0.75);
  const { width, height } = svgRasterDimensions(snapped);
  // 99.75 x 81.75 px grow to 100 x 82 px, without adding a pixel.
  expect(Math.ceil(width * 0.75)).toBe(100);
  expect(Math.ceil(height * 0.75)).toBe(82);
  expect(width * 0.75).toBeGreaterThan(99.99);
  const background =
    /<rect x="-16" y="-16" width="([^"]+)" height="([^"]+)"/.exec(snapped);
  expect(Number(background?.[1]) * 0.75).toBeGreaterThanOrEqual(100);
  expect(Number(background?.[2]) * 0.75).toBeGreaterThanOrEqual(82);
});

test("whole-pixel frames and foreign text are left alone", () => {
  expect(snapSvgFrameToPixels(svg(132, 108), 0.75)).toBe(svg(132, 108));
  expect(snapSvgFrameToPixels("<p>not svg</p>", 2)).toBe("<p>not svg</p>");
});
