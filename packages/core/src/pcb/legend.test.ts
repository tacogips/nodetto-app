import { describe, expect, test } from "bun:test";
import { strokeText } from "./font.ts";
import {
  boxClearOfKeepouts,
  clipLegendStroke,
  type LegendRect,
} from "./legend.ts";
import type { PcbPoint } from "./model.ts";

const largeRect: LegendRect = {
  minX: -100,
  minY: -100,
  maxX: 100,
  maxY: 100,
};

describe("PCB legend clipping", () => {
  test("keeps uncut 1/6 mm glyph strokes unchanged, even above minLength", () => {
    const glyphs = strokeText("25", 66.04, 45.72, 1);
    const clipped = glyphs.map((stroke) =>
      clipLegendStroke(
        stroke,
        largeRect,
        [{ x: -50, y: -50, radius: 1 }],
        0.18,
      ),
    );
    expect(clipped).toEqual(glyphs.map((stroke) => [stroke]));
  });

  test("cuts a segment around a keepout circle", () => {
    const result = clipLegendStroke(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      largeRect,
      [{ x: 5, y: 0, radius: 1 }],
      0,
    );
    expect(result).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      [
        { x: 6, y: 0 },
        { x: 10, y: 0 },
      ],
    ]);
  });

  test("does not rejoin across an original vertex inside a keepout", () => {
    const result = clipLegendStroke(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
      largeRect,
      [{ x: 5, y: 0, radius: 1 }],
      0,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(result[1]?.[0]).toEqual({ x: 5, y: 1 });
    expect(result[1]?.[1]).toEqual({ x: 5, y: 5 });
  });

  test("rejoins an untouched following segment at its original vertex", () => {
    const start = { x: 0, y: 0 };
    const vertex = { x: 5, y: 0 };
    const end = { x: 5, y: 5 };
    const points = [start, vertex, end];
    const result = clipLegendStroke(
      points,
      largeRect,
      [{ x: 1, y: 0, radius: 0.5 }],
      0,
    );
    expect(result).toEqual([
      [start, { x: 0.5, y: 0 }],
      [{ x: 1.5, y: 0 }, vertex, end],
    ]);
  });

  test("filters only cut strokes below minLength", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
    ];
    const keepout = [{ x: 0.2, y: 0, radius: 0.15 }];
    expect(clipLegendStroke(points, largeRect, keepout, 0.18)).toEqual([]);
    expect(clipLegendStroke(points, largeRect, keepout, 0.05)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0.05, y: 0 },
      ],
    ]);
    expect(clipLegendStroke(points, largeRect, [], 0.18)).toEqual([points]);
  });

  test("clips to the rectangle and treats its border as inside", () => {
    const result = clipLegendStroke(
      [
        { x: -1, y: 0 },
        { x: 2, y: 0 },
      ],
      { minX: 0, minY: -1, maxX: 3, maxY: 1 },
      [],
      0,
    );
    expect(result).toEqual([
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    ]);
  });

  test("drops fully covered and outside strokes, and retains clear zero-length segments", () => {
    expect(
      clipLegendStroke(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        largeRect,
        [{ x: 0.5, y: 0, radius: 1 }],
        0,
      ),
    ).toEqual([]);
    expect(
      clipLegendStroke(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        largeRect,
        [],
        0,
      ),
    ).toEqual([
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
    ]);
    expect(
      clipLegendStroke(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        largeRect,
        [{ x: 1, y: 1, radius: 0.1 }],
        0,
      ),
    ).toEqual([]);
  });

  test("merges overlapping keepout intervals into one gap", () => {
    const result = clipLegendStroke(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      largeRect,
      [
        { x: 4, y: 0, radius: 1 },
        { x: 5.5, y: 0, radius: 1 },
      ],
      0,
    );
    expect(result).toEqual([
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      [
        { x: 6.5, y: 0 },
        { x: 10, y: 0 },
      ],
    ]);
  });

  test("keeps a tangent stroke unchanged", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(
      clipLegendStroke(points, largeRect, [{ x: 5, y: 1, radius: 1 }], 0.18),
    ).toEqual([points]);
  });

  test("handles a keepout tangent to a rectangle-clipped endpoint", () => {
    const points = [
      { x: -1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(
      clipLegendStroke(
        points,
        { minX: 0, minY: -1, maxX: 3, maxY: 1 },
        [{ x: 0, y: 1, radius: 1 }],
        0,
      ),
    ).toEqual([
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    ]);
  });

  test("checks box clearance at and around the circle boundary", () => {
    const box = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    expect(boxClearOfKeepouts(box, [{ x: -1.01, y: 0, radius: 1 }])).toBe(true);
    expect(boxClearOfKeepouts(box, [{ x: -0.99, y: 0, radius: 1 }])).toBe(
      false,
    );
    expect(boxClearOfKeepouts(box, [{ x: 0.5, y: 0.5, radius: 0 }])).toBe(true);
    expect(boxClearOfKeepouts(box, [{ x: 0.5, y: 0.5, radius: 0.01 }])).toBe(
      false,
    );
    expect(boxClearOfKeepouts(box, [{ x: -1, y: 0, radius: 1 }])).toBe(true);
  });
});

const _typeCheckPoint: PcbPoint = { x: 0, y: 0 };
void _typeCheckPoint;
