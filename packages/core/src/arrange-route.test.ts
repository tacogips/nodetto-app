import { expect, test } from "bun:test";
import type { PageKind } from "@nodetto/ir";
import { document, TEST_PAGE } from "./test-helpers.ts";
import { Editor } from "./editor.ts";
import { planRoute } from "./arrange-route.ts";
import { bpmnFlowDecoration } from "./bpmn/notation.ts";
import {
  connectorWaypointFromPage,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";
import { pointAlongRoute } from "./shapes/connector/route.ts";

function semantic(editor: Editor, id: string): Record<string, unknown> {
  return editor.store.get(id)?.semantic as Record<string, unknown>;
}
function route(
  editor: Editor,
  resetManual = false,
  targetIds?: readonly string[],
) {
  return planRoute(
    editor.store,
    editor.store.listPages()[0]!.id,
    editor.registry,
    { resetManual, targetIds },
  );
}

test("route assigns and spreads ports, honors scope, and is idempotent", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 100, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  const c = editor.createElement("node.generic", {
    visual: { x: 300, y: 200, width: 80, height: 80 },
  });
  const first = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  const second = editor.createElement("edge.generic", {
    semantic: { from: a, to: c },
  });
  const before = editor.store.get(a)?.visual;
  editor.apply(route(editor));
  expect(semantic(editor, first).fromPort).toBe("right");
  expect(semantic(editor, first).fromPortPosition).toBe(0.3333);
  expect(semantic(editor, second).fromPortPosition).toBe(0.6667);
  expect(editor.store.get(a)?.visual).toEqual(before);
  expect(route(editor)).toEqual([]);
});

test("manual routes remain intact unless reset, and target IDs limit updates", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  const manual = editor.createElement("edge.generic", {
    semantic: {
      from: a,
      to: b,
      routing: "manual",
      routingWaypoints: [
        connectorWaypointFromPage(
          { x: 100, y: 100 },
          { x: 40, y: 40 },
          { x: 340, y: 40 },
        ),
      ],
    },
  });
  const other = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  const original = semantic(editor, manual);
  editor.apply(route(editor, false, [manual]));
  expect(semantic(editor, manual)).toEqual(original);
  expect(semantic(editor, other).routing).toBeUndefined();
  editor.apply(route(editor, true, [manual]));
  expect(semantic(editor, manual).routing).toBe("orthogonal");
  expect(semantic(editor, manual).routingWaypoints).toBeUndefined();
  expect(semantic(editor, other).routing).toBeUndefined();
});

test("self-loops avoid an occupied side", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  editor.createElement("edge.generic", {
    semantic: { from: a, to: b, fromPort: "right" },
  });
  const loop = editor.createElement("edge.generic", {
    semantic: { from: a, to: a },
  });
  editor.apply(route(editor));
  expect(semantic(editor, loop).fromPort).toBe("top");
  expect(semantic(editor, loop).toPort).toBe("top");
  expect(semantic(editor, loop).fromPortPosition).toBe(0.3);
  expect(semantic(editor, loop).toPortPosition).toBe(0.7);
});

test("BPMN label placement follows the rendered route anchor", () => {
  const editor = new Editor();
  const a = editor.createElement("bpmn.task", {
    visual: { x: 0, y: 0, width: 80, height: 60 },
  });
  const b = editor.createElement("bpmn.task", {
    visual: { x: 400, y: 0, width: 80, height: 60 },
  });
  editor.createElement("bpmn.task", {
    visual: { x: 220, y: 18, width: 40, height: 24 },
  });
  const id = editor.createElement("bpmn.sequenceFlow", {
    semantic: {
      from: a,
      to: b,
      name: "Review order",
      fromPort: "right",
      toPort: "left",
      routing: "straight",
    },
  });
  editor.apply(route(editor));
  const edge = editor.store.get(id)!;
  const position = semantic(editor, id).labelPosition;
  expect(typeof position).toBe("number");
  const resolved = resolveConnector(
    edge,
    editor.createShapeContext(),
    endpointReaderFor(edge.type),
  )!;
  const label = bpmnFlowDecoration(edge, resolved.points, () => undefined).find(
    (part) => part.role === "flow-label",
  );
  expect(label?.kind).toBe("text");
  if (label?.kind === "text")
    expect({ x: label.x, y: label.y }).toEqual(
      pointAlongRoute(resolved.points, position as number),
    );
  expect(route(editor)).toEqual([]);
});

