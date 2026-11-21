import { expect, test } from "bun:test";
import { CAD_ELEMENT_TYPES, isCadElementType, isCadTypeName } from "./cad.ts";
import { pageAcceptsElementType } from "./page-content.ts";
import { PAGE_KINDS } from "./types.ts";

test("CAD shapes, including future types, belong exclusively to CAD pages", () => {
  for (const kind of PAGE_KINDS) {
    for (const type of [...CAD_ELEMENT_TYPES, "cad.future"]) {
      expect(pageAcceptsElementType(kind, type)).toBe(kind === "cad3d");
    }
  }
  expect(isCadElementType("cad.line")).toBe(true);
  expect(isCadElementType("cad.future")).toBe(false);
  expect(isCadTypeName("cad.future")).toBe(true);
  expect(isCadTypeName("cad3d")).toBe(false);
});

test("CAD pages allow shared resources and reject other types", () => {
  for (const type of [
    "design.token",
    "design.text-style",
    "design.guide",
    "presentation.slide",
    "review.comment",
  ]) {
    expect(pageAcceptsElementType("cad3d", type)).toBe(true);
  }
  for (const type of ["shape.geo", "image.raster", "frame", "x.y"]) {
    expect(pageAcceptsElementType("cad3d", type)).toBe(false);
    expect(pageAcceptsElementType("freeform", type)).toBe(true);
  }
});
