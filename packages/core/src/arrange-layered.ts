import {
  getElementTypeDefinition,
  type Element,
  type ElementId,
  type PageId,
  type PageKind,
} from "@nodetto/ir";
import type { Command } from "./commands.ts";
import { expandContainers, frameParents } from "./frame-tree.ts";
import { outermostGroupOf } from "./group.ts";
import { createShapeContext } from "./hit-test.ts";
import type { ShapeUtilRegistry } from "./shape-util.ts";
import { endpointReaderFor } from "./shapes/connector.ts";
import { FRAME_TITLE_BAND } from "./shapes/frame.ts";
import type { Store } from "./store.ts";

export const LAYERED_PAGE_KINDS: readonly PageKind[] = [
  "state",
  "flowchart",
  "freeform",
  "architecture",
  "uml",
  "erd",
];
export interface LayeredOptions {
  readonly direction: "LR" | "TB";
  readonly frameOrder?: readonly ElementId[];
}
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const edge = (e: Element): boolean =>
  getElementTypeDefinition(e.type)?.category === "edge";

export function columnFrames(
  store: Store,
  pageId: PageId,
  registry: ShapeUtilRegistry,
): readonly Element[] {
  const context = createShapeContext(store, registry, 1);
  const parents = frameParents(store, pageId, context);
  return store
    .getPageElements(pageId)
    .filter((e) => e.type === "frame" && !parents.has(e.id))
    .sort((a, b) => compare(a.id, b.id));
}

