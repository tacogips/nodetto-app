import { expect, test } from "bun:test";
import {
  columnFrames,
  LAYERED_PAGE_KINDS,
  planLayered,
} from "./arrange-layered.ts";
import { FRAME_TITLE_BAND } from "./shapes/frame.ts";
import { frameParents } from "./frame-tree.ts";
import { document, makeEditor, TEST_PAGE } from "./test-helpers.ts";

function fixture(reverse = false) {
  const editor = makeEditor();
  const entries = [
    {
      id: "stage0",
      type: "frame",
      semantic: { name: "Stage0", memberIds: ["idle", "running"] },
      visual: { x: 0, y: 0, width: 500, height: 500 },
    },
    {
      id: "stage1",
      type: "frame",
      semantic: { name: "Stage1", memberIds: ["done"] },
      visual: { x: 600, y: 0, width: 500, height: 500 },
    },
    {
      id: "idle",
      type: "state.node",
      semantic: { kind: "initial", name: "Idle" },
      visual: { x: 20, y: 30, width: 80, height: 50 },
    },
    {
      id: "running",
      type: "state.node",
      semantic: { kind: "state", name: "Running" },
      visual: { x: 20, y: 150, width: 80, height: 50 },
    },
    {
      id: "done",
      type: "state.node",
      semantic: { kind: "state", name: "Done" },
      visual: { x: 620, y: 30, width: 80, height: 50 },
    },
  ];
  for (const e of reverse ? [...entries].reverse() : entries)
    editor.createElement(e.type, e);
  return editor;
}

test("layered placement is deterministic, preserves parents and reaches a fixed point", () => {
  const editor = fixture();
  const other = fixture(true);
  const plan = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "LR",
  });
  const shuffled = planLayered(other.store, TEST_PAGE.id, other.registry, {
    direction: "LR",
  });
  expect(plan).toEqual(shuffled);
  if ("error" in plan) throw new Error(plan.error);
  expect(plan.commands.length).toBeGreaterThan(0);
  editor.apply(plan.commands, { placed: plan.placed });
  const parents = frameParents(
    editor.store,
    TEST_PAGE.id,
    editor.createShapeContext(),
  );
  expect(parents.get("idle")).toBe("stage0");
  expect(parents.get("done")).toBe("stage1");
  expect(
    planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "LR",
    }),
  ).toEqual({ commands: [], placed: plan.placed });
});

test("explicit order and TB place frames as rows", () => {
  const editor = fixture();
  const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "TB",
    frameOrder: ["stage1", "stage0"],
  });
  if ("error" in result) throw new Error(result.error);
  editor.apply(result.commands, { placed: result.placed });
  expect(editor.store.get("stage1")?.visual.y).toBeLessThan(
    editor.store.get("stage0")?.visual.y ?? 0,
  );
  expect(
    columnFrames(editor.store, TEST_PAGE.id, editor.registry).map((f) => f.id),
  ).toEqual(["stage0", "stage1"]);
});

test("missing and invalid frames report errors", () => {
  const empty = makeEditor();
  expect(
    planLayered(empty.store, TEST_PAGE.id, empty.registry, { direction: "LR" }),
  ).toEqual({
    error: "arrange --mode layered needs frames on the page; use --mode tidy",
  });
  const editor = fixture();
  expect(
    planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "LR",
      frameOrder: ["idle"],
    }),
  ).toEqual({ error: "Not a column frame: idle" });
});

test("edge traversal ranks an initial state before its successors", () => {
  const editor = fixture();
  editor.createElement("state.transition", {
    id: "edge0",
    semantic: { from: "idle", to: "running" },
  });
  editor.createElement("state.transition", {
    id: "edge1",
    semantic: { from: "running", to: "done" },
  });
  const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "LR",
  });
  if ("error" in result) throw new Error(result.error);
  editor.apply(result.commands, { placed: result.placed });
  expect(editor.store.get("idle")?.visual.y).toBe(64);
  expect(editor.store.get("running")?.visual.y).toBe(174);
  expect(editor.store.get("stage0")?.visual).toMatchObject({
    x: 0,
    y: 0,
    width: 160,
    height: 264,
  });
  expect(editor.store.get("stage1")?.visual.x).toBe(280);
  const rerun = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "LR",
  });
  if ("error" in rerun) throw new Error(rerun.error);
  expect(rerun.commands).toEqual([]);
});

