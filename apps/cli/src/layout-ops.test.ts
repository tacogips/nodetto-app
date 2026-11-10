import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { FrameSemantic } from "@nodetto/ir";
import { Batch } from "./edit/batch.ts";

function fixture() {
  const editor = new Editor();
  const frame = editor.createElement("frame", {
    visual: { x: 100, y: 0, width: 390, height: 300 },
    semantic: {
      name: "Frame",
      safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
    },
  });
  const a = editor.createElement("node.generic", {
    visual: { x: 120, y: 50, width: 40, height: 20 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 120, y: 10, width: 40, height: 20 },
  });
  const c = editor.createElement("node.generic", {
    visual: { x: 120, y: 100, width: 40, height: 20 },
  });
  return { editor, frame, a, b, c, batch: new Batch(editor) };
}
test("layout orders geometric children, stretches, accepts per-side padding, and removes layout", () => {
  const { editor, frame, a, b, c, batch } = fixture();
  batch.apply(
    {
      op: "layout",
      id: frame,
      direction: "vertical",
      gap: 8,
      padding: [8, 16, 8, 16],
      align: "stretch",
    },
    0,
  );
  const sem = editor.store.get(frame)?.semantic as FrameSemantic;
  expect(sem.memberIds).toEqual([b, a, c]);
  expect(sem.layout?.paddingTop).toBe(8);
  expect(sem.layout?.paddingLeft).toBe(16);
  expect(editor.store.get(b)?.visual.y).toBe(8);
  expect(editor.store.get(a)?.visual.y).toBe(36);
  expect(editor.store.get(c)?.visual.y).toBe(64);
  expect(editor.store.get(a)?.visual.width).toBe(358);
  expect(() =>
    batch.apply({ op: "layout", id: frame, padding: [1, 2] }, 1),
  ).toThrow();
  batch.apply({ op: "layout", id: frame, remove: true }, 2);
  expect(
    (editor.store.get(frame)?.semantic as FrameSemantic).layout,
  ).toBeUndefined();
  expect(
    (editor.store.get(frame)?.semantic as FrameSemantic).memberIds,
  ).toEqual([b, a, c]);
});
test("horizontal space-between, sizing and absolute", () => {
  const { editor, frame, a, b, c, batch } = fixture();
  batch.apply(
    {
      op: "layout",
      id: frame,
      direction: "horizontal",
      padding: 16,
      justify: "space-between",
    },
    0,
  );
  expect(editor.store.get(b)?.visual.x).toBe(116);
  expect((editor.store.get(c)?.visual.x ?? 0) + 40).toBe(474);
  expect(() =>
    batch.apply({ op: "update", id: a, sizing: { height: "fill" } }, 1),
  ).toThrow("stretch");
  batch.apply({ op: "update", id: a, sizing: { width: "fill" } }, 2);
  expect(editor.store.get(a)?.visual.layoutGrow).toBe(1);
  batch.apply({ op: "update", id: b, absolute: true }, 3);
  expect(editor.store.get(b)?.visual.layoutPosition).toBe("absolute");
  batch.apply({ op: "update", id: b, absolute: false }, 4);
  expect(editor.store.get(b)?.visual.layoutPosition).toBeUndefined();
  batch.apply({ op: "update", id: a, sizing: { width: "fixed" } }, 5);
  expect(editor.store.get(a)?.visual.layoutGrow).toBeUndefined();
});
test("text hug, safe area and parent alignment", () => {
  const { editor, frame, a, batch } = fixture();
  const text = editor.createElement("text.note", {
    visual: { x: 150, y: 140, width: 50, height: 20 },
    semantic: { text: "Example" },
  });
  batch.apply({ op: "update", id: text, sizing: { width: "hug" } }, 0);
  expect(editor.store.get(text)?.visual.textResize).toBe("auto-width");
  batch.apply({ op: "align", ids: [a], edge: "right", to: "parent" }, 1);
  expect((editor.store.get(a)?.visual.x ?? 0) + 40).toBe(490);
  batch.apply({ op: "align", ids: [a], edge: "top", to: "safe-area" }, 2);
  expect(editor.store.get(a)?.visual.y).toBe(47);
  expect(frame).toBeTruthy();
});
test("distribution and parent-relative snap", () => {
  const { editor, a, b, c, batch } = fixture();
  batch.apply(
    { op: "distribute", ids: [a, b, c], axis: "vertical", gap: 12 },
    0,
  );
  expect(editor.store.get(a)?.visual.y).toBe(42);
  expect(editor.store.get(c)?.visual.y).toBe(74);
  batch.apply({ op: "update", id: a, visual: { x: 113.3 } }, 1);
  batch.apply({ op: "snap", ids: [a], grid: 4 }, 2);
  expect(editor.store.get(a)?.visual.x).toBe(112);
  batch.apply({ op: "update", id: a, visual: { y: 60 } }, 3);
  batch.apply({ op: "distribute", ids: [a, b, c], axis: "vertical" }, 4);
  expect(editor.store.get(a)?.visual.y).toBe(42);
});
test("auto-layout flow children are skipped with warning", () => {
  const { editor, frame, a, b, batch } = fixture();
  batch.apply({ op: "layout", id: frame }, 0);
  const x = editor.store.get(a)?.visual.x;
  batch.apply({ op: "align", ids: [a, b], edge: "right", to: "parent" }, 1);
  expect(editor.store.get(a)?.visual.x).toBe(x);
  expect(
    batch.convertWarnings.some((w) => w.message.includes(`skipped ${a}`)),
  ).toBe(true);
});
