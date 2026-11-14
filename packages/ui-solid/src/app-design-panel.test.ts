import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  appDesignProblemRows,
  focusAppDesignProblem,
} from "./AppDesignProblemsPanel.tsx";

test("lists an overflowing label and focuses the finding", () => {
  const editor = new Editor();
  const note = editor.buildElement("text.note", {
    id: "note",
    semantic: { text: "A very long label that must be truncated" },
    visual: {
      x: 8,
      y: 8,
      width: 40,
      height: 32,
      textPadding: 0,
      textTruncate: "ellipsis",
      textMeasure: "proportional",
    },
  });
  const frame = editor.buildElement("frame", {
    id: "screen",
    semantic: { name: "Screen", platform: "ios", memberIds: [note.id] },
    visual: { x: 0, y: 0, width: 200, height: 200 },
  });
  editor.apply(
    [frame, note].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const finding = appDesignProblemRows(editor).find(
    (row) => row.ruleId === "app-text-truncated",
  );
  expect(finding).toBeDefined();
  expect(
    focusAppDesignProblem(editor, finding!, { width: 800, height: 600 }),
  ).toBe(true);
  expect(editor.selection.has(note.id)).toBe(true);
});
