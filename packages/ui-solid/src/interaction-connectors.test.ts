import { describe, expect, test } from "bun:test";
import {
  connectorWaypointFromPage,
  Editor,
  endpointReaderFor,
  resolveConnector,
} from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { Tool } from "./tools.ts";
import {
  interactionFor,
  pointer,
  mouse,
  keyboard,
} from "./interaction-test-helpers.ts";

describe("connector handles (design 3.4)", () => {
  /** a at the origin, b to the right, c below a; an edge from a to b. */
  function wired() {
    const editor = new Editor();
    const a = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = editor.createElement("shape.geo", {
      visual: { x: 400, y: 0, width: 100, height: 100 },
    });
    const c = editor.createElement("shape.geo", {
      visual: { x: 0, y: 400, width: 100, height: 100 },
    });
    const edge = editor.connect(a, b);
    if (!edge) {
      throw new Error("expected an edge");
    }
    editor.selection.set([edge]);
    return { editor, a, b, c, edge, ...interactionFor(editor, "select") };
  }

  test("dragging an end onto another shape rewrites that end in one step", () => {
    const { editor, interaction, a, b, c, edge } = wired();
    const before = editor.history.undoSize;

    interaction.startReconnect(
      edge,
      "to",
      pointer({ clientX: 400, clientY: 50 }),
    );
    expect(interaction.pending()).not.toBeNull();
    interaction.onPointerMove(pointer({ clientX: 50, clientY: 450 }));
    expect(interaction.hoverTarget()).toBe(c);
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 450 }));

    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: c });
    expect(editor.history.undoSize).toBe(before + 1);
    expect(editor.history.batching).toBe(false);
    expect(interaction.hoverTarget()).toBeNull();
    expect(interaction.pending()).toBeNull();

    editor.undo();
    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: b });
  });

  test("dropping on empty canvas detaches, while dropping on the fixed end changes nothing", () => {
    const { editor, interaction, a, b, edge } = wired();
    const before = editor.history.undoSize;

    interaction.startReconnect(
      edge,
      "from",
      pointer({ clientX: 100, clientY: 50 }),
    );
    interaction.onPointerUp(pointer({ clientX: 900, clientY: 900 }));
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      fromPoint: { x: 900, y: 900 },
      to: b,
    });
    expect(editor.store.get(edge)?.semantic).not.toHaveProperty("from");
    editor.undo();
    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: b });

    // The fixed end is never a target: a and b must stay distinct.
    interaction.startReconnect(
      edge,
      "from",
      pointer({ clientX: 100, clientY: 50 }),
    );
    interaction.onPointerMove(pointer({ clientX: 450, clientY: 50 }));
    expect(interaction.hoverTarget()).toBeNull();
    interaction.onPointerUp(pointer({ clientX: 450, clientY: 50 }));
    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: b });

    expect(editor.history.undoSize).toBe(before);
    expect(editor.history.batching).toBe(false);
  });

  test("escape mid-drag cancels the reconnect", () => {
    const { editor, interaction, a, b, edge } = wired();
    interaction.startReconnect(
      edge,
      "to",
      pointer({ clientX: 400, clientY: 50 }),
    );
    interaction.onPointerMove(pointer({ clientX: 50, clientY: 450 }));
    interaction.onKeyDown(keyboard("Escape"));
    expect(interaction.pending()).toBeNull();
    interaction.onPointerUp(pointer({ clientX: 50, clientY: 450 }));
    expect(editor.store.get(edge)?.semantic).toMatchObject({ from: a, to: b });
  });

  test("orthogonal channel dragging batches bend edits and Escape rolls back", () => {
    const editor = new Editor();
    const from = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const to = editor.createElement("shape.geo", {
      visual: { x: 300, y: 200, width: 100, height: 100 },
    });
    const edge = editor.connect(from, to);
    if (!edge) throw new Error("expected edge");
    editor.apply([
      {
        type: "updateSemantic",
        id: edge,
        semantic: { from, to, routing: "orthogonal" },
      },
    ]);
    editor.selection.set([edge]);
    const { interaction } = interactionFor(editor, "select");
    const before = editor.getSnapshot();
    const undoSize = editor.history.undoSize;

    interaction.startRouteBend(edge, pointer({ clientX: 200, clientY: 150 }));
    interaction.onPointerMove(pointer({ clientX: 220, clientY: 150 }));
    interaction.onPointerMove(pointer({ clientX: 250, clientY: 150 }));
    interaction.onPointerUp(pointer({ clientX: 250, clientY: 150 }));
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      routing: "orthogonal",
      routingBend: 0.75,
    });
    expect(editor.history.undoSize).toBe(undoSize + 1);
    expect(editor.undo()).toBe(true);
    expect(editor.getSnapshot()).toEqual(before);

    interaction.startRouteBend(edge, pointer({ clientX: 200, clientY: 150 }));
    interaction.onPointerMove(pointer({ clientX: 240, clientY: 150 }));
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.undoSize).toBe(undoSize);
  });

  test("manual waypoint dragging is endpoint-relative, atomic and cancellable", () => {
    const editor = new Editor();
    const from = editor.createElement("shape.geo", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const to = editor.createElement("shape.geo", {
      visual: { x: 300, y: 200, width: 100, height: 100 },
    });
    const edge = editor.connect(from, to);
    if (!edge) throw new Error("expected edge");
    editor.apply([
      {
        type: "updateSemantic",
        id: edge,
        semantic: {
          from,
          to,
          routing: "manual",
          routingWaypoints: [{ u: 0.5, v: 40 }],
        },
      },
    ]);
    const { interaction } = interactionFor(editor, "select");
    const before = editor.getSnapshot();
    const undoSize = editor.history.undoSize;

    interaction.startRouteWaypoint(
      edge,
      0,
      pointer({ clientX: 178, clientY: 183 }),
    );
    interaction.onPointerMove(pointer({ clientX: 220, clientY: 120 }));
    interaction.onPointerMove(pointer({ clientX: 240, clientY: 130 }));
    interaction.onPointerUp(pointer({ clientX: 240, clientY: 130 }));
    expect(
      (editor.store.get(edge)?.semantic as { routingWaypoints: unknown[] })
        .routingWaypoints[0],
    ).not.toEqual({ u: 0.5, v: 40 });
    expect(editor.history.undoSize).toBe(undoSize + 1);
    expect(editor.undo()).toBe(true);
    expect(editor.getSnapshot()).toEqual(before);

    interaction.startRouteWaypoint(
      edge,
      0,
      pointer({ clientX: 178, clientY: 183 }),
    );
    interaction.onPointerMove(pointer({ clientX: 260, clientY: 140 }));
    interaction.onKeyDown(keyboard("Escape"));
    expect(editor.getSnapshot()).toEqual(before);
    expect(editor.history.undoSize).toBe(undoSize);
  });

  test("an erd.relation end becomes a table endpoint with no column", () => {
    const editor = new Editor();
    const t1 = editor.createElement("erd.table", { visual: { x: 0, y: 0 } });
    const t2 = editor.createElement("erd.table", { visual: { x: 600, y: 0 } });
    const t3 = editor.createElement("erd.table", { visual: { x: 0, y: 400 } });
    const relation = editor.connectSmart(t1, t2);
    if (!relation) {
      throw new Error("expected a relation");
    }
    editor.apply([
      {
        type: "updateSemantic",
        id: relation,
        semantic: {
          from: { table: t1, column: "id" },
          to: { table: t2 },
          cardinality: "1:*",
        },
      },
    ]);
    const { interaction } = interactionFor(editor, "select");

    interaction.startReconnect(
      relation,
      "from",
      pointer({ clientX: 240, clientY: 28 }),
    );
    interaction.onPointerMove(pointer({ clientX: 100, clientY: 420 }));
    expect(interaction.hoverTarget()).toBe(t3);
    interaction.onPointerUp(pointer({ clientX: 100, clientY: 420 }));

    expect(editor.store.get(relation)?.semantic).toEqual({
      from: { table: t3 },
      to: { table: t2 },
      cardinality: "1:*",
    });
  });

  test("a connect handle drag creates an erd.relation between two tables", () => {
    const editor = new Editor();
    const t1 = editor.createElement("erd.table", { visual: { x: 0, y: 0 } });
    const t2 = editor.createElement("erd.table", { visual: { x: 600, y: 0 } });
    editor.selection.set([t1]);
    const { interaction, tool } = interactionFor(editor, "select");

    // From the handle just above t1's top edge.
    interaction.startConnect(t1, pointer({ clientX: 120, clientY: -14 }));
    expect(interaction.pending()).not.toBeNull();
    interaction.onPointerMove(pointer({ clientX: 700, clientY: 20 }));
    expect(interaction.hoverTarget()).toBe(t2);
    interaction.onPointerUp(pointer({ clientX: 700, clientY: 20 }));

    const relations = editor.store
      .listElements()
      .filter((element) => element.type === "erd.relation");
    expect(relations).toHaveLength(1);
    expect(relations[0]?.semantic).toMatchObject({
      from: { table: t1 },
      to: { table: t2 },
    });
    expect([...editor.selection.ids()]).toEqual([relations[0]?.id]);
    expect(tool()).toBe("select");
    expect(interaction.hoverTarget()).toBeNull();
    expect(editor.history.batching).toBe(false);

    // Letting go over empty canvas creates nothing.
    interaction.startConnect(t1, pointer({ clientX: 120, clientY: -14 }));
    interaction.onPointerUp(pointer({ clientX: 900, clientY: 900 }));
    expect(editor.store.size).toBe(3);
  });

  test("the edge tool also picks the connector type from the endpoints", () => {
    const editor = new Editor();
    const c1 = editor.createElement("uml.class", { visual: { x: 0, y: 0 } });
    const c2 = editor.createElement("uml.class", { visual: { x: 600, y: 0 } });
    const { interaction } = interactionFor(editor, "edge");

    interaction.onPointerDown(pointer({ clientX: 50, clientY: 20 }));
    interaction.onPointerMove(pointer({ clientX: 650, clientY: 20 }));
    interaction.onPointerUp(pointer({ clientX: 650, clientY: 20 }));

    const created = editor.store
      .listElements()
      .find((element) => element.type === "uml.association");
    expect(created?.semantic).toMatchObject({
      from: c1,
      to: c2,
      kind: "assoc",
    });
  });
});

