import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import { renderPageSvg, renderSelectionSvg } from "./svg-export.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

const node = element({
  id: "node",
  type: "shape.geo",
  semantic: { geo: "rect" },
  visual: { x: 10, y: 10, width: 20, height: 20 },
});
const frame = element({
  id: "frame",
  type: "frame",
  semantic: { name: "Frame" },
  visual: { x: 0, y: 0, width: 200, height: 200, style: { fill: "#eeeeee" } },
});
const panel = element({
  id: "panel",
  type: "frame",
  semantic: { name: "Panel" },
  visual: { x: 150, y: 150, width: 100, height: 100 },
});
const other = element({
  id: "other",
  type: "shape.geo",
  semantic: { geo: "rect" },
  visual: { x: 500, y: 500, width: 20, height: 20 },
});
const group = element({
  id: "group",
  type: "group",
  semantic: { memberIds: ["node"] },
});
const pool = element({
  id: "pool",
  type: "bpmn.participant",
  semantic: { name: "Pool", collapsed: false },
  visual: { x: 0, y: 0, width: 200, height: 200 },
});
const lane = element({
  id: "lane",
  type: "bpmn.lane",
  semantic: { name: "Lane", parent: "pool" },
  visual: { x: 20, y: 20, width: 150, height: 100 },
});
const task = element({
  id: "task",
  type: "bpmn.task",
  semantic: { name: "Task", taskType: "none", loop: "none" },
  visual: { x: 40, y: 40, width: 40, height: 40 },
});
const flow = element({
  id: "flow",
  type: "bpmn.sequenceFlow",
  semantic: { from: "task", to: "task" },
});
const connector = element({
  id: "connector",
  type: "edge.generic",
  semantic: { fromPoint: { x: 250, y: 0 }, toPoint: { x: 300, y: 0 } },
});
const registry = createDefaultRegistry();

function storeFor(elements: Element[]): Store {
  return new Store(
    document(elements.map((entry, i) => ({ ...entry, index: `a${i + 1}` }))),
  );
}
function render(elements: Element[]): string {
  const svg = renderPageSvg(storeFor(elements), registry, TEST_PAGE.id);
  if (svg === null) throw new Error("expected SVG");
  return svg;
}
function ordered(svg: string, ...ids: string[]) {
  let previous = -1;
  for (const id of ids) {
    const position = svg.indexOf(`data-id="${id}"`);
    expect(position).toBeGreaterThan(previous);
    previous = position;
  }
}

test("late filled frame paints beneath its enclosed node with identical SVG", () => {
  const late = render([node, frame]);
  ordered(late, "frame", "node");
  expect(late).toBe(render([frame, node]));
});
test("connector layers preserve correct backdrop order and bytes", () => {
  const late = render([node, panel, frame, connector]);
  ordered(late, "panel", "frame", "connector", "node");
  expect(late).toBe(render([panel, frame, node, connector]));
});
test("late pool paints beneath its lane in backdrops", () => {
  ordered(render([lane, task, pool, flow]), "pool", "lane", "flow", "task");
});
test("group paints at its position and correct order remains byte-identical", () => {
  const late = render([node, panel, frame, group, other]);
  ordered(late, "panel", "frame", "group", "node", "other");
  expect(late).toBe(render([panel, frame, node, group, other]));
});
test("frame moves below a group without changing its member order", () => {
  const second = { ...node, id: "second", visual: { ...node.visual, x: 40 } };
  const pair = { ...group, semantic: { memberIds: ["second", "node"] } };
  ordered(
    render([node, second, pair, frame]),
    "frame",
    "group",
    "second",
    "node",
  );
});
test("selection export paints frame below its node", () => {
  const svg = renderSelectionSvg(
    storeFor([node, frame]),
    registry,
    TEST_PAGE.id,
    new Set(["node", "frame"]),
  );
  if (svg === null) throw new Error("expected SVG");
  ordered(svg, "frame", "node");
});
