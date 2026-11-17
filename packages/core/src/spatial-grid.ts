// A uniform-grid index over axis-aligned boxes.
//
// Routing and picking ask "which boxes can this region touch?" for every
// connector on a page. Scanning every box per question makes a page's cost
// grow with the square of its size; the grid answers from the handful of
// cells a region covers. Answers are a superset: callers still run their own
// exact test on what comes back.

import type { Box } from "./geometry.ts";

export interface BoxIndex {
  /** How many boxes were indexed. */
  readonly size: number;
  /**
   * Positions (ascending, in the indexed array) of every box that may
   * intersect `region`. `null` asks for all of them.
   */
  query(region: Box | null): readonly number[];
}

const MIN_CELL = 64;
const MAX_CELL = 8192;
/** A box or query spanning more cells than this is handled without the grid. */
const MAX_CELLS = 2048;
/** Cell coordinates are packed into one number; this bounds each axis. */
const AXIS_RANGE = 1 << 20;

function finite(box: Box): boolean {
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height)
  );
}

export function createBoxIndex(boxes: readonly Box[]): BoxIndex {
  const all = boxes.map((_, position) => position);
  // Cells about twice the typical box keep each box in a few cells and each
  // cell to a few boxes, whatever units the page happens to use. The median
  // is the typical box: one page-sized shape must not coarsen the grid.
  const spans: number[] = [];
  for (const box of boxes)
    if (finite(box))
      spans.push(Math.max(Math.abs(box.width), Math.abs(box.height)));
  spans.sort((left, right) => left - right);
  const typical = spans[Math.floor(spans.length / 2)] ?? 0;
  const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, typical * 2));
  const cells = new Map<number, number[]>();
  /** Boxes too large, too far out or not finite: part of every answer. */
  const everywhere: number[] = [];
  const range = (
    box: Box,
  ): { x0: number; x1: number; y0: number; y1: number } | null => {
    if (!finite(box)) return null;
    const x0 = Math.floor(Math.min(box.x, box.x + box.width) / cell);
    const x1 = Math.floor(Math.max(box.x, box.x + box.width) / cell);
    const y0 = Math.floor(Math.min(box.y, box.y + box.height) / cell);
    const y1 = Math.floor(Math.max(box.y, box.y + box.height) / cell);
    if (
      x0 < -AXIS_RANGE ||
      y0 < -AXIS_RANGE ||
      x1 >= AXIS_RANGE ||
      y1 >= AXIS_RANGE ||
      (x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS
    )
      return null;
    return { x0, x1, y0, y1 };
  };
  const key = (x: number, y: number): number =>
    (x + AXIS_RANGE) * (2 * AXIS_RANGE) + (y + AXIS_RANGE);
  boxes.forEach((box, position) => {
    const covered = range(box);
    if (!covered) {
      everywhere.push(position);
      return;
    }
    for (let x = covered.x0; x <= covered.x1; x += 1)
      for (let y = covered.y0; y <= covered.y1; y += 1) {
        const at = key(x, y);
        const bucket = cells.get(at);
        if (bucket) bucket.push(position);
        else cells.set(at, [position]);
      }
  });
  const seen = new Uint32Array(boxes.length);
  let stamp = 0;
  return {
    size: boxes.length,
    query(region) {
      if (region === null) return all;
      const covered = range(region);
      if (!covered) return all;
      stamp += 1;
      if (stamp === 0xffffffff) {
        seen.fill(0);
        stamp = 1;
      }
      const found: number[] = [];
      for (const position of everywhere) {
        seen[position] = stamp;
        found.push(position);
      }
      for (let x = covered.x0; x <= covered.x1; x += 1)
        for (let y = covered.y0; y <= covered.y1; y += 1) {
          const bucket = cells.get(key(x, y));
          if (!bucket) continue;
          for (const position of bucket) {
            if (seen[position] === stamp) continue;
            seen[position] = stamp;
            found.push(position);
          }
        }
      return found.sort((left, right) => left - right);
    },
  };
}
