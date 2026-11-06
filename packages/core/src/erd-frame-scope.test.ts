import { expect, test } from "bun:test";
import { generateDatabaseDdl } from "./database-ddl.ts";
import { erdFrameScope } from "./erd-frame-scope.ts";
import { frameParents } from "./frame-tree.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

const frame = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  index: string,
  memberIds?: string[],
) =>
  element({
    id,
    type: "frame",
    index,
    semantic: { name: id, ...(memberIds ? { memberIds } : {}) },
    visual: { x, y, width, height },
  });
const table = (id: string, x: number, y: number, index: string) =>
  element({
    id,
    type: "erd.table",
    index,
    semantic: { tableName: id, columns: [] },
    visual: { x, y, width: 100 },
  });
function scope(entries: ReturnType<typeof element>[], id: string) {
  const editor = makeEditor({ document: document(entries) });
  const context = editor.createShapeContext(1);
  const before = [...frameParents(editor.store, editor.currentPageId, context)];
  const result = erdFrameScope(editor.store, editor.currentPageId, id, context);
  expect([
    ...frameParents(editor.store, editor.currentPageId, context),
  ]).toEqual(before);
  return result;
}
test("nested positional edges and z-order do not lose contained tables", () => {
  const entries = [
    frame("zone", 0, 0, 300, 150, "a1"),
    table("widgets", 10, 10, "a2"),
    table("gadgets", 10, 130, "a3"),
    frame("catalog", -10, -10, 400, 300, "a4", ["zone"]),
  ];
  const outer = scope(entries, "catalog");
  expect([...outer.included]).toContain("widgets");
  expect([...outer.included]).toContain("gadgets");
  expect(outer.warnings).toEqual([]);
  const inner = scope(entries, "zone");
  expect(inner.included.has("gadgets")).toBe(false);
  expect(inner.warnings.join()).toContain("gadgets");
  expect(inner.warnings.join()).toContain("zone");
  expect(
    scope(
      [table("widgets", 10, 10, "a1"), frame("late", 0, 0, 300, 200, "a2")],
      "late",
    ).included.has("widgets"),
  ).toBe(true);
});
test("explicit claims, closed frames, and competing positional owners", () => {
  const t = table("widgets", 80, 20, "a3");
  expect(
    scope(
      [
        frame("a", 0, 0, 300, 200, "a1"),
        frame("b", 70, 0, 200, 200, "a2", ["widgets"]),
        t,
      ],
      "a",
    ).warnings,
  ).toEqual([]);
  const closed = scope([frame("a", 0, 0, 300, 200, "a1", []), t], "a");
  expect(closed.included.has("widgets")).toBe(false);
  expect(closed.warnings.join()).toContain("memberIds");
  const competing = scope(
    [frame("a", 0, 0, 300, 200, "a1"), frame("b", 70, 0, 300, 150, "a2"), t],
    "a",
  );
  expect(competing.included.has("widgets")).toBe(false);
  expect(competing.warnings.join()).toContain("frame b");
});

test("nested frames, closed content lists, and unrelated tables", () => {
  const nested = [
    frame("outer", 0, 0, 400, 300, "a2"),
    frame("inner", 10, 10, 200, 150, "a1"),
    table("widgets", 20, 20, "a3"),
  ];
  expect(scope(nested, "outer").included.has("widgets")).toBe(true);
  const closed = scope(
    [
      frame("outer", 0, 0, 400, 300, "a1", ["widgets"]),
      table("widgets", 20, 20, "a2"),
      table("gadgets", 20, 100, "a3"),
    ],
    "outer",
  );
  expect(closed.included.has("widgets")).toBe(true);
  expect(closed.included.has("gadgets")).toBe(false);
  expect(closed.warnings.join()).toContain("gadgets");
  expect(
    scope(
      [frame("outer", 0, 0, 200, 100, "a1"), table("far", 500, 500, "a2")],
      "outer",
    ).warnings,
  ).toEqual([]);
});

test("DDL scope warnings are sorted and precede later warnings", () => {
  const straddlingTable = (id: string, x: number, index: string) =>
    element({
      id,
      type: "erd.table",
      index,
      semantic: {
        tableName: id,
        columns: [{ id: "id", name: "id", dataType: "integer" }],
      },
      visual: { x, y: 85, width: 100 },
    });
  const entries = [
    frame("zone", 0, 0, 300, 100, "a1"),
    straddlingTable("zeta", 10, "a2"),
    straddlingTable("alpha", 150, "a3"),
  ];
  const editor = makeEditor({
    document: document(entries, [
      { id: "page-1", name: "Schema", kind: "erd" },
    ]),
  });
  const warnings = generateDatabaseDdl(editor, editor.currentPageId, "sqlite", {
    frameId: "zone",
  }).warnings;
  expect(warnings.slice(0, 2)).toEqual([
    "alpha: table excluded from frame zone: straddles the edge of frame zone.",
    "zeta: table excluded from frame zone: straddles the edge of frame zone.",
  ]);
  expect(warnings).toHaveLength(3);
  expect(warnings[2]).toBe(
    "This page contains no ERD tables or database objects with exportable definitions.",
  );
});

test("nested open container does not veto adoption by its enclosing frame", () => {
  const entries = [
    frame("zone", 0, 0, 300, 200, "a1"),
    frame("q", 200, 0, 250, 150, "a2"),
    table("t", 200, 10, "a3"),
    frame("catalog", -10, -10, 600, 400, "a4", ["zone"]),
  ];
  const catalog = scope(entries, "catalog");
  expect(catalog.included.has("t")).toBe(true);
  expect(catalog.warnings).toEqual([]);
  const zone = scope(entries, "zone");
  expect(zone.included.has("t")).toBe(false);
  expect(zone.warnings).toEqual([
    "t: table excluded from frame zone: also inside frame q.",
  ]);
  const straddle = scope(
    [frame("zone", 0, 0, 300, 100, "a1"), table("t", 250, 85, "a2")],
    "zone",
  );
  expect(straddle.warnings).toEqual([
    "t: table excluded from frame zone: straddles the edge of frame zone.",
  ]);
});

test("duplicate explicit claims warn while a sole external claim stays silent", () => {
  const entries = [
    frame("a", 0, 0, 300, 300, "a1", ["t"]),
    frame("b", 400, 0, 300, 300, "a2", ["t", "o"]),
    table("t", 410, 10, "a3"),
    table("o", 410, 150, "a4"),
  ];
  const b = scope(entries, "b");
  expect(b.included.has("t")).toBe(false);
  expect(b.warnings).toEqual([
    "t: table excluded from frame b: also listed in memberIds of frame a.",
  ]);
  const a = scope(entries, "a");
  expect(a.included.has("t")).toBe(true);
  expect(a.warnings).toEqual([]);
  const external = scope(
    [
      frame("a", 0, 0, 300, 300, "a1", ["t"]),
      frame("b", 400, 0, 300, 300, "a2"),
      table("t", 410, 10, "a3"),
    ],
    "b",
  );
  expect(external.included.has("t")).toBe(false);
  expect(external.warnings).toEqual([]);
});
