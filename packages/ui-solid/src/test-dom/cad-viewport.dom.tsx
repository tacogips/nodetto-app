import assert from "node:assert/strict";
import {
  type CadDisplayBody,
  type CadEngine,
  type CadEngineInput,
  type CadEngineResult,
  CadSupersededError,
  Editor,
} from "@nodetto/core";
import { type Element, isPlainObject } from "@nodetto/ir";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import {
  CAD_TEST_PAGE,
  plateWithHoles,
  rectangle,
  sketch,
} from "../../../core/src/cad/testing/documents.ts";
import { document as makeDocument } from "../../../core/src/test-helpers.ts";
import { type Camera3d, fitBounds, viewProjection } from "../cad/camera3d.ts";
import type { CadRenderer } from "../cad/renderer.ts";
import type { CadTheme } from "../cad/theme.ts";
import { NodettoCanvas, type NodettoCanvasProps } from "../Canvas.tsx";
import { Layers } from "../Layers.tsx";
import { ShapePalette } from "../ShapePalette.tsx";
import { Tool } from "../tools.ts";
import { preloadCadUi } from "../cad-ui.tsx";

await preloadCadUi();

globalThis.getComputedStyle = window.getComputedStyle.bind(window);

const style = document.createElement("style");
style.textContent = await Bun.file(
  new URL("../../../../apps/desktop/src/styles/canvas.css", import.meta.url),
).text();
document.head.append(style);
const darkBackground = [21, 25, 27];
const lightBackground = [246, 244, 238];
const surface = ".nodetto-cad-surface";
const body: CadDisplayBody = {
  id: "ex1",
  positions: new Float32Array([-20, -20, 0, 20, -20, 0, 0, 20, 0]),
  indices: new Uint32Array([0, 1, 2]),
  triFace: new Uint32Array([0]),
  faceNames: ["ex1:end"],
  edges: new Float32Array(),
  reference: false,
};

let viewportWidth = 400;
let viewportHeight = 400;
const originalBounds = window.HTMLElement.prototype.getBoundingClientRect;
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return this.matches(".nodetto-canvas, .nodetto-cad-surface")
    ? new window.DOMRect(0, 0, viewportWidth, viewportHeight)
    : originalBounds.call(this);
};

