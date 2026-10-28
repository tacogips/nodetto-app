import type {
  Document,
  Element,
  ElementId,
  PageId,
  PcbBoardSemantic,
  PcbFootprintSemantic,
  PcbPad,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbZoneSemantic,
  PcbXY,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import {
  expandCopperLayers,
  footprintToBoard,
  outlineBounds,
  outlineContains,
  padCopperOutline,
  padPrimitiveOutlines,
  pageCopperLayers,
  PcbGrid,
  viaCopperLayers,
} from "./geometry.ts";
import type { PcbBounds, PcbOutline } from "./geometry.ts";

export type PcbPadRef = {
  readonly footprintId: ElementId;
  readonly pad: number;
};
export type PcbNodeRef =
  | { readonly kind: "pad"; readonly ref: PcbPadRef }
  | {
      readonly kind: "track" | "via" | "zoneFill";
      readonly id: ElementId;
      readonly index?: number;
    };

export interface PcbConnectivity {
  component(node: PcbNodeRef): number;
  readonly pads: readonly {
    readonly ref: PcbPadRef;
    readonly net: string;
    readonly at: PcbXY;
    readonly elementOrder: number;
  }[];
}

export interface PcbNetHighlight {
  readonly pads: readonly PcbPadRef[];
  readonly tracks: readonly ElementId[];
  readonly vias: readonly ElementId[];
  readonly zones: readonly ElementId[];
}

const CONTACT_EPSILON = 1e-3;
type NodeKind = "pad" | "track" | "via" | "zoneFill";
interface Node {
  readonly kind: NodeKind;
  readonly id: ElementId;
  readonly index?: number;
  readonly net: string;
}
interface PadRecord {
  readonly kind: "pad";
  readonly node: number;
  readonly net: string;
  readonly outlines: readonly PcbOutline[];
}
interface ViaRecord {
  readonly kind: "via";
  readonly node: number;
  readonly net: string;
  readonly at: PcbXY;
  readonly radius: number;
}
interface ZoneRecord {
  readonly kind: "zone";
  readonly node: number;
  readonly net: string;
  readonly outline: PcbOutline;
}
interface SegmentRecord {
  readonly kind: "segment";
  readonly node: number;
  readonly elementId: ElementId;
  readonly net: string;
  readonly width: number;
  readonly start: PcbXY;
  readonly end: PcbXY;
}
type CopperRecord = PadRecord | ViaRecord | ZoneRecord | SegmentRecord;

function elementOrder(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}
function nodeKey(node: PcbNodeRef): string {
  return node.kind === "pad"
    ? JSON.stringify(["pad", node.ref.footprintId, node.ref.pad])
    : JSON.stringify([node.kind, node.id, node.index ?? -1]);
}
function recordBounds(bounds: PcbBounds, grow = 0): PcbBounds {
  return {
    minX: bounds.minX - grow,
    minY: bounds.minY - grow,
    maxX: bounds.maxX + grow,
    maxY: bounds.maxY + grow,
  };
}
function pointBounds(point: PcbXY): PcbBounds {
  return { minX: point[0], minY: point[1], maxX: point[0], maxY: point[1] };
}
function circleBounds(point: PcbXY, radius: number): PcbBounds {
  return {
    minX: point[0] - radius,
    minY: point[1] - radius,
    maxX: point[0] + radius,
    maxY: point[1] + radius,
  };
}
function polygonOutline(points: readonly PcbXY[]): PcbOutline | undefined {
  const [start, ...rest] = points;
  return start
    ? { kind: "contour", start, segments: rest.map((to) => ({ to })) }
    : undefined;
}
function padOutlines(fp: PcbFootprintSemantic, pad: PcbPad): PcbOutline[] {
  return [padCopperOutline(fp, pad), ...padPrimitiveOutlines(fp, pad)];
}
function containsAny(outlines: readonly PcbOutline[], point: PcbXY): boolean {
  return outlines.some((outline) => outlineContains(outline, point));
}
function distanceSquared(a: PcbXY, b: PcbXY): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}
function pointSegmentDistanceSquared(
  point: PcbXY,
  start: PcbXY,
  end: PcbXY,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
              lengthSquared,
          ),
        );
  return distanceSquared(point, [
    start[0] + amount * dx,
    start[1] + amount * dy,
  ]);
}
function nodeRef(node: Node): PcbNodeRef {
  if (node.kind === "pad")
    return { kind: "pad", ref: { footprintId: node.id, pad: node.index ?? 0 } };
  return node.index === undefined
    ? { kind: node.kind, id: node.id }
    : { kind: node.kind, id: node.id, index: node.index };
}
function semantic<T>(element: Element): T {
  return element.semantic as T;
}

