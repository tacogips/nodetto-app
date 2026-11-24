import {
  type CadDisplayBody,
  type CadEngine,
  type CadEngineResult,
  Editor,
} from "@nodetto/core";
import { isPlainObject } from "@nodetto/ir";
import type { CanvasMode, CadRenderer } from "@nodetto/ui-solid";
import {
  NodettoCanvas,
  Tool,
  type ToolKind,
  preloadCadUi,
} from "@nodetto/ui-solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { plateWithHoles } from "../../../../packages/core/src/cad/testing/documents.ts";
import {
  edge,
  PCB_TEST_PAGE,
  testBoard,
} from "../../../../packages/core/src/cad/testing/pcb.ts";
import {
  type Camera3d,
  fitBounds,
  orbit,
  viewProjection,
} from "../../../../packages/ui-solid/src/cad/camera3d.ts";
import {
  CAD_THEME_TOKENS,
  parseCssColor,
} from "../../../../packages/ui-solid/src/cad/theme.ts";
import { createWebgl2Renderer } from "../../../../packages/ui-solid/src/cad/renderer.ts";
import { getCadEngine } from "../../src/cad/engine.ts";
import "../../src/styles/base.css";
import "../../src/styles/canvas.css";

const mountStart = performance.now();
// Not awaited: the CAD chunks import this entry chunk back, so a top-level
// await here would never settle. The viewport appears once they have loaded.
void preloadCadUi();
const plate = plateWithHoles(60);
const secondPage = { ...PCB_TEST_PAGE, id: "interface-pcb", name: "Interface" };
const outline = edge("rim", { kind: "rect", start: [0, 0], end: [20, 10] });
const editor = new Editor({
  document: {
    ...plate,
    pages: [...plate.pages, PCB_TEST_PAGE, secondPage],
    elements: [
      ...plate.elements,
      testBoard(2),
      outline,
      { ...testBoard(3), id: "interface-board", page: secondPage.id },
      { ...outline, id: "interface-rim", page: secondPage.id },
    ],
  },
});
const worker = getCadEngine();
const [mode, setMode] = createSignal<CanvasMode>("light");
const [tool, setTool] = createSignal<ToolKind>(Tool.Select);
const policyViolations: string[] = [];
window.addEventListener("securitypolicyviolation", (event) =>
  policyViolations.push(`${event.violatedDirective}: ${event.blockedURI}`),
);
const timings = { loadMs: 0, editToDisplayMs: 0 };
let evaluated: CadEngineResult | undefined;
let uploaded: CadEngineResult | undefined;
let displayed: CadEngineResult | undefined;

const engine: CadEngine = {
  async evaluate(input) {
    evaluated = await worker.evaluate(input);
    return evaluated;
  },
  dispose: () => worker.dispose(),
};

let frame:
  | {
      camera: Camera3d;
      width: number;
      height: number;
      renderer: CadRenderer;
      gl: WebGL2RenderingContext;
    }
  | undefined;

function createRenderer(canvas: HTMLCanvasElement): CadRenderer | null {
  const renderer = createWebgl2Renderer(canvas);
  const gl = canvas.getContext("webgl2");
  if (!renderer || !gl) return null;
  return {
    ...renderer,
    setBodies(bodies) {
      renderer.setBodies(bodies);
      if (evaluated?.bodies.length && bodies[0] === evaluated.bodies[0])
        uploaded = evaluated;
    },
    draw(camera, width, height) {
      renderer.draw(camera, width, height);
      frame = { camera, width, height, renderer, gl };
      if (!displayed && uploaded)
        timings.loadMs = performance.now() - mountStart;
      displayed = uploaded;
    },
  };
}

function painted(): Promise<number> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve(performance.now());
      };
      channel.port2.postMessage(null);
    }),
  );
}

function requireFrame() {
  if (!frame) throw new Error("CAD viewport has not drawn a frame");
  return frame;
}

function readPixels(x: number, y: number): readonly number[] {
  const { gl, renderer, camera, width, height } = requireFrame();
  renderer.draw(camera, width, height);
  const pixel = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL pixel read failed");
  return Array.from(pixel);
}

function firstHolePixel(): [number, number] {
  const { camera, width, height } = requireFrame();
  const matrix = viewProjection(camera, width / height);
  // Point two millimetres from the centre of the first through hole on its
  // upper face: inside the original hole and outside the edited hole.
  const x = 7;
  const y = 5;
  const z = 5;
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const nx = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w;
  const ny = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w;
  return [
    Math.floor(((nx + 1) * width) / 2),
    Math.floor(((ny + 1) * height) / 2),
  ];
}

async function editRadius(mm: number): Promise<number> {
  const hole = editor.store.get("hole-0");
  if (!hole || !isPlainObject(hole.semantic))
    throw new Error("The fixture hole is missing");
  const start = performance.now();
  editor.apply([
    {
      type: "updateSemantic",
      id: hole.id,
      semantic: { ...hole.semantic, r: mm },
    },
  ]);
  const revision = editor.revision;
  for (let now = await painted(); now - start < 5000; now = await painted()) {
    if (displayed?.revision === revision) {
      timings.editToDisplayMs = now - start;
      return timings.editToDisplayMs;
    }
    if (evaluated?.revision === revision && evaluated.failure)
      throw new Error(evaluated.failure);
  }
  throw new Error("The edited CAD plate did not reach the viewport");
}