test("nested frame and descendant move together and nested frame is not a column", () => {
  const editor = makeEditor();
  editor.createElement("frame", {
    id: "outer",
    semantic: { name: "Outer", memberIds: ["inner"] },
    visual: { x: 0, y: 0, width: 500, height: 500 },
  });
  editor.createElement("frame", {
    id: "inner",
    semantic: { name: "Inner", memberIds: ["child"] },
    visual: { x: 100, y: 100, width: 200, height: 200 },
  });
  editor.createElement("state.node", {
    id: "child",
    semantic: { kind: "state", name: "Child" },
    visual: { x: 130, y: 140, width: 80, height: 50 },
  });
  expect(
    planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "LR",
      frameOrder: ["inner"],
    }),
  ).toEqual({ error: "Not a column frame: inner" });
  const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "LR",
  });
  if ("error" in result) throw new Error(result.error);
  expect(result.placed.has("inner")).toBe(true);
  expect(result.placed.has("child")).toBe(true);
  editor.apply(result.commands, { placed: result.placed });
  expect(editor.store.get("inner")?.visual).toMatchObject({ x: 40, y: 64 });
  expect(editor.store.get("child")?.visual).toMatchObject({ x: 70, y: 104 });
});

function graphFixture(
  edges: readonly (readonly [string, string, string])[],
  reverse = false,
) {
  const editor = makeEditor();
  const nodes = ["a", "b", "c", "d"];
  editor.createElement("frame", {
    id: "frame",
    semantic: { name: "Stage", memberIds: nodes },
    visual: { x: 0, y: 0, width: 600, height: 600 },
  });
  for (const id of reverse ? [...nodes].reverse() : nodes) {
    editor.createElement("state.node", {
      id,
      semantic: { kind: "state", name: id },
      visual: { x: 20, y: 20, width: 80, height: 50 },
    });
  }
  for (const [id, from, to] of reverse ? [...edges].reverse() : edges) {
    editor.createElement("state.transition", { id, semantic: { from, to } });
  }
  return editor;
}

function graphOrder(edges: readonly (readonly [string, string, string])[]) {
  const editor = graphFixture(edges);
  const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "LR",
  });
  if ("error" in result) throw new Error(result.error);
  const shuffled = graphFixture(edges, true);
  expect(
    planLayered(shuffled.store, TEST_PAGE.id, shuffled.registry, {
      direction: "LR",
    }),
  ).toEqual(result);
  editor.apply(result.commands, { placed: result.placed });
  return ["a", "b", "c", "d"].sort(
    (a, b) =>
      (editor.store.get(a)?.visual.y ?? 0) -
      (editor.store.get(b)?.visual.y ?? 0),
  );
}

test("ranking starts at a source without an initial state and restarts disconnected components", () => {
  expect(
    graphOrder([
      ["e0", "b", "a"],
      ["e1", "d", "c"],
    ]),
  ).toEqual(["b", "a", "d", "c"]);
});

test("ranking starts at the smallest id when every unit belongs to a cycle", () => {
  expect(
    graphOrder([
      ["e0", "b", "a"],
      ["e1", "a", "b"],
      ["e2", "c", "d"],
      ["e3", "d", "c"],
    ]),
  ).toEqual(["a", "b", "c", "d"]);
});

test.each([true, false])(
  "TB reserves the title band at the top: %s",
  (showTitle) => {
    const editor = makeEditor();
    editor.createElement("frame", {
      id: "frame",
      semantic: { name: "Stage", memberIds: ["idle", "running"], showTitle },
      visual: { x: 0, y: 0, width: 500, height: 500 },
    });
    for (const [id, height] of [
      ["idle", 60],
      ["running", 40],
    ] as const)
      editor.createElement("state.node", {
        id,
        semantic: { kind: id === "idle" ? "initial" : "state", name: id },
        visual: { x: 20, y: 20, width: 120, height },
      });
    const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "TB",
    });
    if ("error" in result) throw new Error(result.error);
    editor.apply(result.commands, { placed: result.placed });
    const band = showTitle ? FRAME_TITLE_BAND : 0;
    expect(editor.store.get("frame")?.visual).toMatchObject({
      x: 0,
      y: 0,
      width: 380,
      height: 140 + band,
    });
    expect(editor.store.get("idle")?.visual).toMatchObject({
      x: 40,
      y: 40 + band,
    });
    expect(editor.store.get("running")?.visual).toMatchObject({
      x: 220,
      y: 50 + band,
    });
  },
);

