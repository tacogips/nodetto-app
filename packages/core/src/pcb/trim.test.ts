import { expect, test } from "bun:test";
import type { PcbDesign } from "./model.ts";
import { trimPcbToUsed } from "./trim.ts";

const design: PcbDesign = {
  width: 100,
  height: 60,
  rules: {
    pad: 1.8,
    maskOpening: 2,
    drill: 1,
    legendLine: 0.2,
    edgeLine: 0.1,
  },
  pads: [
    { at: { x: 20, y: 20 }, shape: "circle" },
    { at: { x: 30, y: 25 }, shape: "square" },
  ],
  topTraces: [
    {
      width: 0.5,
      points: [
        { x: 20, y: 20 },
        { x: 30, y: 25 },
      ],
    },
  ],
  bottomTraces: [],
  legend: [
    // Design legend sizes the outline.
    {
      points: [
        { x: 18, y: 28 },
        { x: 25, y: 28 },
      ],
    },
    // A label just inside the trimmed outline is kept ...
    {
      points: [
        { x: 21, y: 18.5 },
        { x: 22, y: 18.5 },
      ],
      group: 0,
    },
    // ... and one outside it is dropped whole.
    {
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      group: 1,
    },
    {
      points: [
        { x: 22, y: 18 },
        { x: 90, y: 50 },
      ],
      group: 1,
    },
  ],
};

test("trims to the used area plus margin and moves the origin", () => {
  const trimmed = trimPcbToUsed(design, {
    margin: 1,
    legendEdgeClearance: 0.2,
  });
  // Used x: 17.9 (legend) .. 31 (square mask); y: 19 (mask) .. 28.1 (legend).
  // Grouped strokes do not count. Plus 1 mm each side.
  expect(trimmed.width).toBe(15.1);
  expect(trimmed.height).toBe(11.1);
  expect(trimmed.pads.map((pad) => pad.at)).toEqual([
    { x: 3.1, y: 2 },
    { x: 13.1, y: 7 },
  ]);
  expect(trimmed.topTraces).toEqual([
    {
      width: 0.5,
      points: [
        { x: 3.1, y: 2 },
        { x: 13.1, y: 7 },
      ],
    },
  ]);
  expect(trimmed.legend).toEqual([
    {
      points: [
        { x: 1.1, y: 10 },
        { x: 8.1, y: 10 },
      ],
    },
    {
      points: [
        { x: 4.1, y: 0.5 },
        { x: 5.1, y: 0.5 },
      ],
      group: 0,
    },
  ]);
  expect(trimmed.rules).toBe(design.rules);
});

test("never grows past the original outline", () => {
  const trimmed = trimPcbToUsed(design, {
    margin: 100,
    legendEdgeClearance: 0.2,
  });
  expect([trimmed.width, trimmed.height]).toEqual([100, 60]);
  expect(trimmed.pads.map((pad) => pad.at)).toEqual(
    design.pads.map((pad) => pad.at),
  );
});

test("an empty design is returned as it is", () => {
  const empty = { ...design, pads: [], topTraces: [], legend: [] };
  expect(trimPcbToUsed(empty, { margin: 1, legendEdgeClearance: 0.2 })).toBe(
    empty,
  );
});