test("captured bend double-click removes a vertex without moving it or inserting another", () => {
  const editor = new Editor();
  const from = editor.createElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const to = editor.createElement("shape.geo", {
    visual: { x: 300, y: 200, width: 100, height: 100 },
  });
  const edge = editor.connect(from, to) as ElementId;
  editor.apply([
    {
      type: "updateSemantic",
      id: edge,
      semantic: {
        from,
        to,
        routing: "manual",
        routingWaypoints: [{ u: 0.5, v: 40 }],
      },
    },
  ]);
  editor.selection.set([edge]);
  const { interaction } = interactionFor(editor, "select", {
    scheduleDragFrame: () => () => {},
  });
  const element = editor.store.get(edge);
  if (!element) throw new Error("connector missing");
  const point = resolveConnector(
    element,
    editor.createShapeContext(),
    endpointReaderFor(element.type),
  )?.waypointPoints?.[0];
  if (!point) throw new Error("bend missing");
  const before = editor.getSnapshot();
  const undoSize = editor.history.undoSize;
  // Real pointer coordinates need not fall on the exact fractional center.
  const at = { clientX: point.x + 0.25, clientY: point.y - 0.25 };
  for (let click = 0; click < 2; click += 1) {
    interaction.startRouteWaypoint(edge, 0, pointer(at));
    interaction.onPointerUp(pointer(at));
  }
  expect(editor.getSnapshot()).toEqual(before);
  expect(editor.history.undoSize).toBe(undoSize);
  // Canvas pointer capture retargets dblclick to the canvas itself.
  interaction.onDoubleClick(mouse(at.clientX, at.clientY));
  expect(editor.store.get(edge)?.semantic).toMatchObject({
    from,
    to,
    routing: "straight",
  });
  expect(editor.history.undoSize).toBe(undoSize + 1);
  editor.undo();
  expect(editor.getSnapshot()).toEqual(before);
});

