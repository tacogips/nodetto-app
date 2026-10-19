import { expect, test } from "bun:test";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { nodeLabelLayout } from "./node-label.ts";
import { makeEditor } from "./test-helpers.ts";

test("node labels preserve explicit blank lines, graphemes, wrapping and style", () => {
  const visual = {
    width: 100,
    height: 80,
    style: { fontSize: 20, lineHeight: 1.5 },
  };
  const layout = nodeLabelLayout("日本語\n\nCafe\u0301", visual);
  expect(layout.lines).toEqual(["日本語", "", "Cafe\u0301"]);
  expect(layout.lineHeight).toBe(30);
  expect(layout.top).toBe(0);
  expect(
    nodeLabelLayout("1234567890", { width: 40, height: 60 }).lines.length,
  ).toBeGreaterThan(1);
  expect(nodeLabelLayout("Node", {}).top).toBeCloseTo((60 - 15.6) / 2);
});

test("multiline generic nodes round trip, undo and export the same wrapped lines", () => {
  const editor = makeEditor();
  const node = editor.buildElement("node.generic", {
    id: "multiline",
    semantic: { label: "Title" },
    visual: { width: 100, height: 80 },
  });
  editor.apply([{ type: "createElement", element: node }]);
  editor.setText(node.id, "Title\n説明\n\nLongDescriptionWithoutSpaces");
  const updated = editor.store.get(node.id)!;
  const svg = editor.exportPageSvg()!;
  const lines = nodeLabelLayout(
    (updated.semantic as { label: string }).label,
    updated.visual,
  ).lines;
  for (const line of lines.filter(Boolean))
    expect(svg).toContain(`>${line}</text>`);
  expect(svg).toContain('clip-path="url(#node-label-');
  const document = parseDocument(serializeDocument(editor.getSnapshot()));
  expect(
    document.elements.find((element) => element.id === node.id)?.semantic,
  ).toEqual(updated.semantic);
  editor.undo();
  expect(editor.store.get(node.id)?.semantic).toEqual({ label: "Title" });
  editor.redo();
  expect(editor.store.get(node.id)?.semantic).toEqual(updated.semantic);
});
