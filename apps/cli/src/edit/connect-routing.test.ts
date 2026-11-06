import { expect, test } from "bun:test";
import { Editor, endpointReaderFor, resolveConnector } from "@nodetto/core";
import type { JsonObject } from "./operation-input.ts";
import { Batch } from "./batch.ts";

function setup() {
  const editor = new Editor();
  const page = editor.store.listPages()[0]!.id;
  editor.createElement("node.generic", { id: "a", page });
  editor.createElement("node.generic", { id: "b", page });
  const batch = new Batch(editor);
  return { editor, batch, page };
}

function semantic(element: { semantic: unknown }): Record<string, unknown> {
  return element.semantic as Record<string, unknown>;
}

function connect(batch: Batch, extra: JsonObject = {}) {
  batch.apply({ op: "connect", from: "a", to: "b", ...extra }, 0);
  const created = batch.created.at(-1)!;
  return batch.editor.store.get(created.id)!;
}

test("connect applies visual and resolves explicit routing in both branches", () => {
  for (const type of [undefined, "edge.generic"]) {
    const { batch } = setup();
    const edge = connect(batch, {
      ...(type ? { type } : {}),
      visual: {
        routing: "orthogonal",
        routingAvoidObstacles: true,
        style: { stroke: "#112233" },
      },
    });
    expect(semantic(edge).routing).toBe("orthogonal");
    expect(semantic(edge).routingAvoidObstacles).toBe(true);
    expect(edge.visual.style?.stroke).toBe("#112233");
    expect(edge.visual).not.toHaveProperty("routing");
    const explicit = connect(batch, {
      type,
      routing: "straight",
      routingAvoidObstacles: false,
      semantic: { routing: "orthogonal" },
    });
    expect(semantic(explicit).routing).toBe("straight");
    expect(semantic(explicit).routingAvoidObstacles).toBe(false);
    expect(() =>
      connect(batch, { visual: { style: { strok: "#112233" } } }),
    ).toThrow("stroke");
    expect(() => connect(batch, { routing: "invalid" })).toThrow("routing");
    expect(() => connect(batch, { routingAvoidObstacles: "yes" })).toThrow(
      "routingAvoidObstacles",
    );
    batch.dispose();
  }
});

test("page default precedes convention, and explicit routing does not inherit avoidance", () => {
  const { batch, page } = setup();
  connect(batch, { routing: "orthogonal", routingAvoidObstacles: true });
  batch.apply({ op: "set-page-routing", id: page, routing: "straight" }, 1);
  expect(semantic(connect(batch)).routing).toBe("straight");
  const explicit = connect(batch, { routing: "orthogonal" });
  expect(semantic(explicit).routing).toBe("orthogonal");
  expect(semantic(explicit).routingAvoidObstacles).toBeUndefined();
  batch.apply({ op: "set-page-routing", id: page, routing: null }, 2);
  expect(batch.page(page, 0).connectorRouting).toBeUndefined();
  expect(() =>
    batch.apply({ op: "set-page-routing", id: page, routing: "manual" }, 3),
  ).toThrow("routing");
  expect(() =>
    batch.apply(
      {
        op: "set-page-routing",
        id: page,
        routing: null,
        routingAvoidObstacles: true,
      },
      3,
    ),
  ).toThrow("routingAvoidObstacles");
  expect(() =>
    batch.apply(
      { op: "set-page-routing", id: page, routing: "straight", typo: true },
      3,
    ),
  ).toThrow("typo");
  batch.apply(
    {
      op: "add-page",
      id: "next",
      name: "Next",
      connectorRouting: { routing: "orthogonal", routingAvoidObstacles: true },
    },
    4,
  );
  expect(batch.page("next", 0).connectorRouting).toEqual({
    routing: "orthogonal",
    routingAvoidObstacles: true,
  });
  batch.dispose();
});

test("page convention requires matching non-manual peers and reads earlier batch operations", () => {
  for (const avoids of [
    [true, undefined],
    [false, false],
  ] as const) {
    const { batch } = setup();
    connect(batch, {
      routing: "orthogonal",
      ...(avoids[0] === undefined ? {} : { routingAvoidObstacles: avoids[0] }),
    });
    connect(batch, {
      routing: "orthogonal",
      ...(avoids[1] === undefined ? {} : { routingAvoidObstacles: avoids[1] }),
    });
    const result = connect(batch);
    expect(semantic(result).routing).toBe("orthogonal");
    expect(semantic(result).routingAvoidObstacles).toBe(avoids[0]);
    batch.dispose();
  }
  for (const second of [undefined, "manual", "straight"]) {
    const { batch } = setup();
    connect(batch, { routing: "orthogonal" });
    connect(
      batch,
      second === undefined
        ? { type: "edge.generic", semantic: { routing: null } }
        : { routing: second },
    );
    expect(semantic(connect(batch)).routing).toBeUndefined();
    batch.dispose();
  }
  const { batch } = setup();
  expect(semantic(connect(batch)).routing).toBeUndefined();
  batch.dispose();
});

