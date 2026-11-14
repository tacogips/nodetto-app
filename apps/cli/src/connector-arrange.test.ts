import { expect, test } from "bun:test";
import { Editor, pageMetrics } from "@nodetto/core";
import { getElementTypeDefinition } from "@nodetto/ir";
import { labelRouteGapSquaredForTest } from "../../../packages/core/src/connector-label-placement.ts";
import {
  isLabelObstacle,
  labelOverlapScore,
  resolvedLabelBox,
  segmentOverlapsBox,
} from "../../../packages/core/src/diagram-lint/metrics.ts";
import {
  endpointReaderFor,
  resolveConnector,
} from "../../../packages/core/src/shapes/connector.ts";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { arrangeLayeredOrRoute } from "./arrange-modes.ts";
import { runCli } from "./commands.ts";
import { textLayoutProblemDocument } from "./__fixtures__/text-layout.ts";
import { connectorArrangeDocument } from "./__fixtures__/connector-arrange.ts";

test("layered and route fixture metrics and repeatability", () => {
  let text = connectorArrangeDocument();
  const io = {
    readText: () => text,
    writeText: (_path: string, value: string) => {
      text = value;
    },
  };
  const measure = () => {
    const editor = new Editor({ document: parseDocument(text) });
    const page = editor
      .getSnapshot()
      .pages.find((item) => item.name === "States");
    if (!page) throw new Error("Missing States page");
    return pageMetrics(editor.store, page.id, editor.registry);
  };
  const before = measure();
  const check = arrangeLayeredOrRoute(io, [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "layered",
    "--check",
  ]);
  expect(check.exitCode).toBe(1);
  expect(check.stderr).not.toContain("Moved ");
  const layered = arrangeLayeredOrRoute(io, [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "layered",
    "--write",
  ]);
  expect(layered.exitCode).toBe(0);
  expect(layered.stderr).toContain("Moved ");
  const route = arrangeLayeredOrRoute(io, [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "route",
    "--write",
  ]);
  expect(route.exitCode).toBe(0);
  const after = measure();
  console.log("fixture metrics", JSON.stringify({ before, after }));
  expect(after.edgeCrossings).toBeLessThanOrEqual(before.edgeCrossings);
  expect(after.segmentOverlaps).toBe(0);
  expect(after.labelOverlaps).toBe(0);
  const editor = new Editor({ document: parseDocument(text) });
  const page = editor
    .getSnapshot()
    .pages.find((item) => item.name === "States");
  if (!page) throw new Error("Missing States page");
  const context = editor.createShapeContext();
  let maximumGap = 0;
  for (const element of editor.store.getPageElements(page.id)) {
    if (getElementTypeDefinition(element.type)?.category !== "edge") continue;
    const resolved = resolveConnector(
      element,
      context,
      endpointReaderFor(element.type),
    );
    if (!resolved) continue;
    const box = resolvedLabelBox(element, resolved.points, resolved.labelPoint);
    if (!box) continue;
    const gap = labelRouteGapSquaredForTest(box, resolved.points);
    maximumGap = Math.max(maximumGap, Math.sqrt(gap));
    expect(gap).toBeLessThanOrEqual(
      (1.5 * Math.max(box.width, box.height) + 8) ** 2,
    );
  }
  console.log("fixture maximum label gap", maximumGap);
  const elements = editor.store.getPageElements(page.id);
  const obstacles = elements.filter(isLabelObstacle).map((element) => {
    const box = context.boundsOf(element.id);
    if (!box) throw new Error(`Missing bounds for ${element.id}`);
    return { id: element.id, box };
  });
  const edges = elements
    .filter(
      (element) => getElementTypeDefinition(element.type)?.category === "edge",
    )
    .map((element) => {
      const route = resolveConnector(
        element,
        context,
        endpointReaderFor(element.type),
      );
      if (!route) throw new Error(`Missing route for ${element.id}`);
      return {
        element,
        route,
        label: resolvedLabelBox(element, route.points, route.labelPoint),
      };
    });
  for (const edge of edges) {
    const data = edge.element.semantic as Record<string, unknown>;
    for (const obstacle of obstacles) {
      if (
        !obstacle.id.startsWith("state-") ||
        obstacle.id === data.from ||
        obstacle.id === data.to
      )
        continue;
      for (let i = 1; i < edge.route.points.length; i++) {
        const a = edge.route.points[i - 1];
        const b = edge.route.points[i];
        if (!a || !b) throw new Error("Missing route point");
        expect(segmentOverlapsBox(a, b, obstacle.box)).toBe(false);
      }
    }
    if (edge.element.id.startsWith("loop-")) {
      if (!edge.label) throw new Error(`Missing label for ${edge.element.id}`);
      const others = edges.filter((other) => other !== edge);
      const labels = others.flatMap((other) =>
        other.label ? [other.label] : [],
      );
      expect(
        labelOverlapScore(
          edge.label,
          obstacles.map((obstacle) => obstacle.box),
          labels,
          others.map((other) => other.route.points),
        ),
      ).toBe(0);
    }
  }

  expect(route.stderr).toContain("0 layer update(s)");
  expect(
    arrangeLayeredOrRoute(io, [
      "fixture.jsonl",
      "--page",
      "States",
      "--mode",
      "layered",
      "--check",
    ]).exitCode,
  ).toBe(0);
  const resetArgs = [
    "fixture.jsonl",
    "--page",
    "States",
    "--mode",
    "route",
    "--reset-manual",
    "--write",
  ];
  expect(arrangeLayeredOrRoute(io, resetArgs).exitCode).toBe(0);
  const firstReset = text;
  expect(arrangeLayeredOrRoute(io, resetArgs).exitCode).toBe(0);
  expect(text).toBe(firstReset);
});

