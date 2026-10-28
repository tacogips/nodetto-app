// Snap inputs for a drag: which neighbours a moving box may line up with,
// the layout grid of a shared parent frame, and the per-event switches.

import type { Box, SnapOptions } from "@nodetto/core";
import {
  frameParents,
  layoutGridBands,
  normalizeBox,
  pageGuides,
  safeAreaContentBox,
  visibleBounds,
} from "@nodetto/core";
import type { ElementId, FrameSemantic } from "@nodetto/ir";
import type { InteractionContext } from "./context.ts";
import { boxesOverlap, isSolid } from "./geometry.ts";
import type { GridSnap } from "./types.ts";

/** Object snapping pulls at most this many screen pixels (design 6). */
export const SNAP_THRESHOLD_PX = 8;
/** Grid spacing in page units, shared with the canvas background. */
export const SNAP_GRID = 24;

export interface Snapping {
  /** Bounds of every solid element on the page except `excluded`. */
  snapCandidates(excluded: ReadonlySet<ElementId>): Box[];
  /** Construction guides from a shared direct parent, fixed for the gesture. */
  layoutGridFor(ids: Iterable<ElementId>): GridSnap | null;
  /** Snap parameters for this event, or `null` when snapping is off. */
  snapFor(
    event: {
      readonly metaKey?: boolean;
      readonly ctrlKey?: boolean;
    },
    layoutGrid: GridSnap | null,
  ): { readonly objects: boolean; readonly options: SnapOptions } | null;
}

export function createSnapping(ctx: InteractionContext): Snapping {
  const { editor, options } = ctx;

  /**
   * The viewport grown by one viewport each way, in page space, or `null`
   * when the size is unknown. Snap candidates outside it are skipped
   * (design 6) so a large page stays cheap to drag on.
   */
  const snapWindow = (): Box | null => {
    const size = options.viewport?.();
    if (!size || size.width <= 0 || size.height <= 0) {
      return null;
    }
    return normalizeBox(
      editor.camera.screenToPage({ x: -size.width, y: -size.height }),
      editor.camera.screenToPage({ x: 2 * size.width, y: 2 * size.height }),
    );
  };

  const snapCandidates = (excluded: ReadonlySet<ElementId>): Box[] => {
    const context = editor.createShapeContext();
    const window = snapWindow();
    const out: Box[] = [];
    for (const element of editor.store.getPageElements(editor.currentPageId)) {
      if (
        excluded.has(element.id) ||
        !isSolid(element) ||
        context.isHidden?.(element.id)
      ) {
        continue;
      }
      const bounds = visibleBounds(context, element.id);
      if (bounds && (window === null || boxesOverlap(bounds, window))) {
        out.push(bounds);
      }
    }
    return out;
  };

  const layoutGridFor = (ids: Iterable<ElementId>): GridSnap | null => {
    const selected = [...ids];
    if (!selected.length) return null;
    const context = editor.createShapeContext();
    const parents = frameParents(editor.store, editor.currentPageId, context);
    const parentId = parents.get(selected[0] as ElementId);
    if (!parentId || selected.some((id) => parents.get(id) !== parentId))
      return null;
    const parent = editor.store.get(parentId);
    const semantic =
      parent?.type === "frame" ? (parent.semantic as FrameSemantic) : undefined;
    const grids = (
      parent?.type === "frame" ? semantic?.layoutGrids : undefined
    )?.filter((candidate) => candidate.visible !== false);
    const bounds = context.boundsOf(parentId);
    if ((!grids?.length && !semantic?.safeArea) || !bounds) return null;
    const square = grids?.find((candidate) => candidate.kind === "grid");
    const xLines = new Set<number>();
    const yLines = new Set<number>();
    for (const grid of grids ?? []) {
      if (grid.kind === "grid") continue;
      for (const band of layoutGridBands(grid, bounds.width, bounds.height)) {
        if (grid.kind === "columns") {
          xLines.add(bounds.x + band.x);
          xLines.add(bounds.x + band.x + band.width);
        } else {
          yLines.add(bounds.y + band.y);
          yLines.add(bounds.y + band.y + band.height);
        }
      }
    }
    if (semantic?.safeArea) {
      const safe = safeAreaContentBox(bounds, semantic.safeArea);
      xLines.add(safe.x);
      xLines.add(safe.x + safe.width);
      yLines.add(safe.y);
      yLines.add(safe.y + safe.height);
    }
    return {
      ...(square?.kind === "grid"
        ? {
            size: square.size,
            origin: { x: bounds.x, y: bounds.y },
          }
        : {}),
      xLines: [...xLines].sort((a, b) => a - b),
      yLines: [...yLines].sort((a, b) => a - b),
    };
  };

  const snapFor = (
    event: {
      readonly metaKey?: boolean;
      readonly ctrlKey?: boolean;
    },
    layoutGrid: GridSnap | null,
  ): { readonly objects: boolean; readonly options: SnapOptions } | null => {
    const settings = options.snap?.();
    if (!settings) {
      return null;
    }
    // Cmd/Ctrl held during the gesture disables both kinds (design 3.2).
    if (event.metaKey === true || event.ctrlKey === true) {
      return null;
    }
    const persistent =
      settings.guides === false
        ? []
        : pageGuides(editor, editor.currentPageId).filter(
            (guide) => !guide.hidden,
          );
    if (!settings.grid && !settings.objects && !persistent.length) return null;
    const threshold = SNAP_THRESHOLD_PX / editor.camera.get().z;
    const gridOptions: SnapOptions = settings.grid
      ? layoutGrid
        ? {
            threshold,
            ...(layoutGrid.size ? { grid: layoutGrid.size } : {}),
            ...(layoutGrid.origin ? { gridOrigin: layoutGrid.origin } : {}),
            ...(layoutGrid.xLines.length
              ? { gridLinesX: layoutGrid.xLines }
              : {}),
            ...(layoutGrid.yLines.length
              ? { gridLinesY: layoutGrid.yLines }
              : {}),
          }
        : { threshold, grid: SNAP_GRID }
      : { threshold };
    const guideLinesX = persistent
      .filter((guide) => guide.axis === "x")
      .map((guide) => guide.position);
    const guideLinesY = persistent
      .filter((guide) => guide.axis === "y")
      .map((guide) => guide.position);
    return {
      objects: settings.objects,
      options: {
        ...gridOptions,
        ...(guideLinesX.length || gridOptions.gridLinesX?.length
          ? {
              gridLinesX: [...(gridOptions.gridLinesX ?? []), ...guideLinesX],
            }
          : {}),
        ...(guideLinesY.length || gridOptions.gridLinesY?.length
          ? {
              gridLinesY: [...(gridOptions.gridLinesY ?? []), ...guideLinesY],
            }
          : {}),
      },
    };
  };

  return { snapCandidates, layoutGridFor, snapFor };
}
