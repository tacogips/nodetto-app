import { expect, test } from "bun:test";
import type { Page } from "@nodetto/ir";
import { planPaste } from "./clipboard.ts";
import {
  counterIds,
  document,
  element,
  makeEditor,
  TEST_PAGE,
} from "./test-helpers.ts";

const target: Page = { id: "target", name: "Target", kind: "freeform" };
const fresh = element({
  id: "fresh",
  type: "shape.geo",
  semantic: { geo: "rect" },
  visual: { x: 1, y: 2 },
});
const linked = element({
  id: "linked",
  type: "shape.geo",
  index: "a2",
  semantic: { geo: "rect" },
  visual: { linkId: "L", x: 3, y: 4 },
});
const fixture = () =>
  makeEditor({ document: document([fresh, linked], [TEST_PAGE, target]) });

test("page copy links sources and copies and undoes both pages", () => {
  const editor = fixture();
  const beforeSource = structuredClone(
    editor.store.getPageElements(TEST_PAGE.id),
  );
  const beforeTarget = structuredClone(editor.store.getPageElements(target.id));
  const ids = editor.copyPageElements(TEST_PAGE.id, target.id);
  if (!ids) throw new Error("copy failed");
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe(fresh.id);
  expect(ids[1]).not.toBe(linked.id);
  expect(editor.store.get(ids[0] ?? "")?.visual.linkId).toBe(fresh.id);
  expect(editor.store.get(ids[1] ?? "")?.visual.linkId).toBe("L");
  expect(editor.store.get(fresh.id)?.visual.linkId).toBe(fresh.id);
  expect(editor.store.get(linked.id)).toEqual(linked);
  editor.undo();
  expect(editor.store.getPageElements(TEST_PAGE.id)).toEqual(beforeSource);
  expect(editor.store.getPageElements(target.id)).toEqual(beforeTarget);
});

test("duplicate page links elements and undo restores source", () => {
  const editor = fixture();
  const before = structuredClone(editor.store.getPageElements(TEST_PAGE.id));
  const page = editor.duplicatePage(TEST_PAGE.id);
  if (!page) throw new Error("duplicate failed");
  const copies = editor.store.getPageElements(page);
  expect(copies.map((copy) => copy.visual.linkId)).toEqual([fresh.id, "L"]);
  expect(
    copies.every((copy) => copy.id !== fresh.id && copy.id !== linked.id),
  ).toBe(true);
  expect(editor.store.get(fresh.id)?.visual.linkId).toBe(fresh.id);
  expect(editor.store.get(linked.id)).toEqual(linked);
  editor.undo();
  expect(editor.store.getPage(page)).toBeUndefined();
  expect(editor.store.getPageElements(TEST_PAGE.id)).toEqual(before);
});

test("ordinary duplicate and cross-page clipboard paste strip links", () => {
  const editor = fixture();
  editor.selection.set([linked.id]);
  editor.duplicateSelection();
  const duplicate = editor.store
    .getPageElements(TEST_PAGE.id)
    .find((entry) => entry.id !== fresh.id && entry.id !== linked.id);
  expect(duplicate).toBeDefined();
  expect(duplicate?.visual.linkId).toBeUndefined();
  editor.selection.set([linked.id]);
  editor.copySelection();
  editor.setCurrentPage(target.id);
  editor.paste();
  const pasted = editor.store.getPageElements(target.id);
  expect(pasted).toHaveLength(1);
  expect(pasted[0]?.visual.linkId).toBeUndefined();
});

test("planPaste without explicit links strips them", () => {
  const plan = planPaste(
    { elements: [linked] },
    {
      page: target.id,
      idSource: counterIds(),
      nextIndex: () => "a1",
      offset: { x: 0, y: 0 },
    },
  );
  const command = plan.commands[0];
  expect(command?.type).toBe("createElement");
  if (command?.type !== "createElement") throw new Error("missing create");
  expect(command.element.visual.linkId).toBeUndefined();
});
