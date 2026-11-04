import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { runOperations } from "../edit-command.ts";
import { Batch } from "./batch.ts";

test("names, where counts and select bind existing elements", () => {
  const editor = new Editor();
  const one = editor.createElement("node.generic", {
    semantic: { label: "Idle" },
  });
  const two = editor.createElement("node.generic", {
    semantic: { label: "Running" },
  });
  const batch = new Batch(editor);
  expect(batch.element("name: Idle ", 0).id).toBe(one);
  batch.apply({ op: "select", ref: "ok", id: "name:Idle" }, 0);
  batch.apply({ op: "update", id: "@ok", label: "Ready" }, 1);
  batch.apply(
    {
      op: "update",
      where: { type: "node.generic" },
      expect: 2,
      visual: { width: 100 },
    },
    2,
  );
  expect(batch.matches.map((m) => m.count)).toEqual([1, 2]);
  expect(editor.store.get(two)?.visual.width).toBe(100);
  expect(() =>
    batch.apply({ op: "delete", where: { name: "Missing" } }, 3),
  ).toThrow("where matched no elements");
  batch.apply({ op: "delete", where: { name: "Missing" }, expect: 0 }, 4);
  expect(() => batch.apply({ op: "select", ref: "ok", id: one }, 5)).toThrow(
    "already used",
  );
  expect(() =>
    batch.apply({ op: "delete", where: { nam: "Ready" } }, 6),
  ).toThrow('Did you mean "name"');
});

test("count mismatch does not write", () => {
  const editor = new Editor();
  editor.createElement("node.generic", { semantic: { label: "Idle" } });
  let writes = 0;
  const result = runOperations(
    {
      readText: () => serializeDocument(editor.getSnapshot()),
      writeText: () => {
        writes++;
      },
    },
    "doc.jsonl",
    [{ op: "delete", where: { type: "node.generic" }, expect: 2 }],
    { arrange: false, dryRun: false, format: "text" },
  );
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("expected 2");
  expect(writes).toBe(0);
});

test("name references scope by page, include candidates, and preserve exact ids", () => {
  const editor = new Editor();
  const firstPage = editor.store.listPages()[0]!.id;
  const one = editor.createElement("node.generic", {
    id: "name:Exact",
    semantic: { label: "Approve" },
  });
  const secondPage = editor.createPage({ name: "Returns" });
  const two = editor.createElement("node.generic", {
    id: "second-node",
    semantic: { label: "Approve" },
  });
  const running = editor.createElement("node.generic", {
    semantic: { label: "Running" },
  });
  const batch = new Batch(editor);
  expect(batch.element("name:Exact", 0).id).toBe(one);
  expect(() => batch.element("name:Approve", 0)).toThrow("matches 2 elements");
  try {
    batch.element("name:Approve", 0);
  } catch (error) {
    expect(String(error)).toContain("Returns");
    expect(String(error)).toContain("node.generic");
  }
  expect(() => batch.element("name:approve", 0)).toThrow("similar:");
  expect(() => batch.element("name:Nothing", 0)).toThrow("no similar names");
  batch.apply(
    {
      op: "select",
      ref: "selected",
      where: { name: "Approve", page: secondPage },
    },
    1,
  );
  expect(batch.refs.get("selected")).toBe(two);
  expect(batch.touchedPages.size).toBe(0);
  batch.apply(
    {
      op: "connect",
      page: secondPage,
      from: "name:Approve",
      to: "name:Running",
    },
    2,
  );
  expect(editor.store.get(batch.created.at(-1)!.id)?.semantic).toMatchObject({
    from: two,
    to: running,
  });
  expect(batch.element("name:Approve", 3, firstPage).id).toBe(one);
  batch.refs.set("page-ref", secondPage);
  expect(() => batch.element("@page-ref", 3)).toThrow("No element");
  expect(batch.element("second", 3).id).toBe(two);
});

test("where endpoints, semantic references and text fields", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply({ op: "add", type: "node.generic", label: "Idle" }, 0);
  const idle = batch.created.at(-1)!.id;
  batch.apply({ op: "add", type: "node.generic", label: "Running" }, 1);
  const running = batch.created.at(-1)!.id;
  batch.apply({ op: "connect", from: "name:Idle", to: "name:Running" }, 2);
  const edge = batch.created.at(-1)!.id;
  batch.apply(
    {
      op: "delete",
      where: { type: "edge.generic", from: "name:Idle", to: "name:Running" },
      expect: 1,
    },
    3,
  );
  expect(editor.store.get(edge)).toBeUndefined();
  expect(batch.matches.at(-1)).toMatchObject({ count: 1, ids: [edge] });
  batch.apply(
    { op: "add", type: "text.note", semantic: { text: "name: Idle" } },
    4,
  );
  expect(editor.store.get(batch.created.at(-1)!.id)?.semantic).toMatchObject({
    text: "name: Idle",
  });
  batch.apply(
    {
      op: "add",
      type: "frame",
      semantic: { name: "Container", memberIds: ["name:Idle", "name:Running"] },
    },
    5,
  );
  expect(editor.store.get(batch.created.at(-1)!.id)?.semantic).toMatchObject({
    memberIds: [idle, running],
  });
});

