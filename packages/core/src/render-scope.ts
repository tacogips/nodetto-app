// What one element's drawing depends on, and so which elements a change to
// the document can make stale.
//
// Renderers used to answer "what must be redrawn?" with "everything": every
// drawn element recomputed on every commit, which is what makes dragging one
// table across a page of two thousand slow. Most elements, though, draw from
// their own record alone, and a connector between two such elements draws
// from those three records. Following exactly those lets a renderer leave the
// rest of the page untouched.
//
// The contract a type signs by being listed here is strict, because a wrong
// entry shows up as a stale drawing rather than as an error:
//
//   - a self-contained node's bounds, ports, outline and authoring warnings
//     are a function of its own record (frames, groups and masks around it
//     are handled separately, as page structure) and never of the zoom;
//   - an endpoint-bound connector's route, label and warnings are a function
//     of its own record and its two endpoint records; one that steers around
//     obstacles also reads the shapes along the paths it tried, and one
//     drawn with line jumps reads every connector beneath it.
//
// Everything not listed is "page"-scoped: it may depend on anything, and a
// change to it may affect anything — the previous behaviour, kept as the
// default so that a new element type is correct before it is fast.

import type { Element, ElementId } from "@nodetto/ir";
import type { Box } from "./geometry.ts";
import type { ShapeContext } from "./shape-util.ts";
import {
  connectorAvoidsObstacles,
  connectorObstacleReach,
} from "./shapes/connector/resolve.ts";
import { endpointReaderFor } from "./shapes/connector/util.ts";
import type { StoreDiff } from "./store.ts";

export type RenderScope =
  /** Drawn from the element's own record. */
  | { readonly kind: "self" }
  /**
   * Drawn from its own record and the records of `ids`. With `obstacles`,
   * also from the shapes near its route: see `obstacleReach`.
   */
  | {
      readonly kind: "endpoints";
      readonly ids: readonly ElementId[];
      readonly obstacles: boolean;
    }
  /** May read anything on the page. */
  | { readonly kind: "page" };

const SELF: RenderScope = { kind: "self" };
const PAGE: RenderScope = { kind: "page" };

/** Node types whose geometry and warnings read nothing but their own record. */
const SELF_CONTAINED_NODES: ReadonlySet<string> = new Set(["erd.table"]);

/** Edge types routed between their two endpoints and nothing else. */
const ENDPOINT_BOUND_EDGES: ReadonlySet<string> = new Set(["erd.relation"]);

export function isSelfContainedNode(element: Element): boolean {
  return SELF_CONTAINED_NODES.has(element.type);
}

/**
 * The scope of `element`'s drawing. `resolve` looks up its endpoints: a
 * connector attached to anything but self-contained nodes is page-scoped,
 * since such an endpoint (a group, say) can move without its record changing.
 */
export function renderScope(
  element: Element,
  resolve: (id: ElementId) => Element | undefined,
): RenderScope {
  if (isSelfContainedNode(element)) return SELF;
  if (
    !ENDPOINT_BOUND_EDGES.has(element.type) ||
    // Line jumps are drawn over every connector painted beneath this one.
    element.visual.style?.lineJumps
  )
    return PAGE;
  const ends = endpointReaderFor(element.type)(element.semantic);
  // No endpoints yet: nothing is drawn until the record itself changes.
  if (!ends) return SELF;
  const ids = ends.from === ends.to ? [ends.from] : [ends.from, ends.to];
  for (const id of ids) {
    const end = resolve(id);
    // A missing endpoint is followed by id, so its arrival is noticed.
    if (end && !isSelfContainedNode(end)) return PAGE;
  }
  return {
    kind: "endpoints",
    ids,
    obstacles: connectorAvoidsObstacles(element),
  };
}

/**
 * For a connector whose scope has `obstacles`: the page areas whose shapes
 * its route depends on. A self-contained node that stays clear of all of
 * them, before and after a change, cannot alter the route.
 */
export function obstacleReach(
  element: Element,
  context: ShapeContext,
): readonly Box[] {
  return connectorObstacleReach(
    element,
    context,
    endpointReaderFor(element.type),
  );
}

/**
 * Whether a change to `element` can alter what other, individually followed
 * elements draw beyond the ones that name it: true for anything that can
 * contain, clip, hide or reorder its neighbours.
 */
function changesPageStructure(element: Element): boolean {
  return (
    !isSelfContainedNode(element) && !ENDPOINT_BOUND_EDGES.has(element.type)
  );
}

export interface RenderImpact {
  /**
   * True when the change may affect any drawing on the page; every element
   * must then be treated as stale, whatever its scope.
   */
  readonly structural: boolean;
  /** The records that were added, replaced or removed. */
  readonly ids: readonly ElementId[];
}

const NOTHING: RenderImpact = { structural: false, ids: [] };
const EVERYTHING: RenderImpact = { structural: true, ids: [] };

/**
 * What an editor announcement makes stale. `resolve` reads the document as
 * it is after the change; what it replaced comes with the diff.
 */
export function renderImpact(
  diff: StoreDiff,
  resolve: (id: ElementId) => Element | undefined,
): RenderImpact {
  if (diff.ephemeral === "history") return NOTHING;
  const ids = [...diff.added, ...diff.updated, ...diff.removed];
  // Page switches, document loads and editor state outside the document.
  if (diff.pagesChanged || ids.length === 0 || !diff.previous)
    return EVERYTHING;
  for (const id of ids) {
    const before = diff.previous.get(id);
    const after = resolve(id);
    if (
      (before && changesPageStructure(before)) ||
      (after && changesPageStructure(after)) ||
      // Moving between pages changes what both pages draw.
      (before && after && before.page !== after.page)
    )
      return EVERYTHING;
  }
  return { structural: false, ids };
}
