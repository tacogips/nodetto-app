import { expect, test } from "bun:test";
import { baseFrame } from "@nodetto/core";
import { isOnCadGrid } from "@nodetto/ir";
import { intersectSketch, snapSketchPoint } from "./sketch-snap.ts";

test("snap priority is nearest endpoint, then anchor axis, then grid", () => {
  const context = { grid: 1, tolerance: 0.3, anchor: [0, 1.25] as const };
  expect(
    snapSketchPoint([2.1, 1.2], {
      ...context,
      endpoints: [
        [2.25, 1.2],
        [2.02, 1.23],
      ],
    }),
  ).toEqual({ p: [2.02, 1.23], kind: "endpoint" });
  expect(snapSketchPoint([2.1, 1.2], { ...context, endpoints: [] })).toEqual({
    p: [2, 1.25],
    kind: "axis",
  });
  expect(
    snapSketchPoint([2.12, -1.29], {
      grid: 0.1,
      endpoints: [],
      tolerance: 0.02,
    }),
  ).toEqual({
    p: [2.1, -1.3],
    kind: "grid",
  });
  expect(
    snapSketchPoint([0.1234567, 0.1234567], {
      grid: 1,
      endpoints: [[0.1234567, 0.1234567]],
      tolerance: 0.1,
    }).p.every(isOnCadGrid),
  ).toBe(true);
});

test("rays project onto an offset side plane in the frame's axes", () => {
  const frame = baseFrame("yz", 5);
  expect(
    intersectSketch(frame, { origin: [8, 3, -7], dir: [-1, 0, 0] }),
  ).toEqual([3, -7]);
  expect(
    intersectSketch(frame, { origin: [8, 3, -7], dir: [1, 0, 0] }),
  ).toBeNull();
  expect(
    intersectSketch(frame, { origin: [8, 3, -7], dir: [0, 1, 0] }),
  ).toBeNull();
});
