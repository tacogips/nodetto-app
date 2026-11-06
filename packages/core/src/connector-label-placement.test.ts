import {
  connectorArrangeDocument,
  CONNECTOR_ARRANGE_STATE_PAGE,
} from "../../../apps/cli/src/__fixtures__/connector-arrange.ts";
import { parseDocument } from "@nodetto/io";
import type { Document } from "@nodetto/ir";
import { expect, test } from "bun:test";
import {
  labelCandidatesForTest,
  labelRouteGapSquaredForTest,
  placeConnectorLabels,
  planLabelFixes,
  scoreLabelPlacementForTest,
  type LabelPlacementEdge,
  type LabelFields,
} from "./connector-label-placement.ts";
import {
  isLabelObstacle,
  labelOverlapScore,
  pageMetrics,
  resolvedLabelBox,
} from "./diagram-lint/metrics.ts";
import { createShapeContext } from "./hit-test.ts";
import { endpointReaderFor, resolveConnector } from "./shapes/connector.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import { pointAlongRoute } from "./shapes/connector/route.ts";
import { lintTextLayoutPage } from "./text-layout-lint/engine.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

const points = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
];
function edge(
  id: string,
  type = "edge.generic",
  semantic: Record<string, unknown> = { label: "Label" },
): LabelPlacementEdge {
  return {
    element: element({ id, type, semantic }),
    semantic,
    points,
    movable: true,
  };
}
const obstacle = (x: number, width = 4) => ({ x, y: -30, width, height: 60 });

test("uses legacy positions before expanded candidates", () => {
  const e = edge("a");
  expect(placeConnectorLabels({ edges: [e], obstacles: [] }).get("a")).toEqual(
    {},
  );
  expect(
    placeConnectorLabels({ edges: [e], obstacles: [obstacle(498)] }).get("a"),
  ).toEqual({ labelPosition: 0.35 });
  const blocked = [500, 350, 650, 200, 800, 100, 900].map((x) =>
    obstacle(x - 2),
  );
  expect(
    placeConnectorLabels({ edges: [e], obstacles: blocked }).get("a"),
  ).toEqual({ labelPosition: 0.45 });
});

test("offsets clear blocked positions and BPMN never uses offsets", () => {
  const obstacles = [{ x: -100, y: -20, width: 1200, height: 40 }];
  const result = placeConnectorLabels({ edges: [edge("a")], obstacles }).get(
    "a",
  );
  expect(Math.abs(result?.labelOffsetY ?? 0)).toBeGreaterThan(0);
  expect(Number.isInteger(result?.labelOffsetY)).toBe(true);
  const flow = edge("b", "bpmn.sequenceFlow", { name: "Label" });
  expect(placeConnectorLabels({ edges: [flow], obstacles }).get("b")).toEqual(
    {},
  );
});

test("offset candidates select the nearest free position on routes and loops", () => {
  for (const e of [
    edge("straight"),
    {
      ...edge("loop"),
      points: [
        { x: 0, y: 0 },
        { x: 0, y: -100 },
        { x: 100, y: -100 },
        { x: 100, y: 0 },
      ],
    },
  ]) {
    const obstacles =
      e.element.id === "straight"
        ? [{ x: -100, y: -20, width: 1200, height: 40 }]
        : [{ x: -10, y: -110, width: 120, height: 120 }];
    const candidates = labelCandidatesForTest(e);
    expect(labelCandidatesForTest(e)).toEqual(candidates);
    const boxFor = (fields: LabelFields) => {
      const point = pointAlongRoute(e.points, fields.labelPosition ?? 0.5);
      return resolvedLabelBox(e.element, e.points, {
        x: point.x + (fields.labelOffsetX ?? 0),
        y: point.y + (fields.labelOffsetY ?? 0),
      });
    };
    const chosen = placeConnectorLabels({ edges: [e], obstacles }).get(
      e.element.id,
    );
    expect(chosen).toBeDefined();
    if (!chosen) throw new Error("Missing placement");
    const chosenBox = boxFor(chosen);
    if (!chosenBox) throw new Error("Missing label box");
    const free = candidates
      .map(boxFor)
      .filter(
        (box): box is NonNullable<typeof box> =>
          !!box && labelOverlapScore(box, obstacles, [], []) === 0,
      );
    expect(free.length).toBeGreaterThan(0);
    const gap = labelRouteGapSquaredForTest(chosenBox, e.points);
    expect(gap).toBe(
      Math.min(
        ...free.map((box) => labelRouteGapSquaredForTest(box, e.points)),
      ),
    );
  }
  const flow = edge("flow", "bpmn.sequenceFlow", { name: "Label" });
  const candidates = labelCandidatesForTest(flow);
  expect(candidates).toHaveLength(19);
  expect(
    candidates.every(
      (candidate) =>
        candidate.labelOffsetX === undefined &&
        candidate.labelOffsetY === undefined,
    ),
  ).toBe(true);
});

