import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor, frameParents } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { applyBatch } from "../apply-batch.ts";
import { runOperations } from "../../edit-command.ts";

function fixture(): Editor {
  const editor = new Editor();
  editor.createElement("node.generic", {
    id: "a",
    semantic: { label: "Widget" },
    visual: { x: 0, y: 0, width: 180, height: 120 },
  });
  editor.createElement("node.generic", {
    id: "b",
    semantic: { label: "Other" },
    visual: { x: 300, y: 0, width: 180, height: 120 },
  });
  editor.createElement("node.generic", {
    id: "c",
    semantic: { label: "Target" },
    visual: { x: 600, y: 0, width: 180, height: 120 },
  });
  editor.createElement("edge.generic", {
    id: "edge",
    semantic: {
      from: "a",
      to: "b",
      label: "Link",
      fromPort: "right",
      toPort: "left",
      labelPosition: 0.3,
      routing: "manual",
      routingWaypoints: [{ u: 0.5, v: 0.2 }],
    },
  });
  return editor;
}
function source(editor: Editor): string {
  return serializeDocument(editor.getSnapshot());
}

test("convert retains identity, bounds and connected edge", () => {
  const editor = fixture();
  const before = editor.store.get("a");
  const edge = editor.store.get("edge");
  const result = applyBatch(
    source(editor),
    [{ op: "convert", id: "a", shape: "flowchart:database" }],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("a")?.index).toBe(before?.index);
  expect(after.store.get("edge")).toEqual(edge);
  expect(result.converted?.[0]?.connectors.map((item) => item.id)).toEqual([
    "edge",
  ]);
  expect(after.store.get("a")?.semantic).toMatchObject({ label: "Widget" });
});

test("convert maps labels and rejects bounds changes", () => {
  const editor = fixture();
  const result = applyBatch(
    source(editor),
    [{ op: "convert", id: "a", type: "state.node" }],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("a")?.semantic).toMatchObject({ name: "Widget" });
  expect(result.converted?.[0]?.mapped).toContainEqual({
    from: "semantic.label",
    to: "semantic.name",
  });
  expect(() =>
    applyBatch(
      source(editor),
      [
        { op: "update", id: "b", label: "Changed" },
        { op: "convert", id: "a", type: "erd.table" },
      ],
      false,
    ),
  ).toThrow("resize");
});

test("delete reconnects edges and rejects invalid targets atomically", () => {
  const editor = fixture();
  const original = source(editor);
  const result = applyBatch(
    original,
    [{ op: "delete", id: "a", reconnectTo: "c" }],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("a")).toBeUndefined();
  expect(after.store.get("edge")?.semantic).toEqual({
    ...(editor.store.get("edge")?.semantic as object),
    from: "c",
  });
  expect(result.reconnected?.[0]).toMatchObject({
    deleted: "a",
    to: "c",
    connectors: ["edge"],
  });
  expect(() =>
    applyBatch(original, [{ op: "delete", id: "a", reconnectTo: "b" }], false),
  ).toThrow("self-loop");
  expect(() =>
    applyBatch(original, [{ op: "delete", id: "a", reconnectTo: "a" }], false),
  ).toThrow();
  expect(source(editor)).toBe(original);
});

test("conversion rechecks BPMN position after the semantic changes", () => {
  const editor = new Editor();
  editor.createElement("bpmn.task", {
    id: "a",
    visual: { x: 0, y: 0, width: 100, height: 80 },
  });
  editor.createElement("bpmn.task", {
    id: "b",
    visual: { x: 200, y: 0, width: 100, height: 80 },
  });
  editor.createElement("bpmn.sequenceFlow", {
    id: "flow",
    semantic: { from: "a", to: "b" },
  });
  const original = source(editor);
  expect(() =>
    applyBatch(
      original,
      [
        {
          op: "convert",
          id: "b",
          type: "bpmn.event",
          semantic: { position: "start" },
        },
      ],
      false,
    ),
  ).toThrow("A start event cannot have an incoming sequence flow");
  expect(source(editor)).toBe(original);
});

