import { expect, test } from "bun:test";
import {
  Editor,
  bindSelectionTextStyle,
  createTextStyle,
  nodeLabelLayout,
  updateTextStyle,
} from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { Batch } from "./batch.ts";

const typography = {
  fontFamily: "sans-serif",
  fontSize: 13,
  fontWeight: 400,
  fontStyle: "normal" as const,
  lineHeight: 1.2,
  letterSpacing: 0,
  textAlign: "middle" as const,
  textDecoration: "none" as const,
  verticalAlign: "bottom" as const,
};

function bound(type: "node.generic" | "text.note" = "node.generic") {
  const editor = new Editor();
  const id = editor.createElement(type, {
    semantic: type === "text.note" ? { text: "Widget" } : { label: "Widget" },
    visual: { width: 100, height: 100 },
  });
  const style = createTextStyle(editor, "Widget style", typography) as string;
  editor.selection.set([id]);
  bindSelectionTextStyle(editor, style);
  return { editor, id, style, batch: new Batch(editor) };
}

test("add writes the marker for both box types and round trips it", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply(
    {
      op: "add",
      type: "node.generic",
      label: "Widget",
      visual: { width: 100, height: 100, style: { verticalAlign: "top" } },
    },
    0,
  );
  batch.apply(
    {
      op: "add",
      shape: "flowchart:decision",
      label: "Widget",
      visual: { width: 100, height: 100, style: { verticalAlign: "bottom" } },
    },
    1,
  );
  const doc = parseDocument(serializeDocument(editor.getSnapshot()));
  const boxes = doc.elements.filter(
    (element) =>
      element.type === "node.generic" || element.type === "shape.geo",
  );
  expect(boxes).toHaveLength(2);
  expect(boxes.map((element) => element.visual.style?.boxLabelAlign)).toEqual([
    true,
    true,
  ]);
  const node = boxes.find((element) => element.type === "node.generic")!;
  const shape = boxes.find((element) => element.type === "shape.geo")!;
  expect(node.visual.style?.verticalAlign).toBe("top");
  expect(shape.visual.style?.verticalAlign).toBe("bottom");
  expect(node.visual.style?.extensions?.boxLabelAlign).toBeUndefined();
  expect(nodeLabelLayout("Widget", node.visual).top).toBe(10);
  expect(nodeLabelLayout("Widget", shape.visual).top).toBeCloseTo(74.4);
  const svg = editor.exportPageSvg() ?? "";
  const ys = [
    ...svg.matchAll(/<text[^>]*\sy="([\d.]+)"[^>]*>Widget<\/text>/g),
  ].map((match) => Number(match[1]));
  expect(ys).toHaveLength(2);
  expect(ys[0]!).toBeLessThan(50);
  expect(ys[1]!).toBeGreaterThan(50);
});