test("reserves fixed labels and uses stable id order", () => {
  const a = edge("a");
  const b = edge("b");
  const first = placeConnectorLabels({ edges: [b, a], obstacles: [] });
  expect(first.get("a")).toEqual({});
  expect(first.get("b")).toEqual({ labelPosition: 0.35 });
  expect([...first]).toEqual([
    ...placeConnectorLabels({ edges: [a, b], obstacles: [] }),
  ]);
  const fixed = {
    ...a,
    movable: false,
    semantic: { label: "Label", labelOffsetX: 150 },
  };
  expect(
    placeConnectorLabels({
      edges: [fixed, b],
      obstacles: [obstacle(498), obstacle(348)],
    }).get("b"),
  ).toEqual({ labelPosition: 0.2 });
});

test("fixed BPMN bounds reserve space and empty labels are omitted", () => {
  const base = edge("fixed", "bpmn.sequenceFlow", { name: "Label" });
  const fixed = {
    ...base,
    element: {
      ...base.element,
      visual: {
        ...base.element.visual,
        labelBounds: { x: 480, y: -15, width: 40, height: 30 },
      },
    },
  };
  const result = placeConnectorLabels({
    edges: [fixed, edge("a"), edge("empty", "edge.generic", { label: "" })],
    obstacles: [],
  });
  expect(result.has("fixed")).toBe(false);
  expect(result.has("empty")).toBe(false);
  expect(result.get("a")).toEqual({ labelPosition: 0.35 });
});

test("clear document and sequence messages produce no fixes", () => {
  expect(planLabelFixes(document([]), TEST_PAGE.id)).toEqual([]);
  const left = element({
    id: "l",
    type: "sequence.participant",
    semantic: { name: "l" },
    visual: { x: 0, y: 0, width: 80, height: 400 },
  });
  const right = element({
    id: "r",
    type: "sequence.participant",
    semantic: { name: "r" },
    visual: { x: 500, y: 0, width: 80, height: 400 },
  });
  const block = element({
    id: "block",
    type: "node.generic",
    semantic: {},
    visual: { x: 200, y: -400, width: 40, height: 40 },
  });
  const block2 = element({
    id: "block2",
    type: "node.generic",
    semantic: {},
    visual: { x: 200, y: -200, width: 200, height: 800 },
  });
  const message = element({
    id: "msg",
    type: "sequence.message",
    semantic: { from: "l", to: "r", order: "a1", label: "Hello" },
  });
  const doc = document([left, right, block, block2, message]);
  const context = createShapeContext(
    new Store(doc),
    createDefaultRegistry(),
    1,
  );
  const route = resolveConnector(
    message,
    context,
    endpointReaderFor(message.type),
  );
  if (!route) throw new Error("message must have a route");
  const label = resolvedLabelBox(
    message,
    route.points,
    pointAlongRoute(route.points, 0.5),
  );
  if (!label) throw new Error("message must have a label box");
  const obstacles = [block, block2]
    .map((item) => context.boundsOf(item.id))
    .filter((box) => box != null);
  expect(labelOverlapScore(label, obstacles, [], [])).toBeGreaterThan(0);
  expect(planLabelFixes(doc, TEST_PAGE.id)).toEqual([]);
});

test("clear connector at a stored position needs no fix", () => {
  const left = element({
    id: "l",
    type: "node.generic",
    semantic: {},
    visual: { x: 0, y: 0, width: 40, height: 40 },
  });
  const right = element({
    id: "r",
    type: "node.generic",
    semantic: {},
    visual: { x: 500, y: 0, width: 40, height: 40 },
  });
  const connector = element({
    id: "e",
    type: "edge.generic",
    semantic: { from: "l", to: "r", label: "Label", labelPosition: 0.2 },
  });
  expect(
    planLabelFixes(document([left, right, connector]), TEST_PAGE.id),
  ).toEqual([]);
});

