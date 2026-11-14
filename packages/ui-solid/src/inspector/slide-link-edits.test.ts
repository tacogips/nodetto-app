import { expect, test } from "bun:test";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import {
  linkedPages,
  planApplyToLinked,
  planUnlink,
} from "./slide-link-edits.ts";

const pages = [
  {
    id: "p1",
    name: "One",
    kind: "freeform" as const,
    slideOrigin: { x: 0, y: 0 },
  },
  {
    id: "p2",
    name: "Two",
    kind: "freeform" as const,
    slideOrigin: { x: 2000, y: 0 },
  },
  { id: "p3", name: "Three", kind: "freeform" as const },
];
const shape = (
  id: string,
  page: string,
  visual: Parameters<typeof element>[0]["visual"],
  type = "shape.rect",
) => element({ id, page, type, semantic: {}, visual });
const source = shape("source", "p1", {
  linkId: "L",
  x: 100,
  y: 20,
  width: 30,
  style: { fill: "red" },
});
const target = shape("target", "p2", {
  linkId: "L",
  x: 4,
  y: 5,
  width: 6,
  style: { fill: "blue" },
  textStyle: "text",
});
const other = shape("other", "p3", {
  linkId: "L",
  x: 7,
  y: 8,
  style: { fill: "blue" },
});

test("linked pages follow tab order and unlink is undoable", () => {
  const editor = makeEditor({ document: document([other, source], pages) });
  expect(linkedPages(editor.store, source)).toEqual(["p1", "p3"]);
  expect(linkedPages(editor.store, shape("unlinked", "p1", {}))).toEqual([]);
  const commands = planUnlink(source);
  expect(commands.map((command) => command.type)).toEqual(["replaceVisual"]);
  editor.apply(commands);
  expect(editor.store.get("source")?.visual.linkId).toBeUndefined();
  expect(editor.store.get("other")?.visual.linkId).toBe("L");
  editor.undo();
  expect(editor.store.get("source")?.visual.linkId).toBe("L");
  expect(planUnlink(shape("unlinked", "p1", {}))).toEqual([]);
});

test("apply style to matching types on other pages in one undo", () => {
  const different = shape(
    "different",
    "p2",
    { linkId: "L", style: { fill: "green" } },
    "text.note",
  );
  const editor = makeEditor({
    document: document([source, target, other, different], pages),
  });
  const commands = planApplyToLinked(editor.store, source, { geometry: false });
  expect(commands.map((command) => command.type)).toEqual([
    "replaceVisual",
    "replaceVisual",
  ]);
  editor.apply(commands);
  expect(editor.store.get("target")?.visual.style?.fill).toBe("red");
  expect(editor.store.get("target")?.visual.textStyle).toBeUndefined();
  expect(editor.store.get("target")?.visual.x).toBe(4);
  expect(editor.store.get("target")?.visual.width).toBe(6);
  expect(editor.store.get("different")?.visual).toEqual(different.visual);
  editor.undo();
  expect(editor.store.get("target")?.visual).toEqual(target.visual);
  expect(editor.store.get("other")?.visual).toEqual(other.visual);
});

test("geometry uses slide origins only with a slide size", () => {
  for (const enabled of [true, false]) {
    const doc = document([source, target], pages);
    const editor = makeEditor({
      document: enabled
        ? { ...doc, slideSize: { width: 1000, height: 500 } }
        : doc,
    });
    editor.apply(planApplyToLinked(editor.store, source, { geometry: true }));
    expect(editor.store.get("target")?.visual.x).toBe(enabled ? 2100 : 100);
    expect(editor.store.get("target")?.visual.y).toBe(20);
    expect(editor.store.get("target")?.visual.width).toBe(30);
  }
});

test("identical visuals yield no commands", () => {
  const same = shape("same", "p2", source.visual);
  const editor = makeEditor({ document: document([source, same], pages) });
  expect(planApplyToLinked(editor.store, source, { geometry: false })).toEqual(
    [],
  );
});