export function computePcbConnectivity(
  document: Document,
  pageId: PageId,
): PcbConnectivity {
  const elements = document.elements
    .filter(
      (element) => element.page === pageId && element.visual.hidden !== true,
    )
    .sort(elementOrder);
  const board = elements.find((element) => element.type === "pcb.board");
  const copper = pageCopperLayers(
    board ? semantic<PcbBoardSemantic>(board) : undefined,
  );
  const nodes: Node[] = [];
  const nodeIndexes = new Map<string, number>();
  const grids = new Map(
    copper.map((layer) => [layer, new PcbGrid<CopperRecord>()]),
  );
  const addNode = (node: Node): number => {
    nodes.push(node);
    const index = nodes.length - 1;
    nodeIndexes.set(nodeKey(nodeRef(node)), index);
    return index;
  };
  const addRecord = (
    layer: string,
    record: CopperRecord,
    bounds: PcbBounds,
  ): void => {
    grids.get(layer)?.insert(record, bounds);
  };
  const pads: PcbConnectivity["pads"][number][] = [];

  for (const [order, element] of elements.entries()) {
    if (element.type === "pcb.footprint") {
      const fp = semantic<PcbFootprintSemantic>(element);
      fp.pads.forEach((pad, padIndex) => {
        if (!pad.net) return;
        const layers = expandCopperLayers(pad.layers, copper);
        if (!layers.length) return;
        const ref = { footprintId: element.id, pad: padIndex };
        const node = addNode({
          kind: "pad",
          id: element.id,
          index: padIndex,
          net: pad.net,
        });
        const outlines = padOutlines(fp, pad);
        const bounds = outlines.map(outlineBounds).reduce((a, b) => ({
          minX: Math.min(a.minX, b.minX),
          minY: Math.min(a.minY, b.minY),
          maxX: Math.max(a.maxX, b.maxX),
          maxY: Math.max(a.maxY, b.maxY),
        }));
        for (const layer of layers)
          addRecord(
            layer,
            { kind: "pad", node, net: pad.net, outlines },
            bounds,
          );
        pads.push({
          ref,
          net: pad.net,
          at: boardPadCenter(fp, pad),
          elementOrder: order,
        });
      });
    } else if (element.type === "pcb.track") {
      const track = semantic<PcbTrackSemantic>(element);
      if (!track.net || track.points.length < 2) continue;
      const node = addNode({ kind: "track", id: element.id, net: track.net });
      const points =
        track.mid && track.points.length === 2
          ? [track.points[0] as PcbXY, track.mid, track.points[1] as PcbXY]
          : track.points;
      const grid = grids.get(track.layer);
      if (!grid) continue;
      for (let index = 0; index + 1 < points.length; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        if (!start || !end) continue;
        const bounds = {
          minX: Math.min(start[0], end[0]),
          minY: Math.min(start[1], end[1]),
          maxX: Math.max(start[0], end[0]),
          maxY: Math.max(start[1], end[1]),
        };
        grid.insert(
          {
            kind: "segment",
            node,
            elementId: element.id,
            net: track.net,
            width: track.width,
            start,
            end,
          },
          recordBounds(bounds, track.width / 2 + CONTACT_EPSILON),
        );
      }
    } else if (element.type === "pcb.via") {
      const via = semantic<PcbViaSemantic>(element);
      if (!via.net) continue;
      const node = addNode({ kind: "via", id: element.id, net: via.net });
      for (const layer of viaCopperLayers(via, copper))
        addRecord(
          layer,
          {
            kind: "via",
            node,
            net: via.net,
            at: via.at,
            radius: via.diameter / 2,
          },
          circleBounds(via.at, via.diameter / 2),
        );
    } else if (element.type === "pcb.zone") {
      const zone = semantic<PcbZoneSemantic>(element);
      if (!zone.net) continue;
      let fillIndex = 0;
      for (const fill of zone.filled) {
        const grid = grids.get(fill.layer);
        if (!grid) continue;
        for (const polygon of fill.polygons) {
          const index = fillIndex++;
          const outline = polygonOutline(polygon);
          if (!outline) continue;
          const node = addNode({
            kind: "zoneFill",
            id: element.id,
            index,
            net: zone.net,
          });
          grid.insert(
            { kind: "zone", node, net: zone.net, outline },
            outlineBounds(outline),
          );
        }
      }
    }
  }

  const parent = nodes.map((_, index) => index);
  const rank = nodes.map(() => 0);
  const find = (value: number): number => {
    const current = parent[value];
    if (current === undefined || current === value) return value;
    const root = find(current);
    parent[value] = root;
    return root;
  };
  const union = (left: number, right: number): void => {
    if (nodes[left]?.net !== nodes[right]?.net || !nodes[left]?.net) return;
    const a = find(left);
    const b = find(right);
    if (a === b) return;
    const ar = rank[a] ?? 0;
    const br = rank[b] ?? 0;
    if (ar < br) parent[a] = b;
    else {
      parent[b] = a;
      if (ar === br) rank[a] = ar + 1;
    }
  };
  const connectPoint = (
    node: number,
    net: string,
    at: PcbXY,
    layer: string,
    source: "track" | "via" | "pad",
  ): void => {
    const candidates = grids.get(layer)?.query(pointBounds(at)) ?? [];
    for (const candidate of candidates) {
      if (candidate.net !== net || candidate.node === node) continue;
      let touches = false;
      if (candidate.kind === "pad")
        touches =
          (source === "track" || source === "via") &&
          containsAny(candidate.outlines, at);
      else if (candidate.kind === "via")
        touches =
          source === "track" &&
          distanceSquared(at, candidate.at) <= candidate.radius ** 2;
      else if (candidate.kind === "zone")
        touches = outlineContains(candidate.outline, at);
      else if (source === "track")
        touches =
          pointSegmentDistanceSquared(at, candidate.start, candidate.end) <=
          (candidate.width / 2 + CONTACT_EPSILON) ** 2;
      if (touches) union(node, candidate.node);
    }
  };

  // Process contact points in deterministic element and semantic order.
  for (const element of elements) {
    if (element.type === "pcb.footprint") {
      const fp = semantic<PcbFootprintSemantic>(element);
      fp.pads.forEach((pad, padIndex) => {
        if (!pad.net) return;
        const node =
          nodeIndexes.get(
            nodeKey({
              kind: "pad",
              ref: { footprintId: element.id, pad: padIndex },
            }),
          ) ?? -1;
        if (node < 0) return;
        for (const layer of expandCopperLayers(pad.layers, copper))
          connectPoint(node, pad.net, boardPadCenter(fp, pad), layer, "pad");
      });
    } else if (element.type === "pcb.track") {
      const track = semantic<PcbTrackSemantic>(element);
      if (!track.net || track.points.length < 2) continue;
      const node =
        nodeIndexes.get(nodeKey({ kind: "track", id: element.id })) ?? -1;
      if (node < 0) continue;
      const points =
        track.mid && track.points.length === 2
          ? [track.points[0] as PcbXY, track.mid, track.points[1] as PcbXY]
          : track.points;
      for (const point of [points[0], points[points.length - 1]])
        if (point) connectPoint(node, track.net, point, track.layer, "track");
    } else if (element.type === "pcb.via") {
      const via = semantic<PcbViaSemantic>(element);
      if (!via.net) continue;
      const node =
        nodeIndexes.get(nodeKey({ kind: "via", id: element.id })) ?? -1;
      if (node < 0) continue;
      for (const layer of viaCopperLayers(via, copper))
        connectPoint(node, via.net, via.at, layer, "via");
    }
  }

  const componentByKey = new Map<string, number>();
  const rootOrder = new Map<number, number>();
  for (let index = 0; index < nodes.length; index += 1) {
    const root = find(index);
    if (!rootOrder.has(root)) rootOrder.set(root, rootOrder.size);
    const node = nodes[index];
    if (node)
      componentByKey.set(nodeKey(nodeRef(node)), rootOrder.get(root) ?? -1);
  }
  return {
    pads,
    component: (node) => componentByKey.get(nodeKey(node)) ?? -1,
  };
}