function cameraFrames(): number[] {
  const { renderer, gl, width, height } = requireFrame();
  const columns = 500;
  const rows = 200;
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const indices = new Uint32Array(columns * rows * 6);
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const i = row * (columns + 1) + col;
      positions.set(
        [col / 5, row / 2, Math.sin(col / 30) * Math.sin(row / 20)],
        i * 3,
      );
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const i = row * (columns + 1) + col;
      const next = i + columns + 1;
      indices.set(
        [i, i + 1, next, i + 1, next + 1, next],
        (row * columns + col) * 6,
      );
    }
  }
  const body: CadDisplayBody = {
    id: "camera-benchmark",
    positions,
    indices,
    faceNames: ["camera-benchmark:surface"],
    triFace: new Uint32Array(indices.length / 3),
    edges: new Float32Array(),
    reference: false,
  };
  let camera = fitBounds([0, 0, -1], [100, 100, 1], width / height);
  renderer.setBodies([body]);
  try {
    renderer.draw(camera, width, height);
    const pixel = new Uint8Array(4);
    const syncFrame = () =>
      gl.readPixels(
        width >> 1,
        height >> 1,
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
    syncFrame();
    return Array.from({ length: 30 }, () => {
      camera = orbit(camera, 2, 1);
      const start = performance.now();
      renderer.draw(camera, width, height);
      syncFrame();
      if (gl.getError() !== gl.NO_ERROR)
        throw new Error("Frame readback failed");
      return performance.now() - start;
    });
  } finally {
    renderer.setBodies(displayed?.bodies ?? []);
  }
}

async function checkBoardPicker(): Promise<Record<string, boolean>> {
  const viewport = document.querySelector<HTMLElement>(".nodetto-cad-viewport");
  if (!viewport) throw new Error("CAD viewport is missing");
  const menu = () =>
    viewport.querySelector('[aria-label="Choose a PCB board"]');
  const items = () => Array.from(menu()?.querySelectorAll("button") ?? []);
  const key = (target: EventTarget, name: string) =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: name,
        bubbles: true,
        cancelable: true,
      }),
    );
  editor.selection.set(["ex1"]);
  const undoSize = editor.history.undoSize;
  setTool(Tool.CadPcb);
  await painted();
  const [first, second] = items();
  if (!first || !second) throw new Error("PCB picker did not list two boards");
  const pickerFocus = document.activeElement === first;
  key(first, "Delete");
  key(first, "Backspace");
  const pickerProtectsSelection =
    editor.store.has("ex1") &&
    editor.history.undoSize === undoSize &&
    menu() !== null;
  key(viewport, "Escape");
  const pickerClosesOnEscape = menu() === null && tool() === Tool.Select;
  setTool(Tool.CadPcb);
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true }),
  );
  const pickerClosesOutside = menu() === null && tool() === Tool.Select;
  setTool(Tool.CadPcb);
  await painted();
  const next = items()[1];
  next?.click();
  const pickerInsertsOnce =
    tool() === Tool.Select &&
    menu() === null &&
    editor.history.undoSize === undoSize + 1 &&
    editor.store
      .getPageElements("cad")
      .some(({ type }) => type === "cad.pcb") &&
    editor.undo() &&
    editor.store.getPageElements("cad").every(({ type }) => type !== "cad.pcb");
  return {
    pickerFocus,
    pickerProtectsSelection,
    pickerClosesOnEscape,
    pickerClosesOutside,
    pickerInsertsOnce,
  };
}

const root = document.getElementById("app");
if (!root) throw new Error("CAD fixture root is missing");
render(
  () => (
    <NodettoCanvas
      editor={editor}
      tool={tool()}
      onToolChange={setTool}
      snap={{ grid: false, objects: false }}
      showGrid={false}
      canvasBackground={{ diagram: mode(), pcb: mode() }}
      cadEngine={engine}
      createCadRenderer={createRenderer}
    />
  ),
  root,
);

const check = {
  get engineResult() {
    return (
      evaluated && {
        revision: evaluated.revision,
        bodyCount: evaluated.bodies.length,
        triangles: evaluated.bodies.reduce(
          (count, body) => count + body.indices.length / 3,
          0,
        ),
        failure: evaluated.failure,
      }
    );
  },
  get diagnostics() {
    return frame?.renderer.diagnostics;
  },
  get ready() {
    return Boolean(displayed);
  },
  get size() {
    const { width, height } = requireFrame();
    return { width, height };
  },
  get background() {
    const canvas = document.querySelector(".nodetto-cad-viewport");
    if (!canvas) throw new Error("CAD viewport is missing");
    return parseCssColor(
      getComputedStyle(canvas).getPropertyValue(CAD_THEME_TOKENS.background),
    );
  },
  timings,
  readPixels,
  firstHolePixel,
  async setCanvasMode(next: CanvasMode) {
    setMode(next);
    await painted();
  },
  editRadius,
  cameraFrames,
  checkBoardPicker,
  policyViolations,
};
Object.assign(window, { __cadCheck: check });
