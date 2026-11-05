import { expect, test } from "bun:test";
import { validateDocument } from "@nodetto/ir";
import { planLayeredBpmn } from "./arrange-layered-bpmn.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
function fixture(reverse = false) {
  const entries = [
    element({
      id: "pool",
      type: "bpmn.participant",
      index: "a1",
      semantic: { name: "Orders", collapsed: false },
      visual: { x: 0, y: 0, width: 500, height: 240 },
    }),
    element({
      id: "lane1",
      type: "bpmn.lane",
      index: "a2",
      semantic: { name: "Intake", parent: "pool" },
      visual: { x: 30, y: 0, width: 470, height: 120 },
    }),
    element({
      id: "lane2",
      type: "bpmn.lane",
      index: "a3",
      semantic: { name: "Shipping", parent: "pool" },
      visual: { x: 30, y: 120, width: 470, height: 120 },
    }),
    element({
      id: "start",
      type: "bpmn.event",
      index: "a4",
      semantic: {
        name: "Start",
        position: "start",
        definitions: [],
        parent: "lane1",
      },
      visual: { x: 50, y: 40, width: 36, height: 36 },
    }),
    element({
      id: "task",
      type: "bpmn.task",
      index: "a5",
      semantic: {
        name: "Check order",
        taskType: "user",
        loop: "none",
        parent: "lane1",
      },
      visual: { x: 120, y: 30, width: 100, height: 60 },
    }),
    element({
      id: "next",
      type: "bpmn.task",
      index: "a6",
      semantic: {
        name: "Pack widgets",
        taskType: "user",
        loop: "none",
        parent: "lane2",
      },
      visual: { x: 120, y: 150, width: 100, height: 60 },
    }),
    element({
      id: "flow1",
      type: "bpmn.sequenceFlow",
      index: "a7",
      semantic: { from: "start", to: "task" },
      visual: {},
    }),
    element({
      id: "flow2",
      type: "bpmn.sequenceFlow",
      index: "a8",
      semantic: { from: "task", to: "next" },
      visual: {},
    }),
  ];
  return makeEditor({
    document: document(reverse ? entries.reverse() : entries, [page]),
  });
}
function apply(editor: ReturnType<typeof fixture>) {
  const plan = planLayeredBpmn(editor.store, page.id, editor.registry);
  if ("error" in plan) throw new Error(plan.error);
  editor.apply(plan.containerCommands);
  editor.apply(plan.unitCommands);
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
  return plan;
}
test("BFS places connected units in successive columns", () => {
  const e = fixture();
  apply(e);
  expect(e.store.get("start")?.visual.x).toBeLessThan(
    e.store.get("task")?.visual.x ?? 0,
  );
  expect(e.store.get("task")?.visual.x).toBeLessThan(
    e.store.get("next")?.visual.x ?? 0,
  );
});
test("lanes stay stacked and inset", () => {
  const e = fixture();
  apply(e);
  const p = e.store.get("pool")?.visual;
  const a = e.store.get("lane1")?.visual;
  const b = e.store.get("lane2")?.visual;
  expect(a?.x).toBe((p?.x ?? 0) + 30);
  expect(b?.y).toBe((a?.y ?? 0) + (a?.height ?? 0));
});
test("units remain in their rows", () => {
  const e = fixture();
  apply(e);
  expect(e.store.get("task")?.visual.y).toBeGreaterThanOrEqual(
    e.store.get("lane1")?.visual.y ?? 0,
  );
  expect(e.store.get("next")?.visual.y).toBeGreaterThanOrEqual(
    e.store.get("lane2")?.visual.y ?? 0,
  );
});
test("membership remains unchanged", () => {
  const e = fixture();
  apply(e);
  expect((e.store.get("task")?.semantic as { parent: string }).parent).toBe(
    "lane1",
  );
  expect((e.store.get("next")?.semantic as { parent: string }).parent).toBe(
    "lane2",
  );
});
test("second planning is a no-op", () => {
  const e = fixture();
  apply(e);
  const plan = planLayeredBpmn(e.store, page.id, e.registry);
  if ("error" in plan) throw new Error(plan.error);
  expect(plan.containerCommands).toEqual([]);
  expect(plan.unitCommands).toEqual([]);
});
test("input element order does not affect the plan", () => {
  const a = fixture();
  const b = fixture(true);
  expect(planLayeredBpmn(a.store, page.id, a.registry)).toEqual(
    planLayeredBpmn(b.store, page.id, b.registry),
  );
});
test("placed includes all units", () => {
  const e = fixture();
  expect([...apply(e).placed].sort()).toEqual(["next", "start", "task"]);
});
test("empty page has empty commands", () => {
  const e = makeEditor({ document: document([], [page]) });
  expect(planLayeredBpmn(e.store, page.id, e.registry)).toEqual({
    containerCommands: [],
    unitCommands: [],
    placed: new Set(),
  });
});
test("non BPMN page is rejected", () => {
  const e = makeEditor();
  expect(planLayeredBpmn(e.store, page.id, e.registry)).toHaveProperty("error");
});
test("pool covers its lanes", () => {
  const e = fixture();
  apply(e);
  const p = e.store.get("pool")?.visual;
  const b = e.store.get("lane2")?.visual;
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBe((p?.y ?? 0) + (p?.height ?? 0));
});

