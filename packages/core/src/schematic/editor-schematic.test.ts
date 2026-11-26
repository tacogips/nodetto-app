import { describe, expect, test } from "bun:test";
import type { Element, Page } from "@nodetto/ir";
import { Editor } from "../editor.ts";
import { counterIds, document, seededRng } from "../test-helpers.ts";
import { schematicPins } from "./symbols.ts";

const page: Page = { id: "sch", name: "Schematic", kind: "schematic" };
const other: Page = { id: "other", name: "Other", kind: "freeform" };
function editor() {
  const result = new Editor({
    document: document([], [page, other]),
    idSource: counterIds("s"),
    rng: seededRng(9),
  });
  result.setCurrentPage(page.id);
  return result;
}
function reference(e: Editor, id: string) {
  return (e.store.get(id)?.semantic as { reference: string }).reference;
}
function anchor(e: Editor, id: string) {
  const p = schematicPins(e.store.get(id) as Element)[0];
  return { x: p?.x, y: p?.y };
}

describe("schematic editor intents", () => {
  test("creation snaps anchors and allocates references and rail net", () => {
    const e = editor();
    const a = e.createSchematicElement("schematic.resistor", {
      x: 33,
      y: 47,
    }) as string;
    const b = e.createSchematicElement("schematic.resistor", {
      x: 50,
      y: 50,
    }) as string;
    expect(anchor(e, a)).toEqual({ x: 30, y: 50 });
    expect([reference(e, a), reference(e, b)]).toEqual(["R1", "R2"]);
    const power = e.createSchematicElement(
      "schematic.power",
      { x: 100, y: 100 },
      { style: "rail" },
    ) as string;
    expect(e.store.get(power)?.semantic).toEqual({ style: "rail", net: "VCC" });
  });
  test("paste annotates only on schematic pages and explicit annotation is undoable", () => {
    const e = editor();
    const id = e.createSchematicElement("schematic.resistor", {
      x: 30,
      y: 50,
    }) as string;
    e.selection.set([id]);
    e.copySelection();
    const pasted = e.paste()[0] as string;
    expect(reference(e, pasted)).toBe("R2");
    e.apply([
      {
        type: "updateSemantic",
        id: pasted,
        semantic: {
          ...(e.store.get(pasted)?.semantic as object),
          reference: "R1",
        },
      },
    ]);
    expect(e.annotateSchematic(page.id)).toBe(true);
    expect(reference(e, pasted)).toBe("R2");
    e.undo();
    expect(reference(e, pasted)).toBe("R1");
    e.selection.set([id]);
    e.copySelection();
    e.setCurrentPage(other.id);
    const copy = e.paste()[0] as string;
    expect(reference(e, copy)).toBe("R1");
  });
  test("mirror and rotation preserve anchors and undo atomically, including power and flipped parts", () => {
    const e = editor();
    const id = e.createSchematicElement("schematic.resistor", {
      x: 30,
      y: 50,
    }) as string;
    const power = e.createSchematicElement("schematic.power", {
      x: 100,
      y: 100,
    }) as string;
    const before = structuredClone(e.store.get(id)?.visual);
    const fixed = anchor(e, id);
    const powerFixed = anchor(e, power);
    expect(e.mirrorSchematicParts([id])).toBe(true);
    expect(anchor(e, id)).toEqual(fixed);
    const mirrored = structuredClone(e.store.get(id)?.visual);
    expect(e.rotateSchematicElements([id, power], 1)).toBe(true);
    expect(anchor(e, id)).toEqual(fixed);
    expect(anchor(e, power)).toEqual(powerFixed);
    e.undo();
    expect(e.store.get(id)?.visual).toEqual(mirrored);
    expect(e.store.get(power)?.visual.rotation ?? 0).toBe(0);
    e.undo();
    expect(e.store.get(id)?.visual).toEqual(before);
  });
  test("parameter edits preserve connector pin one", () => {
    const e = editor();
    const id = e.createSchematicElement("schematic.connector", {
      x: 40,
      y: 50,
    }) as string;
    const before = anchor(e, id);
    expect(e.updateSchematicSemantic(id, { pinCount: 6 })).toBe(true);
    expect(anchor(e, id)).toEqual(before);
    expect(schematicPins(e.store.get(id) as Element)).toHaveLength(6);
    e.undo();
    expect(schematicPins(e.store.get(id) as Element)).toHaveLength(2);
  });
});
