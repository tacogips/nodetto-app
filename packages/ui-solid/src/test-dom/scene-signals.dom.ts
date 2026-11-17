// Run under the browser condition, where Solid is reactive: which
// computations a document change re-runs, and what the canvas keeps mounted.
import { Editor } from "@nodetto/core";
import type { Document, Element } from "@nodetto/ir";
import { createMemo, createRoot, createSignal } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { createCulling } from "../canvas/culling.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const table = (id: string, x: number, y: number, index: string): Element => ({
  id,
  page: "page",
  type: "erd.table",
  index,
  semantic: {
    tableName: id,
    columns: [
      { id: "c1", name: "id", dataType: "uuid", pk: true },
      { id: "c2", name: "ref", dataType: "uuid" },
    ],
  },
  visual: { x, y, width: 240 },
});
const relation = (
  id: string,
  from: string,
  to: string,
  routing?: "orthogonal",
): Element => ({
  id,
  page: "page",
  type: "erd.relation",
  index: `r-${id}`,
  semantic: {
    from: { table: from, column: "c1" },
    to: { table: to, column: "c2" },
    cardinality: "1:*",
    ...(routing ? { routing } : {}),
  },
  visual: {},
});
const fixture = (): Document => ({
  schemaVersion: 1,
  id: "doc",
  title: "Scene",
  pages: [{ id: "page", name: "Page", kind: "erd" }],
  elements: [
    table("a", 0, 0, "a1"),
    table("b", 600, 0, "a2"),
    table("c", 0, 2000, "a3"),
    table("d", 600, 2000, "a4"),
    table("far", 5000, 5000, "a5"),
    relation("ab", "a", "b"),
    relation("cd", "c", "d"),
    relation("ab-avoiding", "a", "b", "orthogonal"),
    {
      id: "note",
      page: "page",
      type: "text.note",
      index: "a6",
      semantic: { text: "note" },
      visual: { x: 3000, y: 0, width: 100, height: 40 },
    },
  ],
});