function simpleTask(id: string, x: number, y: number, parent?: string) {
  return element({
    id,
    type: "bpmn.task",
    semantic: {
      name: id,
      taskType: "user",
      loop: "none",
      ...(parent ? { parent } : {}),
    },
    visual: { x, y, width: 100, height: 60 },
  });
}
function custom(entries: ReturnType<typeof element>[]) {
  return makeEditor({ document: document(entries, [page]) });
}
function noOp(e: ReturnType<typeof fixture>) {
  const p = planLayeredBpmn(e.store, page.id, e.registry);
  if ("error" in p) throw new Error(p.error);
  expect(p.containerCommands).toEqual([]);
  expect(p.unitCommands).toEqual([]);
}
function pool(id: string, y: number, collapsed = false) {
  return element({
    id,
    type: "bpmn.participant",
    semantic: { name: id, collapsed },
    visual: { x: 0, y, width: 500, height: 240 },
  });
}
function lane(id: string, parent: string, y: number, index: string) {
  return element({
    id,
    index,
    type: "bpmn.lane",
    semantic: { name: id, parent },
    visual: { x: parent === "p" ? 30 : 60, y, width: 440, height: 120 },
  });
}
function flow(
  id: string,
  from: string,
  to: string,
  type = "bpmn.sequenceFlow",
) {
  return element({ id, type, semantic: { from, to }, visual: {} });
}

