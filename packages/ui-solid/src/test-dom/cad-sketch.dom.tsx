import assert from "node:assert/strict";
import {
  type CadDisplayBody,
  type CadEngine,
  collectCadInput,
  Editor,
  sketchFrameOf,
  sketchParentOf,
  toWorld,
  type Vec3,
} from "@nodetto/core";
import { type CadXY, hasErrors, validateDocument } from "@nodetto/ir";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import {
  edge as pcbEdge,
  PCB_TEST_PAGE,
  testBoard,
} from "../../../core/src/cad/testing/pcb.ts";
import { plateWithHoles } from "../../../core/src/cad/testing/documents.ts";
import { type Camera3d, viewProjection } from "../cad/camera3d.ts";
import type { CadRenderer } from "../cad/renderer.ts";
import type { CadTheme } from "../cad/theme.ts";
import { NodettoCanvas } from "../Canvas.tsx";
import { Tool, type ToolKind } from "../tools.ts";
import { preloadCadUi } from "../cad-ui.tsx";

await preloadCadUi();

const style = document.createElement("style");
style.textContent = await Bun.file(
  new URL("../../../../apps/desktop/src/styles/canvas.css", import.meta.url),
).text();
document.head.append(style);
window.HTMLElement.prototype.getBoundingClientRect = () =>
  new window.DOMRect(0, 0, 500, 500);

const nextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

