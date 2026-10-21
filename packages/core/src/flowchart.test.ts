import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  availableMermaidKinds,
  exportMermaid,
  parseDocument,
  serializeDocument,
} from "@nodetto/io";
import { makeEditor } from "./test-helpers.ts";
import { resolveConnector, readDirectEndpoints } from "./shapes/connector.ts";

test("flowchart pages use editable orthogonal arrows and persist/export branch labels", () => {
  const editor = makeEditor();
  editor.setPageKind(editor.currentPageId, "flowchart");
  const start = editor.createElement("shape.geo", {
    semantic: { geo: "ellipse", label: "Start" },
    visual: { x: 0, y: 0 },
  });
  const decision = editor.createElement("shape.geo", {
    semantic: { geo: "diamond", label: "Ready?" },
    visual: { x: 300, y: 200 },
  });
  const edge = editor.connectSmart(start, decision)!;
  editor.setText(edge, "Yes");
  expect(editor.store.get(edge)?.semantic).toMatchObject({
    routing: "orthogonal",
    label: "Yes",
  });
  const route = resolveConnector(
    editor.store.get(edge)!,
    editor.createShapeContext(),
    readDirectEndpoints,
  )!;
  expect(route.points.length).toBeGreaterThan(2);
  for (let i = 1; i < route.points.length; i++)
    expect(
      route.points[i]!.x === route.points[i - 1]!.x ||
        route.points[i]!.y === route.points[i - 1]!.y,
    ).toBe(true);
  const saved = serializeDocument(editor.getSnapshot());
  expect(serializeDocument(parseDocument(saved))).toBe(saved);
  expect(
    availableMermaidKinds(editor.getSnapshot(), editor.currentPageId),
  ).toContain("flowchart");
  const report = exportMermaid(
    editor.getSnapshot(),
    editor.currentPageId,
    "flowchart",
  );
  expect(report.code).toContain('(["Start"])');
  expect(report.code).toContain('{"Ready?"}');
  expect(report.code).toContain('-->|"Yes"|');
  expect(editor.exportPageSvg()).toContain("Yes");
});

test("the flowchart fixture exports its full decision and retry graph", () => {
  const input = parseDocument(
    readFileSync(
      new URL("../../io/src/__fixtures__/flowchart.jsonl", import.meta.url),
      "utf8",
    ),
  );
  const report = exportMermaid(input, "p1", "flowchart");
  expect(report.elementCount).toBe(7);
  expect(report.relationCount).toBe(7);
  expect(report.code).toContain('[/"Read request"/]');
  expect(report.code).toContain('[("Save result")]');
  expect(report.code).toContain('-->|"No"|');
  expect(report.code).toContain('-->|"Retry"|');
  expect(report.warnings).toEqual([]);
});
