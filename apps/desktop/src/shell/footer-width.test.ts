import { expect, test } from "bun:test";
import { COMPACT_FOOTER_WIDTH, isCompactFooter } from "./footer-width.ts";

test("a narrow footer folds the zoom controls; a wide or unmeasured one does not", () => {
  expect(isCompactFooter(COMPACT_FOOTER_WIDTH - 1)).toBe(true);
  expect(isCompactFooter(320)).toBe(true);
  expect(isCompactFooter(COMPACT_FOOTER_WIDTH)).toBe(false);
  expect(isCompactFooter(1200)).toBe(false);
  expect(isCompactFooter(0)).toBe(false);
});
