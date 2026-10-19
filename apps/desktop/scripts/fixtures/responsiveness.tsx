// Dev-server-only fixture: exercise Solid's DOM runtime, not its SSR runtime.
import { Editor, setGroupMask } from "@nodetto/core";
import {
  createComputed,
  createRoot,
  createSelector,
  createSignal,
} from "solid-js";
import { render } from "solid-js/web";
import { NodettoCanvas } from "../../../../packages/ui-solid/src/Canvas.tsx";
import { Layers } from "../../../../packages/ui-solid/src/Layers.tsx";
import { Inspector } from "../../../../packages/ui-solid/src/Inspector.tsx";
import "../../src/style.css";
import "../../src/inspector.css";
import "../../src/square-chrome.css";

const editor = new Editor();
const elements = Array.from({ length: 300 }, (_, i) =>
  editor.buildElement("node.generic", {
    semantic: { label: `Node ${i}` },
    visual: {
      x: 50 + (i % 20) * 130,
      y: 50 + Math.floor(i / 20) * 100,
      width: 100,
      height: 70,
    },
  }),
);
editor.apply(
  elements.map((element) => ({ type: "createElement" as const, element })),
);
const ids = elements.map((element) => element.id);
editor.selection.set(ids.slice(0, 2));
const group = editor.groupSelection();
if (!group) throw new Error("missing inner group");
editor.selection.set([group, ids[2]]);
const outer = editor.groupSelection();
if (!outer) throw new Error("missing outer group");
editor.selection.set([ids[0]]);
const root = document.getElementById("root");
if (!root) throw new Error("missing fixture root");
render(
  () => (
    <div
      class="app-shell"
      style={{ display: "flex", "flex-direction": "row", height: "800px" }}
    >
      <div
        class="app-pane"
        style={{ width: "260px", "flex-shrink": 0, overflow: "auto" }}
      >
        <Layers editor={editor} />
      </div>
      <div style={{ width: "800px", "flex-shrink": 0, position: "relative" }}>
        <NodettoCanvas
          editor={editor}
          tool="select"
          snap={{ grid: false, objects: false }}
          showGrid
        />
      </div>
      <div
        class="app-pane app-inspector"
        style={{ width: "320px", "flex-shrink": 0 }}
      >
        <Inspector editor={editor} />
      </div>
    </div>
  ),
  root,
);
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function node(id = ids[0]): HTMLElement {
  const result = document.querySelector<HTMLElement>(
    `[data-element-id="${id}"]`,
  );
  assert(result, `missing rendered node ${id}`);
  return result;
}
async function run() {
  // Group records are unchanged when only a child changes. All child artwork
  // and derived wrappers must react before the history batch closes.
  const originalGroup = group ? editor.store.get(group) : undefined;
  editor.beginBatch();
  editor.resizeElement(ids[0], { x: 50, y: 50, width: 180, height: 90 });
  await frame();
  assert(
    node().style.width === "180px",
    "grouped child stayed stale during resize",
  );
  assert(editor.history.batching, "resize must be checked before release");
  assert(
    group && editor.store.get(group) === originalGroup,
    "test must keep the group record unchanged",
  );
  editor.resizeElement(ids[0], { x: 50, y: 50, width: 200, height: 100 });
  await frame();
  assert(node().style.width === "200px", "second live resize did not paint");
  editor.endBatch();
  editor.undo();
  await frame();
  assert(node().style.width === "100px", "grouped child undo stayed stale");
  editor.redo();
  await frame();
  assert(node().style.width === "200px", "grouped child redo stayed stale");
  editor.undo();
  await frame();

  // Closed libraries should not subscribe and rebuild lists before first use.
  assert(
    !document.querySelector(".nodetto-component-library"),
    "closed component library mounted eagerly",
  );
  const details = document.querySelector<HTMLDetailsElement>(
    ".nodetto-navigation-group",
  );
  assert(details, "missing component disclosure");
  details.open = true;
  await frame();
  const search = document.querySelector<HTMLInputElement>(
    '[aria-label="Search components"]',
  );
  assert(search, "component library did not mount on opening");
  search.value = "preserve query";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  details.open = false;
  await frame();
  details.open = true;
  await frame();
  assert(
    search.isConnected && search.value === "preserve query",
    "closing discarded library state",
  );

  const timings: number[] = [];
  for (let i = 3; i < 33; i++) {
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".nodetto-layer-name"),
    ).find((candidate) => candidate.textContent === `Node ${i}`);
    assert(button, `missing layer ${i}`);
    const start = performance.now();
    button.click();
    timings.push(performance.now() - start);
    await frame();
    assert(
      editor.selection.has(ids[i]),
      "layer click did not select immediately",
    );
    assert(
      node(ids[i]).classList.contains("nodetto-selected"),
      "canvas selection did not update",
    );
  }
  // Verify per-ID selection subscribers only run for changed membership.
  createRoot((dispose) => {
    const [selection, setSelection] = createSignal<ReadonlySet<string>>(
      new Set([ids[0]]),
    );
    const selected = createSelector(selection, (id: string, value) =>
      value.has(id),
    );
    const runs = ids.map(() => 0);
    ids.forEach((id, index) =>
      createComputed(() => {
        selected(id);
        runs[index] += 1;
      }),
    );
    setSelection(new Set([ids[1]]));
    assert(
      runs[0] === 2 &&
        runs[1] === 2 &&
        runs.slice(2).every((count) => count === 1),
      "unchanged selection subscribers reran",
    );
    dispose();
  });
  // Boolean geometry depends on descendants, not just the group record.
  const a = editor.createElement("shape.geo", {
    visual: { x: 400, y: 400, width: 100, height: 100 },
  });
  const b = editor.createElement("shape.geo", {
    visual: { x: 450, y: 400, width: 100, height: 100 },
  });
  editor.selection.set([a, b]);
  const boolean = editor.booleanSelection("union");
  await frame();
  const wrapper = () =>
    document.querySelector<HTMLElement>(`[data-group-id="${boolean}"]`);
  assert(wrapper()?.style.width === "150px", "missing boolean geometry");
  editor.beginBatch();
  editor.resizeElement(b, { x: 450, y: 400, width: 200, height: 100 });
  await frame();
  assert(
    wrapper()?.style.width === "250px",
    "boolean wrapper stayed stale during descendant resize",
  );
  editor.endBatch();
  editor.undo();
  await frame();
  assert(
    wrapper()?.style.width === "150px",
    "boolean wrapper undo stayed stale",
  );
  const mask = editor.createElement("image.raster", {
    semantic: {
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      alt: "Mask",
    },
    visual: { x: 700, y: 400, width: 100, height: 100 },
  });
  const content = editor.createElement("node.generic", {
    visual: { x: 700, y: 400, width: 100, height: 100 },
  });
  editor.selection.set([mask, content]);
  const masked = editor.groupSelection();
  assert(masked && setGroupMask(editor, masked, mask), "mask setup failed");
  await frame();
  const maskWrapper = () =>
    document.querySelector<HTMLElement>(`[data-group-id="${masked}"]`);
  const originalMask = maskWrapper()?.style.maskImage;
  editor.beginBatch();
  editor.resizeElement(content, { x: 700, y: 400, width: 180, height: 100 });
  await frame();
  assert(
    maskWrapper()?.style.width === "180px",
    "raster mask surface stayed stale",
  );
  assert(
    maskWrapper()?.style.maskImage !== originalMask,
    "raster mask image stayed stale",
  );
  editor.endBatch();
  editor.undo();
  await frame();
  assert(
    maskWrapper()?.style.width === "100px",
    "raster mask undo stayed stale",
  );
  editor.selection.set([ids[0]]);
  await frame();
  const drawing = [];
  for (const count of [1000, 5000]) {
    const stroke = editor.createElement("draw.freehand", {
      semantic: {
        points: Array.from({ length: count }, (_, i) => ({
          x: i,
          y: 50 + Math.sin(i / 20) * 40,
          pressure: 0.5,
        })),
      },
      visual: { x: 50, y: 200, width: 400, height: 100 },
    });
    editor.selection.set([stroke]);
    await frame();
    const path = () =>
      node(stroke).querySelector("[data-smart-pressure]")?.getAttribute("d");
    const originalPath = path();
    assert(originalPath, "missing pressure stroke artwork");
    const moveTimes = [];
    editor.beginBatch();
    for (let i = 1; i <= 20; i++) {
      const start = performance.now();
      editor.moveElements([{ id: stroke, x: 50 + i, y: 200 + i }]);
      moveTimes.push(performance.now() - start);
      await frame();
      assert(
        node(stroke).style.left === `${50 + i}px`,
        "stroke movement did not paint before release",
      );
      assert(
        document.querySelector<HTMLInputElement>('[aria-label="Point X"]')
          ?.value === `${50 + i}`,
        "stroke inspector coordinates stayed stale during movement",
      );
      assert(
        path() === originalPath,
        "translation changed local stroke geometry",
      );
    }
    editor.endBatch();
    editor.undo();
    await frame();
    assert(node(stroke).style.left === "50px", "stroke movement undo failed");
    const resizeTimes = [];
    editor.beginBatch();
    for (let i = 1; i <= 20; i++) {
      const start = performance.now();
      editor.resizeElement(stroke, {
        x: 50,
        y: 200,
        width: 400 + i,
        height: 100 + i,
      });
      resizeTimes.push(performance.now() - start);
      await frame();
      assert(
        node(stroke).style.width === `${400 + i}px`,
        "stroke resize did not paint before release",
      );
      assert(path() !== originalPath, "stroke resize left stale artwork");
    }
    editor.endBatch();
    editor.undo();
    await frame();
    assert(
      path() === originalPath,
      "stroke resize undo did not restore artwork",
    );
    const stats = (times: number[]) => {
      times.sort((a, b) => a - b);
      return { medianMs: times[10], p95Ms: times[18] };
    };
    drawing.push({
      points: count,
      move: stats(moveTimes),
      resize: stats(resizeTimes),
    });
    editor.apply([{ type: "deleteElements", ids: [stroke] }]);
  }
  editor.selection.set([ids[0]]);
  await frame();
  timings.sort((a, b) => a - b);
  return {
    nodes: ids.length,
    drawing,
    selectionMedianMs: timings[15],
    selectionP95Ms: timings[28],
  };
}
async function runErd(
  withRelations = false,
  relationCount = 39,
  orthogonal = false,
) {
  editor.apply([
    {
      type: "deleteElements",
      ids: editor.store.listElements().map((e) => e.id),
    },
  ]);
  const frames = Array.from({ length: 40 }, (_, i) =>
    editor.buildElement("frame", {
      semantic: { name: `Frame ${i}`, clipContent: true },
      visual: {
        x: (i % 8) * 400,
        y: Math.floor(i / 8) * 600,
        width: 380,
        height: 580,
      },
    }),
  );
  const tables = frames.map((f, i) =>
    editor.buildElement("erd.table", {
      semantic: {
        tableName: `Table ${i}`,
        columns: Array.from({ length: 16 }, (_, j) => ({
          id: `c${j}`,
          name: `column${j}`,
          dataType: "text",
        })),
      },
      visual: { x: (f.visual.x ?? 0) + 20, y: (f.visual.y ?? 0) + 40 },
    }),
  );
  editor.apply(
    [
      ...frames,
      ...tables,
      ...(withRelations
        ? Array.from({ length: relationCount }, (_, i) =>
            editor.buildElement("erd.relation", {
              semantic: {
                from: { table: tables[i % tables.length].id, column: "c0" },
                to: {
                  table:
                    tables[
                      ((i % tables.length) +
                        1 +
                        Math.floor(i / tables.length)) %
                        tables.length
                    ].id,
                  column: "c0",
                },
                routing: orthogonal ? "orthogonal" : "straight",
                cardinality: "1:*",
              },
            }),
          )
        : []),
    ].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  await frame();
  const selection = [];
  const movement = [];
  for (const table of tables.slice(0, 30)) {
    const start = performance.now();
    editor.selection.set([table.id]);
    selection.push(performance.now() - start);
    await frame();
    assert(
      node(table.id).classList.contains("nodetto-selected"),
      "ERD selection did not paint",
    );
  }
  const table = tables[0];
  editor.selection.set([table.id]);
  await frame();
  const originalNode = node(table.id);
  const originalRow = originalNode.querySelector(".nodetto-erd-row");
  const connectorPath = () => {
    const line = document.querySelector(
      ".nodetto-connector line, .nodetto-connector polyline",
    );
    return line
      ? ["x1", "y1", "x2", "y2", "points"]
          .map((name) => line.getAttribute(name))
          .join(";")
      : null;
  };
  const originalConnector = connectorPath();
  if (withRelations) assert(originalConnector, "missing ERD connector artwork");
  editor.beginBatch();
  for (let i = 1; i <= 30; i++) {
    const start = performance.now();
    editor.moveElements([{ id: table.id, x: 20 + i, y: 40 + i }]);
    movement.push(performance.now() - start);
    await frame();
    assert(
      node(table.id).style.left === `${20 + i}px`,
      "ERD drag did not paint",
    );
    if (withRelations)
      assert(
        connectorPath() !== originalConnector,
        "ERD connector did not follow its moving endpoint",
      );
    assert(node(table.id) === originalNode, "ERD drag replaced the table DOM");
    assert(
      node(table.id).querySelector(".nodetto-erd-row") === originalRow,
      "ERD drag replaced column rows",
    );
  }
  editor.endBatch();
  editor.undo();
  await frame();
  assert(node(table.id).style.left === "20px", "ERD drag undo failed");
  if (withRelations)
    assert(
      connectorPath() === originalConnector,
      "ERD connector undo stayed stale",
    );
  editor.redo();
  await frame();
  assert(node(table.id).style.left === "50px", "ERD drag redo failed");
  const stats = (values: number[]) => {
    values.sort((a, b) => a - b);
    return { medianMs: values[15], p95Ms: values[28] };
  };
  return {
    tables: tables.length,
    relations: withRelations ? relationCount : 0,
    orthogonal,
    frames: frames.length,
    selection: stats(selection),
    movement: stats(movement),
  };
}

function heldSize() {
  return {
    width: node().style.width,
    height: node().style.height,
    batching: editor.history.batching,
  };
}
declare global {
  interface Window {
    responsiveness: {
      run: typeof run;
      runErd: typeof runErd;
      heldSize: typeof heldSize;
      undo: () => void;
    };
  }
}
window.responsiveness = { run, runErd, heldSize, undo: () => editor.undo() };
