import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { planRoute } from "../arrange-route.ts";
import { connectorWaypointFromPage } from "../shapes/connector.ts";
import { bpmnFlowLabelBox } from "../bpmn/notation.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import {
  isLabelObstacle,
  labelOverlapScore,
  pageMetrics,
  resolvedLabelBox,
} from "./metrics.ts";

const box = (
  id: string,
  type: string,
  x: number,
  y: number,
  width = 20,
  height = 20,
  semantic: unknown = {},
) => element({ id, type, semantic, visual: { x, y, width, height } });
const edge = (id: string, from: string, to: string, name = "") =>
  element({ id, type: "bpmn.sequenceFlow", semantic: { from, to, name } });
const metrics = (elements: ReturnType<typeof element>[]) =>
  pageMetrics(
    new Store(document(elements)),
    TEST_PAGE.id,
    createDefaultRegistry(),
  );

test("crossings exclude shared endpoints and count distinct intersections", () => {
  const nodes = [
    box("a", "node.generic", 0, 90),
    box("b", "node.generic", 180, 90),
    box("c", "node.generic", 90, 0),
    box("d", "node.generic", 90, 180),
  ];
  expect(
    metrics([...nodes, edge("ab", "a", "b"), edge("cd", "c", "d")])
      .edgeCrossings,
  ).toBe(1);
  expect(
    metrics([...nodes, edge("ab", "a", "b"), edge("ac", "a", "c")])
      .edgeCrossings,
  ).toBe(0);
});

test("BPMN labels ignore containing surfaces but count real obstacles", () => {
  const nodes = [box("a", "bpmn.task", 0, 90), box("b", "bpmn.task", 180, 90)];
  const pool = box("pool", "bpmn.participant", -50, -50, 400, 300, {
    collapsed: false,
  });
  const lane = box("lane", "bpmn.lane", -30, -30, 360, 260);
  const expanded = box("sub", "bpmn.subProcess", -20, -20, 340, 240, {
    expanded: true,
  });
  const flow = edge("ab", "a", "b", "Review order");
  expect(metrics([...nodes, pool, lane, expanded, flow]).labelOverlaps).toBe(0);
  const obstacle = box("obstacle", "bpmn.task", 90, 92, 20, 16);
  expect(
    metrics([...nodes, pool, lane, expanded, obstacle, flow]).labelOverlaps,
  ).toBeGreaterThan(0);
  expect(
    isLabelObstacle(
      box("collapsed", "bpmn.subProcess", 90, 92, 20, 16, { expanded: false }),
    ),
  ).toBe(true);
  expect(
    isLabelObstacle(
      box("pool2", "bpmn.participant", 0, 0, 20, 20, { collapsed: true }),
    ),
  ).toBe(true);
});

test("flow box and collision scoring use the same baseline-relative geometry", () => {
  const flow = edge(
    "flow",
    "a",
    "b",
    "First row\nSecond row\nThird row\nFourth row",
  );
  const points = [
    { x: 0, y: 100 },
    { x: 200, y: 100 },
  ];
  const anchor = { x: 100, y: 100 };
  const label = resolvedLabelBox(flow, points, anchor);
  expect(label).toEqual(bpmnFlowLabelBox(flow, points, anchor));
  if (!label) throw new Error("missing label");
  expect(
    labelOverlapScore(
      label,
      [{ x: 80, y: 130, width: 40, height: 12 }],
      [],
      [],
    ),
  ).toBe(1);
  expect(
    labelOverlapScore(
      label,
      [],
      [label],
      [
        [
          { x: 50, y: 100 },
          { x: 150, y: 100 },
        ],
      ],
    ),
  ).toBe(2);
});

