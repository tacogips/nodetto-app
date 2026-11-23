import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  cadElement,
  plateWithHoles,
} from "../../../core/src/cad/testing/documents.ts";
import { boardReference } from "../../../core/src/cad/testing/pcb.ts";
import {
  setCadBoard,
  setCadFlag,
  setCadNumber,
  setCadOperation,
  setCadPoint,
} from "./cad-edits.ts";

const circle = cadElement("hole", "cad.circle", "A", { c: [2, 3], r: 5 });
const extrude = cadElement("solid", "cad.extrude", "B", {
  name: "Solid",
  distance: 2,
  op: "new",
});
const sketch = cadElement("sketch", "cad.sketch", "C", {
  name: "Sketch",
  plane: { base: "zx" },
});

test("PCB reference edits preserve parameters and can restore board thickness", () => {
  const reference = boardReference();
  expect(setCadBoard(reference, "second-board")).toEqual({
    type: "updateSemantic",
    id: reference.id,
    semantic: { ...reference.semantic, board: "second-board" },
  });
  expect(setCadBoard(reference, "board")).toEqual({ error: "unchanged" });
  expect(setCadNumber(reference, "thickness", "0")).toHaveProperty("error");
  expect(setCadNumber(reference, "thickness", "101")).toHaveProperty("error");
  expect(setCadNumber(reference, "thickness", "1.2345678")).toMatchObject({
    semantic: { thickness: 1.234568 },
  });
  expect(setCadNumber(reference, "thickness", " ")).toEqual({
    error: "unchanged",
  });
  expect(setCadNumber(boardReference(3), "thickness", "")).toEqual({
    type: "updateSemantic",
    id: reference.id,
    semantic: reference.semantic,
  });
});

test("CAD length edits snap decimal input and reject invalid lengths", () => {
  expect(setCadNumber(circle, "r", "6")).toEqual({
    type: "updateSemantic",
    id: "hole",
    semantic: { c: [2, 3], r: 6 },
  });
  expect(setCadNumber(circle, "r", "1.23456789")).toMatchObject({
    semantic: { r: 1.234568 },
  });
  for (const text of [
    "-1",
    "0.0000004",
    "NaN",
    "Infinity",
    "1e999",
    "0x10",
    " ",
  ])
    expect(setCadNumber(circle, "r", text)).toHaveProperty("error");
  expect(setCadNumber(extrude, "distance", "0")).toHaveProperty("error");
  expect(setCadNumber(extrude, "distance", "-2")).toMatchObject({
    semantic: { distance: -2 },
  });
  expect(setCadNumber(circle, "r", "5.0000001")).toEqual({
    error: "unchanged",
  });
});

test("point and sketch offset edits preserve the rest of the field", () => {
  expect(setCadPoint(circle, "c", 1, "6.25")).toMatchObject({
    semantic: { c: [2, 6.25], r: 5 },
  });
  expect(setCadPoint(circle, "c", 1, "10000.001")).toHaveProperty("error");
  expect(setCadPoint(circle, "c", 0, "2.0")).toEqual({ error: "unchanged" });
  expect(setCadNumber(sketch, "offset", "0")).toEqual({ error: "unchanged" });
  expect(setCadNumber(sketch, "offset", "-.2")).toMatchObject({
    semantic: { plane: { base: "zx", offset: -0.2 } },
  });
});

test("operation and body targets change together and optional flags skip no-ops", () => {
  const cut = setCadOperation(extrude, "cut", ["a", "b"]);
  expect(cut).toMatchObject({ semantic: { op: "cut", bodies: ["a", "b"] } });
  if ("error" in cut || cut.type !== "updateSemantic")
    throw new Error("expected a cut edit");
  const current = { ...extrude, semantic: cut.semantic };
  expect(setCadOperation(current, "cut", ["a", "b"])).toEqual({
    error: "unchanged",
  });
  expect(setCadOperation(current, "other", [])).toHaveProperty("error");
  expect(setCadOperation(current, "new", ["a"])).toEqual({
    type: "updateSemantic",
    id: extrude.id,
    semantic: extrude.semantic,
  });
  expect(setCadFlag(circle, "construction", false)).toEqual({
    error: "unchanged",
  });
  expect(setCadFlag(circle, "construction", true)).toMatchObject({
    semantic: { construction: true },
  });
});

test("each accepted parameter edit adds one undo step and redo restores it", () => {
  const editor = new Editor({ document: plateWithHoles(1) });
  const hole = editor.store.get("hole-0");
  if (!hole) throw new Error("fixture is missing the hole");
  const edit = setCadNumber(hole, "r", "6");
  if ("error" in edit) throw new Error(edit.error);
  const before = editor.history.undoSize;
  editor.apply([edit]);
  expect(editor.history.undoSize).toBe(before + 1);
  expect(editor.store.get(hole.id)?.semantic).toMatchObject({ r: 6 });
  editor.undo();
  expect(editor.store.get(hole.id)?.semantic).toEqual(hole.semantic);
  editor.redo();
  expect(editor.store.get(hole.id)?.semantic).toMatchObject({ r: 6 });
  expect(editor.history.undoSize).toBe(before + 1);
});

test("CAD layers and inspector share selection, edits and statuses in light and dark", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--conditions=browser",
      "--config=./test-dom/bunfig.toml",
      "--preload",
      "./test-dom/setup.ts",
      "./test-dom/cad-inspector.dom.tsx",
    ],
    { cwd: `${import.meta.dir}/..`, stdout: "pipe", stderr: "pipe" },
  );
  const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain("ok light");
  expect(output).toContain("ok dark");
});