test("single free task stays at its origin", () => {
  const e = custom([simpleTask("a", 0, 0)]);
  const p = apply(e);
  expect(p.containerCommands).toEqual([]);
  expect(p.unitCommands).toEqual([]);
  noOp(e);
});
test("free chain begins at origin and is stable", () => {
  const e = custom([
    element({
      id: "start",
      type: "bpmn.event",
      semantic: { name: "Start", position: "start", definitions: [] },
      visual: { x: 0, y: 0, width: 36, height: 36 },
    }),
    simpleTask("a", 20, 50),
    flow("f", "start", "a"),
  ]);
  apply(e);
  expect(e.store.get("start")?.visual.y).toBe(12);
  expect(e.store.get("start")?.visual.x).toBe(0);
  noOp(e);
});
test("free row follows pool and shares its columns", () => {
  const e = custom([
    pool("p", 0),
    simpleTask("a", 50, 30, "p"),
    simpleTask("b", 800, 500),
  ]);
  apply(e);
  const p = e.store.get("p")?.visual;
  expect(e.store.get("b")?.visual.y).toBe((p?.y ?? 0) + (p?.height ?? 0) + 120);
  expect(e.store.get("b")?.visual.x).toBe(e.store.get("a")?.visual.x);
  noOp(e);
});
test("nested leaf lanes remain stacked and stable", () => {
  const e = custom([
    pool("p", 0),
    lane("parent", "p", 0, "a1"),
    lane("one", "parent", 0, "a2"),
    lane("two", "parent", 120, "a3"),
    simpleTask("a", 100, 30, "one"),
    simpleTask("b", 100, 150, "two"),
  ]);
  apply(e);
  const a = e.store.get("one")?.visual;
  const b = e.store.get("two")?.visual;
  const parent = e.store.get("parent")?.visual;
  expect(b?.y).toBe((a?.y ?? 0) + (a?.height ?? 0));
  expect(parent?.height).toBe((a?.height ?? 0) + (b?.height ?? 0));
  noOp(e);
});
test("non-leaf lane member uses first leaf", () => {
  const e = custom([
    pool("p", 0),
    lane("parent", "p", 0, "a1"),
    lane("one", "parent", 0, "a2"),
    lane("two", "parent", 120, "a3"),
    simpleTask("a", 100, 30, "parent"),
  ]);
  apply(e);
  expect(e.store.get("a")?.visual.y).toBeLessThan(
    e.store.get("two")?.visual.y ?? 0,
  );
  expect((e.store.get("a")?.semantic as { parent: string }).parent).toBe("one");
  noOp(e);
});
test("pool member uses first leaf", () => {
  const e = custom([
    pool("p", 0),
    lane("one", "p", 0, "a1"),
    lane("two", "p", 120, "a2"),
    simpleTask("a", 100, 30, "p"),
  ]);
  apply(e);
  expect(e.store.get("a")?.visual.y).toBeLessThan(
    e.store.get("two")?.visual.y ?? 0,
  );
  expect((e.store.get("a")?.semantic as { parent: string }).parent).toBe("one");
  noOp(e);
});
test("collapsed pool carries members and retains height", () => {
  const e = custom([
    pool("p", 0),
    simpleTask("a", 50, 30, "p"),
    pool("q", 500, true),
    simpleTask("b", 80, 550, "q"),
  ]);
  const p = apply(e);
  expect(e.store.get("q")?.visual.height).toBe(240);
  expect(e.store.get("q")?.visual.width).toBe(e.store.get("p")?.visual.width);
  expect(
    (e.store.get("b")?.visual.y ?? 0) - (e.store.get("q")?.visual.y ?? 0),
  ).toBe(50);
  expect(p.placed.has("b")).toBe(true);
  noOp(e);
});
test("message flow aligns global columns across pools", () => {
  const e = custom([
    pool("p", 0),
    pool("q", 500),
    simpleTask("a", 50, 30, "p"),
    simpleTask("b", 50, 530, "q"),
    simpleTask("c", 200, 30, "p"),
    simpleTask("d", 200, 530, "q"),
    flow("f1", "a", "c"),
    flow("f2", "b", "d"),
    flow("m", "a", "d", "bpmn.messageFlow"),
  ]);
  apply(e);
  expect(e.store.get("p")?.visual.width).toBe(e.store.get("q")?.visual.width);
  expect(e.store.get("c")?.visual.x).toBe(e.store.get("d")?.visual.x);
  noOp(e);
});
test("message flows affect cross-pool depths", () => {
  const e = custom([
    pool("p", 0),
    pool("q", 500),
    simpleTask("s", 50, 30, "p"),
    simpleTask("a", 200, 30, "p"),
    simpleTask("b", 50, 530, "q"),
    flow("f", "s", "a"),
    flow("m1", "s", "b", "bpmn.messageFlow"),
    flow("m2", "a", "b", "bpmn.messageFlow"),
  ]);
  apply(e);
  expect(e.store.get("a")?.visual.x).toBe(e.store.get("b")?.visual.x);
  expect(e.store.get("p")?.visual.width).toBe(e.store.get("q")?.visual.width);
  noOp(e);
});
test("subprocess carries inner tasks and maps flow endpoints", () => {
  const sub = element({
    id: "sub",
    type: "bpmn.subProcess",
    semantic: {
      name: "Sub",
      parent: "p",
      expanded: true,
      triggeredByEvent: false,
      adHoc: false,
      loop: "none",
    },
    visual: { x: 50, y: 30, width: 200, height: 100 },
  });
  const e = custom([
    pool("p", 0),
    sub,
    simpleTask("inner", 70, 50, "sub"),
    simpleTask("inner2", 140, 50, "sub"),
    simpleTask("after", 300, 30, "p"),
    flow("f", "inner", "after"),
  ]);
  apply(e);
  expect(
    (e.store.get("inner")?.visual.x ?? 0) - (e.store.get("sub")?.visual.x ?? 0),
  ).toBe(20);
  expect(
    (e.store.get("inner2")?.visual.x ?? 0) -
      (e.store.get("sub")?.visual.x ?? 0),
  ).toBe(90);
  expect(e.store.get("after")?.visual.x).toBeGreaterThan(
    e.store.get("sub")?.visual.x ?? 0,
  );
  const subVisual = e.store.get("sub")?.visual;
  expect(e.store.get("after")?.visual.x).toBeGreaterThanOrEqual(
    (subVisual?.x ?? 0) + (subVisual?.width ?? 0) + 120,
  );
  noOp(e);
});
test("boundary event follows host and maps flow", () => {
  const boundary = element({
    id: "boundary",
    type: "bpmn.boundaryEvent",
    semantic: {
      name: "Boundary",
      attachedTo: "a",
      definitions: [],
      cancelActivity: true,
    },
    visual: { x: 90, y: 75, width: 30, height: 30 },
  });
  const e = custom([
    pool("p", 0),
    simpleTask("a", 50, 30, "p"),
    boundary,
    simpleTask("b", 250, 30, "p"),
    flow("f", "boundary", "b"),
  ]);
  apply(e);
  const host = e.store.get("a")?.visual;
  const event = e.store.get("boundary")?.visual;
  const cy = (event?.y ?? 0) + (event?.height ?? 0) / 2;
  expect(cy).toBe((host?.y ?? 0) + (host?.height ?? 0));
  expect(e.store.get("b")?.visual.x).toBeGreaterThan(
    e.store.get("a")?.visual.x ?? 0,
  );
  noOp(e);
});
test("two-pool shuffled order produces identical commands", () => {
  const entries = [
    pool("p", 0),
    pool("q", 500),
    simpleTask("a", 50, 30, "p"),
    simpleTask("b", 50, 530, "q"),
    flow("m", "a", "b", "bpmn.messageFlow"),
  ];
  const a = custom(entries);
  const b = custom([...entries].reverse());
  expect(planLayeredBpmn(a.store, page.id, a.registry)).toEqual(
    planLayeredBpmn(b.store, page.id, b.registry),
  );
  apply(a);
  apply(b);
  noOp(a);
  noOp(b);
});