function point(
  target: HTMLElement,
  type: string,
  x: number,
  y: number,
  button = 0,
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      clientX: x,
      clientY: y,
      button,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function movePointer(target: HTMLElement, x: number, y: number, button = 0) {
  point(target, "pointerdown", x, y, button);
  point(target, "pointermove", x + 30, y + 15, button);
  point(target, "pointerup", x + 30, y + 15, button);
}

function edit(editor: Editor, id: string, radius: number) {
  const hole = editor.store.get(id);
  assert.ok(hole && isPlainObject(hole.semantic));
  editor.apply([
    { type: "updateSemantic", id, semantic: { ...hole.semantic, r: radius } },
  ]);
}

const painted = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

for (const theme of ["light", "dark"] as const) {
  document.documentElement.dataset.nodettoTheme = theme;
  const doc = plateWithHoles();
  const editor = new Editor({
    document: {
      ...doc,
      pages: [
        ...doc.pages,
        { id: "drawing", name: "Drawing", kind: "freeform" },
      ],
    },
  });
  editor.setCurrentPage("cad");
  const [available, setAvailable] = createSignal(true);
  const [engineAvailable, setEngineAvailable] = createSignal(true);
  const [mode, setMode] = createSignal(theme);
  const [drop, setDrop] = createSignal<NodettoCanvasProps["shapeDrop"]>();
  const [viewControls, setViewControls] =
    createSignal<
      Parameters<NonNullable<NodettoCanvasProps["onCadViewControls"]>>[0]
    >();
  const requests: {
    input: CadEngineInput;
    resolve: (result: CadEngineResult) => void;
    reject: (error: Error) => void;
  }[] = [];
  const engine: CadEngine = {
    evaluate: (input) =>
      new Promise((resolve, reject) => {
        // This uses actual editor store records, as the production worker does.
        assert.deepEqual(structuredClone(input), input);
        requests.push({ input, resolve, reject });
      }),
    dispose: () => assert.fail("only the engine owner can dispose the worker"),
  };
  const mounts: {
    uploads: (readonly CadDisplayBody[])[];
    highlights: Parameters<CadRenderer["setHighlight"]>[0][];
    themes: CadTheme[];
    cameras: Camera3d[];
    disposed: boolean;
  }[] = [];
  function createRenderer(): CadRenderer | null {
    if (!available()) return null;
    const mount: (typeof mounts)[number] = {
      uploads: [],
      highlights: [],
      themes: [],
      cameras: [],
      disposed: false,
    };
    mounts.push(mount);
    return {
      diagnostics: { programsLinked: true, renderer: "DOM stub" },
      setBodies: (bodies) => {
        mount.uploads.push(bodies);
      },
      setHighlight: (hit) => {
        mount.highlights.push(hit);
      },
      setTheme: (theme) => {
        mount.themes.push(theme);
      },
      setOverlay: () => {},
      draw: (camera) => {
        mount.cameras.push(camera);
      },
      dispose: () => {
        mount.disposed = true;
      },
    };
  }
  const root = document.createElement("main");
  document.body.append(root);
  const dispose = render(
    () => (
      <>
        <ShapePalette
          editor={editor}
          workspace="cad3d"
          tool={Tool.Select}
          onToolChange={() => {}}
          context={{
            editor,
            viewport: { width: viewportWidth, height: viewportHeight },
            requestEdit: () => {},
            exportSvg: () => {},
          }}
          cadViewControls={viewControls()}
        />
        <NodettoCanvas
          editor={editor}
          tool={Tool.Rectangle}
          cadEngine={engineAvailable() ? engine : undefined}
          createCadRenderer={createRenderer}
          canvasBackground={{ diagram: mode(), pcb: mode() }}
          snap={{ grid: false, objects: false }}
          showGrid={false}
          shapeDrop={drop()}
          onCadViewControls={setViewControls}
        />
        <Layers editor={editor} simple />
      </>
    ),
    root,
  );
  const layer = () => root.querySelector(".nodetto-layer") !== null;
  const messages = () => root.querySelector(".nodetto-cad-status")?.textContent;
  const respond = (
    i: number,
    result: Omit<CadEngineResult, "revision" | "status">,
  ) => {
    const request = requests[i];
    request.resolve({
      revision: request.input.revision,
      status: [],
      ...result,
    });
  };

  assert.equal(requests.length, 1);
  assert.equal(requests[0].input.pageId, "cad");
  assert.equal(layer(), false);
  assert.ok(root.querySelector(".nodetto-layers"));
  const canvas = root.querySelector<HTMLCanvasElement>(surface);
  assert.ok(canvas);
  const mount = mounts[0];
  respond(0, { bodies: [body] });
  await painted();
  assert.deepEqual(mount.uploads.at(-1), [body]);
  assert.deepEqual(
    mount.themes.at(-1)?.background,
    theme === "dark" ? darkBackground : lightBackground,
  );

  setMode(theme === "dark" ? "light" : "dark");
  await painted();
  assert.deepEqual(
    mount.themes.at(-1)?.background,
    theme === "dark" ? lightBackground : darkBackground,
  );
  const uploads = mount.uploads.length;
  const before = editor.getSnapshot();
  point(canvas, "pointerdown", 200, 200);
  point(canvas, "pointerup", 200, 200);
  assert.deepEqual([...editor.selection.ids()], ["ex1"]);
  assert.deepEqual(mount.highlights.at(-1), {
    bodyId: "ex1",
    faceName: "ex1:end",
  });

  const fitted = mount.cameras.at(-1);
  assert.ok(fitted);
  const viewButton = (label: string) => {
    const button = root.querySelector<HTMLButtonElement>(
      `[aria-label="CAD tools"] button[aria-label="${label}"]`,
    );
    assert.ok(button, label);
    return button;
  };
  viewButton("Zoom in").click();
  await painted();
  const zoomedIn = mount.cameras.at(-1);
  assert.ok(zoomedIn && zoomedIn.distance < fitted.distance);
  viewButton("Zoom out").click();
  await painted();
  assert.ok(
    Math.abs((mount.cameras.at(-1)?.distance ?? 0) - fitted.distance) < 1e-9,
  );
  movePointer(canvas, 25, 25);
  await painted();
  assert.notEqual(mount.cameras.at(-1)?.yaw, fitted.yaw);
  const orbited = mount.cameras.at(-1);
  movePointer(canvas, 35, 35, 1);
  await painted();
  assert.notDeepEqual(mount.cameras.at(-1)?.target, orbited?.target);
  canvas.dispatchEvent(
    new window.WheelEvent("wheel", { deltaY: 100, bubbles: true }),
  );
  await painted();
  assert.ok((mount.cameras.at(-1)?.distance ?? 0) > (orbited?.distance ?? 0));
  viewButton("Fit model").click();
  await painted();
  assert.deepEqual(mount.cameras.at(-1), fitted);
  movePointer(canvas, 25, 25);
  canvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  await painted();
  assert.deepEqual(mount.cameras.at(-1), fitted);
  assert.equal(mount.uploads.length, uploads);
  assert.equal(editor.getSnapshot(), before);

  editor.apply([
    { type: "updatePage", id: "drawing", page: { name: "Unrelated drawing" } },
  ]);
  assert.equal(requests.length, 1);
  edit(editor, "hole-0", 2);
  assert.equal(requests.length, 2);
  edit(editor, "hole-0", 1);
  assert.equal(requests.length, 3);
  requests[1].reject(new CadSupersededError());
  respond(2, { bodies: [], failure: "cad.kernel.failed" });
  await painted();
  assert.match(messages() ?? "", /cad\.kernel\.failed/);
  assert.equal(mount.uploads.length, uploads);
  assert.deepEqual(mount.uploads.at(-1), [body]);

  edit(editor, "hole-0", 1.5);
  edit(editor, "hole-0", 2.5);
  respond(4, { bodies: [{ ...body }] });
  await painted();
  const recovered = mount.uploads.at(-1);
  respond(3, { bodies: [] });
  await painted();
  assert.equal(messages(), undefined);
  assert.equal(mount.uploads.at(-1), recovered);

  // The desktop retains its last drop object even across page switches.
  const oldElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => root.querySelector(".nodetto-canvas");
  setDrop({ tool: Tool.Rectangle, client: { x: 50, y: 50 } });
  movePointer(canvas, 25, 25);
  await painted();
  const savedCamera = mount.cameras.at(-1);
  editor.setCurrentPage("drawing");
  assert.equal(root.querySelector(surface), null);
  assert.equal(viewButton("Zoom in").disabled, true);
  assert.equal(layer(), true);
  assert.equal(mount.disposed, true);
  assert.equal(editor.store.getPageElements("drawing").length, 0);
  setDrop({ tool: Tool.Rectangle, client: { x: 50, y: 50 } });
  assert.equal(editor.store.getPageElements("drawing").length, 1);

  editor.setCurrentPage("cad");
  assert.equal(layer(), false);
  await painted();
  assert.deepEqual(mounts[1].cameras.at(-1), savedCamera);
  editor.setCurrentPage("drawing");
  assert.equal(editor.store.getPageElements("drawing").length, 1);

  setAvailable(false);
  editor.setCurrentPage("cad");
  assert.match(messages() ?? "", /WebGL2 is unavailable/);
  assert.ok(root.querySelector(".nodetto-layers"));
  assert.equal(layer(), false);

  editor.setCurrentPage("drawing");
  const requestCount = requests.length;
  setAvailable(true);
  setEngineAvailable(false);
  editor.setCurrentPage("cad");
  assert.match(messages() ?? "", /CAD engine is unavailable/);
  assert.equal(requests.length, requestCount);
  assert.ok(root.querySelector(".nodetto-layers"));
  dispose();
  document.elementFromPoint = oldElementFromPoint;
  root.remove();
  console.log(`ok ${theme}`);
}

viewportWidth = 800;
viewportHeight = 600;
const sketchElements = [
  sketch("visible", "a1"),
  ...rectangle("visible", 590, -610, 20, 20),
];

function fixture(elements: readonly Element[], withDrawing = false) {
  const doc = makeDocument(elements, [CAD_TEST_PAGE]);
  const editor = new Editor({
    document: {
      ...doc,
      pages: withDrawing
        ? [...doc.pages, { id: "drawing", name: "Drawing", kind: "freeform" }]
        : doc.pages,
    },
  });
  editor.setCurrentPage("cad");
  const requests: {
    input: CadEngineInput;
    resolve: (result: CadEngineResult) => void;
  }[] = [];
  const mounts: Camera3d[][] = [];
  const published: [string, Camera3d][] = [];
  const engine: CadEngine = {
    evaluate: (input) =>
      new Promise((resolve) => requests.push({ input, resolve })),
    dispose: () => {},
  };
  const root = document.createElement("main");
  document.body.append(root);
  const dispose = render(
    () => (
      <NodettoCanvas
        editor={editor}
        tool={Tool.Select}
        showGrid={false}
        snap={{ grid: false, objects: false }}
        cadEngine={engine}
        onCadCameraChange={(id, camera) => published.push([id, camera])}
        createCadRenderer={() => {
          const cameras: Camera3d[] = [];
          mounts.push(cameras);
          return {
            diagnostics: { programsLinked: true, renderer: "DOM stub" },
            setBodies: () => {},
            setHighlight: () => {},
            setTheme: () => {},
            setOverlay: () => {},
            draw: (camera) => cameras.push(camera),
            dispose: () => {},
          };
        }}
      />
    ),
    root,
  );
  const respond = (index: number, bodies: CadDisplayBody[]) => {
    const request = requests[index];
    assert.ok(request);
    request.resolve({ revision: request.input.revision, status: [], bodies });
  };
  const canvas = () => {
    const result = root.querySelector<HTMLCanvasElement>(surface);
    assert.ok(result);
    return result;
  };
  return {
    editor,
    requests,
    mounts,
    published,
    respond,
    canvas,
    cleanup: () => {
      dispose();
      root.remove();
    },
  };
}

function assertCorners(camera: Camera3d) {
  const matrix = viewProjection(camera, 800 / 600);
  for (const [x, y] of [
    [590, -610],
    [610, -610],
    [610, -590],
    [590, -590],
  ] as const) {
    const w = (matrix[3] ?? 0) * x + (matrix[7] ?? 0) * y + (matrix[15] ?? 0);
    const nx =
      ((matrix[0] ?? 0) * x + (matrix[4] ?? 0) * y + (matrix[12] ?? 0)) / w;
    const ny =
      ((matrix[1] ?? 0) * x + (matrix[5] ?? 0) * y + (matrix[13] ?? 0)) / w;
    assert.ok(
      nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1,
      `corner ${x},${y}: ${nx},${ny}`,
    );
  }
}
const visible = fixture(sketchElements);
visible.respond(0, []);
await painted();
const initial = visible.mounts[0]?.at(-1);
assert.ok(initial);
assertCorners(initial);
movePointer(visible.canvas(), 35, 35, 1);
await painted();
assert.notDeepEqual(visible.mounts[0]?.at(-1)?.target, initial.target);
visible.canvas().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
await painted();
const refitted = visible.mounts[0]?.at(-1);
assert.ok(refitted);
assertCorners(refitted);
visible.cleanup();

const hidden = fixture([
  ...sketchElements,
  { ...sketch("hidden", "a2"), visual: { hidden: true } },
  ...rectangle("hidden", 5000, 5000, 20, 20),
]);
hidden.respond(0, []);
await painted();
assert.deepEqual(hidden.mounts[0]?.at(-1), initial);
hidden.cleanup();

const empty = fixture([]);
empty.respond(0, []);
empty.canvas().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
await painted();
assert.deepEqual(
  empty.mounts[0]?.at(-1),
  fitBounds([-50, -50, -50], [50, 50, 50], 800 / 600),
);
empty.cleanup();

viewportWidth = 400;
viewportHeight = 400;
const plate = plateWithHoles();
const switched = fixture(plate.elements, true);
await painted();
const bodyFit = fitBounds([-20, -20, 0], [20, 20, 0], 1);
assert.notDeepEqual(switched.mounts[0]?.at(-1), bodyFit);
assert.deepEqual(switched.published, []);
switched.editor.setCurrentPage("drawing");
switched.editor.setCurrentPage("cad");
await painted();
assert.equal(switched.requests.length, 2);
switched.respond(1, [body]);
await painted();
await painted();
assert.deepEqual(switched.mounts[1]?.at(-1), bodyFit);
assert.deepEqual(switched.published[0], ["cad", bodyFit]);
switched.cleanup();
console.log("ok sketch fit");