test("reconnect rejects a target incompatible with a typed edge", () => {
  const editor = new Editor();
  editor.createElement("state.node", { id: "a" });
  editor.createElement("state.node", { id: "b" });
  editor.createElement("node.generic", { id: "c" });
  editor.createElement("state.transition", {
    id: "transition",
    semantic: { from: "a", to: "b" },
  });
  const original = source(editor);
  expect(() =>
    applyBatch(original, [{ op: "delete", id: "a", reconnectTo: "c" }], false),
  ).toThrow("transition");
  expect(source(editor)).toBe(original);
});

test("reconnect remaps ERD columns by name and rejects missing columns", () => {
  const editor = new Editor();
  editor.createElement("erd.table", {
    id: "a",
    semantic: {
      tableName: "a",
      columns: [{ id: "a1", name: "key", dataType: "integer" }],
    },
  });
  editor.createElement("erd.table", {
    id: "b",
    semantic: {
      tableName: "b",
      columns: [{ id: "b1", name: "key", dataType: "integer" }],
    },
  });
  editor.createElement("erd.table", {
    id: "c",
    semantic: {
      tableName: "c",
      columns: [{ id: "c1", name: "key", dataType: "integer" }],
    },
  });
  editor.createElement("erd.table", {
    id: "d",
    semantic: {
      tableName: "d",
      columns: [{ id: "d1", name: "other", dataType: "integer" }],
    },
  });
  editor.createElement("erd.relation", {
    id: "relation",
    semantic: {
      from: { table: "a", column: "a1" },
      to: { table: "b", column: "b1" },
      cardinality: "1:*",
    },
  });
  const original = source(editor);
  const result = applyBatch(
    original,
    [{ op: "delete", id: "a", reconnectTo: "c" }],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("relation")?.semantic).toMatchObject({
    from: { table: "c", column: "c1" },
    to: { table: "b", column: "b1" },
  });
  expect(() =>
    applyBatch(original, [{ op: "delete", id: "a", reconnectTo: "d" }], false),
  ).toThrow("key");
});

test("reconnect rejects locked sources and connectors without changing the file", () => {
  for (const locked of ["a", "edge"]) {
    const editor = new Editor();
    editor.createElement("node.generic", {
      id: "a",
      visual: { locked: locked === "a" },
    });
    editor.createElement("node.generic", { id: "b" });
    editor.createElement("node.generic", { id: "c" });
    editor.createElement("edge.generic", {
      id: "edge",
      semantic: { from: "a", to: "b" },
      visual: { locked: locked === "edge" },
    });
    const original = source(editor);
    expect(() =>
      applyBatch(
        original,
        [{ op: "delete", id: "a", reconnectTo: "c" }],
        false,
      ),
    ).toThrow("locked");
    expect(source(editor)).toBe(original);
  }
});

test("reconnect reports a self-loop connector once", () => {
  const editor = new Editor();
  editor.createElement("state.node", { id: "a" });
  editor.createElement("state.node", { id: "b" });
  editor.createElement("state.transition", {
    id: "loop",
    semantic: { from: "a", to: "a" },
  });
  const result = applyBatch(
    source(editor),
    [{ op: "delete", id: "a", reconnectTo: "b" }],
    false,
  );
  expect(result.reconnected?.[0]?.connectors).toEqual(["loop"]);
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("loop")?.semantic).toMatchObject({
    from: "b",
    to: "b",
  });
});