test("page metrics count overlapping labels, other routes, and collapsed subprocesses", () => {
  const nodes = [
    box("a", "bpmn.task", 0, 90),
    box("b", "bpmn.task", 180, 90),
    box("c", "bpmn.task", 90, 0),
    box("d", "bpmn.task", 90, 180),
  ];
  const flow = edge("ab", "a", "b", "Review order");
  const baseline = metrics([...nodes, flow]).labelOverlaps;
  expect(
    metrics([...nodes, flow, edge("cd", "c", "d")]).labelOverlaps,
  ).toBeGreaterThan(baseline);
  expect(
    metrics([...nodes, flow, edge("ab2", "a", "b", "Review order")])
      .labelOverlaps,
  ).toBeGreaterThan(baseline);
  const collapsed = box("sub", "bpmn.subProcess", 90, 92, 20, 16, {
    expanded: false,
  });
  expect(metrics([...nodes, flow, collapsed]).labelOverlaps).toBeGreaterThan(
    baseline,
  );
});

test("a tangential bend is not a crossing but a bend through a route is", () => {
  const measure = (cy: number) => {
    const editor = new Editor();
    const node = (x: number, y: number) =>
      editor.createElement("node.generic", {
        visual: { x: x - 5, y: y - 5, width: 10, height: 10 },
      });
    const a = node(-100, 0);
    const b = node(300, 0);
    const c = node(0, cy);
    const d = node(200, 100);
    editor.createElement("edge.generic", { semantic: { from: a, to: b } });
    editor.createElement("edge.generic", {
      semantic: {
        from: c,
        to: d,
        routing: "manual",
        routingWaypoints: [
          connectorWaypointFromPage(
            { x: 100, y: 0 },
            { x: 0, y: cy },
            { x: 200, y: 100 },
          ),
        ],
      },
    });
    return pageMetrics(
      editor.store,
      editor.store.listPages()[0]!.id,
      editor.registry,
    ).edgeCrossings;
  };
  expect(measure(100)).toBe(0);
  expect(measure(-100)).toBe(1);
});

test("routing reduces generic label overlaps", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 60 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 400, y: 0, width: 80, height: 60 },
  });
  editor.createElement("node.generic", {
    visual: { x: 220, y: 18, width: 40, height: 24 },
  });
  editor.createElement("edge.generic", {
    semantic: {
      from: a,
      to: b,
      label: "Review",
      fromPort: "right",
      toPort: "left",
      routing: "straight",
    },
  });
  const page = editor.store.listPages()[0]!.id;
  const before = pageMetrics(editor.store, page, editor.registry).labelOverlaps;
  expect(before).toBeGreaterThan(0);
  editor.apply(
    planRoute(editor.store, page, editor.registry, { resetManual: false }),
  );
  expect(
    pageMetrics(editor.store, page, editor.registry).labelOverlaps,
  ).toBeLessThan(before);
});

test("ERD metrics count crossings and table collisions but ignore containing frames", () => {
  const table = (id: string, x: number, y: number) =>
    box(id, "erd.table", x, y, 60, 56, { tableName: id, columns: [] });
  const relation = (id: string, from: string, to: string, label: string) =>
    element({
      id,
      type: "erd.relation",
      semantic: {
        from: { table: from },
        to: { table: to },
        cardinality: "1:*",
        label,
        fromPort: "right",
        toPort: "left",
        routing: "straight",
      },
    });
  const a = table("a", 0, 100);
  const b = table("b", 300, 100);
  const c = table("c", 150, 0);
  const d = table("d", 150, 200);
  const horizontal = relation("ab", "a", "b", "Review");
  const vertical = element({
    id: "cd",
    type: "erd.relation",
    semantic: {
      from: { table: "c" },
      to: { table: "d" },
      cardinality: "1:*",
      label: "",
      fromPort: "bottom",
      toPort: "top",
      routing: "straight",
    },
  });
  const frame = box("frame", "frame", -100, -100, 600, 500);
  expect(metrics([a, b, frame, horizontal]).labelOverlaps).toBe(0);
  expect(
    metrics([a, b, c, d, horizontal, vertical]).edgeCrossings,
  ).toBeGreaterThan(0);
  const obstacle = table("obstacle", 150, 100);
  expect(metrics([a, b, obstacle, horizontal]).labelOverlaps).toBeGreaterThan(
    0,
  );
});
