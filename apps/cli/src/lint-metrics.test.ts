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
    [second.id, { edgeCrossings: 2, labelOverlaps: 3 }],
    [first.id, { edgeCrossings: 1, labelOverlaps: 0 }],
  ]);
  expect(formatMetricsLines(doc, metrics)).toBe(
    "metrics First: 1 edge crossing(s), 0 edge-label overlap(s)\nmetrics Second: 2 edge crossing(s), 3 edge-label overlap(s)",
  );
});