function boardPadCenter(fp: PcbFootprintSemantic, pad: PcbPad): PcbXY {
  return footprintToBoard(fp, pad.at);
}

function pageElements(document: Document, pageId: PageId): Element[] {
  return document.elements
    .filter((element) => element.page === pageId)
    .sort(elementOrder);
}

export function pcbNetHighlight(
  document: Document,
  pageId: PageId,
  net: string,
): PcbNetHighlight {
  const pads: PcbPadRef[] = [];
  const tracks: ElementId[] = [];
  const vias: ElementId[] = [];
  const zones: ElementId[] = [];
  for (const element of pageElements(document, pageId)) {
    if (element.type === "pcb.footprint") {
      semantic<PcbFootprintSemantic>(element).pads.forEach((pad, index) => {
        if (pad.net === net) pads.push({ footprintId: element.id, pad: index });
      });
    } else if (
      element.type === "pcb.track" &&
      semantic<PcbTrackSemantic>(element).net === net
    )
      tracks.push(element.id);
    else if (
      element.type === "pcb.via" &&
      semantic<PcbViaSemantic>(element).net === net
    )
      vias.push(element.id);
    else if (
      element.type === "pcb.zone" &&
      semantic<PcbZoneSemantic>(element).net === net
    )
      zones.push(element.id);
  }
  return { pads, tracks, vias, zones };
}

