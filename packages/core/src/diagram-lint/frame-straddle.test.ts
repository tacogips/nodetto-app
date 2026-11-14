import { expect, test } from "bun:test";
import { document, element } from "../test-helpers.ts";
import { lintFrameStraddles } from "./frame-straddle.ts";
test("reports visible straddles per frame, including explicit members", () => {
  const table = element({
    id: "t",
    type: "erd.table",
    semantic: { tableName: "widgets", columns: [] },
    visual: { x: 90, y: 10, width: 100 },
  });
  const frame = (id: string) =>
    element({
      id,
      type: "frame",
      semantic: { name: id, memberIds: ["t"] },
      visual: { x: 0, y: 0, width: 120, height: 100 },
    });
  const entries = [table, frame("b"), frame("a")];
  const doc = document(entries, [
    { id: "page-1", name: "Schema", kind: "erd" },
  ]);
  expect(lintFrameStraddles(doc, "page-1").map((f) => f.message)).toEqual([
    "Table widgets straddles the edge of frame a.",
    "Table widgets straddles the edge of frame b.",
  ]);
  expect(lintFrameStraddles(document(entries), "page-1")).toEqual([]);
  expect(
    lintFrameStraddles(
      {
        ...doc,
        elements: [
          { ...table, visual: { ...table.visual, hidden: true } },
          frame("a"),
        ],
      },
      "page-1",
    ),
  ).toEqual([]);
});

test("ignores containment, edge touching, and hidden frames", () => {
  const frame = element({
    id: "f",
    type: "frame",
    semantic: { name: "zone" },
    visual: { x: 0, y: 0, width: 200, height: 100 },
  });
  const table = (x: number) =>
    element({
      id: "t",
      type: "erd.table",
      semantic: { tableName: "widgets", columns: [] },
      visual: { x, y: 10, width: 100 },
    });
  const run = (entries: ReturnType<typeof element>[]) =>
    lintFrameStraddles(
      document(entries, [{ id: "page-1", name: "Schema", kind: "erd" }]),
      "page-1",
    );
  expect(run([frame, table(10)])).toEqual([]);
  expect(run([frame, table(200)])).toEqual([]);
  expect(
    run([{ ...frame, visual: { ...frame.visual, hidden: true } }, table(190)]),
  ).toEqual([]);
});
