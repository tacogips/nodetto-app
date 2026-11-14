import { expect, test } from "bun:test";
import type { Page } from "@nodetto/ir";
import * as Y from "yjs";
import { pageFields, pageFromY, pageToY } from "./ydoc.ts";

const page: Page = { id: "p", name: "Page", kind: "freeform" };

test("Yjs page fields preserve booleans and omit absent or malformed flags", () => {
  expect(pageFields(page)).not.toHaveProperty("hiddenInPresentation");
  for (const flag of [true, false]) {
    const flagged = { ...page, hiddenInPresentation: flag };
    expect(pageFields(flagged).hiddenInPresentation).toBe(flag);
    const doc = new Y.Doc();
    const map = pageToY(flagged);
    doc.getMap("pages").set(page.id, map);
    expect(pageFromY(page.id, map).hiddenInPresentation).toBe(flag);
  }
  expect(
    pageFromY(page.id, {
      name: "Page",
      kind: "freeform",
      hiddenInPresentation: "yes",
    }),
  ).not.toHaveProperty("hiddenInPresentation");
});
