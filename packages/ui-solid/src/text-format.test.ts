import { describe, expect, test } from "bun:test";
import {
  boldPatch,
  decorationPatch,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_STEPS,
  fontSizePatch,
  italicPatch,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  stepFontSize,
  supportsVerticalAlign,
  textAlignPatch,
  textFormatState,
  verticalAlignKind,
  verticalAlignPatch,
  verticalAlignValue,
} from "./text-format";

describe("text formatting", () => {
  test("reads default and full state", () => {
    expect(textFormatState(undefined)).toEqual({
      fontSize: 13,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      textAlign: null,
      verticalAlign: "top",
    });
    expect(
      textFormatState({
        fontSize: 20,
        fontWeight: 700,
        fontStyle: "italic",
        textDecoration: "underline line-through",
        textAlign: "end",
        verticalAlign: "bottom",
      }),
    ).toEqual({
      fontSize: 20,
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      textAlign: "end",
      verticalAlign: "bottom",
    });
    expect(textFormatState({ fontWeight: 600 }).bold).toBe(true);
    expect(textFormatState({ fontWeight: 500 }).bold).toBe(false);
    expect(textFormatState({ textDecoration: "none" })).toMatchObject({
      underline: false,
      strikethrough: false,
    });
  });

  test("toggles bold and italic", () => {
    expect(boldPatch(undefined)).toEqual({ fontWeight: 700 });
    expect(boldPatch({ fontWeight: 600 })).toEqual({ fontWeight: null });
    expect(italicPatch(undefined)).toEqual({ fontStyle: "italic" });
    expect(italicPatch({ fontStyle: "italic" })).toEqual({ fontStyle: null });
  });

  test("combines and clears decorations", () => {
    expect(decorationPatch(undefined, "underline")).toEqual({
      textDecoration: "underline",
    });
    expect(
      decorationPatch({ textDecoration: "underline" }, "line-through"),
    ).toEqual({ textDecoration: "underline line-through" });
    expect(
      decorationPatch(
        { textDecoration: "underline line-through" },
        "underline",
      ),
    ).toEqual({ textDecoration: "line-through" });
    expect(
      decorationPatch({ textDecoration: "line-through" }, "line-through"),
    ).toEqual({ textDecoration: null });
  });

  test("toggles explicit alignments", () => {
    expect(textAlignPatch(undefined, "middle")).toEqual({
      textAlign: "middle",
    });
    expect(textAlignPatch({ textAlign: "middle" }, "middle")).toEqual({
      textAlign: null,
    });
    expect(verticalAlignPatch(undefined, "top")).toEqual({
      verticalAlign: "top",
    });
    expect(verticalAlignPatch({ verticalAlign: "top" }, "top")).toEqual({
      verticalAlign: null,
    });
    expect(verticalAlignPatch({ verticalAlign: "top" }, "bottom")).toEqual({
      verticalAlign: "bottom",
    });
  });

  test("steps sizes and respects bounds", () => {
    expect(DEFAULT_FONT_SIZE).toBe(13);
    expect(MIN_FONT_SIZE).toBe(8);
    expect(MAX_FONT_SIZE).toBe(72);
    expect(
      FONT_SIZE_STEPS.every(
        (size, i) => i === 0 || size > (FONT_SIZE_STEPS[i - 1] ?? size),
      ),
    ).toBe(true);
    for (const [current, direction, expected] of [
      [13, 1, 14],
      [13, -1, 12],
      [15, 1, 16],
      [15, -1, 14],
      [72, 1, null],
      [8, -1, null],
      [100, -1, 72],
      [4, 1, 8],
      [Number.NaN, 1, null],
      [Number.POSITIVE_INFINITY, -1, null],
    ] as const)
      expect(stepFontSize(current, direction)).toBe(expected);
    expect(fontSizePatch(undefined, 1)).toEqual({ fontSize: 14 });
    expect(fontSizePatch({ fontSize: 72 }, 1)).toBeNull();
  });

  test("supports vertical alignment only for nonempty note leaves", () => {
    expect(supportsVerticalAlign([])).toBe(false);
    expect(
      supportsVerticalAlign([{ type: "text.note" }, { type: "text.note" }]),
    ).toBe(true);
    expect(
      supportsVerticalAlign([{ type: "text.note" }, { type: "shape.geo" }]),
    ).toBe(false);
  });

  test("box labels opt in to vertical alignment and clear back to centred", () => {
    expect(verticalAlignKind([{ type: "shape.geo" }])).toBe("box");
    expect(
      verticalAlignKind([{ type: "shape.geo" }, { type: "node.generic" }]),
    ).toBe("box");
    expect(verticalAlignKind([{ type: "text.note" }])).toBe("note");
    expect(
      verticalAlignKind([{ type: "shape.geo" }, { type: "text.note" }]),
    ).toBeNull();
    expect(verticalAlignKind([{ type: "edge.generic" }])).toBeNull();
    expect(supportsVerticalAlign([{ type: "shape.geo" }])).toBe(true);
    expect(verticalAlignValue(undefined, "box")).toBe("middle");
    expect(verticalAlignValue({ verticalAlign: "top" }, "box")).toBe("middle");
    expect(
      verticalAlignValue({ verticalAlign: "top", boxLabelAlign: true }, "box"),
    ).toBe("top");
    expect(verticalAlignValue(undefined, "note")).toBe("top");
    expect(verticalAlignPatch(undefined, "bottom", "box")).toEqual({
      verticalAlign: "bottom",
      boxLabelAlign: true,
    });
    const top = { verticalAlign: "top", boxLabelAlign: true } as const;
    expect(verticalAlignPatch(top, "top", "box")).toEqual({
      verticalAlign: null,
      boxLabelAlign: null,
    });
    expect(verticalAlignPatch(top, "middle", "box")).toEqual({
      verticalAlign: null,
      boxLabelAlign: null,
    });
  });
});
