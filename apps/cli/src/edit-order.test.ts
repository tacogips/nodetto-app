import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { runOperations } from "./edit-command.ts";
import { Batch } from "./edit/batch.ts";

function diagram() {
  const editor = new Editor();
  for (const [id, label] of [
    ["alpha", "Idle"],
    ["beta", "Running"],
    ["gamma", "Done"],
  ])
    editor.createElement("node.generic", {
      id,
      semantic: { label },
      visual: { x: id === "alpha" ? 0 : id === "beta" ? 200 : 400, y: 0 },
    });
  return editor;
}
function order(editor: Editor) {
  return editor.store
    .getPageElements(editor.store.listPages()[0]!.id)
    .map((e) => e.id);
}
function run(
  editor: Editor,
  ops: Parameters<typeof runOperations>[2],
  dryRun = false,
) {
  const source = serializeDocument(editor.getSnapshot());
  let saved = source;
  let writes = 0;
  const result = runOperations(
    {
      readText: () => source,
      writeText: (_path, text) => {
        saved = text;
        writes++;
      },
    },
    "doc.jsonl",
    ops,
    { arrange: false, dryRun, format: "json" },
  );
  return { result, source, saved: () => saved, writes: () => writes };
}

test("order moves elements to each position and relative to anchors", () => {
  for (const [placement, expected] of [
    [{ to: "back" }, ["beta", "alpha", "gamma"]],
    [{ to: "front" }, ["alpha", "gamma", "beta"]],
    [{ to: "backward" }, ["beta", "alpha", "gamma"]],
    [{ to: "forward" }, ["alpha", "gamma", "beta"]],
    [{ before: "alpha" }, ["beta", "alpha", "gamma"]],
    [{ after: "gamma" }, ["alpha", "gamma", "beta"]],
  ] as const) {
    const editor = diagram();
    const result = run(editor, [{ op: "order", id: "beta", ...placement }]);
    expect(result.result.exitCode).toBe(0);
    const loaded = new Editor({ document: parseDocument(result.saved()) });
    expect(order(loaded)).toEqual([...expected]);
  }
});

test("prefix, name and batch refs resolve", () => {
  const editor = diagram();
  const batch = new Batch(editor);
  batch.apply({ op: "order", id: "alp", to: "front" }, 0);
  expect(order(editor)).toEqual(["beta", "gamma", "alpha"]);
  batch.apply({ op: "order", id: "name:Idle", to: "back" }, 1);
  expect(order(editor)).toEqual(["alpha", "beta", "gamma"]);
  batch.apply(
    { op: "add", type: "node.generic", ref: "new", visual: { x: 900, y: 0 } },
    2,
  );
  const id = batch.refs.get("new")!;
  batch.apply({ op: "order", id: "@new", to: "back" }, 3);
  expect(order(editor)[0]).toBe(id);
});

test("where moves a block and reports matches; zero matches are a no-op", () => {
  const editor = new Editor();
  editor.createElement("frame", {
    id: "f1",
    visual: { x: 0, y: 0, width: 50, height: 50 },
  });
  editor.createElement("node.generic", {
    id: "anchor",
    visual: { x: 200, y: 0 },
  });
  editor.createElement("frame", {
    id: "f2",
    visual: { x: 400, y: 0, width: 50, height: 50 },
  });
  const batch = new Batch(editor);
  batch.apply(
    { op: "order", where: { type: "frame" }, expect: 2, after: "anchor" },
    0,
  );
  expect(order(editor)).toEqual(["anchor", "f1", "f2"]);
  expect(batch.matches[0]).toMatchObject({ op: "order", count: 2 });
  batch.apply(
    { op: "order", where: { type: "text.note" }, expect: 0, to: "back" },
    1,
  );
  expect(order(editor)).toEqual(["anchor", "f1", "f2"]);
});

test("group ordering changes memberIds without changing indexes", () => {
  const editor = diagram();
  const batch = new Batch(editor);
  batch.apply({ op: "group", ids: ["alpha", "beta", "gamma"], ref: "g" }, 0);
  const group = batch.refs.get("g")!;
  const indexes = ["alpha", "beta", "gamma"].map(
    (id) => editor.store.get(id)?.index,
  );
  batch.apply({ op: "order", id: "gamma", to: "back" }, 1);
  expect(editor.store.get(group)?.semantic).toMatchObject({
    memberIds: ["gamma", "alpha", "beta"],
  });
  batch.apply({ op: "order", id: "beta", before: "alpha" }, 2);
  expect(editor.store.get(group)?.semantic).toMatchObject({
    memberIds: ["gamma", "beta", "alpha"],
  });
  expect(
    ["alpha", "beta", "gamma"].map((id) => editor.store.get(id)?.index),
  ).toEqual(indexes);
});