test("convert where enforces expect and changes every match", () => {
  const editor = fixture();
  const original = source(editor);
  const result = applyBatch(
    original,
    [
      {
        op: "convert",
        where: { type: "node.generic" },
        expect: 3,
        type: "shape.geo",
        semantic: { geo: "rect" },
      },
    ],
    false,
  );
  expect(result.converted?.map((item) => item.id).sort()).toEqual([
    "a",
    "b",
    "c",
  ]);
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("a")?.semantic).toMatchObject({
    geo: "rect",
    label: "Widget",
  });
  expect(() =>
    applyBatch(
      original,
      [
        {
          op: "convert",
          where: { type: "node.generic" },
          expect: 2,
          type: "shape.geo",
        },
      ],
      false,
    ),
  ).toThrow("expected 2");
  expect(source(editor)).toBe(original);
});

test("convert reports dropped fields and field warnings", () => {
  const editor = new Editor();
  editor.createElement("state.node", {
    id: "a",
    semantic: { name: "Ready", kind: "state" },
    visual: { x: 0, y: 0, width: 180, height: 120 },
  });
  const result = applyBatch(
    source(editor),
    [{ op: "convert", id: "a", type: "node.generic" }],
    false,
  );
  expect(result.converted?.[0]?.dropped).toContain("semantic.kind");
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      code: "convert.fieldDropped",
      element: "a",
      path: "semantic.kind",
    }),
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("a")?.semantic).toMatchObject({ label: "Ready" });
  expect(after.store.get("a")?.semantic).not.toHaveProperty("kind");
});

test("same-type participant shape preserves a semantic-only visual", () => {
  const editor = new Editor();
  editor.createElement("sequence.participant", { id: "a" });
  const raw = source(editor)
    .split("\n")
    .map((line) => {
      if (!line) return line;
      const record = JSON.parse(line);
      if (record.id === "a") record.visual = {};
      return JSON.stringify(record);
    })
    .join("\n");
  expect(
    new Editor({ document: parseDocument(raw) }).store.get("a")?.visual,
  ).toEqual({});
  const result = applyBatch(
    raw,
    [{ op: "convert", id: "a", shape: "sequence.actor" }],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("a")?.visual).toEqual({});
  expect(after.store.get("a")?.semantic).toMatchObject({ kind: "actor" });
});

test("convert rejects unsupported targets, containers and locked sources", () => {
  const editor = fixture();
  editor.createElement("frame", { id: "frame" });
  editor.createElement("group", { id: "group" });
  editor.createElement("node.generic", {
    id: "locked",
    visual: { locked: true },
  });
  const original = source(editor);
  for (const op of [
    { op: "convert", id: "a" },
    { op: "convert", id: "a", type: "frame" },
    { op: "convert", id: "frame", type: "node.generic" },
    { op: "convert", id: "group", type: "node.generic" },
    { op: "convert", id: "edge", type: "node.generic" },
    { op: "convert", id: "locked", type: "shape.geo" },
    { op: "convert", id: "a", type: "state.node", shape: "flowchart:database" },
  ])
    expect(() => applyBatch(original, [op], false)).toThrow();
  expect(source(editor)).toBe(original);
});

test("dry-run conversion errors leave the source untouched", () => {
  const original = source(fixture());
  let writes = 0;
  const result = runOperations(
    {
      readText: () => original,
      writeText: () => {
        writes++;
      },
    },
    "doc.jsonl",
    [{ op: "convert", id: "a", type: "erd.table" }],
    { arrange: false, dryRun: true, format: "text" },
  );
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("resize");
  expect(writes).toBe(0);
});

test("convert rejects invalid semantics and typed or non-edge dependents", () => {
  const editor = new Editor();
  editor.createElement("sequence.participant", { id: "a" });
  editor.createElement("sequence.participant", { id: "b" });
  editor.createElement("sequence.message", {
    id: "message",
    semantic: { from: "a", to: "b", order: "a1", kind: "sync", label: "" },
  });
  const original = source(editor);
  expect(() =>
    applyBatch(
      original,
      [{ op: "convert", id: "a", type: "node.generic" }],
      false,
    ),
  ).toThrow("message");
  const plain = source(fixture());
  expect(() =>
    applyBatch(
      plain,
      [
        {
          op: "convert",
          id: "a",
          type: "shape.geo",
          semantic: { geo: "invalid" },
        },
      ],
      false,
    ),
  ).toThrow();
  const active = new Editor();
  active.createElement("sequence.participant", { id: "a" });
  active.createElement("sequence.activation", {
    id: "activation",
    semantic: { participant: "a", fromOrder: "a1", toOrder: "a2" },
  });
  expect(() =>
    applyBatch(
      source(active),
      [{ op: "convert", id: "a", type: "node.generic" }],
      false,
    ),
  ).toThrow("activation");
});