test("add moves connector visual routing to semantic but leaves non-connector visual alone", () => {
  const { batch } = setup();
  batch.apply(
    {
      op: "add",
      type: "edge.generic",
      semantic: { from: "a", to: "b", routing: "straight" },
      visual: { routing: "orthogonal", routingAvoidObstacles: true },
    },
    0,
  );
  const edge = batch.editor.store.get(batch.created.at(-1)!.id)!;
  expect(semantic(edge).routing).toBe("straight");
  expect(semantic(edge).routingAvoidObstacles).toBe(true);
  expect(edge.visual).not.toHaveProperty("routing");
  batch.apply(
    { op: "add", type: "node.generic", visual: { custom: "value" } },
    1,
  );
  expect(
    batch.editor.store.get(batch.created.at(-1)!.id)?.visual,
  ).toHaveProperty("custom", "value");
  batch.dispose();
});

test("sequence messages reject explicit routing and skip page defaults", () => {
  const editor = new Editor();
  const page = editor.createPage({ name: "Sequence", kind: "sequence" });
  editor.setCurrentPage(page);
  editor.createElement("sequence.participant", { id: "a", page });
  editor.createElement("sequence.participant", { id: "b", page });
  const batch = new Batch(editor);
  batch.apply({ op: "set-page-routing", id: page, routing: "orthogonal" }, 0);
  expect(() => connect(batch, { routing: "straight" })).toThrow(
    "sequence.message",
  );
  expect(semantic(connect(batch)).routing).toBeUndefined();
  batch.dispose();
});

test("page default routes a new connector around an intervening node", () => {
  const editor = new Editor();
  const page = editor.store.listPages()[0]!.id;
  for (const [id, x] of [
    ["a", 0],
    ["c", 200],
    ["b", 400],
  ] as const) {
    editor.createElement("node.generic", {
      id,
      page,
      visual: { x, y: 0, width: 100, height: 100 },
    });
  }
  const batch = new Batch(editor);
  batch.apply(
    {
      op: "set-page-routing",
      id: page,
      routing: "orthogonal",
      routingAvoidObstacles: true,
    },
    0,
  );
  const edge = connect(batch);
  const route = resolveConnector(
    edge,
    editor.createShapeContext(),
    endpointReaderFor(edge.type),
  );
  expect(route).not.toBeNull();
  const points = route!.points;
  expect(points.length).toBeGreaterThan(2);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    expect(
      a.y === b.y &&
        a.y > 0 &&
        a.y < 100 &&
        Math.min(a.x, b.x) < 300 &&
        Math.max(a.x, b.x) > 200,
    ).toBe(false);
    expect(
      a.x === b.x &&
        a.x > 200 &&
        a.x < 300 &&
        Math.min(a.y, b.y) < 100 &&
        Math.max(a.y, b.y) > 0,
    ).toBe(false);
  }
  batch.dispose();
});

test("explicit routing does not inherit either page avoidance value", () => {
  for (const [avoid, routing] of [
    [true, "straight"],
    [false, "orthogonal"],
  ] as const) {
    const { batch, page } = setup();
    batch.apply(
      {
        op: "set-page-routing",
        id: page,
        routing: "orthogonal",
        routingAvoidObstacles: avoid,
      },
      0,
    );
    const edge = connect(batch, { routing });
    expect(semantic(edge).routing).toBe(routing);
    expect(semantic(edge).routingAvoidObstacles).toBeUndefined();
    batch.dispose();
  }
});

test("all manual peers and differing avoidance keys have no convention", () => {
  {
    const { batch } = setup();
    connect(batch, { routing: "manual" });
    connect(batch, { routing: "manual" });
    expect(semantic(connect(batch)).routing).toBeUndefined();
    batch.dispose();
  }
  {
    const { batch } = setup();
    connect(batch, { routing: "orthogonal", routingAvoidObstacles: false });
    connect(batch, { routing: "orthogonal", routingAvoidObstacles: true });
    expect(semantic(connect(batch)).routing).toBeUndefined();
    batch.dispose();
  }
});

test("typed connectors honor page defaults and peer conventions", () => {
  {
    const { batch, page } = setup();
    batch.apply(
      {
        op: "set-page-routing",
        id: page,
        routing: "orthogonal",
        routingAvoidObstacles: true,
      },
      0,
    );
    const edge = connect(batch, { type: "edge.generic" });
    expect(semantic(edge).routing).toBe("orthogonal");
    expect(semantic(edge).routingAvoidObstacles).toBe(true);
    batch.dispose();
  }
  {
    const { batch } = setup();
    connect(batch, { routing: "orthogonal", routingAvoidObstacles: true });
    const edge = connect(batch, { type: "edge.generic" });
    expect(semantic(edge).routing).toBe("orthogonal");
    expect(semantic(edge).routingAvoidObstacles).toBe(true);
    batch.dispose();
  }
});

test("typed sequence messages reject explicit routing and skip page defaults", () => {
  const editor = new Editor();
  const page = editor.createPage({ name: "Sequence", kind: "sequence" });
  editor.setCurrentPage(page);
  editor.createElement("sequence.participant", { id: "a", page });
  editor.createElement("sequence.participant", { id: "b", page });
  const batch = new Batch(editor);
  batch.apply(
    {
      op: "set-page-routing",
      id: page,
      routing: "orthogonal",
      routingAvoidObstacles: true,
    },
    0,
  );
  expect(() =>
    connect(batch, { type: "sequence.message", routing: "straight" }),
  ).toThrow("sequence.message");
  expect(
    semantic(connect(batch, { type: "sequence.message" })).routing,
  ).toBeUndefined();
  batch.dispose();
});
