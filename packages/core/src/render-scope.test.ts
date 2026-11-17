import { describe, expect, test } from "bun:test";
import type { Element, ErdRelationSemantic } from "@nodetto/ir";
import { rotatedBox } from "./geometry.ts";
import { obstacleReach, renderImpact, renderScope } from "./render-scope.ts";
import { endpointReaderFor, resolveConnector } from "./shapes/connector.ts";
import type { StoreDiff } from "./store.ts";
import {
  document,
  element,
  erdFixture,
  makeEditor,
  seededRng,
} from "./test-helpers.ts";

function table(id: string, x: number, y: number, index = "a1"): Element {
  return element({
    id,
    type: "erd.table",
    index,
    semantic: {
      tableName: id,
      columns: [
        { id: "c1", name: "id", dataType: "uuid", pk: true },
        { id: "c2", name: "ref", dataType: "uuid" },
      ],
    },
    visual: { x, y, width: 240 },
  });
}

function relation(
  id: string,
  from: string,
  to: string,
  extra: Partial<ErdRelationSemantic> = {},
): Element {
  return element({
    id,
    type: "erd.relation",
    index: "b1",
    semantic: {
      from: { table: from, column: "c1" },
      to: { table: to, column: "c2" },
      cardinality: "1:*",
      ...extra,
    },
  });
}

describe("render scope", () => {
  const elements = [
    table("a", 0, 0),
    table("b", 600, 0),
    relation("straight", "a", "b"),
    relation("avoiding", "a", "b", { routing: "orthogonal" }),
    relation("direct", "a", "b", {
      routing: "orthogonal",
      routingAvoidObstacles: false,
    }),
    relation("dangling", "a", "missing"),
    element({
      id: "group",
      type: "group",
      semantic: { memberIds: ["b"] },
    }),
    relation("to-group", "a", "group"),
    element({
      id: "jumping",
      type: "erd.relation",
      semantic: {
        from: { table: "a", column: "c1" },
        to: { table: "b", column: "c2" },
        cardinality: "1:*",
      },
      visual: { style: { lineJumps: "arc" } },
    }),
    element({ id: "note", type: "text.note", semantic: { text: "n" } }),
  ];
  const byId = new Map(elements.map((entry) => [entry.id, entry]));
  const scope = (id: string) =>
    renderScope(byId.get(id) as Element, (other) => byId.get(other));

  test("a table is drawn from its own record", () => {
    expect(scope("a")).toEqual({ kind: "self" });
  });

  test("a relation between tables is drawn from the three records", () => {
    expect(scope("straight")).toEqual({
      kind: "endpoints",
      ids: ["a", "b"],
      obstacles: false,
    });
    expect(scope("direct")).toEqual({
      kind: "endpoints",
      ids: ["a", "b"],
      obstacles: false,
    });
  });

  test("an obstacle-avoiding relation also reads the shapes on its way", () => {
    expect(scope("avoiding")).toEqual({
      kind: "endpoints",
      ids: ["a", "b"],
      obstacles: true,
    });
  });

  test("a missing endpoint is followed by id", () => {
    expect(scope("dangling")).toEqual({
      kind: "endpoints",
      ids: ["a", "missing"],
      obstacles: false,
    });
  });

  test("anything unvouched for may depend on the whole page", () => {
    expect(scope("note")).toEqual({ kind: "page" });
    expect(scope("group")).toEqual({ kind: "page" });
    // A group moves when a member does, without its own record changing.
    expect(scope("to-group")).toEqual({ kind: "page" });
    // Line jumps are drawn over every connector beneath.
    expect(scope("jumping")).toEqual({ kind: "page" });
  });
});

