import { expect, test } from "bun:test";
import { geoLabelAlignStyle } from "./label-align-style.ts";

test("geo canvas alignment uses marker and clamped padding", () => {
  expect(
    geoLabelAlignStyle({ style: { verticalAlign: "top" } }, 100, 2, 20),
  ).toEqual({});
  expect(
    geoLabelAlignStyle(
      { style: { verticalAlign: "top", boxLabelAlign: true } },
      100,
      2,
      20,
    ),
  ).toEqual({ "align-items": "flex-start", "padding-top": "8px" });
  expect(
    geoLabelAlignStyle(
      { style: { verticalAlign: "bottom", boxLabelAlign: true } },
      100,
      2,
      20,
    ),
  ).toEqual({ "align-items": "flex-start", "padding-top": "52px" });
  expect(
    geoLabelAlignStyle(
      { style: { verticalAlign: "bottom", boxLabelAlign: true } },
      30,
      2,
      20,
    ),
  ).toEqual({ "align-items": "flex-start", "padding-top": "8px" });
});
