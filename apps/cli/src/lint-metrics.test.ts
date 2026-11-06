import { expect, test } from "bun:test";
import {
  document,
  element,
  TEST_PAGE,
} from "../../../packages/core/src/test-helpers.ts";
import { formatMetricsLines, lintMetrics } from "./lint-metrics.ts";

const nodes = [
  element({
    id: "a",
    type: "node.generic",
    semantic: {},
    visual: { x: 0, y: 0, width: 20, height: 20 },
  }),
  element({
    id: "b",
    type: "node.generic",
    semantic: {},
    visual: { x: 200, y: 200, width: 20, height: 20 },
  }),
  element({
    id: "c",
    type: "node.generic",
    semantic: {},
    visual: { x: 0, y: 200, width: 20, height: 20 },
  }),
  element({
    id: "d",
    type: "node.generic",
    semantic: {},
    visual: { x: 200, y: 0, width: 20, height: 20 },
  }),
];
const edges = [
  element({
    id: "one",
    type: "edge.generic",
    semantic: { from: "a", to: "b" },
  }),
  element({
    id: "two",
    type: "edge.generic",
    semantic: { from: "c", to: "d" },
  }),
];

test("metrics report crossing edges and omit pages with no connectors", () => {
  const emptyPage = { id: "empty", name: "Empty", kind: "freeform" as const };
  const doc = document([...nodes, ...edges], [TEST_PAGE, emptyPage]);
  const metrics = lintMetrics(doc, [emptyPage.id, TEST_PAGE.id]);
  expect(metrics.size).toBe(1);
  expect(metrics.get(TEST_PAGE.id)?.edgeCrossings).toBe(1);
  expect(formatMetricsLines(doc, metrics)).toContain("1 edge crossing(s)");
  expect(formatMetricsLines(doc, metrics)).not.toContain("Empty");
  expect(lintMetrics(doc, [emptyPage.id]).size).toBe(0);
});

test("metrics lines follow page order", () => {
  const first = {
    id: "p1",
    name: "First",
    kind: "freeform" as const,
    order: "a",
  };
  const second = {
    id: "p2",
    name: "Second",
    kind: "freeform" as const,
    order: "b",
  };
  const doc = document([], [second, first]);
  const metrics = new Map([
    [second.id, { edgeCrossings: 2, labelOverlaps: 3, segmentOverlaps: 4 }],
    [first.id, { edgeCrossings: 1, labelOverlaps: 0, segmentOverlaps: 0 }],
  ]);
  expect(formatMetricsLines(doc, metrics)).toBe(
    "metrics First: 1 edge crossing(s), 0 edge-label overlap(s), 0 overlapping segment pair(s)\nmetrics Second: 2 edge crossing(s), 3 edge-label overlap(s), 4 overlapping segment pair(s)",
  );
});

test("BPMN and ERD metrics are produced in page order", () => {
  const bpmn = { id: "bpmn", name: "Flow", kind: "bpmn" as const, order: "a" };
  const erd = { id: "erd", name: "Data", kind: "erd" as const, order: "b" };
  const items = [
    element({
      id: "a",
      page: bpmn.id,
      type: "bpmn.task",
      semantic: {},
      visual: { x: 0, y: 0, width: 80, height: 60 },
    }),
    element({
      id: "b",
      page: bpmn.id,
      type: "bpmn.task",
      semantic: {},
      visual: { x: 300, y: 0, width: 80, height: 60 },
    }),
    element({
      id: "flow",
      page: bpmn.id,
      type: "bpmn.sequenceFlow",
      semantic: { from: "a", to: "b", name: "Review" },
    }),
    element({
      id: "c",
      page: erd.id,
      type: "erd.table",
      semantic: { tableName: "widgets", columns: [] },
      visual: { x: 0, y: 0, width: 100, height: 100 },
    }),
    element({
      id: "d",
      page: erd.id,
      type: "erd.table",
      semantic: { tableName: "orders", columns: [] },
      visual: { x: 300, y: 0, width: 100, height: 100 },
    }),
    element({
      id: "relation",
      page: erd.id,
      type: "erd.relation",
      semantic: { from: { table: "c" }, to: { table: "d" } },
    }),
  ];
  const doc = document(items, [erd, bpmn]);
  const lines = formatMetricsLines(
    doc,
    lintMetrics(doc, [erd.id, bpmn.id]),
  ).split("\n");
  expect(lines).toHaveLength(2);
  expect(lines[0]).toStartWith("metrics Flow:");
  expect(lines[1]).toStartWith("metrics Data:");
});
