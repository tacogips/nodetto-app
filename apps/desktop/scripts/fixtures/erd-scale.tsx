// Dev-server-only fixture: the real application shell over one very large
// ERD page. `erd-scale-check.mjs` drives it with real pointer input and reads
// the per-frame main-thread times recorded here.
//
//   /scripts/fixtures/erd-scale.html?tables=2000&routing=orthogonal
import { createDefaultRegistry, Editor } from "@nodetto/core";
import type { ErdTableSemantic } from "@nodetto/ir";
import { render } from "solid-js/web";
import { App } from "../../src/App.tsx";
import {
  createExportBackend,
  createFileBackend,
} from "../../src/file/backend.ts";
import { DocumentSession } from "../../src/file/session.ts";
import "../../src/style.css";
import "../../src/inspector.css";
import { erdScaleDocument } from "./erd-scale-document.ts";

const params = new URLSearchParams(location.search);
const routing = params.get("routing");
const fixture = erdScaleDocument({
  tables: Number(params.get("tables") ?? 2000),
  ...(routing === "orthogonal" || routing === "straight" ? { routing } : {}),
});
const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("missing fixture root");

/** Resolves after the frame that follows has been styled, laid out and painted. */
const painted = () =>
  new Promise<number>((resolve) =>
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(performance.now());
      channel.port2.postMessage(null);
    }),
  );

const mountStart = performance.now();
const editor = new Editor({
  registry: createDefaultRegistry(),
  document: fixture.document,
});
const backend = createFileBackend();
const session = new DocumentSession({ editor, backend });
render(
  () => (
    <App
      editor={editor}
      session={session}
      filesAvailable={backend.available}
      exportBackend={createExportBackend()}
    />
  ),
  root,
);
const mountScriptMs = performance.now() - mountStart;

// Main-thread cost of each frame: from the first input handler (or the first
// animation callback) of the frame to the end of its style, layout and paint.
// Idle frames record near-zero samples; the driver keeps the slowest ones.
const frames: number[] = [];
let frameStart: number | null = null;
const markInput = (): void => {
  frameStart ??= performance.now();
};
for (const type of ["pointermove", "pointerdown", "pointerup", "wheel"])
  window.addEventListener(type, markInput, { capture: true, passive: true });
const channel = new MessageChannel();
channel.port1.onmessage = () => {
  if (frameStart !== null) frames.push(performance.now() - frameStart);
  frameStart = null;
};
const frameLoop = (): void => {
  frameStart ??= performance.now();
  channel.port2.postMessage(null);
  requestAnimationFrame(frameLoop);
};
requestAnimationFrame(frameLoop);

const canvas = () => {
  const element = document.querySelector<HTMLElement>(".nodetto-canvas");
  if (!element) throw new Error("missing canvas");
  return element;
};
const clientOf = (page: { x: number; y: number }) => {
  const rect = canvas().getBoundingClientRect();
  const screen = editor.camera.pageToScreen(page);
  return { x: rect.left + screen.x, y: rect.top + screen.y };
};

/** Script time of one edit, and the time until its frame has painted. */
function timed(body: () => void) {
  return new Promise<{ scriptMs: number; paintedMs: number }>((resolve) =>
    requestAnimationFrame(() => {
      const start = performance.now();
      body();
      const scriptMs = performance.now() - start;
      const done = new MessageChannel();
      done.port1.onmessage = () =>
        resolve({ scriptMs, paintedMs: performance.now() - start });
      done.port2.postMessage(null);
    }),
  );
}

const api = {
  mountScriptMs,
  mountPaintedMs: 0,
  tableIds: fixture.tableIds,
  relations: fixture.relationIds.length,
  editor,
  painted,
  settled: async () => {
    await painted();
    await painted();
  },
  takeFrames: () => frames.splice(0),
  domNodes: () => document.querySelectorAll("*").length,
  canvasRect: () => {
    const rect = canvas().getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  },
  setCamera: (x: number, y: number, z: number) =>
    editor.camera.set({ x, y, z }),
  /** Client point in the middle of a table, clear of its relation ends. */
  tablePoint: (id: string) => {
    const box = editor.getBounds(id);
    if (!box) throw new Error(`missing table ${id}`);
    return clientOf({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  },
  /** The first table from `from` whose middle picks itself at every zoom. */
  pickableTable: (from: number, zooms: readonly number[]) => {
    for (let at = from; at < fixture.tableIds.length; at += 1) {
      const id = fixture.tableIds[at] as string;
      const box = editor.getBounds(id);
      if (!box) continue;
      const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (
        zooms.every(
          (zoom) =>
            editor.hitTest(middle, editor.createShapeContext(zoom)) === id,
        )
      )
        return id;
    }
    throw new Error("no table is pickable at every zoom");
  },
  selectedTypes: () =>
    [...editor.selection.ids()].map((id) => editor.store.get(id)?.type),
  /** Client point on empty canvas in the gutter beside a table. */
  gutterPoint: (id: string) => {
    const box = editor.getBounds(id);
    if (!box) throw new Error(`missing table ${id}`);
    // Pick tolerance grows as the view zooms out, so search in screen steps.
    const step = 4 / editor.camera.get().z;
    for (let row = -20; row < 60; row += 1)
      for (let column = 1; column < 60; column += 1) {
        const page = {
          x: box.x + box.width + column * step,
          y: box.y + row * step,
        };
        if (editor.hitTest(page) === null) return clientOf(page);
      }
    throw new Error(`no empty canvas beside ${id}`);
  },
  select: (ids: readonly string[]) => timed(() => editor.selection.set(ids)),
  selectAll: () => timed(() => editor.selectAll()),
  rename: (id: string, name: string) =>
    timed(() => {
      const semantic = editor.store.get(id)?.semantic as ErdTableSemantic;
      editor.apply([
        {
          type: "updateSemantic",
          id,
          semantic: { ...semantic, tableName: name },
        },
      ]);
    }),
  addColumn: (id: string, name: string) =>
    timed(() => {
      const semantic = editor.store.get(id)?.semantic as ErdTableSemantic;
      editor.apply([
        {
          type: "updateSemantic",
          id,
          semantic: {
            ...semantic,
            columns: [
              ...semantic.columns,
              { id: name, name, dataType: "text" },
            ],
          },
        },
      ]);
    }),
  createTable: (x: number, y: number) => {
    let id = "";
    return timed(() => {
      id = editor.createElement("erd.table", { visual: { x, y, width: 240 } });
    }).then((result) => ({ ...result, id }));
  },
  deleteElements: (ids: readonly string[]) =>
    timed(() => editor.deleteElements(ids)),
  undo: () => timed(() => editor.undo()),
  redo: () => timed(() => editor.redo()),
  ready: false,
};
declare global {
  interface Window {
    erdScale: typeof api;
  }
}
window.erdScale = api;
void painted().then((end) => {
  api.mountPaintedMs = end - mountStart;
  api.ready = true;
});
