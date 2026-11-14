import { expect, test } from "bun:test";
import { slideList, startIndex } from "./slides.ts";
test("slides preserve order and skip hidden pages", () => {
  expect(
    slideList([
      { id: "a" },
      { id: "b", hiddenInPresentation: true },
      { id: "c" },
    ]),
  ).toEqual(["a", "c"]);
  expect(slideList([])).toEqual([]);
  expect(slideList([{ id: "a", hiddenInPresentation: true }])).toEqual([]);
});
test("start selects current, next visible or last", () => {
  const order = ["a", "b", "c"];
  const slides = ["a", "c"];
  expect(startIndex(order, slides, null)).toBe(0);
  expect(startIndex(order, slides, "c")).toBe(1);
  expect(startIndex(order, slides, "b")).toBe(1);
  expect(startIndex(order, ["a", "b"], "c")).toBe(1);
  expect(startIndex(order, slides, "unknown")).toBe(0);
  expect(startIndex(order, [], null)).toBeNull();
});