test("blocked BPMN candidates keep the earliest lowest score", () => {
  const flow = edge("flow", "bpmn.sequenceFlow", { name: "Label" });
  const obstacles = [
    { x: -100, y: -100, width: 1200, height: 200 },
    obstacle(498),
  ];
  expect(
    placeConnectorLabels({ edges: [flow], obstacles }).get("flow"),
  ).toEqual({ labelPosition: 0.35 });
});

test("plans a lower-collision fix and reaches a no-op after applying it", () => {
  const nodes = [
    element({
      id: "left",
      type: "node.generic",
      semantic: {},
      visual: { x: 0, y: 0, width: 40, height: 40 },
    }),
    element({
      id: "right",
      type: "node.generic",
      semantic: {},
      visual: { x: 500, y: 0, width: 40, height: 40 },
    }),
    element({
      id: "block",
      type: "node.generic",
      semantic: {},
      visual: { x: 250, y: 0, width: 40, height: 40 },
    }),
  ];
  const connector = element({
    id: "edge",
    type: "edge.generic",
    semantic: { from: "left", to: "right", label: "Label" },
  });
  const doc = document([...nodes, connector]);
  const fixes = planLabelFixes(doc, TEST_PAGE.id);
  expect(fixes).toHaveLength(1);
  const fix = fixes[0];
  if (!fix) throw new Error("missing fix");
  expect(fix.after).not.toEqual(fix.before);
  const store = new Store(doc);
  const context = createShapeContext(store, createDefaultRegistry(), 1);
  const route = resolveConnector(
    connector,
    context,
    endpointReaderFor(connector.type),
  );
  if (!route) throw new Error("missing connector route");
  const obstacles = nodes
    .filter(isLabelObstacle)
    .map((node) => context.boundsOf(node.id))
    .filter((box) => box != null);
  const scoreAt = (fields: LabelFields) => {
    const point = pointAlongRoute(route.points, fields.labelPosition ?? 0.5);
    const box = resolvedLabelBox(connector, route.points, {
      x: point.x + (fields.labelOffsetX ?? 0),
      y: point.y + (fields.labelOffsetY ?? 0),
    });
    if (!box) throw new Error("missing label box");
    return labelOverlapScore(box, obstacles, [], []);
  };
  expect(scoreAt(fix.after)).toBeLessThan(scoreAt(fix.before));
  const updated = {
    ...doc,
    elements: doc.elements.map((item) =>
      item.id === connector.id
        ? {
            ...item,
            semantic: {
              ...(item.semantic as Record<string, unknown>),
              ...fix.after,
            },
          }
        : item,
    ),
  };
  expect(planLabelFixes(updated, TEST_PAGE.id)).toEqual([]);
});

test("fast selection matches canonical overlap scoring including segment contacts", () => {
  const positions = [
    0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9, 0.45, 0.55, 0.4, 0.6, 0.3, 0.7, 0.25,
    0.75, 0.15, 0.85, 0.05, 0.95,
  ];
  const flow = edge("flow", "bpmn.sequenceFlow", { name: "Label" });
  const other = {
    ...edge("other", "edge.generic", { label: "" }),
    movable: false,
    points: [
      { x: 350, y: -20 },
      { x: 350, y: 20 },
      { x: 650, y: 20 },
      { x: 650, y: -20 },
    ],
  };
  for (const obstacles of [
    [],
    [obstacle(498)],
    [obstacle(498), obstacle(198), obstacle(798)],
  ]) {
    let best = 0.5;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const position of positions) {
      const box = resolvedLabelBox(
        flow.element,
        flow.points,
        pointAlongRoute(flow.points, position),
      );
      if (!box) throw new Error("missing label box");
      const value = labelOverlapScore(box, obstacles, [], [other.points]);
      if (value < bestScore) {
        bestScore = value;
        best = position;
      }
      if (value === 0) break;
    }
    expect(
      placeConnectorLabels({ edges: [flow, other], obstacles }).get("flow"),
    ).toEqual(best === 0.5 ? {} : { labelPosition: best });
  }
});

