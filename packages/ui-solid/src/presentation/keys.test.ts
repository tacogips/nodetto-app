import { expect, test } from "bun:test";
import { presentationKeyAction } from "./keys.ts";
const key = (key: string, ctrlKey = false) =>
  presentationKeyAction({ key, ctrlKey, altKey: false, metaKey: false });
test("maps presentation keys and ignores modifiers", () => {
  for (const value of ["ArrowRight", "ArrowDown", "PageDown", " ", "n", "N"])
    expect(key(value)).toEqual({ type: "next" });
  for (const value of ["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p"])
    expect(key(value)).toEqual({ type: "prev" });
  for (const [value, type] of [
    ["Enter", "enter"],
    ["Home", "first"],
    ["End", "last"],
    ["b", "toggleBlack"],
  ] as const)
    expect(key(value)).toEqual({ type });
  expect(key("7")).toEqual({ type: "digit", digit: "7" });
  expect(key("Escape")).toBe("exit");
  expect(key("n", true)).toBeNull();
  expect(key("x")).toBeNull();
});