for (const mode of ["light", "dark"] as const) {
  document.documentElement.dataset.nodettoTheme = mode;
  const doc = plateWithHoles(1);
  const editor = new Editor({
    document: {
      ...doc,
      pages: [
        ...doc.pages,
        { id: "free", kind: "freeform", name: "Drawing" },
        PCB_TEST_PAGE,
      ],
      elements: [
        ...doc.elements,
        testBoard(5),
        pcbEdge("board-rim", { kind: "rect", start: [0, 0], end: [100, 60] }),
      ],
    },
  });
  editor.setCurrentPage("cad");
  const [tool, setTool] = createSignal<ToolKind>(Tool.Select);
  let faceName = "ex1:end";
  let displayBoard = false;
  let boardReferenceId = "";
  const body: CadDisplayBody = {
    id: "ex1",
    positions: new Float32Array([0, 0, 5, 100, 0, 5, 100, 60, 5, 0, 60, 5]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    triFace: new Uint32Array([0, 0]),
    faceNames: [faceName],
    edges: new Float32Array(),
    reference: false,
  };
  let evaluations = 0;
  const engine: CadEngine = {
    evaluate: async ({ revision, elements }) => {
      if (
        elements.some(({ type }) => type === "cad.pcb") &&
        editor.store.has("board")
      )
        assert.ok(elements.some(({ id }) => id === "board-rim"));
      evaluations++;
      return {
        revision,
        bodies: [
          displayBoard
            ? {
                ...body,
                id: boardReferenceId,
                reference: true,
                faceNames: [faceName],
              }
            : { ...body, faceNames: [faceName] },
        ],
        status: [],
      };
    },
    dispose: () => {},
  };
  let lastCamera: Camera3d | undefined;
  let theme: CadTheme | undefined;
  let lineOverlay: Float32Array | null = null;
  let meshOverlay: Parameters<CadRenderer["setOverlay"]>[1] = null;
  let gridOverlay: Float32Array | null = null;
  let highlight = new Float32Array();
  const renderer: CadRenderer = {
    diagnostics: { programsLinked: true, renderer: "DOM stub" },
    setTheme: (next) => {
      theme = next;
    },
    setBodies: () => {},
    setHighlight: () => {},
    setOverlay: (lines, mesh) => {
      lineOverlay = lines;
      meshOverlay = mesh;
    },
    setSketchGrid: (lines) => {
      gridOverlay = lines;
    },
    setSketchLines: (_, selected) => {
      highlight = new Float32Array(selected);
    },
    draw: (camera) => {
      lastCamera = camera;
    },
    dispose: () => {},
  };
  const host = document.createElement("main");
  document.body.append(host);
  const dispose = render(
    () => (
      <NodettoCanvas
        editor={editor}
        tool={tool()}
        onToolChange={setTool}
        cadEngine={engine}
        createCadRenderer={() => renderer}
        canvasBackground={{ diagram: mode, pcb: mode }}
        snap={{ grid: true, objects: true }}
        showGrid
      />
    ),
    host,
  );
  await nextFrame();
  const canvas = host.querySelector<HTMLCanvasElement>(".nodetto-cad-surface");
  const viewport = host.querySelector<HTMLElement>(".nodetto-cad-viewport");
  assert.ok(canvas && viewport);
  function coords(point: Vec3): [number, number] {
    assert.ok(lastCamera);
    const v = viewProjection(lastCamera, 1);
    const [x, y, z] = point;
    const clip = (i: number) =>
      v[i] * x + v[4 + i] * y + v[8 + i] * z + v[12 + i];
    return [250 * (1 + clip(0) / clip(3)), 250 * (1 - clip(1) / clip(3))];
  }
  function pointer(type: string, point: Vec3, altKey = false) {
    const [x, y] = coords(point);
    canvas?.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        clientX: x,
        clientY: y,
        altKey,
        button: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  function click(point: Vec3, altKey = false) {
    pointer("pointerdown", point, altKey);
    pointer("pointerup", point, altKey);
  }
  function pressEscape() {
    viewport?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  const selectedId = () => [...editor.selection.ids()][0];
  const entities = (id: string) =>
    editor.store.getPageElements("cad").filter((e) => sketchParentOf(e) === id);

  const beforeInsert = editor.history.undoSize;
  const beforeInsertEval = evaluations;
  setTool(Tool.CadPcb);
  const reference = selectedId();
  assert.ok(reference);
  boardReferenceId = reference;
  assert.equal(editor.store.get(reference)?.type, "cad.pcb");
  assert.deepEqual(editor.store.get(reference)?.semantic, {
    name: "PCB board",
    board: "board",
  });
  assert.equal(tool(), Tool.Select);
  assert.equal(evaluations, beforeInsertEval + 1);
  assert.equal(editor.history.undoSize, beforeInsert + 1);
  assert.ok(editor.undo());
  assert.equal(editor.store.has(reference), false);
  assert.ok(editor.redo());
  assert.equal(editor.store.get(reference)?.type, "cad.pcb");
  editor.selection.clear();
  await nextFrame();

  assert.deepEqual(
    theme?.highlight,
    mode === "light" ? [51, 92, 103] : [95, 180, 199],
  );
  const beforeOrbit = lastCamera?.yaw;
  const beforeNavigation = editor.getSnapshot();
  pointer("pointerdown", [73, 42, 5]);
  pointer("pointermove", [62, 28, 5]);
  pointer("pointerup", [62, 28, 5]);
  await nextFrame();
  assert.notEqual(lastCamera?.yaw, beforeOrbit);
  assert.equal(editor.getSnapshot(), beforeNavigation);

  function begin() {
    setTool(Tool.CadSketch);
    const id = selectedId();
    assert.equal(tool(), Tool.Select);
    assert.equal(editor.store.get(id)?.type, "cad.sketch");
    return id;
  }
  function undoRedo(id: string, before: number, types: readonly string[]) {
    assert.deepEqual(
      entities(id).map(({ type }) => type),
      types,
    );
    assert.ok(editor.undo());
    assert.equal(entities(id).length, before);
    assert.ok(editor.redo());
    assert.deepEqual(
      entities(id).map(({ type }) => type),
      types,
    );
  }

  const base = begin();
  assert.deepEqual(editor.store.get(base)?.semantic, {
    name: "Sketch 1",
    plane: { base: "xy" },
  });

  async function drawShapes(id: string, z: number) {
    const frame = sketchFrameOf(editor.store.getPageElements("cad"), id);
    assert.ok(frame);
    const point = (p: CadXY) => toWorld(frame, p);
    setTool(Tool.CadRect);
    await nextFrame();
    assert.equal(lastCamera?.ortho, true);
    assert.ok(gridOverlay && (gridOverlay as Float32Array).length > 0);
    assert.ok(
      (gridOverlay as Float32Array).every((v, i) => i % 3 !== 2 || v === z),
    );
    const before = evaluations;
    pointer("pointerdown", point([20.45, 20.45]));
    pointer("pointerup", point([20.55, 20.55]));
    assert.equal(entities(id).length, 0);
    assert.equal(evaluations, before);
    pressEscape();
    pointer("pointerdown", point([20, 20]));
    pointer("pointermove", point([32, 28]));
    assert.equal(entities(id).length, 0);
    assert.equal(evaluations, before);
    assert.equal((lineOverlay as Float32Array | null)?.length, 24);
    pointer("pointerup", point([32, 28]));
    assert.equal(evaluations, before + 1);
    assert.equal(highlight.length, 24);
    const lines = ["cad.line", "cad.line", "cad.line", "cad.line"];
    undoRedo(id, 0, lines);
    editor.selection.set([id]);

    setTool(Tool.CadCircle);
    await nextFrame();
    click(point([45, 37]), true);
    click(point([47.4, 37]), true);
    undoRedo(id, 4, [...lines, "cad.circle"]);
    assert.deepEqual(entities(id).at(-1)?.semantic, {
      sketch: id,
      c: [45, 37],
      r: 2.4,
    });
    assert.ok(highlight.every((v, i) => i % 3 !== 2 || v === z));
    return point;
  }

  await drawShapes(base, 0);
  setTool(Tool.Select);
  click([73, 42, 5]);
  assert.equal(selectedId(), "ex1");
  const face = begin();
  assert.deepEqual(editor.store.get(face)?.semantic, {
    name: "Sketch 2",
    plane: { face: { feature: "ex1", role: "end" } },
  });
  const facePoint = await drawShapes(face, 5);

  setTool(Tool.Select);
  click(facePoint([26, 20]));
  const edge = editor.store.get(selectedId());
  assert.ok(edge && sketchParentOf(edge) === face);
  setTool(Tool.CadLine);
  const beforeLine = evaluations;
  click(facePoint([60, 25]));
  pointer("pointermove", facePoint([60, 32]));
  assert.equal(evaluations, beforeLine);
  click(facePoint([60, 32]));
  assert.equal(evaluations, beforeLine + 1);
  assert.equal(entities(face).length, 6);
  assert.match(viewport.textContent ?? "", /profile is open/);
  pressEscape();
  assert.equal(tool(), Tool.CadLine);
  pressEscape();
  assert.equal(tool(), Tool.Select);
  assert.equal(selectedId(), edge.id);
  assert.ok(editor.undo());
  assert.equal(entities(face).length, 5);

  setTool(Tool.CadArc);
  await nextFrame();
  click(facePoint([65, 24]));
  click(facePoint([75, 24]));
  click(facePoint([70, 24]));
  assert.equal(entities(face).length, 5);
  assert.match(viewport.textContent ?? "", /valid sketch entity/);
  click(facePoint([70, 30]));
  assert.deepEqual(entities(face).at(-1)?.semantic, {
    sketch: face,
    a: [65, 24],
    m: [70, 30],
    b: [75, 24],
  });
  assert.ok(editor.undo());
  assert.equal(entities(face).length, 5);

  editor.selection.set([face]);
  setTool(Tool.CadRect);
  await nextFrame();
  pointer("pointerdown", facePoint([65, 24]));
  pointer("pointermove", facePoint([75, 30]));
  pointer("pointercancel", facePoint([75, 30]));
  assert.equal(entities(face).length, 5);
  assert.equal(lineOverlay, null);
  editor.apply([{ type: "updateVisual", id: face, visual: { locked: true } }]);
  click(facePoint([65, 24]));
  click(facePoint([75, 30]));
  assert.equal(entities(face).length, 5);
  assert.match(viewport.textContent ?? "", /read-only/);

  setTool(Tool.Select);
  faceName = "ex2:side:hole-0";
  editor.apply([{ type: "updateVisual", id: face, visual: { locked: false } }]);
  await nextFrame();
  click([73, 42, 5]);
  assert.equal(selectedId(), "ex2");
  const beforeInvalid = editor.getSnapshot();
  setTool(Tool.CadSketch);
  assert.equal(editor.getSnapshot(), beforeInvalid);
  assert.match(viewport.textContent ?? "", /face is curved/);
  assert.equal(tool(), Tool.Select);
  assert.equal(hasErrors(validateDocument(editor.getSnapshot())), false);

  function chooseExtrude(sketch: string, op: "new" | "add") {
    editor.selection.set([sketch]);
    const before = evaluations;
    setTool(Tool.CadExtrude);
    const id = selectedId();
    assert.equal(tool(), Tool.Select);
    assert.equal(evaluations, before + 1);
    assert.equal(editor.store.get(id)?.type, "cad.extrude");
    assert.deepEqual(editor.store.get(id)?.semantic, {
      sketch,
      op,
      distance: 10,
      name: op === "new" ? "Extrude 1" : "Extrude 2",
      ...(op === "add" ? { bodies: ["ex1"] } : {}),
    });
    return id;
  }

  const baseExtrude = chooseExtrude(base, "new");
  const faceExtrude = chooseExtrude(face, "add");
  await nextFrame();
  const handle = lineOverlay as Float32Array | null;
  assert.ok(handle);
  const tail: Vec3 = [handle[0], handle[1], handle[2]];
  const tip: Vec3 = [handle[3], handle[4], handle[5]];
  assert.equal(tail[2], 5);
  assert.equal(tip[2], 15);
  const inward: Vec3 = [tail[0], tail[1], 2];
  const beforeDrag = editor.getSnapshot();
  const beforeEvaluation = evaluations;
  pointer("pointerdown", tip);
  pointer("pointermove", inward);
  assert.equal(editor.getSnapshot(), beforeDrag);
  assert.equal(evaluations, beforeEvaluation);
  assert.match(viewport.textContent ?? "", /-3 mm/);
  const preview = meshOverlay as Parameters<CadRenderer["setOverlay"]>[1];
  assert.ok(
    preview && preview.indices.length > 0 && preview.positions.includes(2),
  );
  editor.renamePage("free", "Unrelated drawing edited during the drag");
  assert.match(viewport.textContent ?? "", /-3 mm/);
  assert.equal(evaluations, beforeEvaluation);
  pointer("pointerup", inward);
  assert.equal(evaluations, beforeEvaluation + 1);
  assert.equal(meshOverlay, null);
  assert.deepEqual(editor.store.get(faceExtrude)?.semantic, {
    sketch: face,
    name: "Extrude 2",
    distance: -3,
    op: "cut",
    bodies: ["ex1"],
  });
  assert.ok(editor.undo());
  assert.deepEqual(editor.store.get(faceExtrude)?.semantic, {
    sketch: face,
    name: "Extrude 2",
    distance: 10,
    op: "add",
    bodies: ["ex1"],
  });
  assert.ok(editor.redo());
  assert.deepEqual(editor.store.get(faceExtrude)?.semantic, {
    sketch: face,
    name: "Extrude 2",
    distance: -3,
    op: "cut",
    bodies: ["ex1"],
  });
  editor.selection.set([faceExtrude]);
  const beforeCancel = editor.getSnapshot();
  pointer("pointerdown", inward);
  pointer("pointermove", tip);
  assert.ok(meshOverlay);
  pressEscape();
  assert.match(viewport.textContent ?? "", /drag cancelled/);
  pointer("pointerup", tip);
  assert.equal(meshOverlay, null);
  assert.equal(editor.getSnapshot(), beforeCancel);
  assert.equal(selectedId(), faceExtrude);
  click(inward);
  assert.equal(editor.getSnapshot(), beforeCancel);

  pointer("pointerdown", inward);
  pointer("pointermove", tip);
  editor.apply([
    { type: "updateVisual", id: faceExtrude, visual: { locked: true } },
  ]);
  const locked = editor.getSnapshot();
  assert.match(viewport.textContent ?? "", /drag cancelled/);
  pointer("pointerup", tip);
  assert.equal(meshOverlay, null);
  assert.equal(editor.getSnapshot(), locked);

  editor.selection.set([baseExtrude]);
  const baseHandle = lineOverlay as Float32Array | null;
  assert.ok(baseHandle);
  pointer("pointerdown", [baseHandle[3], baseHandle[4], baseHandle[5]]);
  pointer("pointerup", [baseHandle[0], baseHandle[1], -2]);
  assert.deepEqual(editor.store.get(baseExtrude)?.semantic, {
    sketch: base,
    name: "Extrude 1",
    distance: -2,
    op: "new",
  });
  assert.equal(hasErrors(validateDocument(editor.getSnapshot())), false);

  faceName = `${boardReferenceId}:end`;
  displayBoard = true;
  editor.apply([
    {
      type: "updateSemantic",
      id: "board",
      semantic: { ...testBoard(5).semantic, generator: "dom" },
    },
  ]);
  await nextFrame();
  click([73, 42, 5]);
  assert.equal(selectedId(), boardReferenceId);
  const boardSketch = begin();
  assert.ok(boardSketch);
  assert.deepEqual(editor.store.get(boardSketch)?.semantic, {
    name: "Sketch 3",
    plane: { face: { feature: boardReferenceId, role: "end" } },
  });
  assert.deepEqual(
    sketchFrameOf(
      collectCadInput(editor.getSnapshot(), "cad", 0).elements,
      boardSketch,
    )?.o,
    [0, 0, 5],
  );
  editor.apply([
    { type: "updateSemantic", id: "board", semantic: testBoard(6).semantic },
  ]);
  await nextFrame();
  setTool(Tool.CadRect);
  await nextFrame();
  assert.ok(
    gridOverlay &&
      (gridOverlay as Float32Array).every(
        (value, i) => i % 3 !== 2 || value === 6,
      ),
  );
  pointer("pointerdown", [32, 24, 6]);
  pointer("pointermove", [44, 30, 6]);
  pointer("pointerup", [44, 30, 6]);
  assert.equal(entities(boardSketch).length, 4);
  setTool(Tool.CadExtrude);
  const boardExtrude = selectedId();
  assert.ok(boardExtrude);
  assert.equal(editor.store.get(boardExtrude)?.type, "cad.extrude");
  assert.deepEqual(editor.store.get(boardExtrude)?.semantic, {
    sketch: boardSketch,
    name: "Extrude 3",
    distance: 10,
    op: "new",
  });

  const pocketPlane = { face: { feature: boardReferenceId, role: "start" } };
  editor.apply([
    {
      type: "updateSemantic",
      id: boardSketch,
      semantic: { name: "Sketch 3", plane: pocketPlane },
    },
  ]);
  const pocket = {
    sketch: boardSketch,
    name: "Extrude 3",
    distance: -2,
    op: "cut",
    bodies: ["ex1"],
  };
  editor.apply([
    { type: "updateSemantic", id: boardExtrude, semantic: pocket },
  ]);
  editor.selection.set([boardExtrude]);
  await nextFrame();
  const pocketHandle = lineOverlay as Float32Array | null;
  assert.ok(pocketHandle);
  const pocketTip: Vec3 = [pocketHandle[3], pocketHandle[4], pocketHandle[5]];
  assert.equal(pocketTip[2], -2);
  const deeper: Vec3 = [pocketTip[0], pocketTip[1], -9];
  const beforePocketDrag = editor.history.undoSize;
  pointer("pointerdown", pocketTip);
  pointer("pointermove", deeper);
  assert.deepEqual(editor.store.get(boardExtrude)?.semantic, pocket);
  pointer("pointerup", deeper);
  assert.equal(editor.history.undoSize, beforePocketDrag + 1);
  assert.deepEqual(editor.store.get(boardExtrude)?.semantic, {
    ...pocket,
    distance: -9,
  });
  assert.ok(editor.undo());
  assert.deepEqual(editor.store.get(boardExtrude)?.semantic, pocket);

  const legend = pcbEdge(
    "legend",
    { kind: "rect", start: [0, 0], end: [10, 6] },
    "F.SilkS",
  );
  const beforeOutlineEdit = evaluations;
  editor.apply([{ type: "createElement", element: legend }]);
  assert.equal(evaluations, beforeOutlineEdit);
  editor.apply([
    {
      type: "updateSemantic",
      id: "board-rim",
      semantic: pcbEdge("board-rim", {
        kind: "rect",
        start: [0, 0],
        end: [101, 65],
      }).semantic,
    },
  ]);
  assert.equal(evaluations, beforeOutlineEdit + 1);

  const secondPage = {
    ...PCB_TEST_PAGE,
    id: "second-pcb",
    name: "Expansion board",
  };
  const secondBoard = {
    ...testBoard(4),
    id: "second-board",
    page: secondPage.id,
  };
  editor.apply([
    { type: "createPage", page: secondPage },
    { type: "createElement", element: secondBoard },
  ]);
  setTool(Tool.CadPcb);
  await nextFrame();
  const menu = viewport.querySelector('[role="menu"]');
  const buttons = [
    ...(menu?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ];
  assert.deepEqual(
    buttons.map((item) => item.textContent),
    ["Circuit", "Expansion board"],
  );
  assert.equal(document.activeElement, buttons[0]);
  const beforeKeys = editor.getSnapshot();
  for (const key of ["Delete", "Backspace"]) {
    buttons[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  }
  assert.equal(editor.getSnapshot(), beforeKeys);
  assert.ok(selectedId() && editor.store.has(selectedId() ?? ""));
  buttons[0]?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(document.activeElement, buttons[1]);
  const beforeChoice = editor.history.undoSize;
  buttons[1]?.click();
  assert.equal(editor.history.undoSize, beforeChoice + 1);
  assert.deepEqual(editor.store.get(selectedId())?.semantic, {
    name: "PCB board",
    board: secondBoard.id,
  });
  assert.equal(viewport.querySelector('[role="menu"]'), null);
  setTool(Tool.CadPcb);
  await nextFrame();
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(viewport.querySelector('[role="menu"]'), null);
  assert.equal(editor.history.undoSize, beforeChoice + 1);

  setTool(Tool.CadPcb);
  await nextFrame();
  host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  assert.equal(viewport.querySelector('[role="menu"]'), null);
  assert.equal(tool(), Tool.Select);
  setTool(Tool.CadPcb);
  await nextFrame();
  pressEscape();
  assert.equal(viewport.querySelector('[role="menu"]'), null);
  setTool(Tool.CadPcb);
  await nextFrame();
  editor.setCurrentPage("free");
  assert.equal(tool(), Tool.Select);
  setTool(Tool.CadPcb);
  editor.setCurrentPage("cad");
  await nextFrame();
  assert.equal(tool(), Tool.Select);
  const remounted = host.querySelector(".nodetto-cad-viewport");
  assert.ok(remounted);
  assert.equal(remounted.querySelector('[role="menu"]'), null);

  editor.setReadOnly(true);
  setTool(Tool.CadPcb);
  assert.equal(tool(), Tool.Select);
  assert.equal(editor.history.undoSize, beforeChoice + 1);
  editor.setReadOnly(false);
  editor.apply([
    { type: "deletePage", id: PCB_TEST_PAGE.id },
    { type: "deletePage", id: secondPage.id },
  ]);
  const boardless = editor.getSnapshot();
  editor.selection.set([baseExtrude]);
  setTool(Tool.CadPcb);
  assert.equal(editor.getSnapshot(), boardless);
  assert.match(remounted.textContent ?? "", /no PCB page with a board/);
  editor.selection.clear();
  assert.doesNotMatch(remounted.textContent ?? "", /no PCB page with a board/);
  setTool(Tool.CadPcb);
  assert.match(remounted.textContent ?? "", /no PCB page with a board/);
  editor.renamePage("free", "Renamed drawing");
  assert.doesNotMatch(remounted.textContent ?? "", /no PCB page with a board/);

  editor.setCurrentPage("free");
  const beforeFreeform = editor.getSnapshot();
  setTool(Tool.CadSketch);
  assert.equal(host.querySelector(".nodetto-cad-surface"), null);
  assert.equal(editor.getSnapshot(), beforeFreeform);
  setTool(Tool.CadExtrude);
  assert.equal(editor.getSnapshot(), beforeFreeform);
  setTool(Tool.CadPcb);
  assert.equal(editor.getSnapshot(), beforeFreeform);
  dispose();
  host.remove();
  console.log(`sketch ok ${mode}`);
  console.log(`extrude ok ${mode}`);
  console.log(`pcb ok ${mode}`);
}
