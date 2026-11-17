// Bridge from the core's subscription callbacks to Solid signals.
//
// The core store stays canonical: nothing is copied into a Solid store. The
// signals here are change *notifications* — a revision counter plus the two
// pieces of ephemeral state — and views read the current value straight off
// the editor whenever one of them fires.

import {
  type Box,
  type CameraState,
  type Editor,
  isSelfContainedNode,
  obstacleReach,
  renderImpact,
  renderScope,
  rotatedBox,
} from "@nodetto/core";
import type { Element, ElementId } from "@nodetto/ir";
import {
  type Accessor,
  batch,
  createSignal,
  getOwner,
  onCleanup,
} from "solid-js";

/**
 * Document dependencies finer than "anything changed".
 *
 * `rev` fires on every commit, so a view that reads it recomputes on every
 * commit; with thousands of drawn elements that is the whole cost of an edit.
 * These subscribe a computation to the records its element is actually drawn
 * from (see the core's render-scope), falling back to `rev` for element
 * types that may depend on anything.
 */
export interface SceneSignals {
  /** Depend on the record of `id` alone: its creation, replacement, removal. */
  record(id: ElementId): void;
  /**
   * Depend on everything the drawing of `id` depends on. Returns false when
   * that is the whole page, in which case the caller is subscribed to `rev`.
   */
  track(id: ElementId): boolean;
  /** How many document changes have been announced; grows with each. */
  epoch(): number;
  /**
   * Where self-contained nodes were and are, for every change announced
   * after `since`: what an obstacle-avoiding route has to be checked
   * against. `null` when more than that may have changed.
   */
  changedAreas(since: number): readonly Box[] | null;
}

/** A change touching more nodes than this is treated as touching all. */
const MAX_CHANGED_AREAS = 64;
/** Changes remembered for `changedAreas`. */
const CHANGE_LOG_LENGTH = 32;

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export interface EditorSignals {
  /** Increments on every store commit. Read it to depend on the document. */
  readonly rev: Accessor<number>;
  readonly camera: Accessor<CameraState>;
  /**
   * The camera's zoom alone. A pan leaves it untouched, so whatever depends
   * on zoom (hit tolerances, handle sizes, the shape context) is not even
   * visited while the view scrolls.
   */
  readonly zoom: Accessor<number>;
  readonly selection: Accessor<ReadonlySet<ElementId>>;
  /**
   * Whether local edits are refused. Changes only when the mode does, so a
   * control disabled by it is not revisited on every commit the way one
   * reading `rev` would be.
   */
  readonly readOnly: Accessor<boolean>;
  readonly scene: SceneSignals;
}

/**
 * Subscribe to an editor for the lifetime of the calling component.
 * Must be called from a component or reactive root so `onCleanup` runs.
 */
export function createEditorSignals(editor: Editor): EditorSignals {
  const [rev, setRev] = createSignal(editor.revision);
  const [camera, setCamera] = createSignal<CameraState>(editor.camera.get());
  const [zoom, setZoom] = createSignal(editor.camera.get().z);
  const [readOnly, setReadOnly] = createSignal(editor.readOnly);
  const [selection, setSelection] = createSignal<ReadonlySet<ElementId>>(
    editor.selection.ids(),
  );

  // One signal per followed record, and one for the page's structure. A
  // structural change re-runs every follower, so the per-record signals can
  // be dropped then: the followers subscribe afresh as they re-run.
  const [structure, setStructure] = createSignal(undefined, { equals: false });
  const records = new Map<
    ElementId,
    { readonly read: Accessor<undefined>; readonly bump: () => void }
  >();
  const resolve = (id: ElementId) => editor.store.get(id);
  const follow = (id: ElementId): void => {
    let record = records.get(id);
    if (!record) {
      const [read, write] = createSignal(undefined, { equals: false });
      record = { read, bump: () => write(undefined) };
      records.set(id, record);
    }
    record.read();
  };
  // Obstacle-avoiding routes also depend on the shapes along the paths they
  // tried. Each follower registers that reach; a change is tested against
  // the reaches instead of re-routing every such connector.
  const reaches = new Set<{
    readonly id: ElementId;
    readonly boxes: readonly Box[];
  }>();
  let epoch = 0;
  /** Changes at or before this epoch are no longer in the log. */
  let logStart = 0;
  const log: { readonly epoch: number; readonly areas: readonly Box[] }[] = [];
  const scene: SceneSignals = {
    record(id) {
      structure();
      follow(id);
    },
    track(id) {
      structure();
      const element = editor.store.get(id);
      const scope = element ? renderScope(element, resolve) : undefined;
      const obstacles = scope?.kind === "endpoints" && scope.obstacles;
      // A reach lives as long as the computation that registered it.
      if (scope?.kind === "page" || (obstacles && !getOwner())) {
        rev();
        return false;
      }
      follow(id);
      if (scope?.kind === "endpoints") for (const end of scope.ids) follow(end);
      if (element && obstacles) {
        const reach = {
          id,
          boxes: obstacleReach(element, editor.createShapeContext()),
        };
        reaches.add(reach);
        onCleanup(() => reaches.delete(reach));
      }
      return true;
    },
    epoch: () => epoch,
    changedAreas(since) {
      if (since < logStart) return null;
      return log.flatMap((entry) => (entry.epoch > since ? entry.areas : []));
    },
  };

  /** Where the changed self-contained nodes were and are; null if too many. */
  const changedAreas = (
    ids: readonly ElementId[],
    previous: ReadonlyMap<ElementId, Element> | undefined,
  ): Box[] | null => {
    if (ids.length > MAX_CHANGED_AREAS) return null;
    const context = editor.createShapeContext();
    const areas: Box[] = [];
    for (const id of ids) {
      const before = previous?.get(id);
      const after = editor.store.get(id);
      if (before && isSelfContainedNode(before)) {
        const box = editor.getShapeUtil(before.type).getBounds(before, context);
        if (box) areas.push(rotatedBox(box, before.visual.rotation ?? 0));
      }
      if (after && isSelfContainedNode(after)) {
        const box = context.boundsOf(id);
        if (box) areas.push(rotatedBox(box, after.visual.rotation ?? 0));
      }
    }
    return areas;
  };

  const unsubscribes = [
    editor.subscribe((diff) =>
      batch(() => {
        setRev(editor.revision);
        setReadOnly(editor.readOnly);
        const impact = renderImpact(diff, resolve);
        if (impact.structural) {
          epoch += 1;
          logStart = epoch;
          log.length = 0;
          records.clear();
          setStructure(undefined);
          return;
        }
        if (impact.ids.length === 0) return;
        epoch += 1;
        const stale = new Set(impact.ids);
        const areas = changedAreas(impact.ids, diff.previous);
        if (areas === null) {
          logStart = epoch;
          log.length = 0;
          for (const reach of reaches) stale.add(reach.id);
        } else {
          log.push({ epoch, areas });
          if (log.length > CHANGE_LOG_LENGTH)
            logStart = (log.shift() as { epoch: number }).epoch;
          for (const reach of reaches)
            if (
              !stale.has(reach.id) &&
              areas.some((area) =>
                reach.boxes.some((box) => overlaps(box, area)),
              )
            )
              stale.add(reach.id);
        }
        for (const id of stale) records.get(id)?.bump();
      }),
    ),
    editor.camera.subscribe((state) =>
      batch(() => {
        setZoom(state.z);
        setCamera(state);
      }),
    ),
    editor.selection.subscribe((ids) => setSelection(ids)),
  ];
  onCleanup(() => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  });

  return { rev, camera, zoom, selection, readOnly, scene };
}
