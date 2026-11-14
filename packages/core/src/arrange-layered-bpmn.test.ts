import { expect, test } from "bun:test";
import { validateDocument } from "@nodetto/ir";
import { DEPTH_ONE_FIXTURES } from "./arrange-layered-bpmn.fixtures.ts";
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
  editor.apply(plan.settleCommands);
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
  expect(plan.settleCommands).toEqual([]);
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
    settleCommands: [],
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
  expect(p.settleCommands).toEqual([]);
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
  expect(p.settleCommands).toEqual([]);
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

function depthFixture(depth: number, unitWidth: number) {
  const entries = [pool("p", 0)];
  let parent = "p";
  for (let d = 1; d <= depth; d++) {
    entries.push(
      element({
        id: `l${d}`,
        index: `a${d}`,
        type: "bpmn.lane",
        semantic: { name: `L${d}`, parent },
        visual: { x: 30 * d, y: 0, width: 500 - 30 * d, height: 240 },
      }),
    );
    parent = `l${d}`;
  }
  const t = simpleTask("t", 150, 50, parent);
  entries.push({ ...t, visual: { ...t.visual, width: unitWidth, height: 40 } });
  return custom(entries);
}
for (const depth of [1, 2, 3]) {
  for (const unitWidth of [100, 20]) {
    test(`depth ${depth} width ${unitWidth} has contained stable boxes`, () => {
      const e = depthFixture(depth, unitWidth);
      const plan = apply(e);
      const width = unitWidth + 110 + 30 * (depth - 1);
      expect(e.store.get("p")?.visual.width).toBe(width);
      expect(e.store.get("t")?.visual.x).toBe(40 + 30 * depth);
      for (let d = 1; d <= depth; d++) {
        const box = e.store.get(`l${d}`)?.visual;
        const parent = e.store.get(d === 1 ? "p" : `l${d - 1}`)?.visual;
        expect(box?.x).toBe(30 * d);
        expect(box?.width).toBe(width - 30 * d);
        expect(box?.y).toBe(parent?.y);
        expect(box?.height).toBe(parent?.height);
      }
      expect((e.store.get("t")?.semantic as { parent: string }).parent).toBe(
        `l${depth}`,
      );
      if (depth === 1) {
        expect(plan.settleCommands).toEqual([]);
        for (const c of plan.containerCommands)
          if (c.type === "updateVisual" && c.id === "l1") {
            expect(c.visual).not.toHaveProperty("x");
            expect(c.visual).not.toHaveProperty("y");
            expect(c.visual).not.toHaveProperty("width");
          }
      }
      noOp(e);
    });
  }
}
test("deepest pool sets the page-wide inset", () => {
  const e = depthFixture(3, 100);
  const other = [
    pool("q", 500),
    lane("shallow", "q", 500, "b1"),
    simpleTask("u", 150, 540, "shallow"),
  ];
  const merged = custom([...e.store.getPageElements(page.id), ...other]);
  apply(merged);
  expect(merged.store.get("u")?.visual.x).toBe(130);
  expect(merged.store.get("q")?.visual.width).toBe(270);
  noOp(merged);
});
test("unchanged pool and coincident child settle after ancestor moves", () => {
  const entries = [
    element({
      id: "p",
      type: "bpmn.participant",
      semantic: { name: "p", collapsed: false },
      visual: { x: 0, y: 0, width: 240, height: 360 },
    }),
  ];
  for (const [id, parent, x, y, width, height, index] of [
    ["p1", "p", 30, 0, 210, 170, "a1"],
    ["p2", "p", 30, 170, 210, 190, "a2"],
    ["c1", "p2", 60, 170, 180, 70, "a3"],
    ["c2", "p2", 60, 240, 180, 120, "a4"],
  ] as const)
    entries.push(
      element({
        id,
        index,
        type: "bpmn.lane",
        semantic: { name: id, parent },
        visual: { x, y, width, height },
      }),
    );
  for (const [id, parent, y] of [
    ["t1", "p1", 40],
    ["t2", "c1", 185],
    ["t3", "c2", 280],
  ] as const) {
    const t = simpleTask(id, 100, y, parent);
    entries.push({ ...t, visual: { ...t.visual, height: 40 } });
  }
  const e = custom(entries);
  const plan = apply(e);
  expect(
    plan.containerCommands.some(
      (c) => c.type === "updateVisual" && c.id === "c2",
    ),
  ).toBe(false);
  expect(
    plan.settleCommands.some((c) => c.type === "updateVisual" && c.id === "c2"),
  ).toBe(true);
  for (const [id, y, height] of [
    ["p1", 0, 120],
    ["p2", 120, 240],
    ["c1", 120, 120],
    ["c2", 240, 120],
  ] as const) {
    expect(e.store.get(id)?.visual.y).toBe(y);
    expect(e.store.get(id)?.visual.height).toBe(height);
  }
  expect(e.store.get("p")?.visual).toMatchObject({
    x: 0,
    y: 0,
    width: 240,
    height: 360,
  });
  for (const [id, x, width] of [
    ["p1", 30, 210],
    ["p2", 30, 210],
    ["c1", 60, 180],
    ["c2", 60, 180],
  ] as const) {
    expect(e.store.get(id)?.visual).toMatchObject({ x, width });
  }
  for (const [id, parent] of [
    ["t1", "p1"],
    ["t2", "c1"],
    ["t3", "c2"],
  ] as const)
    expect((e.store.get(id)?.semantic as { parent: string }).parent).toBe(
      parent,
    );
  noOp(e);
});
async function checkBaseline(name: string) {
  const fixture = DEPTH_ONE_FIXTURES.find((item) => item.name === name);
  if (!fixture) throw new Error(`Missing fixture ${name}`);
  const e = fixture.build();
  const plan = apply(e);
  expect(plan.settleCommands).toEqual([]);
  for (const c of plan.containerCommands)
    if (c.type === "updateVisual" && e.store.get(c.id)?.type === "bpmn.lane") {
      expect(c.visual).not.toHaveProperty("x");
      expect(c.visual).not.toHaveProperty("y");
      expect(c.visual).not.toHaveProperty("width");
    }
  expect(`${JSON.stringify(e.getSnapshot(), null, 1)}\n`).toBe(
    await Bun.file(
      new URL(
        `./arrange-layered-bpmn.depth-one.${fixture.name}.expected.json`,
        import.meta.url,
      ),
    ).text(),
  );
  for (const el of e.store.getPageElements(page.id)) {
    const parentId = (el.semantic as { parent?: string }).parent;
    if (!parentId) continue;
    const parent = e.store.get(parentId);
    if (!parent || !["bpmn.lane", "bpmn.participant"].includes(parent.type))
      continue;
    const a = el.visual;
    const b = parent.visual;
    expect(a.x ?? 0).toBeGreaterThanOrEqual(b.x ?? 0);
    expect(a.y ?? 0).toBeGreaterThanOrEqual(b.y ?? 0);
    expect((a.x ?? 0) + (a.width ?? 0)).toBeLessThanOrEqual(
      (b.x ?? 0) + (b.width ?? 0),
    );
    expect((a.y ?? 0) + (a.height ?? 0)).toBeLessThanOrEqual(
      (b.y ?? 0) + (b.height ?? 0),
    );
  }
  noOp(e);
}
test("baseline two pools and message flow", () =>
  checkBaseline("two-pools-message-flow"));