test("frame ranks and explicit order preserve traversal order with empty frames last", () => {
  const editor = makeEditor();
  for (const [frame, member] of [
    ["a", "z"],
    ["b", "x"],
    ["c", "y"],
    ["d", ""],
  ] as const) {
    editor.createElement("frame", {
      id: frame,
      semantic: { name: frame, memberIds: member ? [member] : [] },
      visual: { x: 0, y: 0, width: 500, height: 500 },
    });
    if (member)
      editor.createElement("state.node", {
        id: member,
        semantic: { kind: "state", name: member },
        visual: { x: 20, y: 20, width: 80, height: 50 },
      });
  }
  const order = (frameOrder?: string[]) => {
    const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "LR",
      frameOrder,
    });
    if ("error" in result) throw new Error(result.error);
    const positions = new Map(
      result.commands
        .filter((c) => c.type === "updateVisual")
        .map((c) => [c.id, c.visual.x]),
    );
    return ["a", "b", "c", "d"].sort(
      (a, b) => (positions.get(a) ?? 0) - (positions.get(b) ?? 0),
    );
  };
  expect(order()).toEqual(["b", "c", "a", "d"]);
  expect(order(["c"])).toEqual(["c", "b", "a", "d"]);
});

test("ERD with frames is laid out and reaches a fixed point", () => {
  const page = { ...TEST_PAGE, kind: "erd" as const };
  const editor = makeEditor({ document: document([], [page]) });
  for (const [id, members, x] of [
    ["stage0", ["orders", "order_items"], 0],
    ["stage1", ["widgets"], 600],
  ] as const)
    editor.createElement("frame", {
      id,
      semantic: { name: id, memberIds: [...members] },
      visual: { x, y: 0, width: 500, height: 500 },
    });
  for (const [id, x] of [
    ["orders", 20],
    ["order_items", 20],
    ["widgets", 620],
  ] as const)
    editor.createElement("erd.table", {
      id,
      semantic: {
        tableName: id,
        columns: [{ id: "id", name: "id", dataType: "uuid", pk: true }],
      },
      visual: { x, y: 20, width: 200 },
    });
  for (const [id, from, to] of [
    ["e0", "orders", "order_items"],
    ["e1", "order_items", "widgets"],
  ] as const)
    editor.createElement("erd.relation", {
      id,
      semantic: {
        from: { table: from, column: "id" },
        to: { table: to, column: "id" },
        cardinality: "*:1",
        logical: true,
      },
    });
  const result = planLayered(editor.store, page.id, editor.registry, {
    direction: "LR",
  });
  if ("error" in result) throw new Error(result.error);
  expect(result.commands.length).toBeGreaterThan(0);
  editor.apply(result.commands, { placed: result.placed });
  const parents = frameParents(
    editor.store,
    page.id,
    editor.createShapeContext(),
  );
  expect([
    parents.get("orders"),
    parents.get("order_items"),
    parents.get("widgets"),
  ]).toEqual(["stage0", "stage0", "stage1"]);
  const rerun = planLayered(editor.store, page.id, editor.registry, {
    direction: "LR",
  });
  if ("error" in rerun) throw new Error(rerun.error);
  expect(rerun.commands).toEqual([]);
});

test("ERD without frames errors; BPMN is not in the generic planner", () => {
  const page = { ...TEST_PAGE, kind: "erd" as const };
  const editor = makeEditor({ document: document([], [page]) });
  expect(
    planLayered(editor.store, page.id, editor.registry, { direction: "LR" }),
  ).toEqual({
    error: "arrange --mode layered needs frames on the page; use --mode tidy",
  });
  expect(LAYERED_PAGE_KINDS).toContain("erd");
  expect(LAYERED_PAGE_KINDS).not.toContain("bpmn");
});

test("TB free row remains vertically centered without a title band", () => {
  const editor = fixture();
  editor.createElement("state.node", {
    id: "free",
    semantic: { kind: "state", name: "Free" },
    visual: { x: 1200, y: 0, width: 80, height: 50 },
  });
  const result = planLayered(editor.store, TEST_PAGE.id, editor.registry, {
    direction: "TB",
  });
  if ("error" in result) throw new Error(result.error);
  editor.apply(result.commands, { placed: result.placed });
  expect(editor.store.get("free")?.visual.y).toBe(
    (editor.store.get("stage1")?.visual.y ?? 0) +
      (editor.store.get("stage1")?.visual.height ?? 0) +
      120,
  );
});

test("duplicate explicit frame IDs retain their first index", () => {
  const editor = fixture();
  const plan = (frameOrder: string[]) =>
    planLayered(editor.store, TEST_PAGE.id, editor.registry, {
      direction: "LR",
      frameOrder,
    });
  expect(plan(["stage1", "stage0", "stage1"])).toEqual(
    plan(["stage1", "stage0"]),
  );
});
