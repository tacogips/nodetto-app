import { describe, expect, test } from "bun:test";
import type { Box, Vec } from "./geometry.ts";
import {
  avoidOrthogonalObstacles,
  type RoutingObstacleSource,
  routedAttempts,
} from "./orthogonal-routing.ts";
import { createBoxIndex } from "./spatial-grid.ts";
import { seededRng } from "./test-helpers.ts";

function crossesInterior(from: Vec, to: Vec, box: Box): boolean {
  if (from.y === to.y)
    return (
      from.y > box.y &&
      from.y < box.y + box.height &&
      Math.max(from.x, to.x) > box.x &&
      Math.min(from.x, to.x) < box.x + box.width
    );
  return (
    from.x > box.x &&
    from.x < box.x + box.width &&
    Math.max(from.y, to.y) > box.y &&
    Math.min(from.y, to.y) < box.y + box.height
  );
}

describe("orthogonal obstacle routing", () => {
  const preferred = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 100 },
    { x: 100, y: 100 },
  ] as const;

  test("returns the preferred bend unchanged when every segment is clear", () => {
    expect(
      avoidOrthogonalObstacles(
        preferred,
        [{ x: 10, y: 20, width: 20, height: 20 }],
        "h",
      ),
    ).toBe(preferred);
  });

  test("finds a deterministic clearance path around a blocking layer", () => {
    const obstacle = { x: 40, y: 20, width: 20, height: 60 };
    const route = avoidOrthogonalObstacles(preferred, [obstacle], "h");
    expect(route).not.toEqual(preferred);
    expect(route[0]).toEqual(preferred[0]);
    expect(route.at(-1)).toEqual(preferred.at(-1));
    expect(route[1]?.y).toBe(0);
    expect(route.at(-2)?.y).toBe(100);
    expect(
      route
        .slice(1)
        .some((point, index) =>
          crossesInterior(route[index] as Vec, point, obstacle),
        ),
    ).toBe(false);
    expect(avoidOrthogonalObstacles(preferred, [obstacle], "h")).toEqual(route);
  });

  test("incorporates a second obstacle encountered by the first detour", () => {
    const obstacles = [
      { x: 40, y: 20, width: 20, height: 60 },
      { x: 20, y: 75, width: 20, height: 20 },
    ];
    const route = avoidOrthogonalObstacles(preferred, obstacles, "h");
    for (const obstacle of obstacles)
      expect(
        route
          .slice(1)
          .some((point, index) =>
            crossesInterior(route[index] as Vec, point, obstacle),
          ),
      ).toBe(false);
  });
});

test("cached routes survive unrelated moves and invalidate blocking obstacle changes", () => {
  const key = {};
  const preferred = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 100 },
    { x: 100, y: 100 },
  ];
  const blocker = { x: 40, y: 20, width: 20, height: 60 };
  const far = { x: 500, y: 500, width: 20, height: 20 };
  const route = avoidOrthogonalObstacles(preferred, [blocker, far], "h", key);
  expect(
    avoidOrthogonalObstacles(
      preferred,
      [blocker, { ...far, x: 600 }],
      "h",
      key,
    ),
  ).toBe(route);
  for (const obstacles of [
    [],
    [far],
    [blocker],
    [{ ...blocker, y: 10, height: 80 }],
    [blocker, { x: 20, y: 75, width: 20, height: 20 }],
    [far, blocker],
  ]) {
    expect(avoidOrthogonalObstacles(preferred, obstacles, "h", key)).toEqual(
      avoidOrthogonalObstacles(preferred, obstacles, "h"),
    );
  }
});

test("cached routing matches fresh routing across deterministic scene edits", () => {
  const key = {};
  let state = 12345;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  let obstacles: Box[] = Array.from({ length: 8 }, () => ({
    x: 10 + Math.floor(random() * 150),
    y: 10 + Math.floor(random() * 150),
    width: 10 + Math.floor(random() * 20),
    height: 10 + Math.floor(random() * 20),
  }));
  for (let i = 0; i < 60; i++) {
    const preferred = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 180 },
      { x: 180, y: 180 },
    ];
    if (i % 7 === 0) preferred[3] = { x: 180 + i, y: 180 };
    if (i % 5 === 0) obstacles = obstacles.slice().reverse();
    if (i % 3 === 0 || obstacles.length >= 8) obstacles = obstacles.slice(1);
    else
      obstacles.push({
        x: 10 + Math.floor(random() * 150),
        y: 10 + Math.floor(random() * 150),
        width: 20,
        height: 20,
      });
    const direction = i % 11 === 0 ? "v" : "h";
    expect(
      avoidOrthogonalObstacles(preferred, obstacles, direction, key),
    ).toEqual(avoidOrthogonalObstacles(preferred, obstacles, direction));
  }
});