export function planLayered(
  store: Store,
  pageId: PageId,
  registry: ShapeUtilRegistry,
  options: LayeredOptions,
): { commands: Command[]; placed: ReadonlySet<ElementId> } | { error: string } {
  const context = createShapeContext(store, registry, 1);
  const parents = frameParents(store, pageId, context);
  const elements = [...store.getPageElements(pageId)].sort((a, b) =>
    compare(a.id, b.id),
  );
  const frames = columnFrames(store, pageId, registry);
  if (!frames.length)
    return {
      error: "arrange --mode layered needs frames on the page; use --mode tidy",
    };
  const frameIds = new Set(frames.map((f) => f.id));
  for (const id of options.frameOrder ?? [])
    if (!frameIds.has(id)) return { error: `Not a column frame: ${id}` };
  const units = elements.filter((e) => {
    if (
      edge(e) ||
      e.type === "resource" ||
      frameIds.has(e.id) ||
      outermostGroupOf(store, e.id) !== e.id
    )
      return false;
    let parent = parents.get(e.id);
    while (parent && !frameIds.has(parent)) {
      const owner = store.get(parent);
      if (owner?.type === "frame") return false;
      parent = parents.get(parent);
    }
    return context.boundsOf(e.id) !== null;
  });
  const unitIds = new Set(units.map((u) => u.id));
  const unitOf = (id: ElementId): ElementId | undefined => {
    let current: ElementId | undefined = outermostGroupOf(store, id);
    const seen = new Set<ElementId>();
    while (current && !seen.has(current)) {
      if (unitIds.has(current)) return current;
      seen.add(current);
      current = parents.get(current);
      if (current) current = outermostGroupOf(store, current);
    }
    return undefined;
  };
  const outgoing = new Map<ElementId, ElementId[]>();
  const incoming = new Map<ElementId, number>();
  for (const e of elements) {
    if (!edge(e)) continue;
    const ends = endpointReaderFor(e.type)(e.semantic);
    if (!ends) continue;
    const from = unitOf(ends.from);
    const to = unitOf(ends.to);
    if (!from || !to || from === to) continue;
    outgoing.set(from, [...(outgoing.get(from) ?? []), to]);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
  }
  const ranked: Element[] = [];
  const visited = new Set<ElementId>();
  let start: Element | undefined =
    units.find(
      (u) =>
        u.type === "state.node" &&
        (u.semantic as { kind?: string }).kind === "initial",
    ) ??
    units.find((u) => !incoming.get(u.id)) ??
    units[0];
  while (start) {
    const queue: ElementId[] = [start.id];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (!id || visited.has(id)) continue;
      visited.add(id);
      const unit = store.get(id);
      if (unit) ranked.push(unit);
      for (const next of outgoing.get(id) ?? [])
        if (!visited.has(next)) queue.push(next);
    }
    const unvisitedIncoming = new Set<ElementId>();
    for (const [from, targets] of outgoing)
      if (!visited.has(from))
        for (const to of targets)
          if (!visited.has(to)) unvisitedIncoming.add(to);
    start =
      units.find((u) => !visited.has(u.id) && !unvisitedIncoming.has(u.id)) ??
      units.find((u) => !visited.has(u.id));
  }
  const owner = (id: ElementId): ElementId | undefined => {
    let parent = parents.get(id);
    while (parent && !frameIds.has(parent)) parent = parents.get(parent);
    return parent;
  };
  const ownerOf = new Map<ElementId, ElementId | undefined>();
  const firstRank = new Map<ElementId, number>();
  const membersByOwner = new Map<ElementId | undefined, Element[]>();
  for (const [index, unit] of ranked.entries()) {
    ownerOf.set(unit.id, owner(unit.id));
    const frameId = ownerOf.get(unit.id);
    if (frameId !== undefined && !firstRank.has(frameId))
      firstRank.set(frameId, index);
    const members = membersByOwner.get(frameId) ?? [];
    members.push(unit);
    membersByOwner.set(frameId, members);
  }
  const explicitIndex = new Map<ElementId, number>();
  for (const [index, id] of (options.frameOrder ?? []).entries())
    if (!explicitIndex.has(id)) explicitIndex.set(id, index);
  const ordered = [...frames].sort((a, b) => {
    const ai = explicitIndex.get(a.id);
    const bi = explicitIndex.get(b.id);
    if (ai !== undefined || bi !== undefined)
      return ai === undefined ? 1 : bi === undefined ? -1 : ai - bi;
    return (
      (firstRank.get(a.id) ?? Number.POSITIVE_INFINITY) -
        (firstRank.get(b.id) ?? Number.POSITIVE_INFINITY) || compare(a.id, b.id)
    );
  });
  const boxes = [...frames, ...units]
    .map((e) => context.boundsOf(e.id))
    .filter((b) => b !== null);
  let x = Math.round(Math.min(...boxes.map((b) => b.x)));
  let y = Math.round(Math.min(...boxes.map((b) => b.y)));
  const commands: Command[] = [];
  const placed = new Set<ElementId>();
  const columns: (Element | undefined)[] = [...ordered];
  if (membersByOwner.has(undefined)) columns.push(undefined);
  for (const frame of columns) {
    const members = membersByOwner.get(frame?.id) ?? [];
    const sizes = members
      .map((u) => context.boundsOf(u.id))
      .filter((b) => b !== null);
    const lr = options.direction === "LR";
    const cross = Math.max(0, ...sizes.map((b) => (lr ? b.width : b.height)));
    const stack =
      sizes.reduce((n, b) => n + (lr ? b.height : b.width), 0) +
      Math.max(0, sizes.length - 1) * 60;
    const title =
      frame && (frame.semantic as { showTitle?: boolean }).showTitle !== false
        ? FRAME_TITLE_BAND
        : 0;
    const width = Math.round(
      lr ? cross + (frame ? 80 : 0) : stack + (frame ? 80 : 0),
    );
    const height = Math.round(
      lr ? stack + (frame ? 80 + title : 0) : cross + (frame ? 80 + title : 0),
    );
    let offset = frame ? 40 + (lr ? title : 0) : 0;
    for (const unit of members) {
      const box = context.boundsOf(unit.id);
      if (!box) continue;
      const nx = Math.round(x + (lr ? (width - box.width) / 2 : offset));
      const ny = Math.round(
        y +
          (lr
            ? offset
            : frame
              ? title + 40 + (cross - box.height) / 2
              : (height - box.height) / 2),
      );
      const dx = nx - box.x;
      const dy = ny - box.y;
      for (const id of expandContainers(store, [unit.id], context).sort(
        compare,
      )) {
        const e = store.get(id);
        if (!e || e.type === "group" || edge(e)) continue;
        placed.add(id);
        const vx = Math.round((e.visual.x ?? 0) + dx);
        const vy = Math.round((e.visual.y ?? 0) + dy);
        if (vx !== (e.visual.x ?? 0) || vy !== (e.visual.y ?? 0))
          commands.push({ type: "updateVisual", id, visual: { x: vx, y: vy } });
      }
      offset += (lr ? box.height : box.width) + 60;
    }
    if (frame) {
      const visual = { x: Math.round(x), y: Math.round(y), width, height };
      const b = context.boundsOf(frame.id);
      if (
        b &&
        (b.x !== visual.x ||
          b.y !== visual.y ||
          b.width !== width ||
          b.height !== height)
      )
        commands.push({ type: "updateVisual", id: frame.id, visual });
    }
    if (lr) x += width + 120;
    else y += height + 120;
  }
  return { commands, placed };
}