test("baseline pool and free row", () =>
  checkBaseline("pool-no-lanes-free-row"));
test("baseline collapsed pool", () => checkBaseline("collapsed-pool"));
test("baseline subprocess and boundary", () =>
  checkBaseline("subprocess-boundary"));

test("mismatched child heights settle to the planned parent span", () => {
  const e = custom([
    pool("p", 0),
    lane("parent", "p", 0, "a1"),
    lane("one", "parent", 0, "a2"),
    lane("two", "parent", 80, "a3"),
    simpleTask("a", 100, 30, "one"),
    simpleTask("b", 100, 170, "two"),
  ]);
  apply(e);
  const parent = e.store.get("parent")?.visual;
  const one = e.store.get("one")?.visual;
  const two = e.store.get("two")?.visual;
  expect(two?.y).toBe((one?.y ?? 0) + (one?.height ?? 0));
  expect(parent?.height).toBe((one?.height ?? 0) + (two?.height ?? 0));
  expect((e.store.get("a")?.semantic as { parent: string }).parent).toBe("one");
  expect((e.store.get("b")?.semantic as { parent: string }).parent).toBe("two");
  noOp(e);
});

function depthThreeSiblings(mismatched: boolean) {
  const poolWidth = mismatched ? 500 : 270;
  const entries = [
    element({
      id: "p",
      type: "bpmn.participant",
      semantic: { name: "p", collapsed: false },
      visual: { x: 0, y: 0, width: poolWidth, height: 480 },
    }),
  ];
  const lanes = mismatched
    ? ([
        ["l1", "p", 30, 0, 470, 200, "a1"],
        ["l2", "p", 30, 200, 470, 280, "a2"],
        ["m1", "l2", 60, 200, 440, 50, "a3"],
        ["m2", "l2", 60, 250, 440, 100, "a4"],
        ["n1", "m2", 90, 250, 410, 30, "a5"],
        ["n2", "m2", 90, 280, 410, 40, "a6"],
      ] as const)
    : ([
        ["l1", "p", 30, 0, 240, 170, "a1"],
        ["l2", "p", 30, 170, 240, 310, "a2"],
        ["m1", "l2", 60, 170, 210, 70, "a3"],
        ["m2", "l2", 60, 240, 210, 240, "a4"],
        ["n1", "m2", 90, 240, 180, 120, "a5"],
        ["n2", "m2", 90, 360, 180, 120, "a6"],
      ] as const);
  for (const [id, parent, x, y, width, height, index] of lanes)
    entries.push(
      element({
        id,
        index,
        type: "bpmn.lane",
        semantic: { name: id, parent },
        visual: { x, y, width, height },
      }),
    );
  const taskYs = mismatched ? [40, 205, 255, 285] : [40, 185, 280, 400];
  for (const [i, parent] of ["l1", "m1", "n1", "n2"].entries()) {
    const t = simpleTask(`t${i + 1}`, 130, taskYs[i] ?? 0, parent);
    entries.push({ ...t, visual: { ...t.visual, height: 40 } });
  }
  return custom(entries);
}
function assertDepthThreeResult(e: ReturnType<typeof fixture>) {
  for (const [id, x, y, width, height] of [
    ["p", 0, 0, 270, 480],
    ["l1", 30, 0, 240, 120],
    ["l2", 30, 120, 240, 360],
    ["m1", 60, 120, 210, 120],
    ["m2", 60, 240, 210, 240],
    ["n1", 90, 240, 180, 120],
    ["n2", 90, 360, 180, 120],
  ] as const)
    expect(e.store.get(id)?.visual).toMatchObject({ x, y, width, height });
  for (const [id, parent, y] of [
    ["t1", "l1", 40],
    ["t2", "m1", 160],
    ["t3", "n1", 280],
    ["t4", "n2", 400],
  ] as const) {
    const unit = e.store.get(id);
    const laneBox = e.store.get(parent)?.visual;
    expect(unit?.visual).toMatchObject({ x: 130, y, width: 100, height: 40 });
    expect((unit?.semantic as { parent: string }).parent).toBe(parent);
    const cx = (unit?.visual.x ?? 0) + (unit?.visual.width ?? 0) / 2;
    const cy = (unit?.visual.y ?? 0) + (unit?.visual.height ?? 0) / 2;
    expect(cx).toBeGreaterThanOrEqual(laneBox?.x ?? 0);
    expect(cx).toBeLessThanOrEqual((laneBox?.x ?? 0) + (laneBox?.width ?? 0));
    expect(cy).toBeGreaterThanOrEqual(laneBox?.y ?? 0);
    expect(cy).toBeLessThanOrEqual((laneBox?.y ?? 0) + (laneBox?.height ?? 0));
  }
  noOp(e);
}
test("depth 3 siblings settle after ancestor moves", () => {
  const e = depthThreeSiblings(false);
  const plan = apply(e);
  for (const id of ["m2", "n1", "n2"]) {
    expect(
      plan.containerCommands.some(
        (c) => c.type === "updateVisual" && c.id === id,
      ),
    ).toBe(false);
    expect(
      plan.settleCommands.some((c) => c.type === "updateVisual" && c.id === id),
    ).toBe(true);
  }
  assertDepthThreeResult(e);
});
test("depth 3 child heights that do not sum settle to plan", () => {
  const e = depthThreeSiblings(true);
  apply(e);
  assertDepthThreeResult(e);
});