test("where parent uses frame, semantic parent and group membership", () => {
  const editor = new Editor();
  const batch = new Batch(editor);
  batch.apply(
    {
      op: "add",
      type: "frame",
      semantic: { name: "Box" },
      visual: { x: 0, y: 0, width: 500, height: 400 },
    },
    0,
  );
  batch.apply(
    {
      op: "add",
      type: "node.generic",
      label: "Inside",
      visual: { x: 50, y: 50, width: 100, height: 30 },
    },
    1,
  );
  const inside = batch.created.at(-1)!.id;
  expect(batch.element(inside, 1).id).toBe(inside);
  batch.apply(
    {
      op: "select",
      ref: "inside",
      where: { parent: "name:Box", name: "Inside" },
    },
    2,
  );
  expect(batch.refs.get("inside")).toBe(inside);
  const page = editor.createPage({ name: "Process", kind: "bpmn" });
  batch.apply(
    {
      op: "add",
      page,
      type: "bpmn.subProcess",
      visual: { x: 0, y: 0, width: 500, height: 400 },
      semantic: { name: "Intake" },
    },
    3,
  );
  const parent = batch.created.at(-1)!.id;
  batch.apply(
    {
      op: "add",
      page,
      type: "bpmn.task",
      visual: { x: 50, y: 50 },
      semantic: { name: "Approve", parent: "name:Intake" },
    },
    4,
  );
  const task = batch.created.at(-1)!.id;
  batch.apply(
    { op: "update", id: task, semantic: { parent: "name:Intake" } },
    4,
  );
  expect(editor.store.get(task)?.semantic).toMatchObject({ parent });
  batch.apply(
    {
      op: "select",
      ref: "task",
      where: { parent: "name:Intake", name: "Approve" },
    },
    5,
  );
  expect(batch.refs.get("task")).toBe(task);
  const groupPage = editor.createPage({ name: "Groups" });
  batch.apply(
    { op: "add", page: groupPage, type: "node.generic", label: "One" },
    6,
  );
  const one = batch.created.at(-1)!.id;
  batch.apply(
    { op: "add", page: groupPage, type: "node.generic", label: "Two" },
    7,
  );
  const two = batch.created.at(-1)!.id;
  batch.apply({ op: "group", ids: [one, two], ref: "group" }, 8);
  batch.apply(
    { op: "select", ref: "member", where: { parent: "@group", name: "One" } },
    9,
  );
  expect(batch.refs.get("member")).toBe(one);
});

test("selection validation rejects invalid counts and preserves batch atomicity", () => {
  const editor = new Editor();
  const id = editor.createElement("node.generic", {
    semantic: { label: "Idle" },
  });
  const batch = new Batch(editor);
  expect(() => batch.apply({ op: "select", ref: " ", id }, 0)).toThrow(
    '"ref" must be a non-empty string',
  );
  expect(() => batch.apply({ op: "select", ref: "x" }, 0)).toThrow(
    'select needs "id" or "where"',
  );
  expect(() =>
    batch.apply(
      { op: "select", ref: "x", where: { name: "Idle" }, expect: 2 },
      0,
    ),
  ).toThrow("select binds exactly one");
  expect(() =>
    batch.apply(
      { op: "select", ref: "x", id, where: { name: "Idle" }, expect: 2 },
      0,
    ),
  ).toThrow('use either "id" or "where"');
  expect(() =>
    batch.apply({ op: "delete", id, where: { name: "Idle" } }, 0),
  ).toThrow('use either "id" or "where"');
  expect(() => batch.apply({ op: "delete", id, expect: 1 }, 0)).toThrow(
    '"expect" needs "where"',
  );
  for (const invalid of [null, -1, 1.5, "1"])
    expect(() =>
      batch.apply(
        { op: "delete", where: { name: "Idle" }, expect: invalid },
        0,
      ),
    ).toThrow('"expect" must be a whole number >= 0');
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
    [
      { op: "update", id, label: "Changed" },
      { op: "delete", where: { name: "Changed" }, expect: 2 },
    ],
    { arrange: false, dryRun: false, format: "text" },
  );
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("expected 2");
  expect(writes).toBe(0);
});

test("name lookup excludes elements without string labels", () => {
  const editor = new Editor();
  editor.createElement("group", { semantic: { memberIds: [] } });
  const batch = new Batch(editor);
  expect(() => batch.element("name:", 0)).toThrow("no element named");
});

test("BPMN flow where matches endpoint names and reports mismatch candidates", () => {
  const editor = new Editor();
  const page = editor.createPage({ name: "Orders", kind: "bpmn" });
  const batch = new Batch(editor);
  batch.apply({ op: "add", page, type: "bpmn.task", label: "Approve" }, 0);
  batch.apply(
    { op: "add", page, type: "bpmn.task", label: "Update status" },
    1,
  );
  batch.apply(
    { op: "connect", from: "name:Approve", to: "name:Update status" },
    2,
  );
  const flow = batch.created.at(-1)!.id;
  const where = {
    page,
    type: "bpmn.sequenceFlow",
    from: "name:Approve",
    to: "name:Update status",
  };
  expect(() => batch.apply({ op: "delete", where, expect: 2 }, 3)).toThrow(
    "bpmn.sequenceFlow",
  );
  expect(editor.store.get(flow)).toBeDefined();
  batch.apply({ op: "delete", where, expect: 1 }, 4);
  expect(editor.store.get(flow)).toBeUndefined();
  expect(batch.matches.at(-1)).toMatchObject({
    operation: 4,
    op: "delete",
    count: 1,
    ids: [flow],
  });
});