test("delete without reconnectTo does not add reconnect report", () => {
  const result = applyBatch(
    source(fixture()),
    [{ op: "delete", id: "a" }],
    false,
  );
  expect(result).not.toHaveProperty("reconnected");
});

test("dry-run and real conversion have equal reports and only the real run writes", () => {
  const original = source(fixture());
  const op = [
    { op: "convert", id: "a", type: "shape.geo", semantic: { geo: "rect" } },
  ];
  let writes = 0;
  const io = {
    readText: () => original,
    writeText: () => {
      writes++;
    },
  };
  const dry = runOperations(io, "doc.jsonl", op, {
    arrange: false,
    dryRun: true,
    format: "json",
  });
  const real = runOperations(io, "doc.jsonl", op, {
    arrange: false,
    dryRun: false,
    format: "json",
  });
  expect(dry.exitCode).toBe(0);
  expect(real.exitCode).toBe(0);
  expect(JSON.parse(dry.stdout).converted).toEqual(
    JSON.parse(real.stdout).converted,
  );
  expect(writes).toBe(1);
});

test("conversion preserves explicit and positional frame parents on either side of a frame", () => {
  const editor = new Editor();
  editor.createElement("node.generic", {
    id: "below",
    visual: { x: 20, y: 20, width: 80, height: 60 },
  });
  editor.createElement("frame", {
    id: "frame",
    visual: { x: 0, y: 0, width: 400, height: 300 },
  });
  editor.createElement("node.generic", {
    id: "above",
    visual: { x: 140, y: 20, width: 80, height: 60 },
  });
  editor.createElement("node.generic", {
    id: "member",
    visual: { x: 520, y: 20, width: 80, height: 60 },
  });
  editor.createElement("frame", {
    id: "explicit",
    semantic: { name: "Explicit", memberIds: ["member"] },
    visual: { x: 500, y: 0, width: 300, height: 300 },
  });
  const page = editor.store.get("below")!.page;
  const before = [
    ...frameParents(editor.store, page, editor.createShapeContext(1)),
  ];
  const result = applyBatch(
    source(editor),
    ["below", "above", "member"].map((id) => ({
      op: "convert",
      id,
      type: "shape.geo",
      semantic: { geo: "rect" },
    })),
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect([
    ...frameParents(after.store, page, after.createShapeContext(1)),
  ]).toEqual(before);
  expect(before).toContainEqual(["member", "explicit"]);
  expect(before).toContainEqual(["above", "frame"]);
  expect(before.some(([id]) => id === "below")).toBe(false);
  for (const id of ["below", "above", "member"]) {
    expect(after.store.get(id)?.index).toBe(editor.store.get(id)?.index);
    expect(after.getBounds(id, after.createShapeContext(1))).toEqual(
      editor.getBounds(id, editor.createShapeContext(1)),
    );
  }
});

test("participant conversion keeps a port and assigns a later order", () => {
  const editor = new Editor();
  editor.createElement("sequence.participant", {
    id: "participant",
    semantic: { order: "a1", name: "First", kind: "service" },
    visual: { x: 0, y: 0, width: 140, height: 80 },
  });
  editor.createElement("node.generic", {
    id: "a",
    semantic: { label: "Next" },
    visual: { x: 200, y: 0, width: 140, height: 80 },
  });
  editor.createElement("node.generic", {
    id: "b",
    visual: { x: 400, y: 0, width: 140, height: 80 },
  });
  editor.createElement("edge.generic", {
    id: "edge",
    semantic: { from: "a", to: "b", fromPort: "right" },
  });
  const edge = editor.store.get("edge");
  const result = applyBatch(
    source(editor),
    [{ op: "convert", id: "a", type: "sequence.participant" }],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("edge")).toEqual(edge);
  expect(result.converted?.[0]?.connectors).toContainEqual({
    id: "edge",
    type: "edge.generic",
    keptPorts: ["right"],
  });
  expect(
    String((after.store.get("a")?.semantic as Record<string, unknown>).order) >
      "a1",
  ).toBe(true);
});

test("earlier resize allows conversion to a derived-size table", () => {
  const editor = fixture();
  const result = applyBatch(
    source(editor),
    [
      { op: "update", id: "a", visual: { height: 56 } },
      {
        op: "convert",
        id: "a",
        type: "erd.table",
        semantic: { columns: [{ id: "col", name: "id", dataType: "integer" }] },
      },
    ],
    false,
  );
  expect(
    new Editor({ document: parseDocument(result.text) }).store.get("a")?.type,
  ).toBe("erd.table");
});

test("reconnect rejects BPMN annotation without retyping the flow", () => {
  const editor = new Editor();
  editor.createElement("bpmn.task", { id: "a" });
  editor.createElement("bpmn.task", { id: "b" });
  editor.createElement("bpmn.textAnnotation", { id: "note" });
  editor.createElement("bpmn.sequenceFlow", {
    id: "flow",
    semantic: { from: "a", to: "b" },
  });
  const original = source(editor);
  expect(() =>
    applyBatch(
      original,
      [{ op: "delete", id: "a", reconnectTo: "note" }],
      false,
    ),
  ).toThrow("flow");
  expect(source(editor)).toBe(original);
});

test("reconnect to another page fails without writing", () => {
  const editor = fixture();
  const page = editor.createPage({ name: "Other" });
  editor.setCurrentPage(page);
  editor.createElement("node.generic", { id: "remote" });
  const original = source(editor);
  let writes = 0;
  const result = runOperations(
    {
      readText: () => original,
      writeText: () => {
        writes++;
      },
    },
    "doc.jsonl",
    [{ op: "delete", id: "a", reconnectTo: "remote" }],
    { arrange: false, dryRun: false, format: "text" },
  );
  expect(result.exitCode).toBe(2);
  expect(writes).toBe(0);
  expect(source(editor)).toBe(original);
});

test("same-type conversion preserves null source fields", () => {
  const editor = new Editor();
  editor.createElement("node.generic", {
    id: "a",
    semantic: { label: "Widget", custom: null },
  });
  const result = applyBatch(
    source(editor),
    [{ op: "convert", id: "a", type: "node.generic" }],
    false,
  );
  expect(
    new Editor({ document: parseDocument(result.text) }).store.get("a")
      ?.semantic,
  ).toHaveProperty("custom", null);
});

test("matching type and shape succeeds and connector shapes are rejected", () => {
  const original = source(fixture());
  const result = applyBatch(
    original,
    [
      {
        op: "convert",
        id: "a",
        type: "shape.geo",
        shape: "flowchart:database",
      },
    ],
    false,
  );
  expect(result.converted?.[0]?.toType).toBe("shape.geo");
  expect(() =>
    applyBatch(
      original,
      [{ op: "convert", id: "a", shape: "erd.relation" }],
      false,
    ),
  ).toThrow("Connectors are not convertible");
});

test("bounds mismatch names both actual sizes", () => {
  expect(() =>
    applyBatch(
      source(fixture()),
      [
        {
          op: "convert",
          id: "a",
          type: "erd.table",
          semantic: {
            columns: [{ id: "col", name: "id", dataType: "integer" }],
          },
        },
      ],
      false,
    ),
  ).toThrow("resize from 180x120 to 180x56");
});

test("conversion to a non-text target reports the dropped text", () => {
  const editor = new Editor();
  editor.createElement("node.generic", {
    id: "a",
    semantic: { label: "Widget" },
    visual: { x: 0, y: 0, width: 180, height: 120 },
  });
  const result = applyBatch(
    source(editor),
    [
      {
        op: "convert",
        id: "a",
        type: "image.raster",
        semantic: { src: "images/widget.png" },
      },
    ],
    false,
  );
  expect(result.converted?.[0]?.dropped).toContain("semantic.label");
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      code: "convert.fieldDropped",
      path: "semantic.label",
    }),
  );
});

