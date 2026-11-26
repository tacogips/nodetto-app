import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { Document, Element, Page } from "@nodetto/ir";
import { focusBreadboardProbe } from "./breadboard-problems.ts";
import {
  canFixSchematicReferences,
  schematicProblemRows,
  sendSchematicToBreadboard,
} from "./schematic-problems.ts";

const sheet: Page = { id: "sheet", name: "Circuit", kind: "schematic" };
const pcb: Page = { id: "pcb", name: "PCB", kind: "pcb" };
const board: Page = { id: "board", name: "Board", kind: "breadboard" };
const element = (
  id: string,
  type: string,
  semantic: object,
  x = 0,
  y = 0,
): Element => ({
  id,
  type,
  page: sheet.id,
  index: id,
  semantic,
  visual: { x, y },
});
const part = (id: string, reference: string, x = 0) =>
  element(id, "schematic.connector", { reference, value: "", pinCount: 1 }, x);
const doc = (elements: Element[], pages: Page[] = [sheet]): Document => ({
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages,
  elements,
});

test("exposes all five ERC rules and reference repair", () => {
  const cases: [string, Element[]][] = [
    ["unconnected-pin", [part("a", "J1")]],
    [
      "single-pin-net",
      [
        part("a", "J1"),
        element("w", "schematic.wire", {
          points: [
            { x: 5, y: 5 },
            { x: 20, y: 5 },
          ],
        }),
      ],
    ],
    [
      "dangling-wire-end",
      [
        element("w", "schematic.wire", {
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
          ],
        }),
      ],
    ],
    ["duplicate-reference", [part("a", "J?"), part("b", "J?", 100)]],
    [
      "shorted-power-nets",
      [
        element("a", "schematic.power", { net: "A", style: "ground" }, -15, -5),
        element("b", "schematic.power", { net: "B", style: "ground" }, -15, -5),
      ],
    ],
  ];
  for (const [rule, elements] of cases)
    expect(
      schematicProblemRows(doc(elements), sheet.id).some(
        (row) => row.ruleId === rule,
      ),
    ).toBe(true);
  const editor = new Editor({ document: doc(cases[3]?.[1] ?? []) });
  expect(canFixSchematicReferences(editor.store.getSnapshot(), sheet.id)).toBe(
    true,
  );
  expect(editor.annotateSchematic(sheet.id)).toBe(true);
  expect(canFixSchematicReferences(editor.store.getSnapshot(), sheet.id)).toBe(
    false,
  );
});

test("PCB parity rows focus the source schematic page", () => {
  const editor = new Editor({ document: doc([part("a", "J1")], [pcb, sheet]) });
  editor.setCurrentPage(pcb.id);
  const row = schematicProblemRows(editor.store.getSnapshot(), pcb.id).find(
    (item) => item.ruleId === "pcb-parity-missing-part",
  );
  expect(row?.pageId).toBe(sheet.id);
  if (!row) throw new Error("missing parity row");
  expect(
    focusBreadboardProbe(editor, {
      pageId: row.pageId ?? pcb.id,
      elementIds: row.elementIds,
    }),
  ).toBe(true);
  expect(editor.currentPageId).toBe(sheet.id);
  expect([...editor.selection.ids()]).toEqual(["a"]);
  expect(schematicProblemRows(doc([], [pcb]), pcb.id)).toEqual([]);
});

test("projection writes one card and sparse IC failure preserves its bytes", () => {
  const editor = new Editor({
    document: doc([part("a", "J1")], [sheet, board]),
  });
  expect(
    sendSchematicToBreadboard(editor, sheet.id, board.id).filter(
      (d) => d.severity === "error",
    ),
  ).toEqual([]);
  const cards = () =>
    editor.store
      .getPageElements(board.id)
      .filter((item) => item.type === "breadboard.netlist");
  expect(cards()).toHaveLength(1);
  const before = JSON.stringify(cards()[0]);
  editor.setCurrentPage(sheet.id);
  editor.createSchematicElement(
    "schematic.ic",
    { x: 200, y: 0 },
    {
      reference: "U1",
      value: "",
      pins: [{ number: 2, name: "A", side: "left" }],
    },
  );
  const diagnostics = sendSchematicToBreadboard(editor, sheet.id, board.id);
  expect(diagnostics.map((d) => d.code)).toContain(
    "schematic.unprojectablePart",
  );
  expect(cards()).toHaveLength(1);
  expect(JSON.stringify(cards()[0])).toBe(before);
});
