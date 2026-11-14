import { expect, test } from "bun:test";
import { composeComparisonSvg } from "@nodetto/core";
import { document, element, makeEditor } from "../../core/src/test-helpers.ts";
import { buildComparisons } from "./compare-dialog.ts";

const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 4, 0,
  0, 0, 4,
]);
const editor = () =>
  makeEditor({
    document: document(
      ["a", "b", "c"].map((id, index) =>
        element({
          id,
          type: "frame",
          index: `a${index + 1}`,
          semantic: { name: id, memberIds: [] },
          visual: { x: index * 100, y: 0, width: 80, height: 100 },
        }),
      ),
    ),
  });
const rasterize = async () => png;
const reference = (name: string, bytes = png) => ({ name, bytes });

test("single comparison uses the shared CLI composition without changing history", async () => {
  const e = editor();
  const revision = e.revision;
  const undo = e.canUndo();
  const snapshot = e.getSnapshot();
  const result = await buildComparisons({
    editor: e,
    artboardIds: ["a"],
    references: [reference("reference.png")],
    scale: 2,
    bands: [],
    rasterize,
  });
  expect(result.items[0].svg).toBe(
    composeComparisonSvg({ reference: png, actual: png, scale: 2, bands: [] })
      .svg,
  );
  expect(e.revision).toBe(revision);
  expect(e.canUndo()).toBe(undo);
  expect(e.getSnapshot()).toEqual(snapshot);
});

test("multiple references pair by page reading order", async () => {
  const result = await buildComparisons({
    editor: editor(),
    artboardIds: ["c", "a", "b"],
    references: [
      reference("03-c.png"),
      reference("01-a.png"),
      reference("02-b.png"),
    ],
    scale: 2,
    bands: [],
    rasterize,
  });
  expect(result.items.map((item) => [item.number, item.artboardId])).toEqual([
    [1, "a"],
    [2, "b"],
    [3, "c"],
  ]);
});

test("invalid inputs report errors", async () => {
  const base = {
    editor: editor(),
    artboardIds: ["a", "b", "c"],
    references: [
      reference("01.png"),
      reference("02-a.png"),
      reference("02-b.png"),
    ],
    scale: 2,
    bands: [],
    rasterize,
  };
  await expect(buildComparisons(base)).rejects.toThrow("02-a.png, 02-b.png");
  await expect(
    buildComparisons({
      ...base,
      artboardIds: ["a"],
      references: [reference("bad.jpg", new Uint8Array(24))],
    }),
  ).rejects.toThrow("not a PNG");
  await expect(
    buildComparisons({
      ...base,
      artboardIds: ["a"],
      references: [reference("large.png", new Uint8Array(17 * 1024 * 1024))],
    }),
  ).rejects.toThrow("too large");
  await expect(
    buildComparisons({
      ...base,
      artboardIds: ["a"],
      references: [reference("one.png")],
      bands: [{ y0: 4, y1: 1, dy: 0 }],
    }),
  ).rejects.toThrow("invalid band");
  await expect(buildComparisons({ ...base, artboardIds: [] })).rejects.toThrow(
    "No artboard",
  );
});