test("dry-run reports dropped fields exactly as a real run", () => {
  const editor = new Editor();
  editor.createElement("state.node", {
    id: "a",
    semantic: { name: "Ready", kind: "state" },
    visual: { x: 0, y: 0, width: 180, height: 120 },
  });
  const original = source(editor);
  let writes = 0;
  const io = {
    readText: () => original,
    writeText: () => {
      writes++;
    },
  };
  const operations = [{ op: "convert", id: "a", type: "node.generic" }];
  const dry = runOperations(io, "doc.jsonl", operations, {
    arrange: false,
    dryRun: true,
    format: "json",
  });
  const real = runOperations(io, "doc.jsonl", operations, {
    arrange: false,
    dryRun: false,
    format: "json",
  });
  expect(dry.exitCode).toBe(0);
  expect(real.exitCode).toBe(0);
  expect(JSON.parse(dry.stdout).converted).toEqual(
    JSON.parse(real.stdout).converted,
  );
  expect(JSON.parse(dry.stdout).converted[0].dropped).toContain(
    "semantic.kind",
  );
  expect(writes).toBe(1);
});

test("BPMN conversion refuses a flow that would require retyping", () => {
  const editor = new Editor();
  editor.createElement("bpmn.task", { id: "a" });
  editor.createElement("bpmn.task", { id: "b" });
  editor.createElement("bpmn.sequenceFlow", {
    id: "flow",
    semantic: { from: "a", to: "b" },
  });
  const original = source(editor);
  expect(() =>
    applyBatch(
      original,
      [{ op: "convert", id: "a", type: "bpmn.textAnnotation" }],
      false,
    ),
  ).toThrow("flow");
  expect(source(editor)).toBe(original);
});

