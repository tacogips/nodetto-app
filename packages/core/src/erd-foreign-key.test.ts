import { expect, test } from "bun:test";
import type {
  Element,
  ErdRelationSemantic,
  ErdTableSemantic,
} from "@nodetto/ir";
import { Editor } from "./editor.ts";
import {
  erdForeignKeyWarning,
  erdRelationHighlightedColumns,
} from "./erd-foreign-key.ts";

function fixture() {
  const editor = new Editor();
  const from = editor.createElement("erd.table");
  const to = editor.createElement("erd.table");
  const id = editor.createElement("erd.relation", {
    semantic: { from: { table: from }, to: { table: to }, cardinality: "1:*" },
  });
  const relation = () => editor.store.get(id) as Element;
  const warning = () =>
    erdForeignKeyWarning(relation(), (id) => editor.store.get(id));
  const semantic = () => relation().semantic as ErdRelationSemantic;
  const write = (patch: Partial<ErdRelationSemantic>) =>
    editor.apply([
      { type: "updateSemantic", id, semantic: { ...semantic(), ...patch } },
    ]);
  return { editor, from, to, relation, warning, write };
}

test("table-level FK drafts can be created and warn until both columns are assigned", () => {
  const { from, to, write, warning } = fixture();
  expect(warning()).toContain("not assigned");
  write({ from: { table: from, column: "id" } });
  expect(warning()).toContain("not assigned");
  write({ to: { table: to, column: "id" } });
  expect(warning()).toBeNull();
});

test("composite mapping checks every pair and both legacy and array endpoints", () => {
  const { editor, from, to, relation, write, warning } = fixture();
  const check = (patch: Partial<ErdRelationSemantic>) =>
    erdForeignKeyWarning(
      {
        ...relation(),
        semantic: { ...(relation().semantic as ErdRelationSemantic), ...patch },
      },
      (id) => editor.store.get(id),
    );
  expect(
    check({
      from: { table: from, columns: ["id", "other"] },
      to: { table: to, columns: ["id"] },
    }),
  ).toContain("incomplete");
  write({
    from: { table: from, columns: ["id"] },
    to: { table: to, column: "id" },
  });
  expect(warning()).toBeNull();
  expect(
    check({
      from: { table: from, columns: ["id", "id"] },
      to: { table: to, columns: ["id", "id"] },
    }),
  ).toContain("duplicate");
  write({
    from: { table: from, column: "missing" },
    to: { table: to, column: "id" },
  });
  expect(warning()).toContain("missing column");
});

test("complete composite keys clear the warning only when every mapped column exists", () => {
  const { editor, from, to, write, warning } = fixture();
  for (const id of [from, to]) {
    const table = editor.store.get(id) as Element;
    const semantic = table.semantic as ErdTableSemantic;
    editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: {
          ...semantic,
          columns: [
            ...semantic.columns,
            { id: "other", name: "other", dataType: "uuid" },
          ],
        },
      },
    ]);
  }
  write({
    from: { table: from, columns: ["id", "other"] },
    to: { table: to, columns: ["id", "other"] },
  });
  expect(warning()).toBeNull();
  write({ to: { table: to, columns: ["id", "missing"] } });
  expect(warning()).toContain("missing column");
});

test("deleting a mapped column raises a warning and undo restores the configured FK", () => {
  const { editor, from, to, write, warning } = fixture();
  write({
    from: { table: from, column: "id" },
    to: { table: to, column: "id" },
  });
  expect(warning()).toBeNull();
  const table = editor.store.get(to) as Element;
  editor.apply([
    {
      type: "updateSemantic",
      id: to,
      semantic: { ...(table.semantic as object), columns: [] },
    },
  ]);
  expect(warning()).toContain("missing column");
  editor.undo();
  expect(warning()).toBeNull();
});

test("logical references are exempt and warnings never modify persisted styles", () => {
  const { editor, relation, write, warning } = fixture();
  const snapshot = editor.getSnapshot();
  expect(warning()).not.toBeNull();
  expect(editor.getSnapshot()).toEqual(snapshot);
  write({ logical: true });
  expect(warning()).toBeNull();
  expect(
    erdForeignKeyWarning(
      { ...relation(), type: "edge.generic" },
      () => undefined,
    ),
  ).toBeNull();
});

function highlightFixture() {
  const editor = new Editor();
  const table = (columnIds: readonly string[] = []) => {
    const id = editor.createElement("erd.table");
    const element = editor.store.get(id) as Element;
    const semantic = element.semantic as ErdTableSemantic;
    editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: {
          ...semantic,
          columns: columnIds.map((columnId) => ({
            id: columnId,
            name: columnId,
            dataType: "uuid",
          })),
        },
      },
    ]);
    return id;
  };
  const relation = (
    from: { table: string; column?: string; columns?: readonly string[] },
    to: { table: string; column?: string; columns?: readonly string[] },
    logical = false,
  ) =>
    editor.createElement("erd.relation", {
      semantic: { from, to, cardinality: "1:*", logical },
    });
  const resolve = (id: string) => editor.store.get(id);
  return { editor, table, relation, resolve };
}