test("flattened scores equal the canonical metric for boxes and segments", () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const cases = [
    [
      { x: -5, y: 5 },
      { x: 15, y: 5 },
    ],
    [
      { x: -5, y: 0 },
      { x: 0, y: 0 },
    ],
    [
      { x: -1, y: 9 },
      { x: 9, y: 19 },
    ],
    [
      { x: 4, y: 4 },
      { x: 4, y: 4 },
      { x: 20, y: 20 },
    ],
    [
      { x: -10, y: -10 },
      { x: -5, y: -5 },
    ],
  ];
  const obstacles = [
    { x: 10, y: 0, width: 5, height: 5 },
    { x: 9, y: 9, width: 4, height: 4 },
  ];
  const labels = [
    { x: -1, y: -1, width: 2, height: 2 },
    { x: 0, y: 10, width: 5, height: 5 },
  ];
  for (const points of cases) {
    const other = { ...edge("other"), points };
    const own = {
      ...edge("own"),
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    };
    expect(
      scoreLabelPlacementForTest(box, "own", obstacles, labels, [other, own]),
    ).toBe(labelOverlapScore(box, obstacles, labels, [points]));
  }
});

test("second pass releases a previously blocked label after another moves", () => {
  const make = (id: string, x1: number, y: number, x2: number) => ({
    ...edge(id, "bpmn.sequenceFlow", { name: "Label" }),
    points: [
      { x: x1, y },
      { x: x2, y },
    ],
  });
  const edges = [
    make("a", 60, 40, 160),
    make("b", 60, 10, 190),
    make("c", 0, 30, 160),
    make("d", 15, 40, 205),
  ];
  const obstacles = [
    { x: 15, y: -10, width: 20, height: 40 },
    { x: 90, y: 0, width: 20, height: 40 },
    { x: 90, y: 30, width: 50, height: 40 },
  ];
  const [a, b, c, d] = edges;
  if (!a || !b || !c || !d) throw new Error("missing edge");
  const at = (e: LabelPlacementEdge, p: number) => {
    const box = resolvedLabelBox(
      e.element,
      e.points,
      pointAlongRoute(e.points, p),
    );
    if (!box) throw new Error("missing label");
    return box;
  };
  expect(
    labelOverlapScore(
      at(c, 0.35),
      obstacles,
      [at(a, 0.1), at(b, 0.65)],
      [a.points, b.points, d.points],
    ),
  ).toBe(1);
  const result = placeConnectorLabels({ edges, obstacles });
  expect(result.get("a")).toEqual({ labelPosition: 0.8 });
  expect(result.get("c")).toEqual({ labelPosition: 0.35 });
  const otherLabels = [a, b, d].map((e) =>
    at(e, result.get(e.element.id)?.labelPosition ?? 0.5),
  );
  expect(
    labelOverlapScore(
      at(c, result.get("c")?.labelPosition ?? 0.5),
      obstacles,
      otherLabels,
      [a.points, b.points, d.points],
    ),
  ).toBe(0);
});

function applyLabelFixes(
  doc: Document,
  fixes: ReturnType<typeof planLabelFixes>,
): Document {
  const byId = new Map(fixes.map((fix) => [fix.elementId, fix.after]));
  return {
    ...doc,
    elements: doc.elements.map((item) => {
      const after = byId.get(item.id);
      if (!after) return item;
      const semantic = { ...(item.semantic as Record<string, unknown>) };
      for (const key of [
        "labelPosition",
        "labelOffsetX",
        "labelOffsetY",
      ] as const) {
        if (after[key] === undefined) delete semantic[key];
        else semantic[key] = after[key];
      }
      return { ...item, semantic };
    }),
  };
}
function overlaps(doc: Document, pageId = TEST_PAGE.id): number {
  return pageMetrics(new Store(doc), pageId, createDefaultRegistry())
    .labelOverlaps;
}
test("combined fixes clear mutually blocking stored labels in one run", () => {
  const node = (id: string, x: number, y: number, width = 20, height = 20) =>
    element({
      id,
      type: "node.generic",
      semantic: {},
      visual: { x, y, width, height },
    });
  const doc = document([
    node("l1", 0, -10),
    node("r1", 1000, -10),
    node("l2", 0, 290),
    node("r2", 1000, 290),
    node("o1", 500, 276, 20, 6),
    node("o2", 500, -24, 20, 6),
    element({
      id: "a",
      type: "edge.generic",
      semantic: { from: "l1", to: "r1", label: "Label", labelOffsetY: 297 },
    }),
    element({
      id: "b",
      type: "edge.generic",
      semantic: { from: "l2", to: "r2", label: "Label", labelOffsetY: -303 },
    }),
  ]);
  expect(overlaps(doc)).toBe(2);
  expect(collisionCount(doc)).toBe(2);
  const fixes = planLabelFixes(doc, TEST_PAGE.id);
  expect(fixes.map((fix) => [fix.elementId, fix.after])).toEqual([
    ["a", { labelPosition: 0.35 }],
    ["b", { labelPosition: 0.35 }],
  ]);
  const updated = applyLabelFixes(doc, fixes);
  expect(overlaps(updated)).toBe(0);
  expect(collisionCount(updated)).toBe(0);
  expect(planLabelFixes(updated, TEST_PAGE.id)).toEqual([]);
});