test("ERD reconnect permits a self-loop with same-name columns and rejects missing columns atomically", () => {
  const editor = new Editor();
  for (const [id, column, name] of [
    ["a", "a1", "key"],
    ["b", "b1", "key"],
    ["c", "c1", "other"],
  ]) {
    editor.createElement("erd.table", {
      id,
      semantic: {
        tableName: id,
        columns: [{ id: column, name, dataType: "integer" }],
      },
    });
  }
  editor.createElement("erd.relation", {
    id: "relation",
    semantic: {
      from: { table: "a", column: "a1" },
      to: { table: "b", column: "b1" },
      cardinality: "1:*",
    },
  });
  const original = source(editor);
  const result = applyBatch(
    original,
    [{ op: "delete", id: "a", reconnectTo: "b" }],
    false,
  );
  expect(
    new Editor({ document: parseDocument(result.text) }).store.get("relation")
      ?.semantic,
  ).toMatchObject({
    from: { table: "b", column: "b1" },
    to: { table: "b", column: "b1" },
  });
  let writes = 0;
  const failed = runOperations(
    {
      readText: () => original,
      writeText: () => {
        writes++;
      },
    },
    "doc.jsonl",
    [{ op: "delete", id: "a", reconnectTo: "c" }],
    { arrange: false, dryRun: false, format: "text" },
  );
  expect(failed.exitCode).toBe(2);
  expect(failed.stderr).toContain("key");
  expect(writes).toBe(0);
});

test("reconnect target among where-selected deletions is rejected", () => {
  const original = source(fixture());
  expect(() =>
    applyBatch(
      original,
      [
        {
          op: "delete",
          where: { type: "node.generic" },
          expect: 3,
          reconnectTo: "b",
        },
      ],
      false,
    ),
  ).toThrow("different non-connector");
});