test("lint fixes a forced fixture label overlap and is repeatable in JSON", () => {
  let text = connectorArrangeDocument();
  const io = {
    readText: () => text,
    writeText: (_path: string, value: string) => {
      text = value;
    },
  };
  for (const mode of ["layered", "route"]) {
    expect(
      arrangeLayeredOrRoute(io, [
        "fixture.jsonl",
        "--page",
        "States",
        "--mode",
        mode,
        "--write",
      ]).exitCode,
    ).toBe(0);
  }
  const editor = new Editor({ document: parseDocument(text) });
  const edge = editor.store.get("edge-00");
  const state = editor.store.get("state-00");
  if (!edge || !state) throw new Error("Missing fixture elements");
  const route = resolveConnector(
    edge,
    editor.createShapeContext(),
    endpointReaderFor(edge.type),
  );
  if (!route) throw new Error("Missing route");
  const document = editor.getSnapshot();
  text = serializeDocument({
    ...document,
    elements: document.elements.map((item) =>
      item.id === edge.id
        ? {
            ...item,
            semantic: {
              ...(item.semantic as Record<string, unknown>),
              labelOffsetX:
                (state.visual.x ?? 0) +
                (state.visual.width ?? 0) / 2 -
                route.labelPoint.x,
              labelOffsetY:
                (state.visual.y ?? 0) +
                (state.visual.height ?? 0) / 2 -
                route.labelPoint.y,
            },
          }
        : item,
    ),
  });
  const forced = new Editor({ document: parseDocument(text) });
  expect(
    pageMetrics(forced.store, edge.page, forced.registry).labelOverlaps,
  ).toBeGreaterThan(0);
  const args = [
    "lint",
    "fixture.jsonl",
    "--page",
    "States",
    "--fix",
    "--metrics",
    "--format",
    "json",
  ];
  const first = runCli(args, io, "test");
  expect(first.exitCode).toBe(0);
  const report = JSON.parse(first.stdout) as {
    fixes: { elementId: string }[];
    pages: {
      pageName: string;
      metrics: { labelOverlaps: number; segmentOverlaps: number };
    }[];
    summary: { metrics: { segmentOverlaps: number } };
  };
  expect(report.fixes.some((fix) => fix.elementId === edge.id)).toBe(true);
  expect(
    report.pages.find((page) => page.pageName === "States")?.metrics
      .labelOverlaps,
  ).toBe(0);
  expect(
    report.pages.find((page) => page.pageName === "States")?.metrics
      .segmentOverlaps,
  ).toBe(0);
  expect(report.summary.metrics.segmentOverlaps).toBe(0);
  const saved = text;
  const second = runCli(args, io, "test");
  expect(second.exitCode).toBe(0);
  expect(
    (JSON.parse(second.stdout) as { fixes: unknown[] }).fixes,
  ).toHaveLength(0);
  expect(text).toBe(saved);
});

test("lint fix removes architecture label-collision findings", () => {
  let text = textLayoutProblemDocument("architecture");
  const io = {
    readText: () => text,
    writeText: (_path: string, value: string) => {
      text = value;
    },
  };
  const args = [
    "lint",
    "doc.jsonl",
    "--page",
    "Architecture",
    "--format",
    "json",
  ];
  const collisions = (stdout: string) =>
    (
      JSON.parse(stdout) as { pages: { findings: { ruleId: string }[] }[] }
    ).pages
      .flatMap((page) => page.findings)
      .filter((finding) => finding.ruleId === "label-collision");
  const before = runCli(args, io, "test");
  expect(before.exitCode).toBe(0);
  expect(collisions(before.stdout).length).toBeGreaterThan(0);
  const fixed = runCli([...args, "--fix"], io, "test");
  expect(fixed.exitCode).toBe(0);
  expect(collisions(fixed.stdout)).toHaveLength(0);
});
