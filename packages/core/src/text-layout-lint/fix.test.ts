import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { planTextWrapFixes } from "./fix.ts";
import { lintTextLayoutPage } from "./engine.ts";
test("plans width fixes but not a vertical-only overflow", () => {
  const editor = new Editor();
  const elements = [
    editor.buildElement("node.generic", {
      id: "node",
      visual: { x: 0, y: 0, width: 55, height: 100 },
      semantic: { label: "あいうえおかきくけこさしすせそたちつてと" },
    }),
    editor.buildElement("text.note", {
      id: "note",
      visual: { x: 100, y: 0, width: 70, height: 100 },
      semantic: { text: "あいうえおかきくけこさしすせそたちつてと" },
    }),
    editor.buildElement("text.note", {
      id: "tall",
      visual: { x: 200, y: 0, width: 200, height: 10 },
      semantic: { text: "one\ntwo\nthree" },
    }),
  ];
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const fixes = planTextWrapFixes(editor.getSnapshot(), editor.currentPageId);
  expect(fixes.map((f) => [f.elementId, f.field])).toEqual([
    ["node", "label"],
    ["note", "text"],
  ]);
  expect(fixes.every((f) => f.after.includes("\n"))).toBe(true);
  editor.apply(
    fixes.map((fix) => ({
      type: "updateSemantic" as const,
      id: fix.elementId,
      semantic: { [fix.field]: fix.after },
    })),
  );
  const fixed = editor.getSnapshot();
  expect(
    lintTextLayoutPage(fixed, editor.currentPageId).filter((f) =>
      f.message.includes(" wide but the text area is "),
    ),
  ).toEqual([]);
  expect(planTextWrapFixes(fixed, editor.currentPageId)).toEqual([]);
});

test("fitting text needs no fix", () => {
  const editor = new Editor();
  editor.apply([
    {
      type: "createElement",
      element: editor.buildElement("text.note", {
        visual: { x: 0, y: 0, width: 200, height: 100 },
        semantic: { text: "Fits" },
      }),
    },
  ]);
  expect(planTextWrapFixes(editor.getSnapshot(), editor.currentPageId)).toEqual(
    [],
  );
});
