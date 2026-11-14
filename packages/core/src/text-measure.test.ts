import { describe, expect, test } from "bun:test";
import { estimatedTextWidth } from "./text-layout.ts";
import {
  measureTextWidth,
  textMeasureMode,
  truncateToWidth,
  wrapMeasuredLines,
} from "./text-measure.ts";
import { LIBERATION_SANS_ADVANCES } from "./text-metrics/advances.generated.ts";

const style = { fontSize: 17 };
const width = (text: string) => measureTextWidth(text, style, "proportional");
describe("text measurement", () => {
  test("legacy and proportional widths", () => {
    expect(measureTextWidth("Hello", style, "estimate")).toBe(
      estimatedTextWidth("Hello", 17),
    );
    expect(textMeasureMode({})).toBe("estimate");
    expect(textMeasureMode({ textMeasure: "proportional" })).toBe(
      "proportional",
    );
    expect(width("WWW")).toBeGreaterThan(width("iii"));
    expect(
      measureTextWidth(
        "Settings",
        { ...style, fontWeight: 700 },
        "proportional",
      ),
    ).toBeGreaterThanOrEqual(width("Settings"));
    expect(width("A")).toBe(
      (LIBERATION_SANS_ADVANCES.regular[0x41 - 0x20] /
        LIBERATION_SANS_ADVANCES.unitsPerEm) *
        17,
    );
    expect(
      measureTextWidth("abc", { ...style, letterSpacing: 1 }, "proportional") -
        width("abc"),
    ).toBeCloseTo(3);
    expect(width("漢字")).toBe(34);
    expect(width("a\nb")).toBe(width("a b"));
    expect(LIBERATION_SANS_ADVANCES.regular[0]).toBeGreaterThan(0);
  });
  test("wraps words, explicit lines and graphemes", () => {
    expect(
      wrapMeasuredLines(
        "alpha beta gamma",
        width("alpha beta"),
        style,
        "proportional",
      ),
    ).toEqual(["alpha beta", "gamma"]);
    expect(wrapMeasuredLines("a\nb", 100, style, "proportional")).toEqual([
      "a",
      "b",
    ]);
    expect(wrapMeasuredLines("abc", width("a"), style, "proportional")).toEqual(
      ["a", "b", "c"],
    );
    expect(wrapMeasuredLines("áb", 0, style, "proportional")).toEqual([
      "á",
      "b",
    ]);
    expect(
      wrapMeasuredLines("a   ", width("a"), style, "proportional"),
    ).toEqual(["a   "]);
  });
  test("truncates whole graphemes", () => {
    expect(
      truncateToWidth(
        "Long title text",
        width("Long ti…"),
        style,
        "proportional",
      ),
    ).toEqual({ text: "Long ti…", truncated: true });
    expect(
      truncateToWidth("hello", width("hello"), style, "proportional"),
    ).toEqual({ text: "hello", truncated: false });
    expect(truncateToWidth("hello", 0, style, "proportional")).toEqual({
      text: "",
      truncated: true,
    });
  });
});
