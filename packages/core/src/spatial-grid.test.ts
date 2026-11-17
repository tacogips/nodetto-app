import { describe, expect, test } from "bun:test";
import type { Box } from "./geometry.ts";
import { createBoxIndex } from "./spatial-grid.ts";
import { seededRng } from "./test-helpers.ts";

function intersects(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

describe("box index", () => {
  test("answers every box a region touches, in ascending position", () => {
    const random = seededRng(11);
    const boxes: Box[] = Array.from({ length: 400 }, () => ({
      x: Math.floor(random() * 20000) - 4000,
      y: Math.floor(random() * 20000) - 4000,
      width: Math.floor(random() * 600),
      height: Math.floor(random() * 600),
    }));
    const index = createBoxIndex(boxes);
    expect(index.size).toBe(boxes.length);
    for (let round = 0; round < 300; round += 1) {
      const region = {
        x: Math.floor(random() * 22000) - 5000,
        y: Math.floor(random() * 22000) - 5000,
        // Thin regions are what an orthogonal segment asks about.
        width: round % 3 === 0 ? 0 : Math.floor(random() * 3000),
        height: round % 3 === 1 ? 0 : Math.floor(random() * 3000),
      };
      const found = index.query(region);
      expect([...found]).toEqual([...found].sort((a, b) => a - b));
      expect(new Set(found).size).toBe(found.length);
      const present = new Set(found);
      boxes.forEach((box, position) => {
        if (intersects(box, region)) expect(present.has(position)).toBe(true);
      });
    }
  });

  test("narrows a query on a large page to its neighbourhood", () => {
    const boxes: Box[] = Array.from({ length: 2000 }, (_, position) => ({
      x: (position % 50) * 360,
      y: Math.floor(position / 50) * 300,
      width: 240,
      height: 176,
    }));
    const found = createBoxIndex(boxes).query({
      x: 3600,
      y: 3000,
      width: 400,
      height: 0,
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThan(20);
  });

  test("keeps boxes it cannot place in every answer", () => {
    const boxes: Box[] = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: Number.NaN, y: 0, width: 10, height: 10 },
      { x: -1e9, y: -1e9, width: 2e9, height: 2e9 },
      { x: 5000, y: 5000, width: 10, height: 10 },
    ];
    const index = createBoxIndex(boxes);
    expect([...index.query({ x: 5000, y: 5000, width: 1, height: 1 })]).toEqual(
      [1, 2, 3],
    );
    expect([...index.query(null)]).toEqual([0, 1, 2, 3]);
    expect([
      ...index.query({
        x: 0,
        y: 0,
        width: Number.POSITIVE_INFINITY,
        height: 1,
      }),
    ]).toEqual([0, 1, 2, 3]);
  });
});