function subprocessTearFixture(clear: boolean) {
  const entries = [
    element({
      id: "p",
      type: "bpmn.participant",
      semantic: { name: "p", collapsed: false },
      visual: { x: 0, y: 0, width: 800, height: 800 },
    }),
  ];
  for (const [id, parent, x, y, width, height, index] of [
    ["a", "p", 30, 0, 770, 500, "a1"],
    ["b", "p", 30, 500, 770, 300, "a2"],
    ["a1", "a", 60, 0, 740, 500, "a3"],
    ["b1", "b", 60, 500, 740, 300, "a4"],
  ] as const)
    entries.push(
      element({
        id,
        index,
        type: "bpmn.lane",
        semantic: { name: id, parent },
        visual: { x, y, width, height },
      }),
    );
  for (const [id, parent, x, y] of [
    ["sa", "a1", 100, 300],
    ["sb", "b1", clear ? 500 : 100, 620],
  ] as const) {
    entries.push(
      element({
        id,
        type: "bpmn.subProcess",
        semantic: {
          name: id,
          parent,
          expanded: true,
          triggeredByEvent: false,
          adHoc: false,
          loop: "none",
        },
        visual: { x, y, width: 200, height: 100 },
      }),
    );
    const inner = simpleTask(`${id}_in`, x + 10, y + 10, id);
    entries.push({
      ...inner,
      visual: { ...inner.visual, width: 40, height: 20 },
    });
  }
  return custom(entries);
}
test("nested lane restack refuses to tear subprocess contents", () => {
  const e = subprocessTearFixture(false);
  expect(
    validateDocument(e.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
  const before = JSON.stringify(e.getSnapshot());
  const plan = planLayeredBpmn(e.store, page.id, e.registry);
  expect(plan).toEqual({
    error:
      'arrange --mode layered cannot keep the contents of sub-process "sb" while restacking lanes: move it clear of the sub-processes in other lanes, then rerun.',
  });
  expect(JSON.stringify(e.getSnapshot())).toBe(before);
  expect(plan).not.toHaveProperty("containerCommands");
  expect(plan).not.toHaveProperty("settleCommands");
  expect(plan).not.toHaveProperty("unitCommands");
});
test("nested lane restack preserves clear subprocess contents", () => {
  const e = subprocessTearFixture(true);
  apply(e);
  const sub = e.store.get("sb");
  const inner = e.store.get("sb_in");
  expect((inner?.semantic as { parent: string }).parent).toBe("sb");
  expect((inner?.visual.x ?? 0) - (sub?.visual.x ?? 0)).toBe(10);
  expect((inner?.visual.y ?? 0) - (sub?.visual.y ?? 0)).toBe(10);
  noOp(e);
});

function collapsedTearFixture(clear: boolean) {
  const entries = [
    element({
      id: "p",
      type: "bpmn.participant",
      semantic: { name: "p", collapsed: false },
      visual: { x: 0, y: 0, width: 800, height: 800 },
    }),
    element({
      id: "a",
      index: "a1",
      type: "bpmn.lane",
      semantic: { name: "a", parent: "p" },
      visual: { x: 30, y: 0, width: 770, height: 800 },
    }),
    element({
      id: "a1",
      index: "a2",
      type: "bpmn.lane",
      semantic: { name: "a1", parent: "a" },
      visual: { x: 60, y: 0, width: 740, height: 800 },
    }),
    element({
      id: "sl",
      type: "bpmn.subProcess",
      semantic: {
        name: "sl",
        parent: "a1",
        expanded: true,
        triggeredByEvent: false,
        adHoc: false,
        loop: "none",
      },
      visual: { x: 100, y: clear ? 40 : 280, width: 200, height: 100 },
    }),
    element({
      id: "q",
      type: "bpmn.participant",
      semantic: { name: "q", collapsed: true },
      visual: { x: 0, y: 900, width: 800, height: 60 },
    }),
  ];
  const inner = simpleTask("sl_in", 110, clear ? 50 : 290, "sl");
  const task = simpleTask("t", 100, 920, "q");
  entries.push(
    { ...inner, visual: { ...inner.visual, width: 40, height: 20 } },
    { ...task, visual: { ...task.visual, width: 40, height: 20 } },
  );
  return custom(entries);
}
test("nested lane restack refuses to tear collapsed pool contents", () => {
  const e = collapsedTearFixture(false);
  expect(
    validateDocument(e.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
  const before = JSON.stringify(e.getSnapshot());
  const plan = planLayeredBpmn(e.store, page.id, e.registry);
  expect(plan).toEqual({
    error:
      'arrange --mode layered cannot keep the contents of collapsed pool "q" at the planned pool width 340: move them so that their centres fit inside that width and clear of the sub-processes in other pools, then rerun.',
  });
  expect(JSON.stringify(e.getSnapshot())).toBe(before);
  expect(plan).not.toHaveProperty("containerCommands");
  expect(plan).not.toHaveProperty("settleCommands");
  expect(plan).not.toHaveProperty("unitCommands");
});
test("nested lane restack preserves clear collapsed pool contents", () => {
  const e = collapsedTearFixture(true);
  apply(e);
  expect(e.store.get("q")?.visual).toMatchObject({
    x: 0,
    y: 300,
    width: 340,
    height: 60,
  });
  expect(e.store.get("t")?.visual).toMatchObject({ x: 100, y: 320 });
  expect((e.store.get("t")?.semantic as { parent: string }).parent).toBe("q");
  const sub = e.store.get("sl");
  const inner = e.store.get("sl_in");
  expect((inner?.semantic as { parent: string }).parent).toBe("sl");
  expect((inner?.visual.x ?? 0) - (sub?.visual.x ?? 0)).toBe(10);
  expect((inner?.visual.y ?? 0) - (sub?.visual.y ?? 0)).toBe(10);
  noOp(e);
});

function collapsedWidthFixture(x: number) {
  const task = simpleTask("x", 100, 40, "a1");
  const hidden = simpleTask("hidden", x, 420, "q");
  return custom([
    element({
      id: "p",
      type: "bpmn.participant",
      semantic: { name: "p", collapsed: false },
      visual: { x: 0, y: 0, width: 800, height: 240 },
    }),
    element({
      id: "a",
      index: "a1",
      type: "bpmn.lane",
      semantic: { name: "a", parent: "p" },
      visual: { x: 30, y: 0, width: 770, height: 240 },
    }),
    element({
      id: "a1",
      index: "a2",
      type: "bpmn.lane",
      semantic: { name: "a1", parent: "a" },
      visual: { x: 60, y: 0, width: 740, height: 240 },
    }),
    { ...task, visual: { ...task.visual, height: 40 } },
    element({
      id: "q",
      type: "bpmn.participant",
      semantic: { name: "q", collapsed: true },
      visual: { x: 0, y: 400, width: 800, height: 100 },
    }),
    { ...hidden, visual: { ...hidden.visual, height: 40 } },
  ]);
}
test("collapsed pool width refusal names remedies without subprocesses", () => {
  const e = collapsedWidthFixture(500);
  expect(
    validateDocument(e.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
  const before = JSON.stringify(e.getSnapshot());
  const plan = planLayeredBpmn(e.store, page.id, e.registry);
  expect(plan).toEqual({
    error:
      'arrange --mode layered cannot keep the contents of collapsed pool "q" at the planned pool width 240: move them so that their centres fit inside that width and clear of the sub-processes in other pools, then rerun.',
  });
  expect(JSON.stringify(e.getSnapshot())).toBe(before);
  expect(plan).not.toHaveProperty("containerCommands");
  expect(plan).not.toHaveProperty("settleCommands");
  expect(plan).not.toHaveProperty("unitCommands");
});
test("collapsed pool contents fitted within planned width can be arranged", () => {
  const e = collapsedWidthFixture(60);
  apply(e);
  expect(e.store.get("q")?.visual).toMatchObject({
    x: 0,
    y: 240,
    width: 240,
    height: 100,
  });
  expect(e.store.get("hidden")?.visual).toMatchObject({ x: 60, y: 260 });
  expect((e.store.get("hidden")?.semantic as { parent: string }).parent).toBe(
    "q",
  );
  noOp(e);
});