test("convert where matches exactly two elements and enforces expect", () => {
  const editor = new Editor();
  editor.createElement("node.generic", { id: "a" });
  editor.createElement("node.generic", { id: "b" });
  const original = source(editor);
  const operation = {
    op: "convert",
    where: { type: "node.generic" },
    expect: 2,
    type: "shape.geo",
    semantic: { geo: "rect" },
  };
  expect(
    applyBatch(original, [operation], false)
      .converted?.map((item) => item.id)
      .sort(),
  ).toEqual(["a", "b"]);
  expect(() =>
    applyBatch(original, [{ ...operation, expect: 1 }], false),
  ).toThrow("expected 1");
  expect(source(editor)).toBe(original);
});

test("incompatible dry-run leaves a temporary file byte-identical", () => {
  const directory = mkdtempSync(join(tmpdir(), "nodetto-convert-"));
  const path = join(directory, "document.jsonl");
  try {
    const original = source(fixture());
    writeFileSync(path, original);
    const result = runOperations(
      {
        readText: (file) => readFileSync(file, "utf8"),
        writeText: (file, text) => writeFileSync(file, text),
      },
      path,
      [{ op: "convert", id: "a", type: "erd.table" }],
      { arrange: false, dryRun: true, format: "text" },
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("resize");
    expect(readFileSync(path, "utf8")).toBe(original);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reconnect fails atomically when deletion cascades its target or moved connector", () => {
  for (const targetIsPort of [true, false]) {
    const editor = new Editor();
    editor.createElement("uml.component", { id: "owner" });
    editor.createElement("uml.port", {
      id: "port",
      semantic: { owner: "owner", name: "P", side: "left", offset: 0.5 },
    });
    editor.createElement("node.generic", { id: "other" });
    editor.createElement("node.generic", { id: "target" });
    editor.createElement("edge.generic", {
      id: "edge",
      semantic: {
        from: "owner",
        to: targetIsPort ? "other" : "port",
        label: "Link",
      },
    });
    const original = source(editor);
    for (const dryRun of [false, true]) {
      let writes = 0;
      const result = runOperations(
        {
          readText: () => original,
          writeText: () => {
            writes++;
          },
        },
        "doc.jsonl",
        [
          {
            op: "delete",
            id: "owner",
            reconnectTo: targetIsPort ? "port" : "target",
          },
        ],
        { arrange: false, dryRun, format: "text" },
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(targetIsPort ? "port" : "edge");
      expect(writes).toBe(0);
    }
  }
});

test("reconnect permits an explicitly selected connector to be deleted", () => {
  const editor = new Editor();
  editor.createElement("node.generic", {
    id: "owner",
    semantic: { label: "Remove" },
  });
  editor.createElement("node.generic", {
    id: "other",
    semantic: { label: "Other" },
  });
  editor.createElement("node.generic", {
    id: "target",
    semantic: { label: "Target" },
  });
  editor.createElement("edge.generic", {
    id: "selected",
    semantic: { from: "owner", to: "other", label: "Remove" },
  });
  editor.createElement("edge.generic", {
    id: "kept",
    semantic: {
      from: "owner",
      to: "other",
      label: "Kept",
      fromPort: "right",
      toPort: "left",
      route: { kind: "manual", points: [{ x: 10, y: 20 }] },
      labelPosition: 0.3,
    },
  });
  const original = source(editor);
  const before = editor.store.get("kept");
  const result = applyBatch(
    original,
    [
      {
        op: "delete",
        where: { name: "Remove" },
        expect: 2,
        reconnectTo: "target",
      },
    ],
    false,
  );
  const after = new Editor({ document: parseDocument(result.text) });
  expect(after.store.get("selected")).toBeUndefined();
  expect(after.store.get("kept")?.semantic).toEqual({
    ...(before?.semantic as object),
    from: "target",
  });
});
