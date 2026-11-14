import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { validateDocument } from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "../commands.ts";
import {
  document,
  element,
  makeEditor,
  counterIds,
  seededRng,
} from "../../../../packages/core/src/test-helpers.ts";
import { Batch } from "./batch.ts";

const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
function bpmn() {
  const pool = element({
    id: "pool",
    type: "bpmn.participant",
    index: "a1",
    semantic: { name: "Orders", collapsed: false },
    visual: { x: 0, y: 0, width: 600, height: 240 },
  });
  const lane = element({
    id: "lane",
    type: "bpmn.lane",
    index: "a2",
    semantic: { name: "Intake", parent: "pool" },
    visual: { x: 30, y: 0, width: 570, height: 120 },
  });
  const sibling = element({
    id: "sibling",
    type: "bpmn.lane",
    index: "a3",
    semantic: { name: "Shipping", parent: "pool" },
    visual: { x: 30, y: 120, width: 570, height: 120 },
  });
  const task = element({
    id: "task",
    type: "bpmn.task",
    index: "a4",
    semantic: {
      name: "Check order",
      taskType: "user",
      loop: "none",
      parent: "lane",
    },
    visual: { x: 60, y: 40, width: 100, height: 60 },
  });
  const other = element({
    id: "other",
    type: "bpmn.task",
    index: "a5",
    semantic: {
      name: "Ship",
      taskType: "user",
      loop: "none",
      parent: "sibling",
    },
    visual: { x: 60, y: 140, width: 100, height: 60 },
  });
  return makeEditor({
    document: document([pool, lane, sibling, task, other], [page]),
  });
}
function update(editor: Editor, id: string, visual: object) {
  new Batch(editor).apply({ op: "update", id, visual, carryMembers: false }, 0);
}
test("pool move keeps members and reparents outside tasks; earlier batch placement survives", () => {
  const editor = bpmn();
  const batch = new Batch(editor);
  batch.apply({ op: "update", id: "task", visual: { x: 80 } }, 0);
  batch.apply(
    { op: "update", id: "pool", visual: { x: 700 }, carryMembers: false },
    1,
  );
  expect(editor.store.get("lane")?.visual.x).toBe(730);
  expect(editor.store.get("task")?.visual.x).toBe(80);
  expect(
    (editor.store.get("task")?.semantic as { parent?: string }).parent,
  ).toBeUndefined();
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
});
test("pool resize leaves members in place", () => {
  const editor = bpmn();
  update(editor, "pool", { width: 700, height: 300 });
  expect(editor.store.get("task")?.visual.x).toBe(60);
  expect(editor.store.get("lane")?.visual.width).toBe(670);
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
});
test("pool shrink fits lanes and leaves members in place", () => {
  const editor = bpmn();
  update(editor, "pool", { height: 150 });
  expect(editor.store.get("lane")?.visual.height).toBe(120);
  expect(editor.store.get("sibling")?.visual.y).toBe(120);
  expect(editor.store.get("sibling")?.visual.height).toBe(30);
  expect(editor.store.get("task")?.visual.y).toBe(40);
  expect(editor.store.get("other")?.visual.y).toBe(140);
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
});
test("CLI rejects a pool too small for its lanes without writing", () => {
  const source = serializeDocument(bpmn().getSnapshot());
  for (const item of [
    {
      visual: { height: 120 },
      message:
        'carryMembers:false on "Orders": its lanes need a height of at least 150; shrink the lanes first.',
    },
    {
      visual: { width: 20 },
      message:
        'carryMembers:false on "Orders": its lanes need a width greater than 30.',
    },
  ]) {
    const files = new Map([
      ["doc.jsonl", source],
      [
        "ops.json",
        JSON.stringify([
          {
            op: "update",
            id: "pool",
            visual: item.visual,
            carryMembers: false,
          },
        ]),
      ],
    ]);
    const io: CommandIo = {
      readText(path) {
        const text = files.get(path);
        if (text === undefined) throw new Error("ENOENT");
        return text;
      },
      writeText(path, text) {
        files.set(path, text);
      },
    };
    const result = runCli(
      ["edit", "doc.jsonl", "--ops", "ops.json"],
      io,
      "test",
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(item.message);
    expect(files.get("doc.jsonl")).toBe(source);
  }
});
function nestedBpmn() {
  const source = bpmn().getSnapshot();
  const nested = [
    element({
      id: "nested1",
      type: "bpmn.lane",
      index: "a6",
      semantic: { name: "First", parent: "sibling" },
      visual: { x: 60, y: 120, width: 540, height: 60 },
    }),
    element({
      id: "nested2",
      type: "bpmn.lane",
      index: "a7",
      semantic: { name: "Second", parent: "sibling" },
      visual: { x: 60, y: 180, width: 540, height: 60 },
    }),
  ];
  return makeEditor({
    document: { ...source, elements: [...source.elements, ...nested] },
  });
}
test("nested lanes determine the minimum fitting pool size", () => {
  const editor = nestedBpmn();
  expect(() => update(editor, "pool", { height: 239 })).toThrow(
    "height of at least 240",
  );
  expect(() => update(editor, "pool", { width: 60 })).toThrow(
    "width greater than 60",
  );
  update(editor, "pool", { height: 240, width: 600 });
  update(editor, "pool", { height: 260 });
  expect(editor.store.get("nested2")?.visual.height).toBe(60);
  expect(editor.store.get("nested2")?.visual.y).toBe(180);
});
test("CLI rejects pool widths that exclude nested lanes without writing", () => {
  const source = serializeDocument(nestedBpmn().getSnapshot());
  for (const visual of [
    { width: 300 },
    { width: 599 },
    { x: 20, width: 580 },
  ]) {
    const files = new Map([
      ["doc.jsonl", source],
      [
        "ops.json",
        JSON.stringify([
          { op: "update", id: "pool", visual, carryMembers: false },
        ]),
      ],
    ]);
    const io: CommandIo = {
      readText(path) {
        const text = files.get(path);
        if (text === undefined) throw new Error("ENOENT");
        return text;
      },
      writeText(path, text) {
        files.set(path, text);
      },
    };
    const result = runCli(
      ["edit", "doc.jsonl", "--ops", "ops.json"],
      io,
      "test",
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      'carryMembers:false on "Orders": its nested lanes need a width of at least 600.',
    );
    expect(files.get("doc.jsonl")).toBe(source);
  }
});
test("fitting pool widths contain nested lanes", () => {
  for (const visual of [{ width: 700 }, { x: -20, width: 620 }]) {
    const editor = nestedBpmn();
    update(editor, "pool", visual);
    const pool = editor.store.get("pool");
    if (!pool) throw new Error("missing pool");
    for (const id of ["nested1", "nested2"]) {
      const lane = editor.store.get(id);
      if (!lane) throw new Error("missing nested lane");
      expect(
        (lane.visual.x ?? 0) + (lane.visual.width ?? 0),
      ).toBeLessThanOrEqual((pool.visual.x ?? 0) + (pool.visual.width ?? 0));
    }
    expect(
      validateDocument(editor.getSnapshot()).filter(
        (issue) => issue.severity === "error",
      ),
    ).toEqual([]);
  }
});
test("nested lane height boundary is enforced", () => {
  const editor = nestedBpmn();
  expect(() => update(editor, "sibling", { height: 89 })).toThrow(
    "height of at least 90",
  );
  update(editor, "sibling", { height: 90 });
  const parent = editor.store.get("sibling");
  if (!parent) throw new Error("missing lane");
  for (const id of ["nested1", "nested2"]) {
    const lane = editor.store.get(id);
    if (!lane) throw new Error("missing nested lane");
    expect(
      (lane.visual.y ?? 0) + (lane.visual.height ?? 0),
    ).toBeLessThanOrEqual((parent.visual.y ?? 0) + (parent.visual.height ?? 0));
  }
});
test("lane height keeps its members and carries sibling members; lane movement is rejected", () => {
  const editor = bpmn();
  update(editor, "lane", { height: 200 });
  expect(editor.store.get("task")?.visual.y).toBe(40);
  expect(editor.store.get("other")?.visual.y).toBe(220);
  expect(() => update(editor, "lane", { x: 50 })).toThrow(
    `carryMembers:false on lane "Intake": a lane's x, y and width follow its pool; change the pool, or change only "height".`,
  );
});
function subprocess() {
  const sub = element({
    id: "sub",
    type: "bpmn.subProcess",
    index: "a1",
    semantic: {
      name: "Sub",
      expanded: true,
      triggeredByEvent: false,
      adHoc: false,
      loop: "none",
    },
    visual: { x: 0, y: 0, width: 300, height: 200 },
  });
  const task = element({
    id: "task",
    type: "bpmn.task",
    index: "a2",
    semantic: { name: "Task", taskType: "user", loop: "none", parent: "sub" },
    visual: { x: 160, y: 40, width: 100, height: 60 },
  });
  return makeEditor({ document: document([sub, task], [page]) });
}
test("subprocess move leaves members and reparents them", () => {
  const editor = subprocess();
  update(editor, "sub", { x: 400 });
  expect(editor.store.get("task")?.visual.x).toBe(160);
  expect(
    (editor.store.get("task")?.semantic as { parent?: string }).parent,
  ).toBeUndefined();
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
});
test("subprocess shrink and top-left resize keep members", () => {
  for (const visual of [{ width: 120 }, { x: 20, y: 20, width: 280 }]) {
    const editor = subprocess();
    update(editor, "sub", visual);
    expect(editor.store.get("task")?.visual.x).toBe(160);
    expect(editor.store.get("task")?.visual.y).toBe(40);
    expect(
      validateDocument(editor.getSnapshot()).filter(
        (issue) => issue.severity === "error",
      ),
    ).toEqual([]);
    if (visual.width === 120)
      expect(
        (editor.store.get("task")?.semantic as { parent?: string }).parent,
      ).toBeUndefined();
  }
});
test("frame resize preserves constrained explicit members", () => {
  const editor = new Editor();
  const child = editor.createElement("node.generic", {
    visual: {
      x: 50,
      y: 50,
      width: 100,
      height: 40,
      horizontalConstraint: "end",
    },
  });
  const frame = editor.createElement("frame", {
    semantic: { name: "Stage0", memberIds: [child] },
    visual: { x: 0, y: 0, width: 400, height: 400 },
  });
  update(editor, frame, { x: 20, y: 20, width: 500 });
  expect(editor.store.get(child)?.visual.x).toBe(50);
  expect(
    (editor.store.get(frame)?.semantic as { memberIds?: string[] }).memberIds,
  ).toEqual([child]);
});
test("frame resize carries constrained members by default", () => {
  const editor = new Editor();
  const child = editor.createElement("node.generic", {
    visual: {
      x: 50,
      y: 50,
      width: 100,
      height: 40,
      horizontalConstraint: "end",
    },
  });
  const frame = editor.createElement("frame", {
    semantic: { name: "Stage0", memberIds: [child] },
    visual: { x: 0, y: 0, width: 400, height: 400 },
  });
  new Batch(editor).apply(
    { op: "update", id: frame, visual: { width: 500 } },
    0,
  );
  expect(editor.store.get(child)?.visual.x).toBe(150);
});
test("board move and resize keep plugged parts", () => {
  for (const visual of [
    { x: 110, y: 120 },
    { x: 110, y: 120, width: 800 },
  ]) {
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
    if (!board || !part) throw new Error("missing board fixture");
    const before = editor.store.get(part)?.visual;
    update(editor, board, visual);
    expect(editor.store.get(part)?.visual).toEqual(before);
  }
});
test("group, non-container and layout frame return E1 errors", () => {
  const editor = new Editor();
  const node = editor.createElement("node.generic", {});
  const group = editor.createElement("group", { semantic: { memberIds: [] } });
  const frame = editor.createElement("frame", {
    semantic: {
      name: "Stage0",
      layout: {
        direction: "horizontal",
        gap: 10,
        padding: 20,
        sizing: "fixed",
        align: "start",
      },
    },
  });
  expect(() => update(editor, group, {})).toThrow(
    "carryMembers does not apply to a group: a group has no box of its own; move its members, or ungroup it.",
  );
  expect(() => update(editor, node, {})).toThrow(
    "carryMembers applies only to frame, bpmn.participant, bpmn.lane, bpmn.subProcess and breadboard.board; node.generic does not move other elements.",
  );
  expect(() => update(editor, frame, {})).toThrow(
    'carryMembers:false cannot be used on frame "Stage0": it lays out its members ("layout"); remove "layout" first.',
  );
});

test("subprocess boundary event follows its host while inner task stays", () => {
  const source = subprocess().getSnapshot();
  const boundary = element({
    id: "boundary",
    type: "bpmn.boundaryEvent",
    index: "a3",
    semantic: {
      name: "Boundary",
      attachedTo: "sub",
      definitions: [],
      cancelActivity: true,
    },
    visual: { x: 285, y: 85, width: 30, height: 30 },
  });
  const editor = makeEditor({
    document: { ...source, elements: [...source.elements, boundary] },
  });
  update(editor, "sub", { x: 400 });
  expect(editor.store.get("task")?.visual.x).toBe(160);
  expect(editor.store.get("boundary")?.visual.x).toBe(685);
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
});
test("where updates compute held members independently for each pool", () => {
  const source = bpmn().getSnapshot();
  const pool = element({
    id: "pool2",
    type: "bpmn.participant",
    index: "a6",
    semantic: { name: "Second", collapsed: false },
    visual: { x: 800, y: 0, width: 600, height: 240 },
  });
  const task = element({
    id: "task2",
    type: "bpmn.task",
    index: "a7",
    semantic: { name: "Pack", taskType: "user", loop: "none", parent: "pool2" },
    visual: { x: 850, y: 40, width: 100, height: 60 },
  });
  const editor = makeEditor({
    document: { ...source, elements: [...source.elements, pool, task] },
  });
  new Batch(editor).apply(
    {
      op: "update",
      where: { type: "bpmn.participant" },
      expect: 2,
      visual: { y: 400 },
      carryMembers: false,
    },
    0,
  );
  expect(editor.store.get("task")?.visual.y).toBe(40);
  expect(editor.store.get("task2")?.visual.y).toBe(40);
  expect(
    validateDocument(editor.getSnapshot()).filter(
      (issue) => issue.severity === "error",
    ),
  ).toEqual([]);
});

test("CLI rejects invalid carry requests without writing, including after a valid operation", () => {
  const editor = bpmn();
  const node = editor.createElement("node.generic", {});
  const group = editor.createElement("group", { semantic: { memberIds: [] } });
  const frame = editor.createElement("frame", {
    semantic: {
      name: "Stage0",
      layout: {
        direction: "horizontal",
        gap: 10,
        padding: 20,
        sizing: "fixed",
        align: "start",
      },
    },
  });
  const source = serializeDocument(editor.getSnapshot());
  const cases = [
    {
      id: frame,
      visual: {},
      message:
        'carryMembers:false cannot be used on frame "Stage0": it lays out its members ("layout"); remove "layout" first.',
    },
    {
      id: "lane",
      visual: { x: 50 },
      message: `carryMembers:false on lane "Intake": a lane's x, y and width follow its pool; change the pool, or change only "height".`,
    },
    {
      id: group,
      visual: {},
      message:
        "carryMembers does not apply to a group: a group has no box of its own; move its members, or ungroup it.",
    },
    {
      id: node,
      visual: {},
      message:
        "carryMembers applies only to frame, bpmn.participant, bpmn.lane, bpmn.subProcess and breadboard.board; node.generic does not move other elements.",
    },
  ];
  for (const [index, item] of cases.entries()) {
    for (const preceding of index === 1 ? [false, true] : [false]) {
      const ops = [
        ...(preceding ? [{ op: "update", id: "task", visual: { x: 80 } }] : []),
        { op: "update", id: item.id, visual: item.visual, carryMembers: false },
      ];
      const files = new Map([
        ["doc.jsonl", source],
        ["ops.json", JSON.stringify(ops)],
      ]);
      const io: CommandIo = {
        readText(path) {
          const text = files.get(path);
          if (text === undefined) throw new Error("ENOENT");
          return text;
        },
        writeText(path, text) {
          files.set(path, text);
        },
      };
      const result = runCli(
        ["edit", "doc.jsonl", "--ops", "ops.json"],
        io,
        "test",
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain(item.message);
      expect(files.get("doc.jsonl")).toBe(source);
    }
  }
});

test("BPMN containers carry their members by default", () => {
  for (const id of ["pool", "lane"]) {
    const editor = bpmn();
    const visual = id === "pool" ? { x: 100 } : { height: 200 };
    new Batch(editor).apply({ op: "update", id, visual }, 0);
    expect(
      editor.store.get(id === "pool" ? "task" : "other")?.visual[
        id === "pool" ? "x" : "y"
      ],
    ).toBe(id === "pool" ? 160 : 220);
  }
  const editor = subprocess();
  new Batch(editor).apply({ op: "update", id: "sub", visual: { x: 100 } }, 0);
  expect(editor.store.get("task")?.visual.x).toBe(260);
});

test("board carries plugged parts by default", () => {
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
  if (!board || !part) throw new Error("missing board fixture");
  const before = editor.store.get(part)?.visual.x;
  if (before === undefined) throw new Error("missing part");
  const boardX = editor.store.get(board)?.visual.x;
  if (boardX === undefined) throw new Error("missing board");
  new Batch(editor).apply(
    { op: "update", id: board, visual: { x: boardX + 100 } },
    0,
  );
  expect(editor.store.get(part)?.visual.x).toBe(before + 100);
});
