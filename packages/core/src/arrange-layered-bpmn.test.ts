import { expect, test } from "bun:test";
import { planLayeredBpmn } from "./arrange-layered-bpmn.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
function fixture(reverse = false) {
  const entries = [
    element({
      id: "pool",
      type: "bpmn.participant",
      index: "a1",
      semantic: { name: "Orders" },
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