describe("orthogonal routing over an obstacle source", () => {
  /** The same obstacles, answered by region the way a page index does. */
  function indexed(boxes: readonly Box[]): RoutingObstacleSource {
    const index = createBoxIndex(boxes);
    const all = boxes.map((box, order) => ({ order, box }));
    return {
      size: boxes.length,
      near: (region) =>
        index.query(region).map((position) => all[position] as (typeof all)[0]),
    };
  }

  test("routes exactly as it does over the plain list, cached or not", () => {
    const random = seededRng(5);
    let detours = 0;
    for (let round = 0; round < 400; round += 1) {
      const boxes: Box[] = Array.from(
        { length: 1 + Math.floor(random() * 40) },
        () => ({
          x: Math.floor(random() * 2000),
          y: Math.floor(random() * 2000),
          width: 20 + Math.floor(random() * 300),
          height: 20 + Math.floor(random() * 300),
        }),
      );
      const from = {
        x: Math.floor(random() * 2200) - 100,
        y: Math.floor(random() * 2200) - 100,
      };
      const to = {
        x: Math.floor(random() * 2200) - 100,
        y: Math.floor(random() * 2200) - 100,
      };
      const horizontal = random() < 0.5;
      const middle = horizontal ? (from.x + to.x) / 2 : (from.y + to.y) / 2;
      const preferred = horizontal
        ? [from, { x: middle, y: from.y }, { x: middle, y: to.y }, to]
        : [from, { x: from.x, y: middle }, { x: to.x, y: middle }, to];
      const direction = horizontal ? "h" : "v";
      const listKey = {};
      const sourceKey = {};
      // The second pass moves one obstacle and goes through cache validation.
      for (let pass = 0; pass < 2; pass += 1) {
        if (pass === 1) {
          const moved = Math.floor(random() * boxes.length);
          const box = boxes[moved] as Box;
          boxes[moved] = {
            ...box,
            x: box.x + Math.floor(random() * 400) - 200,
          };
        }
        const plain = avoidOrthogonalObstacles(preferred, boxes, direction);
        expect(
          avoidOrthogonalObstacles(preferred, boxes, direction, listKey),
        ).toEqual(plain);
        expect(
          avoidOrthogonalObstacles(
            preferred,
            indexed(boxes),
            direction,
            sourceKey,
          ),
        ).toEqual(plain);
        if (plain !== preferred) detours += 1;
      }
    }
    // The comparison is only worth something if routes actually detour.
    expect(detours).toBeGreaterThan(100);
  });

  test("looks only at obstacles near the paths it tries", () => {
    const boxes: Box[] = Array.from({ length: 2000 }, (_, position) => ({
      x: (position % 50) * 360,
      y: Math.floor(position / 50) * 300,
      width: 240,
      height: 176,
    }));
    const index = createBoxIndex(boxes);
    const all = boxes.map((box, order) => ({ order, box }));
    let visited = 0;
    const source: RoutingObstacleSource = {
      size: boxes.length,
      near(region) {
        const found = index.query(region);
        visited += found.length;
        return found.map((position) => all[position] as (typeof all)[0]);
      },
    };
    // From the gutter left of one table to the gutter right of the next.
    const route = avoidOrthogonalObstacles(
      [
        { x: 3590, y: 3050 },
        { x: 3900, y: 3050 },
        { x: 3900, y: 3100 },
        { x: 4210, y: 3100 },
      ],
      source,
      "h",
    );
    expect(route.length).toBeGreaterThan(2);
    expect(visited).toBeLessThan(200);
  });

  test("remembers the paths a cached search tried", () => {
    const key = {};
    expect(routedAttempts(key)).toBeNull();
    const preferred = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ];
    const route = avoidOrthogonalObstacles(
      preferred,
      [{ x: 40, y: 20, width: 20, height: 60 }],
      "h",
      key,
    );
    const attempts = routedAttempts(key);
    expect(attempts?.[0]).toBe(preferred);
    expect(attempts?.at(-1)).toEqual(route);
  });
});
