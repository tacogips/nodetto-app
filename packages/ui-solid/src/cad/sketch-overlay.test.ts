import { expect, test } from "bun:test";
import { baseFrame, tessellateCircle } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { sketchGridSegments, sketchOverlaySegments } from "./sketch-overlay.ts";

function entity(id: string, type: string, semantic: unknown): Element {
  return { id, type, semantic, index: "a1", page: "cad", visual: {} };
}

test("rectangle, circle and pending polyline use the sketch frame", () => {
  const rectangle = [
    [
      [0, 0],
      [6, 0],
    ],
    [
      [6, 0],
      [6, 4],
    ],
    [
      [6, 4],
      [0, 4],
    ],
    [
      [0, 4],
      [0, 0],
    ],
  ].map(([a, b], i) => entity(`edge-${i}`, "cad.line", { a, b }));
  const circle = entity("hole", "cad.circle", { c: [2, 2], r: 1 });
  const frame = baseFrame("yz", 5);
  const lines = sketchOverlaySegments(
    frame,
    [...rectangle, circle],
    [0, 0, 2, 3],
  );
  expect(lines.length / 6).toBe(4 + tessellateCircle([2, 2], 1).length / 2 + 1);
  expect(lines.every((value, i) => i % 3 !== 0 || value === 5)).toBe(true);
  expect([...lines.slice(-6)]).toEqual([5, 0, 0, 5, 2, 3]);
});

test("construction lines are dashed and the grid follows an offset plane", () => {
  const frame = baseFrame("zx", 2);
  const dashed = sketchOverlaySegments(frame, [
    entity("axis", "cad.line", {
      a: [0, 0],
      b: [10, 0],
      construction: true,
    }),
  ]);
  expect(dashed).toHaveLength(5 * 6);
  expect(dashed[5]).toBeCloseTo(1.2);
  expect(dashed[8]).toBe(2);
  const grid = sketchGridSegments(frame, [10, 2, 20], 15, 10);
  expect(grid.length).toBeGreaterThan(0);
  expect(grid.every((value, i) => i % 3 !== 1 || value === 2)).toBe(true);
});