test("update preserves legacy alignment until requested and clears both keys", () => {
  const editor = new Editor();
  const id = editor.createElement("node.generic", {
    semantic: { label: "Widget" },
    visual: { width: 100, height: 100, style: { verticalAlign: "top" } },
  });
  const batch = new Batch(editor);
  batch.apply(
    { op: "update", id, visual: { style: { stroke: "#112233" } } },
    0,
  );
  expect(editor.store.get(id)?.visual.style?.boxLabelAlign).toBeUndefined();
  expect(
    nodeLabelLayout("Widget", editor.store.get(id)!.visual).top,
  ).toBeCloseTo(42.2);
  const snapshot = editor.getSnapshot();
  const plain = {
    ...snapshot,
    elements: snapshot.elements.map((element) => {
      const { verticalAlign: _verticalAlign, ...style } =
        element.visual.style ?? {};
      return { ...element, visual: { ...element.visual, style } };
    }),
  };
  expect(editor.exportPageSvg()).toBe(
    new Editor({ document: plain }).exportPageSvg(),
  );
  batch.apply(
    { op: "update", id, visual: { style: { verticalAlign: "bottom" } } },
    1,
  );
  expect(editor.store.get(id)?.visual.style?.boxLabelAlign).toBe(true);
  expect(
    nodeLabelLayout("Widget", editor.store.get(id)!.visual).top,
  ).toBeCloseTo(74.4);
  batch.apply(
    { op: "update", id, visual: { style: { boxLabelAlign: null } } },
    2,
  );
  expect(editor.store.get(id)?.visual.style?.verticalAlign).toBe("bottom");
  expect(
    nodeLabelLayout("Widget", editor.store.get(id)!.visual).top,
  ).toBeCloseTo(42.2);
  batch.apply(
    { op: "update", id, visual: { style: { verticalAlign: "bottom" } } },
    3,
  );
  expect(editor.store.get(id)?.visual.style?.boxLabelAlign).toBe(true);
  batch.apply(
    {
      op: "update",
      id,
      visual: { style: { verticalAlign: null, stroke: null } },
    },
    4,
  );
  expect(editor.store.get(id)?.visual.style?.boxLabelAlign).toBeUndefined();
  expect(editor.store.get(id)?.visual.style?.verticalAlign).toBeUndefined();
  expect(editor.store.get(id)?.visual.style).toBeUndefined();
  expect(
    nodeLabelLayout("Widget", editor.store.get(id)!.visual).top,
  ).toBeCloseTo(42.2);
});

test("bound box detaches for alignment but can follow a style with marker alone", () => {
  const a = bound();
  a.batch.apply(
    { op: "update", id: a.id, visual: { style: { verticalAlign: "bottom" } } },
    0,
  );
  expect(a.editor.store.get(a.id)?.visual.textStyle).toBeUndefined();
  expect(
    nodeLabelLayout("Widget", a.editor.store.get(a.id)!.visual).top,
  ).toBeCloseTo(74.4);
  expect(a.editor.store.get(a.id)?.visual.style).toMatchObject({
    verticalAlign: "bottom",
    boxLabelAlign: true,
    fontSize: 13,
  });
  a.batch.apply({ op: "update", id: a.id, visual: { width: 120 } }, 1);
  expect(a.editor.store.get(a.id)?.visual.style?.verticalAlign).toBe("bottom");

  const b = bound();
  b.batch.apply(
    { op: "update", id: b.id, visual: { style: { boxLabelAlign: true } } },
    0,
  );
  expect(b.editor.store.get(b.id)?.visual.textStyle).toBe(b.style);
  expect(
    nodeLabelLayout("Widget", b.editor.store.get(b.id)!.visual).top,
  ).toBeCloseTo(74.4);
  expect(
    updateTextStyle(b.editor, b.style, "Widget style", {
      ...typography,
      verticalAlign: "top",
    }),
  ).toBe(true);
  expect(nodeLabelLayout("Widget", b.editor.store.get(b.id)!.visual).top).toBe(
    10,
  );

  const c = bound();
  c.batch.apply(
    {
      op: "update",
      id: c.id,
      visual: { textStyle: c.style, style: { verticalAlign: "top" } },
    },
    0,
  );
  expect(c.editor.store.get(c.id)?.visual.textStyle).toBe(c.style);
  expect(c.editor.store.get(c.id)?.visual.style).toMatchObject({
    boxLabelAlign: true,
    verticalAlign: "bottom",
  });
});

test("notes retain binding and unknown style keys are rejected", () => {
  const { editor, id, style, batch } = bound("text.note");
  batch.apply(
    { op: "update", id, visual: { style: { verticalAlign: "top" } } },
    0,
  );
  expect(editor.store.get(id)?.visual.textStyle).toBe(style);
  expect(editor.store.get(id)?.visual.style?.boxLabelAlign).toBeUndefined();
  expect(() =>
    batch.apply({ op: "update", id, visual: { style: { valign: "top" } } }, 1),
  ).toThrow("verticalAlign");
});
