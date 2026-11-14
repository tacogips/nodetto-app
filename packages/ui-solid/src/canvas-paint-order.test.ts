import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  connectorBackdropIds,
  containerPaintOrder,
  groupOf,
} from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { document, element, makeEditor } from "../../core/src/test-helpers.ts";
import { isConnector } from "./canvas/geometry.ts";
import type { InteractionContext } from "./interaction/context.ts";
import { createHitTesting } from "./interaction/hit-testing.ts";
import { Tool } from "./tools.ts";

const node = () =>
  element({
    id: "node",
    type: "shape.geo",
    semantic: { geo: "rect" },
    visual: { x: 10, y: 10, width: 20, height: 20 },
  });
const frame = (id: string, x = 0, y = 0, width = 200, height = 200) =>
  element({
    id,
    type: "frame",
    semantic: { name: id },
    visual: { x, y, width, height },
  });
const surface = (
  id: string,
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
) =>
  element({
    id,
    type,
    semantic: { name: id },
    visual: { x, y, width, height },
  });
const flow = () =>
  element({
    id: "flow",
    type: "bpmn.sequenceFlow",
    semantic: { from: "task", to: "task" },
  });
const group = () =>
  element({ id: "group", type: "group", semantic: { memberIds: ["node"] } });

function partition(input: Element[]) {
  const ordered = input.map((entry, i) => ({ ...entry, index: `a${i + 1}` }));
  const editor = makeEditor({ document: document(ordered) });
  const elements = editor.store.getPageElements(editor.currentPageId);
  const backdropIds = connectorBackdropIds(
    elements,
    (id) => groupOf(editor.store, id) !== null,
  );
  const painted = containerPaintOrder(
    elements,
    editor.createShapeContext(),
    backdropIds,
  );
  return {
    elements,
    painted,
    backdrops: painted
      .filter((entry) => backdropIds.has(entry.id))
      .map((entry) => entry.id),
    visuals: painted
      .filter(
        (entry) =>
          !isConnector(entry) &&
          !groupOf(editor.store, entry.id) &&
          !backdropIds.has(entry.id),
      )
      .map((entry) => entry.id),
  };
}

test("late frame is beneath the node without connectors", () => {
  const result = partition([node(), frame("frame")]);
  expect(result.backdrops).toEqual([]);
  expect(result.visuals).toEqual(["frame", "node"]);
});
test("connector backdrop partition keeps correct order", () => {
  const result = partition([
    node(),
    frame("panel", 150, 150, 100, 100),
    frame("frame"),
    flow(),
  ]);
  expect(result.backdrops).toEqual(["panel", "frame"]);
  expect(result.visuals).toEqual(["node"]);
});
test("pool is painted beneath its lane", () => {
  const result = partition([
    surface("lane", "bpmn.lane", 20, 20, 100, 80),
    surface("task", "bpmn.task", 30, 30, 20, 20),
    surface("pool", "bpmn.participant", 0, 0, 200, 200),
    flow(),
  ]);
  expect(result.backdrops).toEqual(["pool", "lane"]);
});
test("group members paint at their group position", () => {
  const result = partition([
    node(),
    frame("panel", 150, 150, 100, 100),
    frame("frame"),
    group(),
    frame("other", 500, 500, 100, 100),
  ]);
  expect(result.visuals).toEqual(["panel", "frame", "group", "other"]);
  expect(result.painted).toBe(result.elements);
});
test("targetUnder chooses the visible task over a later pool", () => {
  const task = surface("task", "bpmn.task", 40, 40, 100, 80);
  const pool = surface("pool", "bpmn.participant", 0, 0, 300, 200);
  const editor = makeEditor({
    document: document([
      { ...task, index: "a1" },
      { ...pool, index: "a2" },
    ]),
  });
  const ctx = {
    editor,
    options: { tool: () => Tool.Connector },
    state: { gesture: { kind: "idle" } },
  } as unknown as InteractionContext;
  expect(createHitTesting(ctx).targetUnder({ x: 90, y: 80 }, [])).toBe("task");
});
test("canvas roots use the paint-order memo", () => {
  const source = readFileSync(new URL("./Canvas.tsx", import.meta.url), "utf8");
  expect(source).toContain(
    "containerPaintOrder(elements(), context(), backdropIds())",
  );
  for (const name of ["connectors", "backdropRoots", "visualRoots"]) {
    expect(source).toContain(
      `const ${name} = createMemo(() =>\n    paintElements().filter`,
    );
  }
});
