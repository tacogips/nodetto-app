import { describe, expect, test } from "bun:test";
import type { PcbFootprintSemantic, PcbPad } from "@nodetto/ir";
import {
  PcbGrid,
  arcCenter,
  boardToFootprint,
  expandCopperLayers,
  footprintToBoard,
  outlineBounds,
  outlineContains,
  padCopperOutline,
  pcbAnchor,
  translatePcbSemantic,
} from "./geometry.ts";

const fp = { at: [4, 3] as const, rotation: 90 };
const rectPad: PcbPad = {
  number: "1",
  type: "smd",
  shape: "rect",
  at: [0, 0],
  rotation: 0,
  size: [2, 1],
  layers: ["F.Cu"],
  net: "",
};

describe("PCB geometry", () => {
  test("round trips footprint transforms", () => {
    for (const rotation of [0, 45, 90, 30]) {
      const transform = { at: [4, 3] as const, rotation };
      const result = boardToFootprint(
        transform,
        footprintToBoard(transform, [1, -2]),
      );
      expect(result[0]).toBeCloseTo(1, 9);
      expect(result[1]).toBeCloseTo(-2, 9);
    }
  });
  test("builds pad outlines and contains interior, exterior and edge points", () => {
    const box = outlineBounds(padCopperOutline(fp, rectPad));
    expect(box.maxX - box.minX).toBeCloseTo(1);
    expect(box.maxY - box.minY).toBeCloseTo(2);
    const rect = padCopperOutline({ at: [0, 0], rotation: 45 }, rectPad);
    expect(outlineContains(rect, [0, 0])).toBe(true);
    expect(outlineContains(rect, [4, 4])).toBe(false);
    expect(outlineContains(rect, [0, Math.SQRT1_2])).toBe(true);
  });
  test("contains circle, oval and roundrect outlines", () => {
    for (const shape of ["circle", "oval", "roundrect"] as const) {
      const pad: PcbPad = { ...rectPad, shape, size: [2, 1] };
      const outline = padCopperOutline({ at: [0, 0], rotation: 0 }, pad);
      expect(outlineContains(outline, [0, 0])).toBe(true);
      expect(outlineContains(outline, [5, 5])).toBe(false);
    }
  });
  test("computes bounds and containment for a vertical oval", () => {
    const pad: PcbPad = { ...rectPad, shape: "oval", size: [1, 3] };
    const transform = { at: [0, 0] as const, rotation: 0 };
    const outline = padCopperOutline(transform, pad);
    expect(outlineBounds(outline)).toEqual({
      minX: -0.5,
      minY: -1.5,
      maxX: 0.5,
      maxY: 1.5,
    });
    for (const point of [
      [0, -1.4],
      [0, -0.6],
      [0, 0],
      [0, 1.4],
    ] as const) {
      expect(outlineContains(outline, point)).toBe(true);
    }
    expect(outlineContains(outline, [0, -1.6])).toBe(false);
    expect(outlineContains(outline, [0.6, 0])).toBe(false);

    const rotated = { at: [0, 0] as const, rotation: 45 };
    expect(
      outlineContains(
        padCopperOutline(rotated, pad),
        footprintToBoard(rotated, [0, -1.4]),
      ),
    ).toBe(true);
  });
  test("computes arc centers and exact quarter-arc bounds", () => {
    const center = arcCenter([1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1]);
    expect(center?.[0]).toBeCloseTo(0);
    expect(center?.[1]).toBeCloseTo(0);
    expect(arcCenter([0, 0], [1, 1], [2, 2])).toBeUndefined();
    const box = outlineBounds({
      kind: "contour",
      start: [1, 0],
      segments: [{ to: [0, -1], arc: { center: [0, 0], clockwise: false } }],
    });
    expect(box.maxX).toBe(1);
    expect(box.maxY).toBe(0);
  });
  test("expands copper layers and queries grid without duplicates", () => {
    expect(expandCopperLayers(["*.Cu"], ["F.Cu", "In1.Cu", "B.Cu"])).toEqual([
      "F.Cu",
      "In1.Cu",
      "B.Cu",
    ]);
    expect(expandCopperLayers(["F&B.Cu"], ["F.Cu", "In1.Cu", "B.Cu"])).toEqual([
      "F.Cu",
      "B.Cu",
    ]);
    const grid = new PcbGrid<number>(1);
    for (let i = 0; i < 1000; i++)
      grid.insert(i, { minX: 0, minY: 0, maxX: 2, maxY: 2 });
    expect(grid.query({ minX: 1, minY: 1, maxX: 1, maxY: 1 })).toHaveLength(
      1000,
    );
  });
  test("resolves anchors and translates zone geometry to nm", () => {
    const zone = {
      layers: ["F.Cu"],
      net: "GND",
      outline: [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      filled: [
        {
          layer: "F.Cu",
          polygons: [
            [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
          ],
        },
      ],
    };
    const moved = translatePcbSemantic("pcb.zone", zone, 1.0000004, 2);
    expect(moved["outline"]).toEqual([
      [1, 2],
      [2, 2],
      [1, 3],
    ]);
    expect(pcbAnchor("pcb.zone", zone)?.[0]).toBe(0);
    const footprint: PcbFootprintSemantic = {
      reference: "R1",
      value: "",
      library: "",
      at: [0, 0],
      rotation: 0,
      side: "top",
      pads: [],
      graphics: [],
    };
    expect(
      pcbAnchor(
        "pcb.footprint",
        footprint as unknown as Record<string, unknown>,
      ),
    ).toEqual([0, 0]);
  });
});