test("relation column highlighting handles single and composite endpoints", () => {
  const { table, relation, resolve } = highlightFixture();
  const from = table(["source_id", "unused"]);
  const to = table(["target_id", "other"]);
  const single = relation(
    { table: from, column: "source_id" },
    { table: to, column: "target_id" },
  );
  expect(erdRelationHighlightedColumns([single], resolve)).toEqual(
    new Map([
      [from, new Set(["source_id"])],
      [to, new Set(["target_id"])],
    ]),
  );

  const composite = relation(
    { table: from, columns: ["source_id", "unused"] },
    { table: to, columns: ["target_id", "other"] },
  );
  expect(erdRelationHighlightedColumns([composite], resolve)).toEqual(
    new Map([
      [from, new Set(["source_id", "unused"])],
      [to, new Set(["target_id", "other"])],
    ]),
  );
});

test("columns take precedence and selected relations union per table including self-relations", () => {
  const { table, relation, resolve } = highlightFixture();
  const a = table(["x", "y", "z"]);
  const b = table(["id"]);
  const first = relation({ table: a, column: "x" }, { table: b, column: "id" });
  const firstWithBothSpellings = {
    ...resolve(first),
    semantic: {
      from: { table: a, columns: ["x"], column: "y" },
      to: { table: b, column: "id" },
    },
  } as Element;
  const second = relation(
    { table: a, column: "z" },
    { table: b, column: "id" },
  );
  const resolveUnion = (id: string) =>
    id === first ? firstWithBothSpellings : resolve(id);
  expect(erdRelationHighlightedColumns([first, second], resolveUnion)).toEqual(
    new Map([
      [a, new Set(["x", "z"])],
      [b, new Set(["id"])],
    ]),
  );

  const self = {
    ...resolve(first),
    semantic: {
      from: { table: a, column: "x" },
      to: { table: a, column: "y" },
    },
  } as Element;
  expect(
    erdRelationHighlightedColumns([first], (id) =>
      id === first ? self : resolve(id),
    ),
  ).toEqual(new Map([[a, new Set(["x", "y"])]]));
});

test("empty, non-relation, unknown and table-level selections produce no entries", () => {
  const { editor, table, relation, resolve } = highlightFixture();
  const tableId = table(["id"]);
  const tableLevel = relation({ table: tableId }, { table: tableId });
  expect(erdRelationHighlightedColumns([], resolve).size).toBe(0);
  expect(
    erdRelationHighlightedColumns([tableId, "unknown-id"], resolve).size,
  ).toBe(0);
  const ordinary = editor.createElement("shape.geo");
  expect(erdRelationHighlightedColumns([ordinary], resolve).size).toBe(0);
  expect(erdRelationHighlightedColumns([tableLevel], resolve).size).toBe(0);
});

test("missing, non-table and stale endpoints are skipped while valid ends remain", () => {
  const { editor, table, relation, resolve } = highlightFixture();
  const valid = table(["id"]);
  const nonTable = editor.createElement("shape.geo");
  const baseRelation = relation(
    { table: valid, column: "id" },
    { table: valid, column: "id" },
  );
  const invalidEnds = {
    ...resolve(baseRelation),
    semantic: {
      from: { table: "missing-table", column: "stale" },
      to: { table: valid, column: "id" },
    },
  } as Element;
  const resolveInvalid = (id: string) =>
    id === baseRelation ? invalidEnds : resolve(id);
  expect(erdRelationHighlightedColumns([baseRelation], resolveInvalid)).toEqual(
    new Map([[valid, new Set(["id"])]]),
  );
  const nonTableEnds = {
    ...resolve(baseRelation),
    semantic: {
      from: { table: nonTable, column: "id" },
      to: { table: valid, column: "id" },
    },
  } as Element;
  const resolveNonTable = (id: string) =>
    id === baseRelation ? nonTableEnds : resolve(id);
  expect(
    erdRelationHighlightedColumns([baseRelation], resolveNonTable),
  ).toEqual(new Map([[valid, new Set(["id"])]]));
  const staleEnds = {
    ...resolve(baseRelation),
    semantic: {
      from: { table: valid, columns: ["deleted"] },
      to: { table: "missing-table", column: "id" },
    },
  } as Element;
  const resolveStale = (id: string) =>
    id === baseRelation ? staleEnds : resolve(id);
  expect(erdRelationHighlightedColumns([baseRelation], resolveStale).size).toBe(
    0,
  );
});

test("logical relations highlight and malformed relation semantics do not throw", () => {
  const { table, relation, resolve } = highlightFixture();
  const source = table(["id"]);
  const target = table(["id"]);
  const logical = relation(
    { table: source, column: "id" },
    { table: target, column: "id" },
    true,
  );
  expect(erdRelationHighlightedColumns([logical], resolve).size).toBe(2);

  const malformed = {
    ...resolve(logical),
    semantic: { from: null, to: 42 },
  } as Element;
  expect(
    erdRelationHighlightedColumns(["malformed"], (id) =>
      id === "malformed" ? malformed : undefined,
    ).size,
  ).toBe(0);
});