createRoot((dispose) => {
  const editor = new Editor({ document: fixture() });
  const signals = createEditorSignals(editor);
  const runs = new Map<string, number>();
  const followers = new Map<string, () => void>();
  for (const id of ["a", "b", "c", "far", "ab", "cd", "ab-avoiding", "note"]) {
    const follower = createMemo(
      () => {
        signals.scene.track(id);
        runs.set(id, (runs.get(id) ?? 0) + 1);
      },
      undefined,
      { equals: false },
    );
    followers.set(id, follower);
  }
  let revisions = 0;
  const everything = createMemo(
    () => {
      signals.rev();
      revisions += 1;
    },
    undefined,
    { equals: false },
  );
  /**
   * Which followers re-ran because of `change`. The note's type is not
   * vouched for, so it follows every announcement; it is checked on its own.
   */
  const rerun = (change: () => void): string[] => {
    for (const follower of followers.values()) follower();
    everything();
    const before = new Map(runs);
    change();
    for (const follower of followers.values()) follower();
    everything();
    assert(
      runs.get("note") !== before.get("note"),
      "a page-scoped follower missed an announcement",
    );
    return [...runs]
      .filter(([id, count]) => id !== "note" && count !== before.get(id))
      .map(([id]) => id)
      .sort();
  };
  const same = (actual: string[], expected: string[], what: string): void =>
    assert(
      JSON.stringify(actual) === JSON.stringify([...expected].sort()),
      `${what}: re-ran [${actual}] instead of [${expected}]`,
    );

  same(
    rerun(() => editor.moveElements([{ id: "c", x: 10, y: 2010 }])),
    ["c", "cd"],
    "moving a table",
  );
  same(
    rerun(() => editor.moveElements([{ id: "a", x: 10, y: 10 }])),
    ["a", "ab", "ab-avoiding"],
    "moving a table two relations end at",
  );
  console.log("ok record");

  same(
    rerun(() => editor.moveElements([{ id: "far", x: 5200, y: 5200 }])),
    ["far"],
    "moving a table far from every route",
  );
  // Dropped between a and b, the table is in the avoiding route's way.
  same(
    rerun(() => editor.moveElements([{ id: "far", x: 300, y: -40 }])),
    ["ab-avoiding", "far"],
    "moving a table onto an avoiding route",
  );
  same(
    rerun(() => editor.moveElements([{ id: "far", x: 5000, y: 5000 }])),
    ["ab-avoiding", "far"],
    "moving a table off an avoiding route",
  );
  console.log("ok obstacles");

  // Closing a batch announces history alone: undo availability moved, no
  // record did.
  editor.beginBatch();
  same(
    rerun(() => editor.moveElements([{ id: "c", x: 20, y: 2020 }])),
    ["c", "cd"],
    "moving a table inside a batch",
  );
  const before = revisions;
  same(
    rerun(() => editor.endBatch()),
    [],
    "a history-only announcement",
  );
  assert(revisions > before, "rev did not follow a history announcement");
  console.log("ok history");

  same(
    rerun(() => editor.moveElements([{ id: "note", x: 3100, y: 0 }])),
    ["a", "ab", "ab-avoiding", "b", "c", "cd", "far"],
    "moving an element of an unvouched type",
  );
  // The followers subscribed afresh: record-level changes still reach them.
  same(
    rerun(() => editor.moveElements([{ id: "b", x: 610, y: 0 }])),
    ["ab", "ab-avoiding", "b"],
    "moving a table after a structural change",
  );
  same(
    rerun(() => editor.deleteElements(["a"])),
    ["a", "ab", "ab-avoiding"],
    "deleting a table",
  );
  same(
    rerun(() => editor.undo()),
    ["a", "ab", "ab-avoiding"],
    "restoring a table",
  );
  console.log("ok structure");

  let zoomRuns = 0;
  let readOnlyRuns = 0;
  const zoom = createMemo(() => {
    zoomRuns += 1;
    return signals.zoom();
  });
  const readOnly = createMemo(() => {
    readOnlyRuns += 1;
    return signals.readOnly();
  });
  zoom();
  readOnly();
  editor.camera.panBy(30, 40);
  editor.moveElements([{ id: "b", x: 620, y: 0 }]);
  zoom();
  readOnly();
  assert(zoomRuns === 1, "a pan re-ran a zoom dependent");
  assert(readOnlyRuns === 1, "a commit re-ran a read-only dependent");
  editor.camera.zoomBy(2, { x: 0, y: 0 });
  editor.setReadOnly(true);
  assert(zoom() === 2, "zoom did not follow the camera");
  assert(readOnly(), "read-only did not follow");
  assert(
    [zoomRuns, readOnlyRuns].every((count) => count === 2),
    "a coarse signal re-ran more than once for one change",
  );
  editor.setReadOnly(false);
  editor.camera.set({ x: 0, y: 0, z: 1 });
  console.log("ok coarse");

  // Culling: what the canvas mounts for a view of the top-left corner.
  const [viewport, setViewport] = createSignal({ width: 0, height: 0 });
  const [measured, setMeasured] = createSignal(false);
  const culling = createCulling({
    editor: () => editor,
    camera: signals.camera,
    viewport,
    scene: signals.scene,
    measured,
  });
  const mountedIds = (): string[] =>
    editor.store
      .getPageElements("page")
      .filter((element) => culling.mounts(element, editor.createShapeContext()))
      .map((element) => element.id)
      .sort();
  assert(mountedIds().length === 0, "mounted before the viewport was measured");
  setMeasured(true);
  assert(
    mountedIds().length === editor.store.getPageElements("page").length,
    "an unmeasurable viewport must mount everything",
  );
  setViewport({ width: 1000, height: 600 });
  same(
    mountedIds(),
    // The note's type is not vouched for, so it is never culled.
    ["a", "ab", "ab-avoiding", "b", "note"],
    "culling to the first view",
  );
  const first = culling.window();
  editor.camera.panBy(-100, -100);
  assert(culling.window() === first, "a short pan rebuilt the window");
  editor.camera.set({ x: 0, y: -1800, z: 1 });
  assert(culling.window() !== first, "a long pan kept the window");
  same(mountedIds(), ["c", "cd", "d", "note"], "culling after a long pan");
  // A table dragged into view is mounted without the window moving.
  editor.moveElements([{ id: "far", x: 200, y: 2100 }]);
  same(mountedIds(), ["c", "cd", "d", "far", "note"], "culling after a move");
  // An avoiding route pushed into view by an obstacle dropped on it: its
  // records are unchanged, so only the reach can tell the extent is stale.
  // The view is a strip just below tables a and b.
  setViewport({ width: 1000, height: 90 });
  editor.camera.set({ x: 0, y: -222, z: 1 });
  editor.moveElements([{ id: "far", x: 5000, y: 5000 }]);
  const avoiding = (): Element => {
    const element = editor.store.get("ab-avoiding");
    assert(element, "the avoiding relation is gone");
    return element;
  };
  const uncached = (): boolean =>
    createCulling({
      editor: () => editor,
      camera: signals.camera,
      viewport,
      scene: signals.scene,
      measured,
    }).mounts(avoiding(), editor.createShapeContext());
  assert(
    !culling.mounts(avoiding(), editor.createShapeContext()),
    "the avoiding route should start out of view",
  );
  editor.moveElements([{ id: "far", x: 300, y: -10 }]);
  assert(uncached(), "the detour should reach into the view");
  assert(
    culling.mounts(avoiding(), editor.createShapeContext()),
    "culling kept a stale extent for a rerouted relation",
  );
  editor.moveElements([{ id: "far", x: 5000, y: 5000 }]);
  assert(
    !culling.mounts(avoiding(), editor.createShapeContext()),
    "culling kept the detour's extent after the obstacle left",
  );
  console.log("ok culling");
  dispose();
});