test("seeded dense pages do not regress and need no second label plan", () => {
  let seed = 777;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let page = 0; page < 300; page++) {
    const count = 6 + Math.floor(random() * 8);
    const nodes = Array.from({ length: count }, (_, i) =>
      element({
        id: `n${i}`,
        type: "node.generic",
        semantic: {},
        visual: {
          x: Math.floor(random() * 500),
          y: Math.floor(random() * 500),
          width: 40,
          height: 30,
        },
      }),
    );
    const edgeCount = 8 + Math.floor(random() * 12);
    const edges = Array.from({ length: edgeCount }, (_, i) => {
      const from = Math.floor(random() * count);
      let to = Math.floor(random() * (count - 1));
      if (to >= from) to++;
      return element({
        id: `e${i}`,
        type: "edge.generic",
        semantic: {
          from: `n${from}`,
          to: `n${to}`,
          label: "Label",
          ...(i % 2 === 0
            ? { routing: "orthogonal", routingAvoidObstacles: true }
            : {}),
        },
      });
    });
    const doc = document([...nodes, ...edges]);
    const before = overlaps(doc);
    const updated = applyLabelFixes(doc, planLabelFixes(doc, TEST_PAGE.id));
    expect(overlaps(updated)).toBeLessThanOrEqual(before);
    expect(planLabelFixes(updated, TEST_PAGE.id)).toEqual([]);
  }
}, 120000);

test("connector fixture clears label overlaps in one plan", () => {
  const doc = parseDocument(connectorArrangeDocument());
  const page = doc.pages.find(
    (item) => item.name === CONNECTOR_ARRANGE_STATE_PAGE,
  );
  if (!page) throw new Error("missing state page");
  const updated = applyLabelFixes(doc, planLabelFixes(doc, page.id));
  expect(overlaps(updated, page.id)).toBe(0);
  expect(planLabelFixes(updated, page.id)).toEqual([]);
}, 120000);

test("rejects a final placement that does not improve its collision", () => {
  const node = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) =>
    element({
      id,
      type: "node.generic",
      semantic: {},
      visual: { x, y, width, height },
    });
  const doc = document([
    node("cover", -200, -400, 1400, 800),
    node("l", 0, -10, 20, 20),
    node("r", 1000, -10, 20, 20),
    element({
      id: "a",
      type: "edge.generic",
      semantic: { from: "l", to: "r", label: "Label", labelPosition: 0.2 },
    }),
  ]);
  const fixes = planLabelFixes(doc, TEST_PAGE.id);
  expect(fixes).toEqual([]);
  expect(planLabelFixes(applyLabelFixes(doc, fixes), TEST_PAGE.id)).toEqual([]);
});