test("double-clicking a selected orthogonal channel straightens it", () => {
  const editor = new Editor();
  const from = editor.createElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const to = editor.createElement("shape.geo", {
    visual: { x: 300, y: 200, width: 100, height: 100 },
  });
  const edge = editor.connect(from, to) as ElementId;
  editor.apply([
    {
      type: "updateSemantic",
      id: edge,
      semantic: { from, to, routing: "orthogonal" },
    },
  ]);
  editor.selection.set([edge]);
  const element = editor.store.get(edge);
  if (!element) throw new Error("connector missing");
  const point = resolveConnector(
    element,
    editor.createShapeContext(),
    endpointReaderFor(element.type),
  )?.bendPoint;
  if (!point) throw new Error("channel missing");
  const { interaction } = interactionFor(editor, "select");
  interaction.onDoubleClick(mouse(point.x, point.y));
  expect(editor.store.get(edge)?.semantic).toEqual({
    from,
    to,
    routing: "straight",
  });
});

describe("outline point snapping", () => {
  function setup() {
    const editor = new Editor();
    const a = editor.createElement("shape.geo", {
      semantic: { geo: "diamond" },
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const b = editor.createElement("shape.geo", {
      semantic: { geo: "rect" },
      visual: { x: 300, y: 0, width: 100, height: 100 },
    });
    return { editor, a, b, ...interactionFor(editor, Tool.Connector) };
  }

  test("snaps outside an outline, previews the point and creates both ports in one commit", () => {
    const { editor, a, b, interaction } = setup();
    const before = editor.history.undoSize;
    let commits = 0;
    editor.store.subscribe(() => commits++);
    interaction.onPointerMove(pointer({ clientX: 50, clientY: 107 }));
    expect(interaction.hoverTarget()).toBe(a);
    interaction.onPointerDown(pointer({ clientX: 50, clientY: 107 }));
    interaction.onPointerMove(pointer({ clientX: 292, clientY: 50 }));
    expect(interaction.hoverTarget()).toBe(b);
    expect(interaction.pending()).toEqual({
      from: { x: 50, y: 99 },
      to: { x: 300, y: 50 },
    });
    interaction.onPointerUp(pointer({ clientX: 292, clientY: 50 }));
    const edge = editor.store
      .listElements()
      .find((element) => element.type === "edge.generic")!;
    expect(edge.semantic).toMatchObject({
      from: a,
      to: b,
      fromPort: "bottom",
      toPort: "left",
    });
    expect(commits).toBe(1);
    expect(editor.history.undoSize).toBe(before + 1);
    editor.undo();
    expect(editor.store.has(edge.id)).toBe(false);
    editor.redo();
    expect(editor.store.get(edge.id)!.semantic).toEqual(edge.semantic);
  });

  test("quick-connect explicitly chooses a side and reconnecting on the same node can change or clear it", () => {
    const { editor, a, b, interaction } = setup();
    interaction.startConnect(
      a,
      pointer({ clientX: 50, clientY: 114 }),
      "bottom",
    );
    expect(interaction.pending()?.from).toEqual({ x: 50, y: 99 });
    interaction.onPointerUp(pointer({ clientX: 301, clientY: 50 }));
    const edge = editor.store
      .listElements()
      .find((element) => element.type === "edge.generic")!;
    const before = editor.history.undoSize;
    interaction.startReconnect(
      edge.id,
      "to",
      pointer({ clientX: 301, clientY: 50 }),
    );
    interaction.onPointerUp(pointer({ clientX: 350, clientY: -8 }));
    expect(editor.store.get(edge.id)!.semantic).toMatchObject({
      to: b,
      toPort: "top",
    });
    expect(editor.history.undoSize).toBe(before + 1);
    interaction.startReconnect(
      edge.id,
      "to",
      pointer({ clientX: 350, clientY: 1 }),
    );
    interaction.onPointerUp(pointer({ clientX: 350, clientY: 50 }));
    expect(editor.store.get(edge.id)!.semantic).not.toHaveProperty("toPort");
    editor.undo();
    expect(editor.store.get(edge.id)!.semantic).toMatchObject({
      toPort: "top",
    });
  });

  test("magnet radius stays twelve screen pixels at different zoom levels", () => {
    const { editor, b, interaction } = setup();
    for (const z of [0.5, 2]) {
      editor.camera.set({ x: 0, y: 0, z });
      interaction.onPointerMove(
        pointer({ clientX: 300 * z - 11, clientY: 50 * z }),
      );
      expect(interaction.hoverTarget()).toBe(b);
      interaction.onPointerMove(
        pointer({ clientX: 300 * z - 13, clientY: 50 * z }),
      );
      expect(interaction.hoverTarget()).toBeNull();
    }
  });

  test("points cannot bypass hidden or locked layer state", () => {
    const { editor, a, b, interaction } = setup();
    interaction.startConnect(a, pointer(), "right");
    editor.apply([{ type: "updateVisual", id: b, visual: { locked: true } }]);
    interaction.onPointerMove(pointer({ clientX: 292, clientY: 50 }));
    expect(interaction.hoverTarget()).toBeNull();
    interaction.onPointerUp(pointer({ clientX: 292, clientY: 50 }));
    const line = editor.store
      .listElements()
      .find((element) => element.type === "edge.generic")!;
    expect(line.semantic).toMatchObject({
      from: a,
      toPoint: { x: 292, y: 50 },
    });
    expect(line.semantic).not.toHaveProperty("to");
  });
});

describe("free line gestures", () => {
  test("draws in empty canvas, edits an intermediate point and attaches a free end", () => {
    const editor = new Editor();
    const shape = editor.createElement("shape.geo", {
      semantic: { geo: "diamond" },
      visual: { x: 400, y: 200, width: 100, height: 100 },
    });
    const { interaction, setTool } = interactionFor(editor, Tool.Connector);
    const before = editor.history.undoSize;
    interaction.onPointerDown(pointer({ clientX: 100, clientY: 100 }));
    interaction.onPointerMove(pointer({ clientX: 300, clientY: 250 }));
    expect(interaction.pending()).toEqual({
      from: { x: 100, y: 100 },
      to: { x: 300, y: 250 },
    });
    interaction.onPointerUp(pointer({ clientX: 300, clientY: 250 }));
    const edge = editor.store
      .listElements()
      .find((element) => element.type === "edge.generic")!;
    expect(edge.semantic).toMatchObject({
      fromPoint: { x: 100, y: 100 },
      toPoint: { x: 300, y: 250 },
    });
    expect(editor.history.undoSize).toBe(before + 1);
    const waypoint = connectorWaypointFromPage(
      { x: 200, y: 200 },
      { x: 100, y: 100 },
      { x: 300, y: 250 },
    );
    editor.apply([
      {
        type: "updateSemantic",
        id: edge.id,
        semantic: {
          ...(edge.semantic as object),
          routing: "manual",
          routingWaypoints: [waypoint],
        },
      },
    ]);
    setTool(Tool.Select);
    interaction.startRouteWaypoint(
      edge.id,
      0,
      pointer({ clientX: 200, clientY: 200 }),
    );
    interaction.onPointerMove(pointer({ clientX: 220, clientY: 210 }));
    interaction.onPointerUp(pointer({ clientX: 220, clientY: 210 }));
    const moved = resolveConnector(
      editor.store.get(edge.id)!,
      editor.createShapeContext(),
      endpointReaderFor(edge.type),
    )!;
    expect(moved.waypointPoints![0]!.x).toBeCloseTo(220);
    expect(moved.waypointPoints![0]!.y).toBeCloseTo(210);
    interaction.startReconnect(
      edge.id,
      "to",
      pointer({ clientX: 300, clientY: 250 }),
    );
    interaction.onPointerMove(pointer({ clientX: 392, clientY: 250 }));
    expect(interaction.pending()?.to).toEqual({ x: 401, y: 250 });
    interaction.onPointerUp(pointer({ clientX: 392, clientY: 250 }));
    expect(editor.store.get(edge.id)!.semantic).toMatchObject({
      to: shape,
      toPort: "left",
    });
    expect(editor.store.get(edge.id)!.semantic).not.toHaveProperty("toPoint");
    const attached = resolveConnector(
      editor.store.get(edge.id)!,
      editor.createShapeContext(),
      endpointReaderFor(edge.type),
    )!;
    expect(attached.waypointPoints![0]!.x).toBeCloseTo(220);
    expect(attached.waypointPoints![0]!.y).toBeCloseTo(210);
    interaction.startReconnect(
      edge.id,
      "to",
      pointer({ clientX: 401, clientY: 250 }),
    );
    interaction.onPointerUp(pointer({ clientX: 300, clientY: 400 }));
    expect(editor.store.get(edge.id)!.semantic).toMatchObject({
      toPoint: { x: 300, y: 400 },
    });
    expect(editor.store.get(edge.id)!.semantic).not.toHaveProperty("to");
  });
});
