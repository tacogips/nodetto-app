import { expect, test } from "bun:test";
import { readSlideSettings } from "@nodetto/ir";
import { copyElements, planPaste } from "./clipboard.ts";
import {
  counterIds,
  document,
  element,
  makeEditor,
  TEST_PAGE,
} from "./test-helpers.ts";

const carrier = element({
  id: "carrier",
  type: "presentation.slide",
  index: "a1",
  semantic: {},
  visual: { animation: { slide: { mode: "fade" } } },
});
const shape = element({
  id: "shape",
  type: "shape.geo",
  index: "a2",
  semantic: { geo: "rect" },
  visual: { x: 10, y: 10, width: 100, height: 100 },
});

test("carrier survives artwork deletion, has no bounds or hit area, and creation undoes", () => {
  const editor = makeEditor();
  editor.apply([{ type: "createElement", element: carrier }]);
  expect(readSlideSettings(editor.store.getPageElements(TEST_PAGE.id))).toEqual(
    { mode: "fade" },
  );
  expect(editor.getBounds(carrier.id)).toBeNull();
  expect(editor.hitTest({ x: 0, y: 0 })).toBeNull();
  editor.undo();
  expect(
    readSlideSettings(editor.store.getPageElements(TEST_PAGE.id)),
  ).toBeUndefined();
  editor.apply([
    { type: "createElement", element: carrier },
    { type: "createElement", element: shape },
  ]);
  editor.selectAll();
  expect([...editor.selection.ids()]).toEqual([shape.id]);
  editor.deleteSelection();
  editor.apply([{ type: "createElement", element: { ...shape, id: "new" } }]);
  expect(readSlideSettings(editor.store.getPageElements(TEST_PAGE.id))).toEqual(
    { mode: "fade" },
  );
});

test("duplicate retains carrier without links; copy and paste omit it without consuming ids", () => {
  const target = { id: "target", name: "Target", kind: "freeform" as const };
  const editor = makeEditor({
    document: document([carrier, shape], [TEST_PAGE, target]),
  });
  const duplicate = editor.duplicatePage(TEST_PAGE.id);
  if (!duplicate) throw new Error("duplicate failed");
  const copied = editor.store
    .getPageElements(duplicate)
    .filter((item) => item.type === carrier.type);
  expect(copied).toHaveLength(1);
  expect(copied[0]?.id).not.toBe(carrier.id);
  expect(copied[0]?.visual).toEqual(carrier.visual);
  expect(editor.store.get(carrier.id)?.visual.linkId).toBeUndefined();
  editor.copyPageElements(TEST_PAGE.id, target.id);
  expect(
    editor.store
      .getPageElements(target.id)
      .some((item) => item.type === carrier.type),
  ).toBe(false);
  const payload = copyElements(editor.store, [carrier.id, shape.id]);
  const options = () => ({
    page: target.id,
    idSource: counterIds("paste"),
    nextIndex: () => "a1",
    offset: { x: 0, y: 0 },
  });
  const withCarrier = planPaste(payload, options());
  const withoutCarrier = planPaste(
    { elements: payload.elements.filter((item) => item.type !== carrier.type) },
    options(),
  );
  expect(withCarrier.commands).toEqual(withoutCarrier.commands);
  expect(withCarrier.ids).toEqual(["paste-1"]);
});
