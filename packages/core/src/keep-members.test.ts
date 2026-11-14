import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import {
  counterIds,
  document,
  element,
  makeEditor,
  seededRng,
} from "./test-helpers.ts";

test("kept frame members stay in place on move and resize", () => {
  const editor = makeEditor();
  const child = editor.buildElement("node.generic", {
    visual: {
      x: 50,
      y: 50,
      width: 100,
      height: 40,
      horizontalConstraint: "end",
    },
  });
  const frame = editor.buildElement("frame", {
    semantic: { name: "Frame", memberIds: [child.id] },
    visual: { x: 0, y: 0, width: 400, height: 400 },
  });
  editor.apply(
    [child, frame].map((item) => ({ type: "createElement", element: item })),
  );
  editor.apply([{ type: "updateVisual", id: frame.id, visual: { x: 100 } }], {
    keepMembers: new Set([child.id]),
  });
  expect(editor.store.get(child.id)?.visual.x).toBe(50);
  editor.undo();
  editor.apply(
    [{ type: "updateVisual", id: frame.id, visual: { width: 600 } }],
    { keepMembers: new Set([child.id]) },
  );
  expect(editor.store.get(child.id)?.visual.x).toBe(50);
  editor.undo();
  editor.apply([
    { type: "updateVisual", id: frame.id, visual: { width: 600 } },
  ]);
  expect(editor.store.get(child.id)?.visual.x).toBe(250);
});

test("kept BPMN task stays in place and is reparented after pool move", () => {
  const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
  const pool = element({
    id: "pool",
    type: "bpmn.participant",
    index: "a1",
    semantic: { name: "Pool", collapsed: false },
    visual: { x: 0, y: 0, width: 600, height: 200 },
  });
  const lane = element({
    id: "lane",
    type: "bpmn.lane",
    index: "a2",
    semantic: { name: "Lane", parent: "pool" },
    visual: { x: 30, y: 0, width: 570, height: 200 },
  });
  const task = element({
    id: "task",
    type: "bpmn.task",
    index: "a3",
    semantic: { name: "Task", taskType: "user", loop: "none", parent: "lane" },
    visual: { x: 60, y: 40, width: 100, height: 60 },
  });
  const editor = makeEditor({ document: document([pool, lane, task], [page]) });
  editor.apply([{ type: "updateVisual", id: "pool", visual: { x: 700 } }], {
    keepMembers: new Set(["task"]),
  });
  expect(editor.store.get("lane")?.visual.x).toBe(730);
  expect(editor.store.get("task")?.visual.x).toBe(60);
  expect(
    (editor.store.get("task")?.semantic as { parent?: string }).parent,
  ).toBeUndefined();
  editor.undo();
  editor.apply([{ type: "updateVisual", id: "pool", visual: { x: 700 } }]);
  expect(editor.store.get("task")?.visual.x).toBe(760);
});

test("kept breadboard part stays while board moves", () => {
  const editor = new Editor({
    document: document([], [{ id: "bb", name: "Board", kind: "breadboard" }]),
    idSource: counterIds("bb"),
    rng: seededRng(9),
  });
  const board = editor.createBreadboardPart("breadboard.board", {
    x: 130,
    y: 150,
  });
  const part = editor.createBreadboardPart("breadboard.resistor", {
    x: 130,
    y: 150,
  });
  expect(board).not.toBeNull();
  expect(part).not.toBeNull();
  if (!board || !part) return;
  const before = editor.store.get(part)?.visual;
  editor.apply(
    [{ type: "updateVisual", id: board, visual: { x: 110, y: 120 } }],
    { keepMembers: new Set([part]) },
  );
  expect(editor.store.get(part)?.visual).toEqual(before);
  editor.undo();
  editor.apply([
    { type: "updateVisual", id: board, visual: { x: 110, y: 120 } },
  ]);
  expect(editor.store.get(part)?.visual).not.toEqual(before);
});

test("lane resize carries sibling members but keeps selected members", () => {
  const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
  const pool = element({
    id: "pool",
    type: "bpmn.participant",
    index: "a1",
    semantic: { name: "Pool", collapsed: false },
    visual: { x: 0, y: 0, width: 600, height: 240 },
  });
  const lane = (id: string, index: string, y: number) =>
    element({
      id,
      type: "bpmn.lane",
      index,
      semantic: { name: id, parent: "pool" },
      visual: { x: 30, y, width: 570, height: 120 },
    });
  const task = (id: string, index: string, parent: string, y: number) =>
    element({
      id,
      type: "bpmn.task",
      index,
      semantic: { name: id, taskType: "user", loop: "none", parent },
      visual: { x: 60, y, width: 100, height: 60 },
    });
  const editor = makeEditor({
    document: document(
      [
        pool,
        lane("a", "a2", 0),
        lane("b", "a3", 120),
        task("first", "a4", "a", 40),
        task("second", "a5", "b", 140),
      ],
      [page],
    ),
  });
  editor.apply([{ type: "updateVisual", id: "a", visual: { height: 200 } }], {
    keepMembers: new Set(["first"]),
  });
  expect(editor.store.get("first")?.visual.y).toBe(40);
  expect(editor.store.get("second")?.visual.y).toBe(220);
});

test("kept subprocess member does not follow subprocess movement", () => {
  const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
  const sub = element({
    id: "sub",
    type: "bpmn.subProcess",
    index: "a1",
    semantic: { name: "Sub", collapsed: false },
    visual: { x: 0, y: 0, width: 300, height: 200 },
  });
  const task = element({
    id: "task",
    type: "bpmn.task",
    index: "a2",
    semantic: { name: "Task", taskType: "user", loop: "none", parent: "sub" },
    visual: { x: 60, y: 40, width: 100, height: 60 },
  });
  const editor = makeEditor({ document: document([sub, task], [page]) });
  editor.apply([{ type: "updateVisual", id: "sub", visual: { x: 400 } }], {
    keepMembers: new Set(["task"]),
  });
  expect(editor.store.get("task")?.visual.x).toBe(60);
  expect(
    (editor.store.get("task")?.semantic as { parent?: string }).parent,
  ).toBeUndefined();
  editor.undo();
  editor.apply([{ type: "updateVisual", id: "sub", visual: { x: 400 } }]);
  expect(editor.store.get("task")?.visual.x).toBe(460);
});
