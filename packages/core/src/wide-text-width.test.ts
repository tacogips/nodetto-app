import { expect, test } from "bun:test";
import { estimatedTextWidth, wrapTextLines } from "./text-layout.ts";
import {
  EAST_ASIAN_WIDE_RANGES,
  isWideCodePoint,
  wideAwareLineCount,
  wideAwareTextWidth,
} from "./wide-text-width.ts";

test("Unicode wide and fullwidth code points are classified", () => {
  for (const cp of [
    0x1100, 0x3000, 0x3001, 0x3042, 0x30a2, 0x30fc, 0x4e00, 0xac00, 0xff08,
    0xff09, 0xffe0, 0x1f600, 0x20000,
  ]) {
    expect(isWideCodePoint(cp)).toBe(true);
  }
  for (const cp of [0x41, 0xe9, 0x2026, 0x410, 0xff61, 0x10ff, 0x1160]) {
    expect(isWideCodePoint(cp)).toBe(false);
  }
});

test("wide ranges are sorted, merged and well formed", () => {
  expect(EAST_ASIAN_WIDE_RANGES.length % 2).toBe(0);
  expect(EAST_ASIAN_WIDE_RANGES[0]).toBe(0x1100);
  for (let i = 0; i < EAST_ASIAN_WIDE_RANGES.length; i += 2) {
    expect(EAST_ASIAN_WIDE_RANGES[i]).toBeLessThanOrEqual(
      EAST_ASIAN_WIDE_RANGES[i + 1],
    );
    if (i > 0)
      expect(EAST_ASIAN_WIDE_RANGES[i]).toBeGreaterThan(
        EAST_ASIAN_WIDE_RANGES[i - 1] + 1,
      );
  }
});

test("width preserves narrow estimates and measures wide graphemes", () => {
  for (const text of [
    "Payment gateway",
    "café",
    "\u2764\ufe0f\u200d\u{1f525}",
  ]) {
    expect(wideAwareTextWidth(text, 13)).toBe(estimatedTextWidth(text, 13));
  }
  expect(wideAwareTextWidth("在庫照会サービス（試験運用中）", 13)).toBe(195);
  expect(wideAwareTextWidth("ab在", 10, 1)).toBe(2 * 6.5 + 11);
});

test("greedy line count handles wide, narrow and oversized graphemes", () => {
  expect(wideAwareLineCount("", 104, 13)).toBe(1);
  for (const line of wrapTextLines(
    "Payment gateway authorisation service",
    120,
    13,
  )) {
    expect(wideAwareLineCount(line, 120, 13)).toBe(1);
  }
  expect(wideAwareLineCount("在庫照会サービスの再試行ポリ", 104, 13)).toBe(2);
  expect(wideAwareLineCount("シー", 104, 13)).toBe(1);
  expect(wideAwareLineCount("在", 5, 13)).toBe(1);
  expect(wideAwareLineCount("在在", 25.99, 13)).toBe(1);
  expect(wideAwareLineCount("在在", 25.98, 13)).toBe(2);
});
