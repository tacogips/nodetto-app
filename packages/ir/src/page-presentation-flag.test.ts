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

test("presentation flag is optional and boolean", () => {
  for (const flag of [undefined, true, false]) {
    const page = {
      ...base.pages[0]!,
      ...(flag === undefined ? {} : { hiddenInPresentation: flag }),
    };
    expect(validateDocument({ ...base, pages: [page] })).toEqual([]);
  }
  for (const flag of ["yes", 1]) {
    const issues = validateDocument({
      ...base,
      pages: [{ ...base.pages[0]!, hiddenInPresentation: flag }],
    } as unknown as Document);
    expect(
      issues
        .filter((issue) => issue.path === "pages[0].hiddenInPresentation")
        .map((issue) => issue.code),
    ).toEqual(["type.boolean"]);
  }
});