export function pcbNetMembers(
  document: Document,
  pageId: PageId,
  net: string,
): ElementId[] {
  const result: ElementId[] = [];
  for (const element of pageElements(document, pageId)) {
    if (element.type === "pcb.footprint") {
      if (
        semantic<PcbFootprintSemantic>(element).pads.some(
          (pad) => pad.net === net,
        )
      )
        result.push(element.id);
    } else if (
      (element.type === "pcb.track" &&
        semantic<PcbTrackSemantic>(element).net === net) ||
      (element.type === "pcb.via" &&
        semantic<PcbViaSemantic>(element).net === net) ||
      (element.type === "pcb.zone" &&
        semantic<PcbZoneSemantic>(element).net === net)
    )
      result.push(element.id);
  }
  return result;
}

export function pcbNetNames(document: Document, pageId: PageId): string[] {
  const names = new Set<string>();
  for (const element of pageElements(document, pageId)) {
    if (element.type === "pcb.board") {
      for (const net of semantic<PcbBoardSemantic>(element).nets)
        if (net) names.add(net);
    } else if (element.type === "pcb.footprint") {
      for (const pad of semantic<PcbFootprintSemantic>(element).pads)
        if (pad.net) names.add(pad.net);
    } else if (element.type === "pcb.track") {
      const net = semantic<PcbTrackSemantic>(element).net;
      if (net) names.add(net);
    } else if (element.type === "pcb.via") {
      const net = semantic<PcbViaSemantic>(element).net;
      if (net) names.add(net);
    } else if (element.type === "pcb.zone") {
      const net = semantic<PcbZoneSemantic>(element).net;
      if (net) names.add(net);
    }
  }
  return [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
