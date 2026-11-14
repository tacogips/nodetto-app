import { expect, test } from "bun:test";
import { CONNECTOR_PORTS } from "@nodetto/ir";
import { generateInterfaceCode } from "./interface-code.ts";
import { findShape } from "./shape-catalogue.ts";
import { connectionPorts } from "./shapes/connector.ts";
import { geoOutline } from "./shapes/geo-outline.ts";
import { renderPageSvg } from "./svg-export.ts";
import { makeEditor, TEST_PAGE } from "./test-helpers.ts";
import { creationFor, Tool } from "./tools.ts";

test("actor geometry stays inset and mirrors head and limbs", () => {
  const normal = geoOutline("actor", 60, 110);
  const flipped = geoOutline("actor", 60, 110, { x: true, y: true });
  if (normal.kind !== "polygon" || flipped.kind !== "polygon")
    throw new Error("expected polygon");
  const points = normal.points
    .split(" ")
    .map((pair) => pair.split(",").map(Number));
  const mirror = flipped.points
    .split(" ")
    .map((pair) => pair.split(",").map(Number));
  expect(points.length).toBeGreaterThanOrEqual(12);
  points.forEach(([x, y], i) => {
    expect(x).toBeGreaterThanOrEqual(1);
    expect(x).toBeLessThanOrEqual(59);
    expect(y).toBeGreaterThanOrEqual(1);
    expect(y).toBeLessThanOrEqual(109);
    expect(mirror[i]?.[0]).toBeCloseTo(60 - x!);
    expect(mirror[i]?.[1]).toBeCloseTo(110 - y!);
  });
  expect(normal.detail?.startsWith("M")).toBe(true);
  const coords = normal.detail!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  coords.forEach((n, i) => {
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(i % 2 === 0 ? 59 : 109);
  });
});

test("actor uses its box for picking and ports, exports and creation", () => {
  const editor = makeEditor();
  const id = editor.createElement("shape.geo", {
    semantic: { geo: "actor", label: "Guest" },
    visual: { x: 100, y: 100, width: 60, height: 110 },
  });
  const actor = editor.store.get(id)!;
  const context = editor.createShapeContext();
  const util = editor.registry.getOrFallback("shape.geo");
  expect(util.hitTest(actor, { x: 105, y: 200 }, context)).toBe(true);
  expect(util.hitTest(actor, { x: 99, y: 200 }, context)).toBe(false);
  const ports = connectionPorts(actor, context);
  expect(ports.map((port) => port.id)).toEqual([...CONNECTOR_PORTS]);
  for (const { point } of ports) {
    expect(
      point.x === 100 || point.x === 160 || point.y === 100 || point.y === 210,
    ).toBe(true);
  }
  const svg = renderPageSvg(editor.store, editor.registry, TEST_PAGE.id)!;
  expect(svg).toContain("<polygon");
  expect(svg).toContain('fill="none"');
  expect(svg).toContain("Guest");
  expect(findShape("geo:actor")).toMatchObject({
    label: "Stick figure",
    category: "general",
  });
  expect(creationFor(Tool.StickFigure)).toEqual({
    type: "shape.geo",
    semantic: { geo: "actor", label: "" },
    visual: { width: 60, height: 110 },
  });
  const frame = editor.createElement("frame", {
    semantic: { name: "Screen", memberIds: [id] },
    visual: { x: 0, y: 0, width: 300, height: 300 },
  });
  expect(generateInterfaceCode(editor, frame)?.css).not.toContain("clip-path");
});