describe("render impact", () => {
  function recorded(run: (editor: ReturnType<typeof makeEditor>) => void) {
    const editor = makeEditor({
      document: document([
        ...erdFixture(),
        element({ id: "note", type: "text.note", semantic: { text: "n" } }),
      ]),
    });
    const diffs: StoreDiff[] = [];
    editor.subscribe((diff) => diffs.push(diff));
    run(editor);
    return {
      editor,
      impacts: diffs.map((diff) =>
        renderImpact(diff, (id) => editor.store.get(id)),
      ),
    };
  }

  test("moving a table stales exactly that record", () => {
    const { impacts } = recorded((editor) =>
      editor.moveElements([{ id: "users", x: 40, y: 40 }]),
    );
    expect(impacts).toEqual([{ structural: false, ids: ["users"] }]);
  });

  test("removing a table names it, though it is gone from the store", () => {
    const { impacts } = recorded((editor) => editor.deleteElements(["users"]));
    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.structural).toBe(false);
    expect(impacts[0]?.ids).toContain("users");
  });

  test("a change to anything else may affect the whole page", () => {
    const { impacts } = recorded((editor) => {
      editor.moveElements([{ id: "note", x: 5, y: 5 }]);
      editor.deleteElements(["note"]);
    });
    expect(impacts.map((impact) => impact.structural)).toEqual([true, true]);
  });

  test("history alone stales nothing; other editor state stales everything", () => {
    const { impacts } = recorded((editor) => {
      editor.beginBatch();
      editor.moveElements([{ id: "users", x: 40, y: 40 }]);
      editor.endBatch();
      editor.setReadOnly(true);
    });
    expect(impacts).toEqual([
      { structural: false, ids: ["users"] },
      { structural: false, ids: [] },
      { structural: true, ids: [] },
    ]);
  });

  test("page switches and document loads stale everything", () => {
    const { impacts } = recorded((editor) => {
      const page = editor.createPage({ name: "Second" });
      editor.setCurrentPage(page);
      editor.loadDocument(document(erdFixture()));
    });
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts.every((impact) => impact.structural)).toBe(true);
  });
});

describe("obstacle reach", () => {
  test("a table that stays clear of the reach leaves the route alone", () => {
    const random = seededRng(3);
    const tables = Array.from({ length: 60 }, (_, position) =>
      table(
        `t${position}`,
        (position % 10) * 360,
        Math.floor(position / 10) * 300,
        `a${String(position).padStart(3, "0")}`,
      ),
    );
    const relations = Array.from({ length: 24 }, (_, position) =>
      relation(`r${position}`, `t${position}`, `t${59 - position * 2}`, {
        routing: "orthogonal",
        ...(position % 4 === 0 ? { routingLane: 3 } : {}),
      }),
    );
    const editor = makeEditor({
      document: document([...tables, ...relations]),
    });
    const route = (id: string) => {
      const edge = editor.store.get(id) as Element;
      return resolveConnector(
        edge,
        editor.createShapeContext(),
        endpointReaderFor(edge.type),
      )?.points;
    };
    const clearOf = (
      reach: ReturnType<typeof obstacleReach>,
      box: { x: number; y: number; width: number; height: number },
    ) =>
      reach.every(
        (area) =>
          box.x > area.x + area.width ||
          box.x + box.width < area.x ||
          box.y > area.y + area.height ||
          box.y + box.height < area.y,
      );
    let untouched = 0;
    let rerouted = 0;
    for (let round = 0; round < 250; round += 1) {
      const moved = `t${Math.floor(random() * tables.length)}`;
      const before = relations.map((edge) => {
        const current = editor.store.get(edge.id) as Element;
        return {
          id: edge.id,
          ends: endpointReaderFor(current.type)(current.semantic),
          points: route(edge.id),
          reach: obstacleReach(current, editor.createShapeContext()),
        };
      });
      const context = editor.createShapeContext();
      const oldBox = rotatedBox(
        context.boundsOf(moved) as NonNullable<
          ReturnType<typeof context.boundsOf>
        >,
        0,
      );
      editor.moveElements([
        {
          id: moved,
          x: Math.floor(random() * 3600) - 100,
          y: Math.floor(random() * 1800) - 100,
        },
      ]);
      const newBox = editor.getBounds(moved);
      if (!newBox) throw new Error("moved table lost its bounds");
      for (const entry of before) {
        if (entry.ends?.from === moved || entry.ends?.to === moved) continue;
        const after = route(entry.id);
        if (clearOf(entry.reach, oldBox) && clearOf(entry.reach, newBox)) {
          expect(after).toEqual(entry.points);
          untouched += 1;
        } else if (JSON.stringify(after) !== JSON.stringify(entry.points))
          rerouted += 1;
      }
    }
    // Both outcomes must occur for the property to have been exercised.
    expect(untouched).toBeGreaterThan(1000);
    expect(rerouted).toBeGreaterThan(20);
  });
});
