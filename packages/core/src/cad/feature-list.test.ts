import { expect, test } from "bun:test";
import { parseDocument } from "@nodetto/io";
import { layerName, renameLayer } from "../layer-name.ts";
import { layerRows } from "../layer-tree.ts";
import { makeEditor } from "../test-helpers.ts";
import { cadFeatureRows } from "./feature-list.ts";
import { cadElement } from "./testing/documents.ts";

const plate = parseDocument(
  await Bun.file(
    new URL("../../../io/src/__fixtures__/cad3d.jsonl", import.meta.url),
  ).text(),
);

const expected: [string, 0 | 1, string][] = [
  ["sketch-base", 0, "Outline"],
  ["line-bottom", 1, "Line"],
  ["line-left", 1, "Line"],
  ["arc-rim", 1, "Arc"],
  ["line-top", 1, "Line"],
  ["plate", 0, "Plate"],
  ["sketch-top", 0, "Mounting hole"],
  ["circle-bore", 1, "Circle 2.125001 mm"],
  ["cut", 0, "Bore"],
];

test("feature rows follow history and sort entities by index and id", () => {
  const orphan = cadElement("orphan", "cad.circle", "A", { c: [0, 0], r: 4 });
  const tied = {
    ...cadElement("aaa", "cad.line", "a3", {
      sketch: "sketch-base",
      a: [0, 0],
      b: [1, 0],
    }),
    page: "part",
  };
  const rows = cadFeatureRows([orphan, ...plate.elements, tied]);
  expect(rows.map(({ id, depth, name }) => [id, depth, name])).toEqual([
    ...expected.slice(0, 3),
    ["aaa", 1, "Line"],
    ...expected.slice(3),
    ["orphan", 0, "Circle 4 mm"],
  ]);
});

test("layers omit shared resources and search reveals the matching sketch entity", () => {
  const editor = makeEditor({ document: plate });
  editor.setCurrentPage("part");
  const rows = layerRows(editor);
  expect(
    rows.map(({ element, depth }) => [element.id, depth, layerName(element)]),
  ).toEqual(expected);
  expect(
    layerRows(editor, new Set(["sketch-base"])).map((row) => row.element.id),
  ).not.toContain("arc-rim");
  expect(
    layerRows(editor, new Set(["sketch-base"]), "Arc").map(
      ({ element, matched }) => [element.id, matched],
    ),
  ).toEqual([
    ["sketch-base", false],
    ["arc-rim", true],
  ]);
});

test("feature rename is one semantic undo step and empty input restores the default", () => {
  const editor = makeEditor({ document: plate });
  const original = editor.store.get("plate");
  const history = editor.history.undoSize;
  expect(renameLayer(editor, "plate", "  Lid  ")).toBe(true);
  expect(editor.store.get("plate")).toMatchObject({
    semantic: { name: "Lid" },
    visual: original?.visual,
  });
  expect(editor.store.get("plate")?.visual).not.toHaveProperty("layerName");
  expect(layerName(editor.store.get("plate")!)).toBe("Lid");
  expect(renameLayer(editor, "plate", "Lid")).toBe(false);
  expect(renameLayer(editor, "circle-bore", "Bore")).toBe(false);
  expect(editor.history.undoSize).toBe(history + 1);
  editor.undo();
  expect(editor.store.get("plate")).toEqual(original);
  editor.redo();
  expect(renameLayer(editor, "plate", " ")).toBe(true);
  expect(layerName(editor.store.get("plate")!)).toBe("Extrude");
  expect(editor.store.get("plate")?.semantic).toMatchObject({
    name: "Extrude",
  });
});

test("2D layer renames keep their visual override", () => {
  const editor = makeEditor();
  const id = editor.createElement("shape.geo");
  const semantic = editor.store.get(id)?.semantic;
  expect(renameLayer(editor, id, "Diagram")).toBe(true);
  expect(editor.store.get(id)).toMatchObject({
    visual: { layerName: "Diagram" },
    semantic,
  });
});
