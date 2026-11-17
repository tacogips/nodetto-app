// Viewport culling: which elements the canvas needs in the DOM at all.
//
// Every mounted element costs the browser on every interaction, whether or
// not it is on screen: native hit testing, style, layout and paint all walk
// it. On a page of thousands of shapes that, not script, is what a click or
// a pan pays for. Elements that cannot paint inside the visible area (plus a
// margin, so a short pan reveals nothing unmounted) are left out.
//
// Culling is conservative. An element is dropped only when its paint extent
// is known: the element types the core vouches for (render-scope), without
// effects that paint beyond their box. Anything else stays mounted, as
// before. With no measured viewport nothing is culled either, which is also
// what a headless render gets.

import {
  type Box,
  type CameraState,
  connectorLabelBox,
  type Editor,
  obstacleReach,
  renderScope,
  rotatedBox,
  type ShapeContext,
  type ViewportSize,
} from "@nodetto/core";
import type { Element, ElementId } from "@nodetto/ir";
import { type Accessor, createMemo } from "solid-js";
import type { SceneSignals } from "../adapter.ts";

/**
 * Page units an element may paint outside its geometry: strokes, markers,
 * selection rings and the warning badge.
 */
const PAINT_MARGIN = 96;

/** The window extends this fraction of the view beyond each edge. */
const WINDOW_MARGIN = 0.5;
/** A kept window larger than this many views is rebuilt, to release DOM. */
const WINDOW_SLACK = 3;

export interface Culling {
  /** The page-space area elements are mounted for; `null` mounts everything. */
  readonly window: Accessor<Box | null>;
  /**
   * Whether `element` has to be mounted. Reads the window, so a computation
   * calling it re-runs when the window moves.
   */
  mounts(element: Element, context: ShapeContext): boolean;
  /** Forget extents of elements that no longer exist, given how many do. */
  retain(count: number, exists: (id: ElementId) => boolean): void;
}

interface Extent {
  /** The records the extent was computed from, compared by identity. */
  readonly sources: readonly (Element | undefined)[];
  readonly box: Box | null;
  /**
   * For a route that steers around obstacles: the areas whose shapes it
   * depends on, and the scene epoch up to which they are known undisturbed.
   */
  readonly reach?: readonly Box[];
  checked: number;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export function createCulling(deps: {
  readonly editor: Accessor<Editor>;
  readonly camera: Accessor<CameraState>;
  readonly viewport: Accessor<ViewportSize>;
  readonly scene: SceneSignals;
  /**
   * False until the viewport has been measured. Nothing is mounted before
   * that: mounting a whole page only to cull it a moment later is what makes
   * a large document slow to open.
   */
  readonly measured: Accessor<boolean>;
}): Culling {
  const window = createMemo<Box | null>((previous) => {
    const size = deps.viewport();
    const camera = deps.camera();
    // Without a usable view there is nothing to cull against.
    if (
      !(size.width > 0) ||
      !(size.height > 0) ||
      !(camera.z > 0) ||
      !Number.isFinite(camera.x) ||
      !Number.isFinite(camera.y)
    )
      return null;
    // screen = (page + camera) * zoom, so the view starts at -camera.
    const view = {
      x: -camera.x,
      y: -camera.y,
      width: size.width / camera.z,
      height: size.height / camera.z,
    };
    // Keep the window while the view stays inside it: a pan then changes
    // nothing here, and so mounts and unmounts nothing.
    if (
      previous &&
      view.x >= previous.x &&
      view.y >= previous.y &&
      view.x + view.width <= previous.x + previous.width &&
      view.y + view.height <= previous.y + previous.height &&
      previous.width <= view.width * (1 + 2 * WINDOW_MARGIN) * WINDOW_SLACK
    )
      return previous;
    return {
      x: view.x - view.width * WINDOW_MARGIN,
      y: view.y - view.height * WINDOW_MARGIN,
      width: view.width * (1 + 2 * WINDOW_MARGIN),
      height: view.height * (1 + 2 * WINDOW_MARGIN),
    };
  }, null);

  // An extent is a function of the records its element is drawn from, so it
  // is recomputed only when one of those is replaced: a commit that moves
  // one table revalidates the rest of the page by identity alone.
  const extents = new Map<ElementId, Extent>();

  /** Where `element` can paint, or `null` when that is not known. */
  const extentOf = (element: Element, context: ShapeContext): Box | null => {
    const store = deps.editor().store;
    const scope = renderScope(element, (id) => store.get(id));
    const style = element.visual.style;
    if (scope.kind === "page" || style?.effects?.length || style?.shadow)
      return null;
    const sources =
      scope.kind === "endpoints"
        ? [element, ...scope.ids.map((id) => store.get(id))]
        : [element];
    const cached = extents.get(element.id);
    if (
      cached &&
      cached.sources.length === sources.length &&
      cached.sources.every((source, index) => source === sources[index])
    ) {
      if (!cached.reach) return cached.box;
      // Unchanged records, but a shape may have moved into the route's way.
      const areas = deps.scene.changedAreas(cached.checked);
      if (
        areas &&
        !areas.some((area) => cached.reach?.some((box) => overlaps(box, area)))
      ) {
        cached.checked = deps.scene.epoch();
        return cached.box;
      }
    }
    let box = context.boundsOf(element.id);
    if (box && scope.kind === "endpoints") {
      const label = connectorLabelBox(element, context);
      if (label) box = union(box, label);
    } else if (box) box = rotatedBox(box, element.visual.rotation ?? 0);
    extents.set(element.id, {
      sources,
      box,
      ...(scope.kind === "endpoints" && scope.obstacles
        ? { reach: obstacleReach(element, context) }
        : {}),
      checked: deps.scene.epoch(),
    });
    return box;
  };

  return {
    window,
    mounts(element, context) {
      if (!deps.measured()) return false;
      const area = window();
      if (!area) return true;
      const box = extentOf(element, context);
      // No geometry means nothing is drawn, but the unit must stay mounted
      // to notice the element gaining geometry later.
      if (!box) return true;
      return (
        box.x - PAINT_MARGIN <= area.x + area.width &&
        box.x + box.width + PAINT_MARGIN >= area.x &&
        box.y - PAINT_MARGIN <= area.y + area.height &&
        box.y + box.height + PAINT_MARGIN >= area.y
      );
    },
    retain(count, exists) {
      if (extents.size <= count * 2 + 256) return;
      for (const id of extents.keys()) if (!exists(id)) extents.delete(id);
    },
  };
}
