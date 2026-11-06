import { expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import { planRouteLanes } from "./arrange-route-lanes.ts";
import { countRouteOverlaps } from "./diagram-lint/metrics.ts";
import { endpointReaderFor, resolveConnector } from "./shapes/connector.ts";

test("lane search is deterministic and keeps an isolated route unchanged", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 150, width: 80, height: 80 },
  });
  const ids = ["a", "b", "c"].map((id, index) =>
    editor.createElement("edge.generic", {
      id,
      semantic: {
        from: a,
        to: b,
        routing: "orthogonal",
        fromPort: "right",
        toPort: "left",
        fromPortPosition: 0.2 + index * 0.3,
        toPortPosition: 0.2 + index * 0.3,
      },
    }),
  );
  const edges = ids.map((id) => {
    const element = editor.store.get(id);
    if (!element) throw new Error("Missing edge");
    return { element, movable: true };
  });
  const context = editor.createShapeContext();
  expect(planRouteLanes(edges.slice(0, 1), context).size).toBe(0);
  expect([...planRouteLanes(edges, context)]).toEqual([
    ...planRouteLanes([...edges].reverse(), context),
  ]);
  expect(planRouteLanes(edges, context).size).toBeGreaterThan(0);
  const patches = planRouteLanes(edges, context);
  expect(
    new Set(
      edges.map(({ element }) => patches.get(element.id)?.routingLane ?? 0),
    ).size,
  ).toBe(3);
  const routes = edges.map(({ element }) =>
    resolveConnector(
      {
        ...element,
        semantic: {
          ...(element.semantic as Record<string, unknown>),
          ...patches.get(element.id),
        },
      },
      context,
      endpointReaderFor(element.type),
    ),
  );
  for (let i = 0; i < routes.length; i++)
    for (let j = i + 1; j < routes.length; j++) {
      const first = routes[i];
      const second = routes[j];
      if (!first || !second) throw new Error("Missing route");
      expect(countRouteOverlaps(first.points, second.points)).toBe(0);
    }
});

test("fixed routes and custom bends participate in the bounded search", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 150, width: 80, height: 80 },
  });
  editor.createElement("node.generic", {
    visual: { x: 150, y: 60, width: 50, height: 90 },
  });
  const ids = Array.from({ length: 12 }, (_, index) =>
    editor.createElement("edge.generic", {
      id: `edge-${String(index).padStart(2, "0")}`,
      semantic: {
        from: a,
        to: b,
        routing: "orthogonal",
        fromPort: "right",
        toPort: "left",
        fromPortPosition: 0.2 + (index % 3) * 0.3,
        toPortPosition: 0.2 + (index % 3) * 0.3,
        routingBend: 0.3,
      },
    }),
  );
  const edges = ids.map((id, index) => {
    const element = editor.store.get(id);
    if (!element) throw new Error("Missing edge");
    return { element, movable: index !== 0 };
  });
  const fixed = edges[0];
  if (!fixed) throw new Error("Missing fixed edge");
  const before = JSON.stringify(fixed.element.semantic);
  const patches = planRouteLanes(edges, editor.createShapeContext());
  expect(patches.has(fixed.element.id)).toBe(false);
  expect(JSON.stringify(fixed.element.semantic)).toBe(before);
  expect(patches.size).toBeGreaterThan(0);
  for (const { element } of edges) {
    const patch = patches.get(element.id);
    if (!patch) continue;
    expect(patch.routingLane).toBeGreaterThan(0);
    expect(patch.routingLane).toBeLessThanOrEqual(8);
    if (patch.routingBend !== undefined && patch.routingLane !== undefined) {
      const base = resolveConnector(
        element,
        editor.createShapeContext(),
        endpointReaderFor(element.type),
      );
      if (!base?.bendAxis) throw new Error("Missing bend axis");
      const span = Math.abs(
        base.end[base.bendAxis] - base.start[base.bendAxis],
      );
      const k = patch.routingLane;
      const expected =
        Math.round(
          Math.max(
            0,
            Math.min(1, 0.3 + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8) / span),
          ) * 10000,
        ) / 10000;
      expect(patch.routingBend).toBe(expected);
    }
  }
});