test("frame moves with owned content; no-op and dry run preserve document", () => {
  const editor = new Editor();
  editor.createElement("frame", {
    id: "frame",
    visual: { x: 0, y: 0, width: 200, height: 200 },
  });
  editor.createElement("node.generic", {
    id: "inside",
    visual: { x: 20, y: 20, width: 40, height: 40 },
  });
  editor.createElement("node.generic", {
    id: "outside",
    visual: { x: 500, y: 0 },
  });
  const batch = new Batch(editor);
  batch.apply({ op: "order", id: "frame", to: "front" }, 0);
  expect(order(editor)).toEqual(["outside", "frame", "inside"]);
  const noOp = run(editor, [{ op: "order", id: "outside", to: "back" }]);
  expect(noOp.result.exitCode).toBe(0);
  expect(noOp.saved()).toBe(noOp.source);
  const preview = run(
    editor,
    [{ op: "order", id: "outside", to: "front" }],
    true,
  );
  expect(preview.result.exitCode).toBe(0);
  expect(preview.saved()).toBe(preview.source);
  expect(preview.writes()).toBe(0);
});

test("invalid orders fail atomically with actionable errors", () => {
  const editor = diagram();
  const second = editor.createPage({ name: "Second" });
  editor.createElement("node.generic", {
    id: "other",
    visual: { x: 700, y: 0 },
  });
  editor.setCurrentPage(editor.store.listPages()[0]!.id);
  const batch = new Batch(editor);
  batch.apply({ op: "group", ids: ["alpha", "beta"], ref: "g" }, 0);
  for (const [op, message] of [
    [{ id: "gamma" }, 'order needs exactly one of "to", "before" or "after"'],
    [
      { id: "gamma", to: "back", before: "alpha" },
      'order needs exactly one of "to", "before" or "after"',
    ],
    [
      { id: "gamma", to: "middle" },
      '"to" must be back, front, backward or forward',
    ],
    [
      { where: { type: "node.generic" }, to: "back" },
      "order targets must be on one page",
    ],
    [
      {
        where: { type: "node.generic", page: editor.store.listPages()[0]!.id },
        to: "back",
      },
      "order targets must all be ungrouped or all in one group",
    ],
    [{ id: "gamma", before: "other" }, "anchor other is on another page"],
    [
      { id: "alpha", before: "gamma" },
      "anchor gamma must be in the same group",
    ],
    [
      { id: "gamma", before: "alpha" },
      "anchor alpha is inside a group; order relative to the group",
    ],
    [
      { id: "gamma", before: "gamma" },
      "anchor gamma is one of the elements being moved",
    ],
    [
      { where: { page: second, type: "node.generic" }, expect: 2, to: "back" },
      "expected 2",
    ],
    [
      { id: "gamma", to: "front", bogus: true },
      "Valid fields: op, id, where, expect, to, before, after",
    ],
  ] as const) {
    const attempt = run(editor, [{ op: "order", ...op }]);
    expect(attempt.result.exitCode).toBe(2);
    expect(attempt.result.stderr).toContain(message);
    expect(attempt.writes()).toBe(0);
    expect(attempt.saved()).toBe(attempt.source);
  }
});

test("only known aliases receive order hints", () => {
  for (const [op, hint] of [
    ["send-to-back", '"to":"back"'],
    ["bring-to-front", '"to":"front"'],
    ["reorder", "before"],
  ] as const) {
    const attempt = run(diagram(), [{ op }]);
    expect(attempt.result.exitCode).toBe(2);
    expect(attempt.result.stderr).toContain(hint);
    expect(attempt.result.stderr).toContain("order");
    expect(attempt.writes()).toBe(0);
  }
  const unknown = run(diagram(), [{ op: "unknown" }]);
  expect(unknown.result.exitCode).toBe(2);
  expect(unknown.result.stderr).toContain("order");
  expect(unknown.result.stderr).not.toContain('"to":"back"');
  expect(unknown.result.stderr).not.toContain('"to":"front"');
});
