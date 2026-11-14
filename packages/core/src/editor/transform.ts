// Geometry edits the editor plans: moving elements (including free-floating
// connectors and PCB items, whose position lives in their semantic),
// resizing through a ShapeUtil, and rotating PCB footprints.

import {
  type Element,
  type ElementId,
  type GenericEdgeSemantic,
  isPcbElementType,
  PCB_PAGE_SCALE,
  type PcbFootprintSemantic,
  roundNm,
  type Visual,
} from "@nodetto/ir";
import { aspectSize, supportsAspectRatio } from "../aspect-ratio.ts";
import type { Command } from "../commands.ts";
import type { Box } from "../geometry.ts";
import { leafElements } from "../group.ts";
import { pcbAnchor } from "../pcb-board/geometry.ts";
import {
  type PcbViaInput,
  pcbMoveCommand,
  rotatePcbFootprintSemantic,
} from "../pcb-board/edit.ts";
import type { ShapeContext, ShapeUtil } from "../shape-util.ts";
import type { Store } from "../store.ts";

export interface ElementMove {
  readonly id: ElementId;
  readonly x: number;
  readonly y: number;
}

/**
 * The commands that put each element at its new origin. Empty when no
 * element would actually move.
 */
export function planElementMoves(
  store: Store,
  moves: readonly ElementMove[],
): Command[] {
  // Snapping or repeated pointer samples may produce identical coordinates.
  // Avoid the derived-planning/store/render pipeline when nothing would move.
  if (
    !moves.some((move) => {
      const current = store.get(move.id);
      if (current && isPcbElementType(current.type))
        return pcbMoveCommand(current, move.x, move.y) !== undefined;
      return (
        current && (current.visual.x !== move.x || current.visual.y !== move.y)
      );
    })
  )
    return [];
  const commands: Command[] = [];
  for (const move of moves) {
    const element = store.get(move.id);
    if (!element) continue;
    if (isPcbElementType(element.type)) {
      const command = pcbMoveCommand(element, move.x, move.y);
      if (command) commands.push(command);
      continue;
    }
    if (element.type === "edge.generic") {
      const semantic = element.semantic as GenericEdgeSemantic;
      if (semantic.fromPoint && semantic.toPoint) {
        const dx = move.x - (element.visual.x ?? 0);
        const dy = move.y - (element.visual.y ?? 0);
        commands.push({
          type: "updateSemantic",
          id: element.id,
          semantic: {
            ...semantic,
            fromPoint: {
              x: semantic.fromPoint.x + dx,
              y: semantic.fromPoint.y + dy,
            },
            toPoint: {
              x: semantic.toPoint.x + dx,
              y: semantic.toPoint.y + dy,
            },
          },
        });
      }
    }
    commands.push({
      type: "updateVisual",
      id: move.id,
      visual: { x: move.x, y: move.y },
    });
  }
  return commands;
}

/**
 * The positioned leaves of `ids` with their current origins, minus anything
 * that has no coordinates of its own (connectors, derived layouts).
 */
export function movableOrigins(
  store: Store,
  ids: Iterable<ElementId>,
): ElementMove[] {
  const out: { id: ElementId; x: number; y: number }[] = [];
  for (const leaf of leafElements(store, ids)) {
    const { x, y } = leaf.visual;
    const semantic = leaf.semantic as GenericEdgeSemantic;
    if (
      leaf.type === "edge.generic" &&
      semantic.fromPoint &&
      semantic.toPoint
    ) {
      out.push({ id: leaf.id, x: x ?? 0, y: y ?? 0 });
    } else if (isPcbElementType(leaf.type)) {
      const anchor = pcbAnchor(
        leaf.type,
        leaf.semantic as Record<string, unknown>,
      );
      if (anchor)
        out.push({
          id: leaf.id,
          x: anchor[0] * PCB_PAGE_SCALE,
          y: anchor[1] * PCB_PAGE_SCALE,
        });
    } else if (x !== undefined && y !== undefined) {
      out.push({ id: leaf.id, x, y });
    }
  }
  return out;
}

/**
 * The visual `util` resizes `element` to, honouring a locked aspect ratio
 * along the dominant drag axis and dropping size-token links the new size
 * overrides.
 */
export function resizedVisual(
  element: Element,
  util: ShapeUtil,
  current: Box | null,
  box: Box,
): Visual | null {
  if (!util.canResize || !util.resize) {
    return null;
  }
  const ratio = element.visual.aspectRatio;
  const horizontalChange = current?.width
    ? Math.abs(box.width / current.width - 1)
    : 0;
  const verticalChange = current?.height
    ? Math.abs(box.height / current.height - 1)
    : 0;
  const constrained =
    ratio !== undefined && current && supportsAspectRatio(element)
      ? {
          ...box,
          ...aspectSize(
            ratio,
            box.width,
            box.height,
            horizontalChange >= verticalChange ? "width" : "height",
          ),
        }
      : box;
  const patch = util.resize(element, constrained);
  const links = Object.fromEntries(
    Object.entries(element.visual.numberTokens ?? {}).filter(
      ([field]) =>
        !(field === "width" && patch.visual.width !== undefined) &&
        !(field === "height" && patch.visual.height !== undefined),
    ),
  );
  const { numberTokens: _old, ...rest } = element.visual;
  return {
    ...rest,
    ...patch.visual,
    ...(element.type === "text.note" &&
    element.visual.textResize !== undefined &&
    element.visual.textResize !== "fixed"
      ? { textResize: "fixed" as const }
      : {}),
    ...(Object.keys(links).length ? { numberTokens: links } : {}),
  };
}

/** Rotate unlocked PCB footprints without changing their local pad geometry. */
export function planPcbFootprintRotation(
  store: Store,
  context: ShapeContext,
  ids: readonly ElementId[],
  degrees: number,
): Command[] {
  const commands: Command[] = [];
  for (const id of ids) {
    const element = store.get(id);
    if (!element || element.type !== "pcb.footprint" || context.isLocked?.(id))
      continue;
    commands.push({
      type: "updateSemantic",
      id,
      semantic: rotatePcbFootprintSemantic(
        element.semantic as PcbFootprintSemantic,
        degrees,
      ),
    });
  }
  return commands;
}

/** A via's semantic, rounded to whole nanometres and through-hole by default. */
export function pcbViaSemantic(input: PcbViaInput) {
  return {
    ...input,
    at: [roundNm(input.at[0]), roundNm(input.at[1])] as const,
    layers: input.layers ?? (["F.Cu", "B.Cu"] as const),
  };
}
