import { expect, test } from "bun:test";
import { wrapTextToWidth } from "./text-wrap.ts";
import { wideAwareTextWidth } from "./wide-text-width.ts";
test("wraps words, hard breaks, CJK and preserves existing lines", () => {
  expect(wrapTextToWidth("alpha beta gamma", 60, 10)).toBe("alpha beta\ngamma");
  const hard = wrapTextToWidth("abcdefghijklmnop", 25, 10);
  expect(
    hard.split("\n").every((line) => wideAwareTextWidth(line, 10) <= 25),
  ).toBe(true);
  expect(wrapTextToWidth("あい、うえ。おか", 30, 10)).toBe(
    "あい、\nうえ。\nおか",
  );
  expect(wrapTextToWidth("あいう」え", 30, 10)).toBe("あい\nう」え");
  expect(wrapTextToWidth("short\nline", 100, 10)).toBe("short\nline");
  expect(wrapTextToWidth(hard, 25, 10)).toBe(hard);
});
