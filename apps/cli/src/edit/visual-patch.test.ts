import { expect, test } from "bun:test";
import { Editor, resolvedStrokeDashArray } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { runOperations } from "../edit-command.ts";
import { Batch } from "./batch.ts";

function setup(style?: Record<string, unknown>) {
  const editor = new Editor();
  const id = editor.createElement("node.generic", {
    semantic: { label: "Idle" },
    visual: style ? { style } : {},
  });
  return { editor, id, batch: new Batch(editor) };
}

test("null and empty dash clear values with preset semantics", () => {
  for (const value of [null, []]) {
    const { editor, id, batch } = setup({ strokeDashArray: [4, 2] });
    batch.apply(
      { op: "update", id, visual: { style: { strokeDashArray: value } } },
      0,
    );
    expect(editor.store.get(id)?.visual.style).toBeUndefined();
  }
  for (const [patch, expected] of [
    [{ strokeDashArray: [] }, undefined],
    [{ strokeDashArray: [], dash: "dotted" }, "dotted"],
    [{ strokeDashArray: null }, "dashed"],
  ] as const) {
    const { editor, id, batch } = setup({
      dash: "dashed",
      strokeDashArray: [4, 2],
    });
    batch.apply({ op: "update", id, visual: { style: patch } }, 0);
    const style = editor.store.get(id)?.visual.style;
    expect(style?.dash).toBe(expected);
    if (!expected) expect(resolvedStrokeDashArray(style)).toEqual([]);
  }
});

test("nested nulls and partial style patches merge", () => {
  const { editor, id, batch } = setup();
  batch.apply(
    { op: "update", id, visual: { style: { strokeDashArray: null } } },
    0,
  );
  expect(editor.store.get(id)?.visual.style).toBeUndefined();
  batch.apply(
    {
      op: "update",
      id,
      visual: { aspectRatio: 2, style: { fill: "#ffffff", fontSize: 14 } },
    },
    1,
  );
  batch.apply(
    {
      op: "update",
      id,
      visual: {
        aspectRatio: null,
        style: { stroke: "#112233", fontSize: null },
      },
    },
    2,
  );
  expect(editor.store.get(id)?.visual).toMatchObject({
    style: { fill: "#ffffff", stroke: "#112233" },
  });
  expect(editor.store.get(id)?.visual.aspectRatio).toBeUndefined();
  expect(editor.store.get(id)?.visual.style?.fontSize).toBeUndefined();
  const frame = editor.createElement("frame", {
    semantic: { name: "Box", memberIds: [] },
  });
  batch.apply({ op: "update", id: frame, semantic: { memberIds: null } }, 3);
  expect(
    (editor.store.get(frame)?.semantic as Record<string, unknown>)["memberIds"],
  ).toBeUndefined();
});

test("required semantic removal fails without writing", () => {
  const { editor, id } = setup();
  const source = serializeDocument(editor.getSnapshot());
  let writes = 0;
  const result = runOperations(
    {
      readText: () => source,
      writeText: () => {
        writes++;
      },
    },
    "doc.jsonl",
    [{ op: "update", id, semantic: { label: null } }],
    { arrange: false, dryRun: false, format: "text" },
  );
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain(
    'update cannot remove required field "label" of node.generic',
  );
  expect(writes).toBe(0);
});

test("locked elements only accept lock controls", () => {
  for (const value of [false, null]) {
    const { editor, id, batch } = setup();
    batch.apply({ op: "update", id, visual: { locked: true } }, 0);
    const width = editor.store.get(id)?.visual.width;
    batch.apply({ op: "update", id, visual: { width: 10 } }, 1);
    expect(editor.store.get(id)?.visual.width).toBe(width);
    batch.apply({ op: "update", id, visual: { locked: value } }, 2);
    expect(editor.store.get(id)?.visual.locked).toBe(false);
  }
});

test("add still rejects empty dash", () => {
  const { editor } = setup();
  const source = serializeDocument(editor.getSnapshot());
  const result = runOperations(
    { readText: () => source, writeText: () => {} },
    "doc.jsonl",
    [
      {
        op: "add",
        type: "node.generic",
        label: "Ready",
        visual: { style: { strokeDashArray: [] } },
      },
    ],
    { arrange: false, dryRun: false, format: "text" },
  );
  expect(result.exitCode).toBe(2);
});

test("semantic null paths include nested list items", async () => {
  const { nullPaths } = await import("./visual-patch.ts");
  expect(nullPaths({ columns: [{ name: null }] })).toEqual(["columns[0].name"]);
});
