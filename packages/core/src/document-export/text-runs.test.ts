import { expect, test } from "bun:test";
import { document, element, makeEditor, TEST_PAGE } from "../test-helpers.ts";
import { PDF_TEXT_RUN_EXTRACTORS } from "./extractors.ts";
import { collectTextRuns, type TextRunExtractor } from "./text-runs.ts";
test("collects only visible intersecting runs inside the rectangle", () => {
  const shape = (id: string, x: number, hidden = false) =>
    element({
      id,
      type: "text.note",
      semantic: {},
      visual: { x, y: 20, width: 20, height: 20, hidden },
    });
  const editor = makeEditor({
    document: document([
      shape("inside", 20),
      shape("outside", 200),
      shape("hidden", 30, true),
    ]),
  });
  const args = [
    editor.store,
    editor.registry,
    TEST_PAGE.id,
    { x: 10, y: 10, width: 100, height: 100 },
    {
      "text.note": ((el, box) => [
        { x: box.x, y: box.y, size: 12, text: el.id, font: "sans" },
      ]) satisfies TextRunExtractor,
    },
  ] as const;
  const runs = collectTextRuns(...args);
  expect(collectTextRuns(...args, undefined)).toEqual(runs);
  expect(collectTextRuns(...args, () => false)).toEqual([]);
  expect(runs).toEqual([
    { x: 10, y: 10, size: 12, text: "inside", font: "sans" },
  ]);
  expect(Object.keys(PDF_TEXT_RUN_EXTRACTORS).sort()).toEqual([
    "text.code",
    "text.markdown",
  ]);
});
