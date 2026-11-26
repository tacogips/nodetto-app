import { expect, test } from "bun:test";
import { breadboardTargetFromSchematic, serializeDocument } from "@nodetto/io";
import { lintBreadboardPage } from "../breadboard/erc.ts";
import { buildBreadboardDocument } from "../breadboard/test-builder.ts";
import { Editor } from "../editor.ts";
import { counterIds, seededRng } from "../test-helpers.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { toSchematicNetlist } from "./netlist.ts";

const board = "breadboard-page";
const sheet = "sheet";
function setup() {
  const doc = buildBreadboardDocument({
    parts: [
      {
        id: "r",
        type: "breadboard.resistor",
        reference: "R1",
        value: "4k7",
        pin1: { x: 20, y: 50 },
      },
      {
        id: "d",
        type: "breadboard.led",
        reference: "D1",
        value: "red",
        pin1: { x: 40, y: 50 },
      },
    ],
    wires: [
      {
        id: "wire",
        points: [
          { x: 20, y: 50 },
          { x: 40, y: 50 },
        ],
      },
    ],
  });
  const editor = new Editor({
    document: {
      ...doc,
      pages: [...doc.pages, { id: sheet, name: "Circuit", kind: "schematic" }],
    },
    idSource: counterIds("new"),
    rng: seededRng(9),
  });
  editor.setCurrentPage(sheet);
  const r = editor.createSchematicElement(
    "schematic.resistor",
    { x: 0, y: 0 },
    { reference: "R1", value: "4k7" },
  ) as string;
  const d = editor.createSchematicElement(
    "schematic.led",
    { x: 100, y: 0 },
    { reference: "D1", value: "red" },
  ) as string;
  editor.createSchematicElement(
    "schematic.wire",
    { x: 0, y: 0 },
    {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
  );
  return { editor, r, d };
}
function projection(editor: Editor) {
  const doc = editor.store.getSnapshot();
  return breadboardTargetFromSchematic(
    toSchematicNetlist(doc, sheet, computeSchematicConnectivity(doc, sheet)),
    { pageName: "Circuit" },
  );
}
function parity(editor: Editor) {
  return lintBreadboardPage(editor.store.getSnapshot(), board).filter(
    (finding) => finding.ruleId.startsWith("parity-"),
  );
}
test("projected schematic drives breadboard parity", () => {
  const { editor } = setup();
  const result = projection(editor);
  expect(result.target).toBeDefined();
  if (!result.target) throw new Error("projection failed");
  expect(editor.setBreadboardTarget(board, result.target)).toBe(true);
  const card = editor.store
    .getPageElements(board)
    .find((e) => e.type === "breadboard.netlist");
  expect(card?.visual.width).toBe(160);
  expect(card?.visual.height).toBe(40);
  expect(parity(editor)).toEqual([]);
  editor.deleteElements(["wire"]);
  expect(parity(editor).map((f) => f.ruleId)).toContain(
    "parity-missing-connection",
  );
});
test("replacement is one undo step and keeps one card", () => {
  const { editor } = setup();
  const result = projection(editor);
  if (!result.target) throw new Error("projection failed");
  editor.setBreadboardTarget(board, result.target);
  const before = serializeDocument(editor.store.getSnapshot());
  expect(
    editor.setBreadboardTarget(board, {
      ...result.target,
      source: "replacement",
    }),
  ).toBe(true);
  expect(
    editor.store
      .getPageElements(board)
      .filter((e) => e.type === "breadboard.netlist"),
  ).toHaveLength(1);
  const card = editor.store
    .getPageElements(board)
    .find((e) => e.type === "breadboard.netlist");
  expect((card?.semantic as { source: string }).source).toBe("replacement");
  editor.undo();
  expect(serializeDocument(editor.store.getSnapshot())).toBe(before);
});
test("invalid projections return diagnostics without changing the card", () => {
  const { editor, r, d } = setup();
  const result = projection(editor);
  if (!result.target) throw new Error("projection failed");
  editor.setBreadboardTarget(board, result.target);
  for (const [id, reference, code] of [
    [d, "R1", "schematic.duplicateReference"],
    [r, "R?", "schematic.unannotatedReference"],
  ] as const) {
    const old = editor.store.get(id);
    if (!old) throw new Error("missing part");
    editor.apply([
      {
        type: "updateSemantic",
        id,
        semantic: { ...(old.semantic as object), reference },
      },
    ]);
    const before = serializeDocument(editor.store.getSnapshot());
    const failed = projection(editor);
    expect(failed.target).toBeUndefined();
    expect(failed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      code,
    );
    if (failed.target) editor.setBreadboardTarget(board, failed.target);
    expect(serializeDocument(editor.store.getSnapshot())).toBe(before);
    editor.undo();
  }
  editor.createSchematicElement(
    "schematic.ic",
    { x: 200, y: 0 },
    {
      reference: "U1",
      value: "",
      pins: [{ number: 2, name: "A", side: "left" }],
    },
  );
  const before = serializeDocument(editor.store.getSnapshot());
  const failed = projection(editor);
  expect(failed.target).toBeUndefined();
  expect(failed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
    "schematic.unprojectablePart",
  );
  expect(serializeDocument(editor.store.getSnapshot())).toBe(before);
});
