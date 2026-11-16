import { expect, test } from "bun:test";
import { validateDocument } from "./validate.ts";
import type { Document } from "./types.ts";
import { FRAME } from "./registry/containers.ts";
const base: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Doc",
  pages: [{ id: "p", name: "P", kind: "freeform" }],
  elements: [],
};
test("frame page fields are validated", () => {
  const issues = (page: unknown) =>
    FRAME.validateSemantic({ name: "P", page }, "semantic").map((i) => i.code);
  expect(issues({ size: "a4", orientation: "portrait" })).toEqual([]);
  expect(issues({ size: "a3", orientation: "portrait" })).toContain(
    "type.enum",
  );
  expect(issues({ size: "a4" })).toContain("field.missing");
  expect(issues("bad")).toContain("type.object");
  const doc = {
    ...base,
    elements: [
      {
        id: "f",
        page: "p",
        type: "frame",
        semantic: {
          name: "P",
          page: { size: "a4", orientation: "portrait", x: 1 },
        },
        visual: { x: 0, y: 0 },
        index: "a0",
      },
    ],
  } as unknown as Document;
  expect(validateDocument(doc).map((i) => i.code)).toContain(
    "semantic.unknownField",
  );
});
test("page flow rejects unknown values", () => {
  const doc = {
    ...base,
    pages: [{ ...base.pages[0], pageFlow: "diagonal" }],
  } as unknown as Document;
  expect(validateDocument(doc)).toContainEqual(
    expect.objectContaining({ code: "type.enum", path: "pages[0].pageFlow" }),
  );
});
