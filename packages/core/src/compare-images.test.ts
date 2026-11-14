import { expect, test } from "bun:test";
import {
  composeComparisonSvg,
  leadingNumber,
  pairByLeadingNumber,
  parseBand,
  pngInfo,
} from "./compare-images.ts";

const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 4, 0,
  0, 0, 4,
]);
test("PNG headers are checked before dimensions are read", () => {
  expect(pngInfo(png)).toEqual({ width: 4, height: 4 });
  expect(() => pngInfo(png.slice(0, 20))).toThrow("not a PNG");
  expect(() => pngInfo(new Uint8Array(24))).toThrow("not a PNG");
});
test("numbered names pair deterministically and report errors", () => {
  expect(leadingNumber("a/02-ref.png")).toBe(2);
  expect(
    pairByLeadingNumber(
      [
        { name: "02-b", value: "b" },
        { name: "01-a", value: "a" },
      ],
      [
        { name: "01-r", value: "r" },
        { name: "02-s", value: "s" },
      ],
    ),
  ).toEqual([
    { number: 1, actual: "a", reference: "r" },
    { number: 2, actual: "b", reference: "s" },
  ]);
  expect(() =>
    pairByLeadingNumber(
      [
        { name: "01-a", value: 1 },
        { name: "01-b", value: 2 },
      ],
      [],
    ),
  ).toThrow("01-a, 01-b");
  expect(() => pairByLeadingNumber([{ name: "03-x", value: 1 }], [])).toThrow(
    "03-x",
  );
  expect(() => pairByLeadingNumber([{ name: "x", value: 1 }], [])).toThrow("x");
});
test("bands and comparison output are deterministic", () => {
  expect(parseBand("0:400:47")).toEqual({ y0: 0, y1: 400, dy: 47 });
  expect(() => parseBand("5:1:0")).toThrow();
  expect(() => parseBand("x")).toThrow();
  const options = { reference: png, actual: png, scale: 2 };
  const result = composeComparisonSvg(options);
  expect(result).toEqual(composeComparisonSvg(options));
  expect(result.svg).toContain('width="38" height="26"');
  expect(result.svg).toContain("mix-blend-mode:difference");
  expect(result.svg.match(/<image /g)?.length).toBe(4);
  expect(result.warnings).toEqual([]);
});
