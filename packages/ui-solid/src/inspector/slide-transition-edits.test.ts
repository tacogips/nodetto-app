import { expect, test } from "bun:test";
import { readSlideSettings } from "@nodetto/ir";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { planSlideSettingsEdit } from "./slide-transition-edits.ts";
const pages = [{ id: "p1", name: "Page", kind: "freeform" as const }];
test("slide settings create, replace and delete with undo on an empty page", () => {
  const editor = makeEditor({ document: document([], pages) });
  expect(planSlideSettingsEdit(editor, "p1", { mode: "auto" })).toEqual([]);
  const create = planSlideSettingsEdit(editor, "p1", { mode: "fade" });
  expect(create.map((c) => c.type)).toEqual(["createElement"]);
  editor.apply(create);
  expect(readSlideSettings(editor.store.getPageElements("p1"))).toEqual({
    mode: "fade",
  });
  editor.undo();
  expect(editor.store.getPageElements("p1")).toHaveLength(0);
  editor.redo();
  const replace = planSlideSettingsEdit(editor, "p1", { durationMs: 900 });
  expect(replace.map((c) => c.type)).toEqual(["replaceVisual"]);
  editor.apply(replace);
  editor.undo();
  expect(readSlideSettings(editor.store.getPageElements("p1"))).toEqual({
    mode: "fade",
  });
  const remove = planSlideSettingsEdit(editor, "p1", { mode: null });
  expect(remove.map((c) => c.type)).toEqual(["deleteElements"]);
  editor.apply(remove);
  expect(editor.store.getPageElements("p1")).toHaveLength(0);
  editor.undo();
  expect(readSlideSettings(editor.store.getPageElements("p1"))).toEqual({
    mode: "fade",
  });
});
test("first carrier by index and id is edited", () => {
  const carrier = (id: string, index: string) =>
    element({
      id,
      page: "p1",
      type: "presentation.slide",
      index,
      semantic: {},
      visual: { animation: { slide: { mode: "fade" } } },
    });
  const editor = makeEditor({
    document: document([carrier("b", "a"), carrier("a", "a")], pages),
  });
  expect(planSlideSettingsEdit(editor, "p1", { mode: "cut" })[0]).toMatchObject(
    { type: "replaceVisual", id: "a" },
  );
});
