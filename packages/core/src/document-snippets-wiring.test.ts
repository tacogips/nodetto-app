import { expect, test } from "bun:test";
import { validateDocument } from "@nodetto/ir";
import { PDF_TEXT_RUN_EXTRACTORS } from "./document-export/extractors.ts";
import { markdownSnippetLayout } from "./markdown-snippet/layout.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

function snippetsEditor() {
  return makeEditor({
    document: document([
      element({
        id: "code",
        type: "text.code",
        semantic: {
          code: "let x = 1;",
          language: "rust",
          showLineNumbers: true,
        },
        visual: { x: 0, y: 0, width: 300, height: 100 },
      }),
      element({
        id: "md",
        index: "a2",
        type: "text.markdown",
        semantic: { markdown: "# Hello" },
        visual: { x: 0, y: 150, width: 300, height: 100 },
      }),
    ]),
  });
}

test("snippet validation, SVG rendering and text editing", () => {
  const editor = snippetsEditor();
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
  const svg = editor.exportPageSvgOf("page-1");
  expect(svg).toContain("nodetto-code");
  expect(svg).toContain("nodetto-markdown");
  for (const [id, before, after] of [
    ["code", "let x = 1;", "let x = 2;"],
    ["md", "# Hello", "## Updated"],
  ] as const) {
    expect(editor.getText(id)).toBe(before);
    expect(editor.setText(id, after)).toBe(true);
    expect(editor.getText(id)).toBe(after);
    expect(editor.store.get(id)?.semantic).toMatchObject(
      id === "code"
        ? { code: after, language: "rust", showLineNumbers: true }
        : { markdown: after },
    );
  }
  expect(Object.keys(PDF_TEXT_RUN_EXTRACTORS).sort()).toEqual([
    "text.code",
    "text.markdown",
  ]);
});

test("copy, paste and duplicate retain both snippet semantics", () => {
  const editor = snippetsEditor();
  const originals = [editor.store.get("code"), editor.store.get("md")];
  editor.selection.set(["code", "md"]);
  expect(editor.copySelection()).toBe(true);
  const pasted = editor.paste();
  expect(pasted).toHaveLength(2);
  for (const original of originals) {
    expect(original).toBeDefined();
    const copy = pasted
      .map((id) => editor.store.get(id))
      .find((item) => item?.type === original?.type);
    expect(copy?.semantic).toEqual(original?.semantic);
  }
  const duplicated = editor.duplicateSelection();
  expect(duplicated).toHaveLength(2);
  for (const original of originals) {
    const copy = duplicated
      .map((id) => editor.store.get(id))
      .find((item) => item?.type === original?.type);
    expect(copy?.semantic).toEqual(original?.semantic);
  }
});

test("markdown layout cache follows semantic and visual store updates", () => {
  const editor = snippetsEditor();
  const before = editor.store.get("md");
  if (!before) throw new Error("missing markdown");
  const light = markdownSnippetLayout(before);
  editor.apply([
    {
      type: "updateSemantic",
      id: "md",
      semantic: {
        markdown:
          "# Longer\n\nOne paragraph.\n\nAnother paragraph.\n\nA third paragraph.",
      },
    },
  ]);
  const updated = editor.store.get("md");
  if (!updated) throw new Error("missing updated markdown");
  expect(updated).not.toBe(before);
  expect(markdownSnippetLayout(updated).height).toBeGreaterThan(light.height);
  editor.apply([
    { type: "updateVisual", id: "md", visual: { style: { fill: "#000000" } } },
  ]);
  const dark = editor.store.get("md");
  if (!dark) throw new Error("missing visually updated markdown");
  expect(dark).not.toBe(updated);
  expect(markdownSnippetLayout(dark).palette).not.toEqual(light.palette);
});
