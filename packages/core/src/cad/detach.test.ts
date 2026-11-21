import { expect, test } from "bun:test";
import { hasErrors, validateDocument } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { makeEditor } from "../test-helpers.ts";

const plateSource = await Bun.file(
  new URL("../../../io/src/__fixtures__/cad3d.jsonl", import.meta.url),
).text();

const cut = {
  name: "Bore",
  sketch: "sketch-top",
  loops: ["circle-bore"],
  distance: -6,
  op: "cut",
  bodies: ["plate"],
};

test.each([
  {
    target: "sketch-top",
    survivor: "cut",
    detached: {
      name: "Bore",
      loops: [],
      distance: -6,
      op: "cut",
      bodies: ["plate"],
    },
    removed: ["sketch-top", "circle-bore"],
  },
  {
    target: "plate",
    survivor: "cut",
    detached: { ...cut, bodies: [] },
    removed: ["plate"],
  },
  {
    target: "circle-bore",
    survivor: "cut",
    detached: { ...cut, loops: [] },
    removed: ["circle-bore"],
  },
  {
    target: "plate",
    survivor: "sketch-top",
    detached: { name: "Mounting hole", plane: { face: { role: "end" } } },
    removed: ["plate"],
  },
  {
    target: "arc-rim",
    survivor: "sketch-side",
    detached: {
      name: "Side sketch",
      plane: { face: { feature: "plate", role: "side" } },
    },
    removed: ["arc-rim"],
  },
])(
  "deleting $target leaves $survivor editable and undoable",
  ({ target, survivor, detached, removed }) => {
    const editor = makeEditor({ document: parseDocument(plateSource) });
    editor.createElement("cad.sketch", {
      id: "sketch-side",
      semantic: {
        name: "Side sketch",
        plane: { face: { feature: "plate", role: "side", entity: "arc-rim" } },
      },
    });
    const original = editor.getSnapshot();

    editor.apply([{ type: "deleteElements", ids: [target] }]);
    expect(editor.store.get(survivor)?.semantic).toEqual(detached);
    for (const id of removed) expect(editor.store.has(id)).toBe(false);
    const snapshot = editor.getSnapshot();
    expect(hasErrors(validateDocument(snapshot))).toBe(false);
    expect(parseDocument(serializeDocument(snapshot))).toEqual(snapshot);

    const edited = { ...detached, name: "Edited feature" };
    editor.apply([{ type: "updateSemantic", id: survivor, semantic: edited }]);
    expect(editor.store.get(survivor)?.semantic).toEqual(edited);
    expect(editor.undo()).toBe(true);
    expect(editor.store.get(survivor)?.semantic).toEqual(detached);
    expect(editor.undo()).toBe(true);
    expect(editor.getSnapshot()).toEqual(original);
  },
);
