import { expect, test } from "bun:test";
import {
  createPresentationState,
  currentSlide,
  reducePresentation,
  slideCounter,
} from "./navigation.ts";
import type { PresentationAction, PresentationState } from "./navigation.ts";
const initial = () => createPresentationState(["a", "b", "c"], 0);
const apply = (state: PresentationState, action: PresentationAction) =>
  reducePresentation(state, action) as PresentationState;
test("navigation clamps and clears black and digits", () => {
  const state = initial();
  expect(apply(state, { type: "prev" }).index).toBe(0);
  const last = apply(state, { type: "last" });
  expect(apply(last, { type: "next" }).index).toBe(2);
  expect(apply(last, { type: "first" }).index).toBe(0);
  expect(apply(state, { type: "goto", n: 0 }).index).toBe(0);
  expect(apply(state, { type: "goto", n: 99 }).index).toBe(2);
  expect(apply(state, { type: "goto", n: Number.NaN })).toBe(state);
  const black = apply(state, { type: "toggleBlack" });
  expect(black.black).toBe(true);
  expect(apply(black, { type: "next" })).toMatchObject({
    index: 1,
    black: false,
    digits: "",
  });
  expect(slideCounter(last)).toEqual({ n: 3, total: 3 });
  expect(currentSlide(last)).toBe("c");
  expect(state.index).toBe(0);
});
test("digits and enter select slides", () => {
  let state = initial();
  state = apply(state, { type: "digit", digit: "1" });
  state = apply(state, { type: "digit", digit: "2" });
  expect(apply(state, { type: "enter" }).index).toBe(2);
  expect(apply(initial(), { type: "enter" }).index).toBe(1);
  state = apply(state, { type: "digit", digit: "3" });
  state = apply(state, { type: "digit", digit: "4" });
  expect(apply(state, { type: "digit", digit: "5" })).toBe(state);
  expect(apply(state, { type: "digit", digit: "x" })).toBe(state);
  expect(apply(state, { type: "clearDigits" }).digits).toBe("");
});
test("reconcile preserves page and black or clamps removed page", () => {
  let state = apply(initial(), { type: "goto", n: 2 });
  state = apply(state, { type: "toggleBlack" });
  state = apply(state, { type: "digit", digit: "3" });
  const moved = apply(state, { type: "reconcile", slides: ["b", "a"] });
  expect(moved).toMatchObject({ index: 0, black: true, digits: "" });
  expect(apply(state, { type: "reconcile", slides: ["a"] }).index).toBe(0);
  expect(
    reducePresentation(state, { type: "reconcile", slides: [] }),
  ).toBeNull();
});