test("interleaved nested lanes preserve leaf row order", () => {
  const originalPool = pool("p", 0);
  const p = {
    ...originalPool,
    visual: { ...originalPool.visual, width: 900, height: 360 },
  };
  const originalA = lane("A", "p", 0, "a2");
  const a = { ...originalA, visual: { ...originalA.visual, height: 240 } };
  const b = lane("B", "p", 240, "a3");
  const a1 = lane("A1", "A", 0, "a4");
  const a2 = lane("A2", "A", 120, "a5");
  const e = custom([
    p,
    a,
    b,
    a1,
    a2,
    simpleTask("ta1", 100, 30, "A1"),
    simpleTask("ta2", 100, 150, "A2"),
    simpleTask("tb", 100, 270, "B"),
  ]);
  apply(e);
  for (const [id, owner] of [
    ["ta1", "A1"],
    ["ta2", "A2"],
    ["tb", "B"],
  ] as const) {
    const unit = e.store.get(id);
    const row = e.store.get(owner);
    expect((unit?.semantic as { parent: string }).parent).toBe(owner);
    expect(unit?.visual.y ?? -1).toBeGreaterThanOrEqual(row?.visual.y ?? 0);
    expect(
      (unit?.visual.y ?? 0) + (unit?.visual.height ?? 0),
    ).toBeLessThanOrEqual((row?.visual.y ?? 0) + (row?.visual.height ?? 0));
  }
  noOp(e);
});