test("fixed ends reserve their position while selected edges spread", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  const c = editor.createElement("node.generic", {
    visual: { x: 300, y: 100, width: 80, height: 80 },
  });
  const fixed = editor.createElement("edge.generic", {
    semantic: { from: a, to: c, fromPort: "right", fromPortPosition: 0.6667 },
  });
  const moving = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  editor.apply(route(editor, false, [moving]));
  expect(semantic(editor, moving).fromPortPosition).toBe(
    Math.round((0.6667 / 2) * 10000) / 10000,
  );
  expect(semantic(editor, fixed).fromPortPosition).toBe(0.6667);
  expect(route(editor, false, [moving])).toEqual([]);
});

test("ERD column endpoints and self relations do not receive ports", () => {
  const editor = new Editor();
  const a = editor.createElement("erd.table", {
    semantic: {
      tableName: "widgets",
      columns: [{ id: "c1", name: "id", dataType: "int" }],
    },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const b = editor.createElement("erd.table", {
    semantic: {
      tableName: "orders",
      columns: [{ id: "c2", name: "id", dataType: "int" }],
    },
    visual: { x: 300, y: 0, width: 100, height: 100 },
  });
  const column = editor.createElement("erd.relation", {
    semantic: {
      from: { table: a, column: "c1" },
      to: { table: b, column: "c2" },
      cardinality: "1:*",
    },
  });
  const self = editor.createElement("erd.relation", {
    semantic: { from: { table: a }, to: { table: a }, cardinality: "1:*" },
  });
  editor.apply(route(editor));
  expect(semantic(editor, column).fromPort).toBeUndefined();
  expect(semantic(editor, column).toPort).toBeUndefined();
  expect(semantic(editor, self).fromPort).toBeUndefined();
  expect(semantic(editor, self).toPort).toBeUndefined();
});

test("rounding in a narrow fixed gap falls back without colliding", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  for (const position of [0.5, 0.50001])
    editor.createElement("edge.generic", {
      semantic: {
        from: a,
        to: b,
        fromPort: "right",
        fromPortPosition: position,
      },
    });
  const moving = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  editor.apply(route(editor, false, [moving]));
  const position = semantic(editor, moving).fromPortPosition as number;
  expect(Math.abs(position - 0.5)).toBeGreaterThanOrEqual(0.0001);
  expect(Math.abs(position - 0.50001)).toBeGreaterThanOrEqual(0.0001);
});

test("BPMN label bounds are preserved when routing", () => {
  const editor = new Editor();
  const a = editor.createElement("bpmn.task", {
    visual: { x: 0, y: 0, width: 80, height: 60 },
  });
  const b = editor.createElement("bpmn.task", {
    visual: { x: 300, y: 0, width: 80, height: 60 },
  });
  const id = editor.createElement("bpmn.sequenceFlow", {
    semantic: { from: a, to: b, name: "Review order" },
    visual: { labelBounds: { x: 150, y: 0, width: 40, height: 20 } },
  });
  editor.apply(route(editor));
  expect(semantic(editor, id).labelPosition).toBeUndefined();
  expect(editor.store.get(id)?.visual.labelBounds).toEqual({
    x: 150,
    y: 0,
    width: 40,
    height: 20,
  });
  expect(route(editor)).toEqual([]);
});

test("routing is available and stable on every applicable page kind", () => {
  const kinds: readonly PageKind[] = [
    "state",
    "flowchart",
    "freeform",
    "architecture",
    "uml",
    "erd",
    "bpmn",
  ];
  for (const kind of kinds) {
    const editor = new Editor({
      document: document([], [{ ...TEST_PAGE, kind }]),
    });
    const a = editor.createElement("node.generic", {
      visual: { x: 0, y: 0, width: 80, height: 80 },
    });
    const b = editor.createElement("node.generic", {
      visual: { x: 300, y: 0, width: 80, height: 80 },
    });
    const id = editor.createElement("edge.generic", {
      semantic: { from: a, to: b },
    });
    const before = [editor.store.get(a)?.visual, editor.store.get(b)?.visual];
    editor.apply(route(editor));
    expect(semantic(editor, id).routing).toBe("orthogonal");
    expect(semantic(editor, id).fromPort).toBe("right");
    expect(semantic(editor, id).toPort).toBe("left");
    expect([editor.store.get(a)?.visual, editor.store.get(b)?.visual]).toEqual(
      before,
    );
    expect(route(editor)).toEqual([]);
  }
});

test("BPMN pools and lanes alone do not displace labels and flow self-loops use one side", () => {
  const editor = new Editor();
  const pool = editor.createElement("bpmn.participant", {
    semantic: { name: "Pool", collapsed: false },
    visual: { x: -50, y: -80, width: 600, height: 240 },
  });
  editor.createElement("bpmn.lane", {
    semantic: { name: "Lane", parent: pool },
    visual: { x: -40, y: -70, width: 580, height: 220 },
  });
  const a = editor.createElement("bpmn.task", {
    visual: { x: 0, y: 0, width: 80, height: 60 },
  });
  const b = editor.createElement("bpmn.task", {
    visual: { x: 400, y: 0, width: 80, height: 60 },
  });
  const flow = editor.createElement("bpmn.sequenceFlow", {
    semantic: { from: a, to: b, name: "Review order" },
  });
  const loop = editor.createElement("bpmn.sequenceFlow", {
    semantic: { from: b, to: b },
  });
  editor.apply(route(editor));
  expect(semantic(editor, flow).labelPosition).toBeUndefined();
  expect(semantic(editor, loop).fromPort).toBe(semantic(editor, loop).toPort);
  expect(semantic(editor, loop).fromPortPosition).toBe(0.3);
  expect(semantic(editor, loop).toPortPosition).toBe(0.7);
  expect(route(editor)).toEqual([]);
});

test("ERD table ends spread while column ends are excluded", () => {
  const editor = new Editor();
  const a = editor.createElement("erd.table", {
    semantic: {
      tableName: "widgets",
      columns: [{ id: "c1", name: "id", dataType: "int" }],
    },
    visual: { x: 0, y: 100, width: 100, height: 100 },
  });
  const b = editor.createElement("erd.table", {
    semantic: {
      tableName: "orders",
      columns: [{ id: "c2", name: "id", dataType: "int" }],
    },
    visual: { x: 400, y: 0, width: 100, height: 100 },
  });
  const c = editor.createElement("erd.table", {
    semantic: {
      tableName: "items",
      columns: [{ id: "c3", name: "id", dataType: "int" }],
    },
    visual: { x: 400, y: 200, width: 100, height: 100 },
  });
  const relation = (to: string, fromColumn = false) =>
    editor.createElement("erd.relation", {
      semantic: {
        from: fromColumn ? { table: a, column: "c1" } : { table: a },
        to: { table: to },
        cardinality: "1:*",
      },
    });
  const first = relation(b);
  const second = relation(c);
  const column = relation(b, true);
  editor.apply(route(editor));
  expect(semantic(editor, first).fromPortPosition).toBe(0.3333);
  expect(semantic(editor, second).fromPortPosition).toBe(0.6667);
  expect(semantic(editor, column).fromPort).toBeUndefined();
  expect(semantic(editor, column).fromPortPosition).toBeUndefined();
  expect(route(editor)).toEqual([]);
});

test("unselected ends reserve default positions and selected routes leave them unchanged", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  const fixed = editor.createElement("edge.generic", {
    semantic: { from: a, to: b, fromPort: "right" },
  });
  const target = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  const before = semantic(editor, fixed);
  editor.apply(route(editor, false, [target]));
  expect(semantic(editor, fixed)).toEqual(before);
  expect(semantic(editor, target).fromPortPosition).not.toBe(0.5);
  expect(route(editor, false, [target])).toEqual([]);
});

test("an unpinned non-target edge occupies the side used by its resolved route", () => {
  const editor = new Editor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 80, height: 80 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 300, y: 0, width: 80, height: 80 },
  });
  const edge = editor.createElement("edge.generic", {
    semantic: { from: a, to: b },
  });
  const loop = editor.createElement("edge.generic", {
    semantic: { from: a, to: a },
  });
  const before = semantic(editor, edge);
  editor.apply(route(editor, false, [loop]));
  expect(semantic(editor, edge)).toEqual(before);
  expect(semantic(editor, loop).fromPort).toBe("top");
  expect(semantic(editor, loop).toPort).toBe("top");
});