test("saturated lanes choose the lowest overlap count and earliest tied candidate", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 150, width: 80, height: 80 },
  });
  const id = editor.createElement("edge.generic", {
    id: "movable",
    semantic: {
      from: a,
      to: b,
      routing: "orthogonal",
      fromPort: "right",
      toPort: "left",
      routingBend: 0.3,
    },
  });
  const element = editor.store.get(id);
  if (!element) throw new Error("Missing movable edge");
  const context = editor.createShapeContext();
  const semantic = element.semantic as Record<string, unknown>;
  const base = resolveConnector(
    element,
    context,
    endpointReaderFor(element.type),
  );
  if (!base?.bendAxis) throw new Error("Missing bend axis");
  const span = Math.abs(base.end[base.bendAxis] - base.start[base.bendAxis]);
  const candidates = Array.from({ length: 9 }, (_, k) => {
    const bend =
      Math.round(
        Math.max(
          0,
          Math.min(1, 0.3 + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8) / span),
        ) * 10000,
      ) / 10000;
    const patch = k === 0 ? {} : { routingLane: k, routingBend: bend };
    const candidate = { ...element, semantic: { ...semantic, ...patch } };
    const resolved = resolveConnector(
      candidate,
      context,
      endpointReaderFor(candidate.type),
    );
    if (!resolved) throw new Error("Missing candidate route");
    return { candidate, resolved };
  });
  const fixed = candidates.map(({ candidate }, k) => ({
    element: { ...candidate, id: `fixed-${k}` },
    movable: false,
  }));
  const scores = candidates.map(({ resolved }) =>
    candidates.reduce(
      (sum, other) =>
        sum + countRouteOverlaps(resolved.points, other.resolved.points),
      0,
    ),
  );
  const minimum = Math.min(...scores);
  const firstMinimum = scores.indexOf(minimum);
  expect(minimum).toBeGreaterThan(0);
  expect(scores.filter((score) => score === minimum).length).toBeGreaterThan(1);
  const patches = planRouteLanes(
    [...fixed, { element, movable: true }],
    context,
  );
  expect(patches.get(id)?.routingLane ?? 0).toBe(firstMinimum);
});

test("lane search separates two detours around an obstacle", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  editor.createElement("node.generic", {
    visual: { x: 150, y: 20, width: 50, height: 90 },
  });
  const edges = [0.2, 0.5].map((position, index) => {
    const id = editor.createElement("edge.generic", {
      id: `detour-${index}`,
      semantic: {
        from: a,
        to: b,
        routing: "orthogonal",
        routingAvoidObstacles: true,
        fromPort: "right",
        toPort: "left",
        fromPortPosition: position,
        toPortPosition: position,
      },
    });
    const element = editor.store.get(id);
    if (!element) throw new Error("Missing detour edge");
    return { element, movable: true };
  });
  const first = edges[0];
  const second = edges[1];
  if (!first || !second) throw new Error("Missing detour edges");
  const context = editor.createShapeContext();
  const resolve = (
    element: typeof first.element,
    patch: Record<string, unknown> = {},
  ) => {
    const route = resolveConnector(
      {
        ...element,
        semantic: {
          ...(element.semantic as Record<string, unknown>),
          ...patch,
        },
      },
      context,
      endpointReaderFor(element.type),
    );
    if (!route) throw new Error("Missing detour route");
    return route;
  };
  const beforeFirst = resolve(first.element);
  const beforeSecond = resolve(second.element);
  expect(beforeFirst.points.length).toBeGreaterThan(2);
  expect(beforeSecond.points.length).toBeGreaterThan(2);
  expect(
    countRouteOverlaps(beforeFirst.points, beforeSecond.points),
  ).toBeGreaterThan(0);
  const patches = planRouteLanes(edges, context);
  expect(
    countRouteOverlaps(
      resolve(first.element, patches.get(first.element.id)).points,
      resolve(second.element, patches.get(second.element.id)).points,
    ),
  ).toBe(0);
});

test("movable route separates from a fixed manual route", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  const fixedId = editor.createElement("edge.generic", {
    id: "fixed",
    semantic: {
      from: a,
      to: b,
      routing: "manual",
      fromPort: "right",
      toPort: "left",
      fromPortPosition: 0.2,
      toPortPosition: 0.8,
      routingWaypoints: [
        { u: 0.5, v: -24 },
        { u: 0.5, v: 24 },
      ],
    },
  });
  const movingId = editor.createElement("edge.generic", {
    id: "moving",
    semantic: {
      from: a,
      to: b,
      routing: "orthogonal",
      fromPort: "right",
      toPort: "left",
      fromPortPosition: 0.8,
      toPortPosition: 0.5,
    },
  });
  const fixed = editor.store.get(fixedId);
  const moving = editor.store.get(movingId);
  if (!fixed || !moving) throw new Error("Missing edges");
  const before = JSON.stringify(fixed);
  const context = editor.createShapeContext();
  const fixedRoute = resolveConnector(
    fixed,
    context,
    endpointReaderFor(fixed.type),
  );
  const base = resolveConnector(
    moving,
    context,
    endpointReaderFor(moving.type),
  );
  if (!fixedRoute || !base) throw new Error("Missing route");
  expect(countRouteOverlaps(fixedRoute.points, base.points)).toBeGreaterThan(0);
  const patches = planRouteLanes(
    [
      { element: fixed, movable: false },
      { element: moving, movable: true },
    ],
    context,
  );
  expect(patches.has(fixedId)).toBe(false);
  expect(JSON.stringify(fixed)).toBe(before);
  const separated = resolveConnector(
    {
      ...moving,
      semantic: {
        ...(moving.semantic as Record<string, unknown>),
        ...patches.get(movingId),
      },
    },
    context,
    endpointReaderFor(moving.type),
  );
  if (!separated) throw new Error("Missing separated route");
  expect(countRouteOverlaps(fixedRoute.points, separated.points)).toBe(0);
});
