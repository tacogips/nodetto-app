import { expect, test } from "bun:test";
import {
  connectorBackdropIds,
  containerPaintOrder,
  groupOf,
  renderPageSvg,
} from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import {
  document,
  element,
  makeEditor,
  TEST_PAGE,
} from "../../core/src/test-helpers.ts";
import { isConnector } from "./canvas/geometry.ts";

const node = element({
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
const group = element({
  id: "group",
  type: "group",
  semantic: { memberIds: ["node"] },
});
const connector = element({
  id: "connector",
  type: "edge.generic",
  semantic: { fromPoint: { x: 250, y: 0 }, toPoint: { x: 300, y: 0 } },
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
const pool = element({
  id: "pool",
  type: "bpmn.participant",
  semantic: { name: "Pool", collapsed: false },
  visual: { x: 0, y: 0, width: 200, height: 200 },
});
const flow = element({
  id: "flow",
  type: "bpmn.sequenceFlow",
  semantic: { from: "task", to: "task" },
});

// Track XML depth so nested group members are not mistaken for layer roots.
function layerRoots(svg: string, layer: string): string[] {
  const start = svg.indexOf(`<g data-layer="${layer}"`);
  if (start < 0) return [];
  const tags = svg.slice(start).matchAll(/<[^>]+>/g);
  const ids: string[] = [];
  let depth = 0;
  for (const match of tags) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      depth--;
      if (depth === 0) break;
    } else if (!tag.startsWith("<!") && !tag.startsWith("<?")) {
      if (depth === 1) {
        const id = /\bdata-id="([^"]+)"/.exec(tag)?.[1];
        if (id) ids.push(id);
      }
      if (!tag.endsWith("/>")) depth++;
    }
  }
  return ids;
}

function check(input: Element[]) {
  const editor = makeEditor({
    document: document(
      input.map((entry, i) => ({ ...entry, index: `a${i + 1}` })),
    ),
  });
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
  const roots = (predicate: (entry: Element) => boolean) =>
    painted.filter(predicate).map((entry) => entry.id);
  const svg = renderPageSvg(editor.store, editor.registry, TEST_PAGE.id);
  if (svg === null) throw new Error("expected SVG");
  expect(layerRoots(svg, "backdrops")).toEqual(
    roots((entry) => backdropIds.has(entry.id)),
  );
  expect(layerRoots(svg, "connectors")).toEqual(
    roots((entry) => isConnector(entry)),
  );
  expect(layerRoots(svg, "shapes")).toEqual(
    roots(
      (entry) =>
        !isConnector(entry) &&
        !groupOf(editor.store, entry.id) &&
        !backdropIds.has(entry.id),
    ),
  );
}

test("canvas and SVG layer roots agree", () => {
  const panel = frame("panel", 150, 150, 100, 100);
  const main = frame("frame");
  const other = frame("other", 500, 500, 100, 100);
  for (const entries of [
    [node, main],
    [node, panel, main, connector],
    [node, panel, main, group, other],
    [node, group, main],
    [lane, task, pool, flow],
  ])
    check(entries);
});
