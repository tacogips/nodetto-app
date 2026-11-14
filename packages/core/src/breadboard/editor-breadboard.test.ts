import { describe, expect, test } from "bun:test";
import type { Element, Page } from "@nodetto/ir";
import { Editor } from "../editor.ts";
import { counterIds, document, seededRng } from "../test-helpers.ts";
import { breadboardPins } from "./catalogue.ts";

const page: Page = { id: "bb", name: "Board", kind: "breadboard" };
const secondPage: Page = { id: "other", name: "Other", kind: "freeform" };

function makeBreadboardEditor(elements: readonly Element[] = []): Editor {
  return new Editor({
    document: document(elements, [page, secondPage]),
    idSource: counterIds("bb"),
    rng: seededRng(9),
  });
}

describe("breadboard Editor intents", () => {
  test("creates a snapped part with an automatic reference and puts the board at the bottom", () => {
    const editor = makeBreadboardEditor();
    const resistor = editor.createBreadboardPart("breadboard.resistor", {
      x: 33,
      y: 47,
    });
    expect(resistor).not.toBeNull();
    const created = editor.store.get(resistor as string);
    expect(breadboardPins(created as Element)[0]).toMatchObject({
      x: 30,
      y: 50,
    });
    expect((created?.semantic as { reference: string }).reference).toBe("R1");
    const second = editor.createBreadboardPart("breadboard.resistor", {
      x: 50,
      y: 50,
    });
    expect(
      (editor.store.get(second as string)?.semantic as { reference: string })
        .reference,
    ).toBe("R2");
    const board = editor.createBreadboardPart("breadboard.board", {
      x: 100,
      y: 100,
    });
    const card = editor.createBreadboardPart("breadboard.netlist", {
      x: 300,
      y: 200,
    });
    expect(editor.store.get(card as string)?.visual).toMatchObject({
      x: 300,
      y: 200,
      width: 160,
      height: 40,
    });
    expect(
      (editor.store.get(board as string)?.index ?? "") < (created?.index ?? ""),
    ).toBe(true);
  });

  test("rotates parts in quarter turns around pin 1 and undo restores the exact visual", () => {
    const editor = makeBreadboardEditor();
    const id = editor.createBreadboardPart("breadboard.resistor", {
      x: 30,
      y: 50,
    });
    const original = structuredClone(editor.store.get(id as string)?.visual);
    editor.rotateBreadboardParts([id as string], 1);
    editor.undo();
    expect(editor.store.get(id as string)?.visual).toEqual(original);
    for (const turn of [1, 1, 1, 1] as const) {
      editor.rotateBreadboardParts([id as string], turn);
      const item = editor.store.get(id as string) as Element;
      expect(breadboardPins(item)[0]).toMatchObject({ x: 30, y: 50 });
      for (const pin of breadboardPins(item)) {
        expect(Math.abs(pin.x % 10)).toBe(0);
        expect(Math.abs(pin.y % 10)).toBe(0);
      }
    }
    expect(editor.store.get(id as string)?.visual.rotation).toBe(0);
    editor.rotateBreadboardParts([id as string], -1);
    expect(editor.store.get(id as string)?.visual.rotation).toBe(270);
  });

  test("parameter edits preserve pin 1 while changing the other pin geometry", () => {
    const editor = makeBreadboardEditor();
    const resistor = editor.createBreadboardPart("breadboard.resistor", {
      x: 30,
      y: 50,
    });
    const before = breadboardPins(
      editor.store.get(resistor as string) as Element,
    );
    expect(
      editor.updateBreadboardSemantic(resistor as string, { span: 6 }),
    ).toBe(true);
    const after = breadboardPins(
      editor.store.get(resistor as string) as Element,
    );
    expect(after[0]).toEqual(before[0]);
    expect(after[1]?.x).toBe((after[0]?.x ?? 0) + 60);
    const ic = editor.createBreadboardPart("breadboard.ic", { x: 100, y: 100 });
    const first = breadboardPins(editor.store.get(ic as string) as Element)[0];
    editor.updateBreadboardSemantic(ic as string, { pinCount: 14 });
    expect(
      breadboardPins(editor.store.get(ic as string) as Element)[0],
    ).toEqual(first);
    expect(
      breadboardPins(editor.store.get(ic as string) as Element),
    ).toHaveLength(14);
  });

  test("wire point edits are undoable and wire color edits persist", () => {
    const editor = makeBreadboardEditor();
    const wire = editor.createBreadboardPart(
      "breadboard.wire",
      { x: 100, y: 100 },
      {
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
      },
    );
    const originalPoints = structuredClone(
      (editor.store.get(wire as string)?.semantic as { points: unknown[] })
        .points,
    );
    const editedPoints = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
    ];
    expect(
      editor.updateBreadboardSemantic(wire as string, { points: editedPoints }),
    ).toBe(true);
    expect(
      (editor.store.get(wire as string)?.semantic as { points: unknown[] })
        .points,
    ).toEqual(editedPoints);
    editor.undo();
    expect(
      (editor.store.get(wire as string)?.semantic as { points: unknown[] })
        .points,
    ).toEqual(originalPoints);
    expect(
      editor.updateBreadboardSemantic(wire as string, { color: "blue" }),
    ).toBe(true);
    expect(
      (editor.store.get(wire as string)?.semantic as { color: string }).color,
    ).toBe("blue");
  });

  test("board size edits update dimensions in one undoable intent", () => {
    const editor = makeBreadboardEditor();
    const board = editor.createBreadboardPart("breadboard.board", {
      x: 100,
      y: 100,
    });
    const original = editor.store.get(board as string);
    expect(original?.visual).toMatchObject({ width: 330, height: 220 });
    expect(
      editor.updateBreadboardSemantic(board as string, { size: "full" }),
    ).toBe(true);
    expect(editor.store.get(board as string)?.semantic).toMatchObject({
      size: "full",
    });
    expect(editor.store.get(board as string)?.visual).toMatchObject({
      width: 660,
      height: 220,
    });
    editor.undo();
    expect(editor.store.get(board as string)?.semantic).toMatchObject({
      size: "half",
    });
    expect(editor.store.get(board as string)?.visual).toMatchObject({
      width: 330,
      height: 220,
    });
  });

  test("netlist semantic edits are undoable and non-breadboard edits are rejected", () => {
    const editor = makeBreadboardEditor();
    const card = editor.createBreadboardPart("breadboard.netlist", {
      x: 300,
      y: 200,
    });
    const originalSource = (
      editor.store.get(card as string)?.semantic as {
        source: string;
      }
    ).source;
    expect(
      editor.updateBreadboardSemantic(card as string, { source: "updated" }),
    ).toBe(true);
    expect(
      (editor.store.get(card as string)?.semantic as { source: string }).source,
    ).toBe("updated");
    editor.undo();
    expect(
      (editor.store.get(card as string)?.semantic as { source: string }).source,
    ).toBe(originalSource);

    const shape = editor.createElement("shape.geo", {
      semantic: { geo: "ellipse" },
    });
    expect(editor.updateBreadboardSemantic(shape, { color: "blue" })).toBe(
      false,
    );
    expect(editor.store.get(shape)?.semantic).toEqual({ geo: "ellipse" });
  });

  test("moving a board carries fully hosted parts and wires, but not a part spanning off-board", () => {
    const editor = makeBreadboardEditor();
    const board = editor.createBreadboardPart("breadboard.board", {
      x: 130,
      y: 150,
    });
    const resistor = editor.createBreadboardPart("breadboard.resistor", {
      x: 130,
      y: 150,
    });
    const wire = editor.createBreadboardPart(
      "breadboard.wire",
      { x: 130, y: 150 },
      {
        color: "red",
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
        ],
      },
    );
    const outside = editor.createBreadboardPart("breadboard.resistor", {
      x: 430,
      y: 150,
    });
    const beforeResistor = editor.store.get(resistor as string)?.visual;
    const beforeWire = editor.store.get(wire as string)?.visual;
    const beforeOutside = editor.store.get(outside as string)?.visual;
    editor.apply([
      { type: "updateVisual", id: board as string, visual: { x: 110, y: 120 } },
    ]);
    expect(editor.store.get(resistor as string)?.visual).toMatchObject({
      x: (beforeResistor?.x ?? 0) + 10,
      y: (beforeResistor?.y ?? 0) + 20,
    });
    expect(editor.store.get(wire as string)?.visual).toMatchObject({
      x: (beforeWire?.x ?? 0) + 10,
      y: (beforeWire?.y ?? 0) + 20,
    });
    expect(editor.store.get(outside as string)?.visual).toEqual(beforeOutside);
  });

  test("paste annotation is breadboard-only, and duplicate fixing is one undoable intent", () => {
    const editor = makeBreadboardEditor();
    const id = editor.createBreadboardPart("breadboard.resistor", {
      x: 30,
      y: 50,
    });
    editor.selection.set([id as string]);
    expect(editor.copySelection()).toBe(true);
    const pasted = editor.paste()[0];
    expect(
      (editor.store.get(pasted as string)?.semantic as { reference: string })
        .reference,
    ).toBe("R2");
    editor.apply([
      {
        type: "updateSemantic",
        id: pasted as string,
        semantic: {
          ...(editor.store.get(pasted as string)?.semantic as object),
          reference: "R1",
        },
      },
    ]);
    expect(editor.annotateBreadboard(page.id)).toBe(true);
    expect(
      (editor.store.get(pasted as string)?.semantic as { reference: string })
        .reference,
    ).toBe("R2");
    editor.undo();
    expect(
      (editor.store.get(pasted as string)?.semantic as { reference: string })
        .reference,
    ).toBe("R1");

    const other = editor.createBreadboardPart("breadboard.resistor", {
      x: 90,
      y: 80,
    });
    editor.apply([
      {
        type: "updateSemantic",
        id: other as string,
        semantic: {
          ...(editor.store.get(other as string)?.semantic as object),
          reference: "R1",
        },
      },
    ]);
    editor.selection.set([other as string]);
    editor.copySelection();
    editor.setCurrentPage(secondPage.id);
    const freeformCopy = editor.paste()[0];
    expect(
      (
        editor.store.get(freeformCopy as string)?.semantic as {
          reference: string;
        }
      ).reference,
    ).toBe("R1");
  });

  test("probe listeners notify on changes and page switching clears transient state", () => {
    const editor = makeBreadboardEditor();
    const changes: unknown[] = [];
    editor.onBreadboardProbeChange((probe) => changes.push(probe));
    const probe = {
      pageId: page.id,
      elementIds: ["part"],
      pin: { elementId: "part", pin: 1 },
    };
    editor.setBreadboardProbe(probe);
    editor.setBreadboardProbe({ ...probe, elementIds: ["part"] });
    expect(changes).toEqual([probe]);
    editor.setCurrentPage(secondPage.id);
    expect(editor.breadboardProbe()).toBeNull();
    expect(changes).toEqual([probe, null]);
  });
});
