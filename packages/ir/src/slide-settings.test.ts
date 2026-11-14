import { expect, test } from "bun:test";
import {
  validateElementAnimation,
  validateDocument,
  readSlideSettings,
  type Element,
} from "./index.ts";

const carrier = (
  id: string,
  index: string,
  mode: "cut" | "fade",
  type = "presentation.slide",
): Element => ({
  id,
  index,
  type,
  page: "p",
  semantic: {},
  visual: { animation: { slide: { mode } } },
});
test("animation enums and malformed objects report exact paths", () => {
  for (const key of ["enter", "enterFrom", "exit", "exitTo", "linked"]) {
    expect(
      validateElementAnimation({ [key]: "bad" }, "visual.animation"),
    ).toEqual([
      expect.objectContaining({
        code: "value.enum",
        path: `visual.animation.${key}`,
      }),
    ]);
  }
  expect(
    validateElementAnimation({ slide: { mode: "bad", stagger: 1 } }, "a"),
  ).toEqual([
    expect.objectContaining({ code: "value.enum", path: "a.slide.mode" }),
    expect.objectContaining({ code: "type.boolean", path: "a.slide.stagger" }),
  ]);
  expect(validateElementAnimation(null, "a")).toEqual([
    expect.objectContaining({ code: "type.object", path: "a" }),
  ]);
  expect(validateElementAnimation({ slide: [] }, "a")).toEqual([
    expect.objectContaining({ code: "type.object", path: "a.slide" }),
  ]);
});
test("ranges enforce integer limits and accept boundaries", () => {
  for (const [key, bad, path] of [
    ["durationMs", 49, "a.durationMs"],
    ["durationMs", 5001, "a.durationMs"],
    ["delayMs", -1, "a.delayMs"],
    ["order", 1.5, "a.order"],
    ["slide", { durationMs: 99 }, "a.slide.durationMs"],
    ["slide", { durationMs: 5001 }, "a.slide.durationMs"],
    ["durationMs", "50", "a.durationMs"],
  ] as const) {
    expect(validateElementAnimation({ [key]: bad }, "a")).toEqual([
      expect.objectContaining({ code: "range.animation", path }),
    ]);
  }
  for (const value of [
    { durationMs: 50, delayMs: 0, order: -999, slide: { durationMs: 100 } },
    {
      durationMs: 5000,
      delayMs: 5000,
      order: 999,
      slide: { durationMs: 5000 },
    },
  ])
    expect(validateElementAnimation(value, "a")).toEqual([]);
});
test("unknown settings are warnings", () => {
  expect(
    validateElementAnimation({ future: 1, slide: { future: 1 } }, "a"),
  ).toEqual([
    expect.objectContaining({
      code: "field.unknown",
      severity: "warning",
      path: "a.slide.future",
    }),
    expect.objectContaining({
      code: "field.unknown",
      severity: "warning",
      path: "a.future",
    }),
  ]);
});
test("carrier validates and selects the first index and id", () => {
  const base = {
    schemaVersion: 1,
    id: "d",
    title: "D",
    pages: [{ id: "p", name: "P", kind: "freeform" as const }],
    elements: [carrier("b", "a1", "fade")],
  };
  expect(
    validateDocument(base).filter((issue) => issue.severity === "error"),
  ).toEqual([]);
  const issues = validateDocument({
    ...base,
    elements: [{ ...carrier("b", "a1", "fade"), semantic: { x: 1 } }],
  });
  expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  expect(issues).toContainEqual(
    expect.objectContaining({
      code: "field.unknown",
      path: "elements[0].semantic.x",
    }),
  );
  expect(readSlideSettings([])).toBeUndefined();
  expect(
    readSlideSettings([carrier("shape", "a0", "cut", "shape.geo")]),
  ).toBeUndefined();
  expect(
    readSlideSettings([
      carrier("b", "a1", "fade"),
      carrier("z", "a2", "fade"),
      carrier("a", "a1", "cut"),
    ]),
  ).toEqual({ mode: "cut" });
});
