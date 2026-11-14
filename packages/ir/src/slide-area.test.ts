import { expect, test } from "bun:test";
import type { Document } from "./types.ts";
import { validateDocument } from "./validate.ts";

const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements: [],
};
test("validates optional slide dimensions and origins", () => {
  const issues = (slideSize: unknown, slideOrigin?: unknown) =>
    validateDocument({
      ...base,
      slideSize,
      pages: [{ ...base.pages[0], slideOrigin }],
    } as Document);
  expect(issues({ width: 1920, height: 1080 }, { x: -50, y: 100 })).toEqual([]);
  expect(issues(5).map((i) => i.code)).toContain("type.object");
  for (const width of [0, Number.NaN, 100001])
    expect(issues({ width, height: 100 }).map((i) => i.code)).toContain(
      "range.slideSize",
    );
  expect(
    issues({ width: 10, height: 10, depth: 1 }).map((i) => i.code),
  ).toContain("type.unknown");
  expect(
    issues(
      { width: 10, height: 10 },
      { x: Number.POSITIVE_INFINITY, y: 0 },
    ).map((i) => i.code),
  ).toContain("range.slideOrigin");
  expect(issues({ width: 10, height: 10 }, 5).map((i) => i.code)).toContain(
    "type.object",
  );
  expect(
    issues({ width: 10, height: 10 }, { x: 0, y: 0, z: 1 }).map((i) => i.code),
  ).toContain("type.unknown");
});
