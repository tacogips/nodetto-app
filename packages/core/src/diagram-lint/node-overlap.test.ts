import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { lintNodeOverlaps, NODE_OVERLAP_PAGE_KINDS } from "./node-overlap.ts";
test("overlap pairs are unique, sorted, and touching is excluded", () => {
  const editor = new Editor();
  const elements = [0, 0, 60, 200].map((x, i) =>
    editor.buildElement("erd.table", {
      id: `table-${i}`,
      visual: { x, y: 0, width: 100, height: 100 },
      semantic: { tableName: `table${i}`, columns: [] },
    }),
  );
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const doc = editor.getSnapshot();
  const erd = {
    ...doc,
    pages: doc.pages.map((p) => ({
      ...p,
      kind: "erd" as const,
      name: "Schema",
    })),
  };
  const results = lintNodeOverlaps(erd, editor.currentPageId);
  expect(results.map((f) => [f.elementId, f.otherId])).toEqual([
    ["table-0", "table-1"],
    ["table-0", "table-2"],
    ["table-1", "table-2"],
  ]);
  expect(results[0]?.message).toContain(
    'table "table0" overlaps table "table1" on page "Schema"',
  );
  expect(lintNodeOverlaps(doc, editor.currentPageId)).toEqual([]);
  expect(NODE_OVERLAP_PAGE_KINDS).not.toContain("freeform");
});

test("ERD touching, containment and partial intersection", () => {
  const run = (
    boxes: { x: number; y: number; width: number; height: number }[],
  ) => {
    const editor = new Editor();
    editor.apply(
      boxes.map((visual, i) => ({
        type: "createElement" as const,
        element: editor.buildElement("erd.table", {
          id: `t${i}`,
          visual,
          semantic: { tableName: `t${i}`, columns: [] },
        }),
      })),
    );
    const doc = editor.getSnapshot();
    return lintNodeOverlaps(
      { ...doc, pages: doc.pages.map((p) => ({ ...p, kind: "erd" as const })) },
      editor.currentPageId,
    );
  };
  const box = { x: 0, y: 0, width: 100, height: 100 };
  expect(run([box, { ...box, x: 100 }])).toHaveLength(0);
  expect(run([box, { x: 20, y: 0, width: 40, height: 40 }])).toHaveLength(1);
  const partial = run([box, { x: 60, y: 36, width: 100, height: 100 }]);
  expect(partial).toHaveLength(1);
  expect(partial[0]?.message.endsWith("(40x20)")).toBe(true);
});

test("UML system contains use cases and state nodes overlap", () => {
  const editor = new Editor();
  const system = editor.buildElement("usecase.node", {
    id: "system",
    visual: { x: 0, y: 0, width: 400, height: 300 },
    semantic: { kind: "system", name: "System" },
  });
  const a = editor.buildElement("usecase.node", {
    id: "a",
    visual: { x: 40, y: 40, width: 100, height: 80 },
    semantic: { kind: "usecase", name: "A" },
  });
  const b = editor.buildElement("usecase.node", {
    id: "b",
    visual: { x: 90, y: 80, width: 100, height: 80 },
    semantic: { kind: "usecase", name: "B" },
  });
  editor.apply(
    [system, a].map((element) => ({ type: "createElement" as const, element })),
  );
  const uml = () => {
    const doc = editor.getSnapshot();
    return {
      ...doc,
      pages: doc.pages.map((p) => ({ ...p, kind: "uml" as const })),
    };
  };
  expect(lintNodeOverlaps(uml(), editor.currentPageId)).toEqual([]);
  editor.apply([{ type: "createElement", element: b }]);
  expect(
    lintNodeOverlaps(uml(), editor.currentPageId).map((f) => [
      f.elementId,
      f.otherId,
    ]),
  ).toEqual([["a", "b"]]);

  const states = new Editor();
  states.apply(
    ["Idle", "Running"].map((name, i) => ({
      type: "createElement" as const,
      element: states.buildElement("state.node", {
        id: `s${i}`,
        visual: { x: i * 20, y: 0, width: 100, height: 80 },
        semantic: { kind: "state", name },
      }),
    })),
  );
  const doc = states.getSnapshot();
  const findings = lintNodeOverlaps(
    { ...doc, pages: doc.pages.map((p) => ({ ...p, kind: "state" as const })) },
    states.currentPageId,
  );
  expect(findings).toHaveLength(1);
  expect(findings[0]?.message.startsWith('state "')).toBe(true);
});