function collisionCount(doc: Document): number {
  return lintTextLayoutPage(doc, TEST_PAGE.id).filter(
    (f) => f.ruleId === "label-collision",
  ).length;
}
function findingNode(
  id: string,
  x: number,
  y: number,
  width = 20,
  height = 20,
) {
  return element({
    id,
    type: "node.generic",
    semantic: {},
    visual: { x, y, width, height },
  });
}
function findingEdge(id: string, from: string, to: string) {
  return element({
    id,
    type: "edge.generic",
    semantic: { from, to, label: "Label" },
  });
}
for (const [name, doc] of [
  [
    "parallel edges",
    document([
      findingNode("l1", 0, -10),
      findingNode("r1", 1000, -10),
      findingNode("l2", 0, 8),
      findingNode("r2", 1000, 8),
      findingEdge("a", "l1", "r1"),
      findingEdge("b", "l2", "r2"),
    ]),
  ],
  [
    "node padding",
    document([
      findingNode("l", 0, -10),
      findingNode("r", 1000, -10),
      findingNode("box", 480, -60, 40, 42),
      findingEdge("a", "l", "r"),
    ]),
  ],
] as const) {
  test(`clears finding-only collision: ${name}`, () => {
    expect(collisionCount(doc)).toBeGreaterThan(0);
    expect(overlaps(doc)).toBe(0);
    const updated = applyLabelFixes(doc, planLabelFixes(doc, TEST_PAGE.id));
    expect(collisionCount(updated)).toBe(0);
    expect(overlaps(updated)).toBe(0);
    expect(planLabelFixes(updated, TEST_PAGE.id)).toEqual([]);
  });
}
test("sequence message contributes to the finding overlap gate", () => {
  const base = [
    findingNode("l", 0, -10),
    findingNode("r", 1000, -10),
    findingNode("box", 480, -60, 40, 42),
    findingEdge("a", "l", "r"),
    element({
      id: "p1",
      type: "sequence.participant",
      semantic: { name: "p1" },
      visual: { x: 300, y: -400, width: 80, height: 400 },
    }),
    element({
      id: "p2",
      type: "sequence.participant",
      semantic: { name: "p2" },
      visual: { x: 700, y: -400, width: 80, height: 400 },
    }),
  ];
  const message = element({
    id: "msg",
    type: "sequence.message",
    semantic: { from: "p1", to: "p2", order: "a1", label: "Message" },
    visual: { y: 0 },
  });
  const doc = document([...base, message]);
  expect(overlaps(doc)).toBeGreaterThan(overlaps(document(base)));
  const fixes = planLabelFixes(doc, TEST_PAGE.id);
  expect(fixes.some((fix) => fix.elementId === "msg")).toBe(false);
  const updated = applyLabelFixes(doc, fixes);
  expect(overlaps(updated)).toBeLessThanOrEqual(overlaps(doc));
  expect(planLabelFixes(updated, TEST_PAGE.id)).toEqual([]);
});

test("unclearable finding stays put", () => {
  const doc = document([
    findingNode("cover1", -200, -400, 700, 800),
    findingNode("cover2", 500, -400, 700, 800),
    findingNode("l", 0, -10),
    findingNode("r", 1000, -10),
    element({
      id: "a",
      type: "edge.generic",
      semantic: { from: "l", to: "r", label: "Label", labelPosition: 0.2 },
    }),
  ]);
  expect(collisionCount(doc)).toBeGreaterThan(0);
  const fixes = planLabelFixes(doc, TEST_PAGE.id);
  expect(fixes).toEqual([]);
  expect(planLabelFixes(applyLabelFixes(doc, fixes), TEST_PAGE.id)).toEqual([]);
});

test("seeded finding counts do not increase and reach a fixed point", () => {
  let seed = 777;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let totalBefore = 0;
  let totalAfter = 0;
  for (let page = 0; page < 300; page++) {
    const count = 6 + Math.floor(random() * 8);
    const nodes = Array.from({ length: count }, (_, i) =>
      element({
        id: `n${i}`,
        type: "node.generic",
        semantic: {},
        visual: {
          x: Math.floor(random() * 500),
          y: Math.floor(random() * 500),
          width: 40,
          height: 30,
        },
      }),
    );
    const edgeCount = 8 + Math.floor(random() * 12);
    const edges = Array.from({ length: edgeCount }, (_, i) => {
      const from = Math.floor(random() * count);
      let to = Math.floor(random() * (count - 1));
      if (to >= from) to++;
      return element({
        id: `e${i}`,
        type: "edge.generic",
        semantic: {
          from: `n${from}`,
          to: `n${to}`,
          label: "Label",
          ...(i % 2 === 0
            ? { routing: "orthogonal", routingAvoidObstacles: true }
            : {}),
        },
      });
    });
    const doc = document([...nodes, ...edges]);
    const before = overlaps(doc);
    const findingsBefore = collisionCount(doc);
    totalBefore += findingsBefore;
    const updated = applyLabelFixes(doc, planLabelFixes(doc, TEST_PAGE.id));
    expect(overlaps(updated)).toBeLessThanOrEqual(before);
    const findingsAfter = collisionCount(updated);
    totalAfter += findingsAfter;
    expect(findingsAfter).toBeLessThanOrEqual(findingsBefore);
    expect(planLabelFixes(updated, TEST_PAGE.id)).toEqual([]);
  }
  console.log(`seeded findings: ${totalBefore} -> ${totalAfter}`);
}, 120000);
