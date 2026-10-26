import type {
  BreadboardNetlist,
  BreadboardNetlistComponent,
  BreadboardPartType,
  Document,
  Element,
  ElementId,
  PageId,
} from "@nodetto/ir";
import { BREADBOARD_PART_TYPES, compareReferences } from "@nodetto/ir";
import type { Vec } from "../geometry.ts";
import { compareFractional } from "../fractional.ts";
import {
  breadboardBondGroups,
  breadboardDescription,
  breadboardFootprint,
  breadboardPartName,
  breadboardPins,
  breadboardWireEnds,
} from "./catalogue.ts";
import { boardHoles } from "./board.ts";
import type {
  BreadboardConnectivity,
  BreadboardNet,
  BreadboardPinRef,
} from "./types.ts";

export interface BreadboardHighlight {
  readonly pins: readonly BreadboardPinRef[];
  readonly holes: readonly Vec[];
  readonly wireIds: readonly ElementId[];
  readonly strips: readonly {
    readonly boardId: ElementId;
    readonly strip: string;
  }[];
}

type Target = BreadboardPinRef | { readonly wireId: ElementId };
type PointId = string;
/** Wire ends in point order: the first and the last bend point. */
const WIRE_END = { start: 0, end: 1 } as const;
type WireEnd = (typeof WIRE_END)[keyof typeof WIRE_END];
interface PointRecord {
  readonly id: PointId;
  readonly elementId: ElementId;
  readonly point: Vec;
  readonly pin?: number;
  readonly wireEnd?: WireEnd;
}
interface HoleRecord {
  readonly boardId: ElementId;
  readonly strip: string;
}

const holesByConnectivity = new WeakMap<
  BreadboardConnectivity,
  ReadonlyMap<number, readonly Vec[]>
>();

function elementOrder(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    compareFractional(left.id, right.id)
  );
}
function key(x: number, y: number): string {
  return `${x},${y}`;
}
function pinKey(ref: BreadboardPinRef): string {
  return `${ref.elementId}\u0000${ref.pin}`;
}
function pointKey(point: Vec): string {
  return key(Math.round(point.x / 10), Math.round(point.y / 10));
}
function nearLattice(point: Vec): boolean {
  const x = Math.round(point.x / 10) * 10;
  const y = Math.round(point.y / 10) * 10;
  return Math.abs(point.x - x) <= 0.5 && Math.abs(point.y - y) <= 0.5;
}
function visible(element: Element): boolean {
  return element.visual.hidden !== true;
}
function isPart(element: Element): boolean {
  return BREADBOARD_PART_TYPES.includes(element.type as BreadboardPartType);
}

export function computeBreadboardConnectivity(
  document: Document,
  pageId: PageId,
): BreadboardConnectivity {
  const elements = document.elements
    .filter((element) => element.page === pageId && visible(element))
    .sort(elementOrder);
  const boards = elements
    .filter((element) => element.type === "breadboard.board")
    .sort(elementOrder);
  const holeAt = new Map<string, HoleRecord>();
  for (const board of boards) {
    for (const hole of boardHoles(board)) {
      const point = { x: hole.pageX, y: hole.pageY };
      if (nearLattice(point)) {
        holeAt.set(pointKey(point), { boardId: board.id, strip: hole.strip });
      }
    }
  }

  const points: PointRecord[] = [];
  const partPointIds = new Map<string, PointId>();
  const wireEndIds = new Map<string, readonly [PointId, PointId]>();
  for (const element of elements) {
    if (isPart(element)) {
      for (const pin of breadboardPins(element)) {
        const id = `p:${element.id}:${pin.number}`;
        points.push({ id, elementId: element.id, pin: pin.number, point: pin });
        partPointIds.set(
          pinKey({ elementId: element.id, pin: pin.number }),
          id,
        );
      }
    } else if (element.type === "breadboard.wire") {
      const ends = breadboardWireEnds(element);
      if (!ends) continue;
      const [start, end] = ends;
      const first = `w:${element.id}:${WIRE_END.start}`;
      const last = `w:${element.id}:${WIRE_END.end}`;
      points.push(
        {
          id: first,
          elementId: element.id,
          point: start,
          wireEnd: WIRE_END.start,
        },
        { id: last, elementId: element.id, point: end, wireEnd: WIRE_END.end },
      );
      wireEndIds.set(element.id, [first, last]);
    }
  }

  const parent = new Map<PointId, PointId>();
  const rank = new Map<PointId, number>();
  for (const point of points) {
    parent.set(point.id, point.id);
    rank.set(point.id, 0);
  }
  const find = (item: PointId): PointId => {
    const current = parent.get(item);
    if (current === undefined || current === item) return item;
    const root = find(current);
    parent.set(item, root);
    return root;
  };
  const unionAll = ([first, ...rest]: readonly PointId[]): void => {
    if (first) for (const id of rest) union(first, id);
  };
  const union = (left: PointId, right: PointId): void => {
    const a = find(left);
    const b = find(right);
    if (a === b) return;
    const ar = rank.get(a) ?? 0;
    const br = rank.get(b) ?? 0;
    if (ar < br) parent.set(a, b);
    else {
      parent.set(b, a);
      if (ar === br) rank.set(a, ar + 1);
    }
  };
  const byLattice = new Map<string, PointId[]>();
  const pointsByStrip = new Map<string, PointId[]>();
  const stripRecords = new Map<string, HoleRecord>();
  const holesByStrip = new Map<string, Vec[]>();
  const pointById = new Map(points.map((point) => [point.id, point]));
  for (const point of points) {
    if (!nearLattice(point.point)) continue;
    const latticeKey = pointKey(point.point);
    const group = byLattice.get(latticeKey) ?? [];
    group.push(point.id);
    byLattice.set(latticeKey, group);
    const hole = holeAt.get(latticeKey);
    if (hole) {
      const stripKey = `${hole.boardId}\u0000${hole.strip}`;
      const stripPoints = pointsByStrip.get(stripKey) ?? [];
      stripPoints.push(point.id);
      pointsByStrip.set(stripKey, stripPoints);
      stripRecords.set(stripKey, hole);
    }
  }
  for (const ids of byLattice.values()) unionAll(ids);
  for (const [stripKey, ids] of pointsByStrip) {
    unionAll(ids);
    const record = stripRecords.get(stripKey);
    if (!record) continue;
    const board = boards.find((item) => item.id === record.boardId);
    if (!board) continue;
    const all = boardHoles(board)
      .filter((hole) => hole.strip === record.strip)
      .map((hole) => ({ x: hole.pageX, y: hole.pageY }));
    holesByStrip.set(stripKey, all);
  }
  for (const [start, end] of wireEndIds.values()) union(start, end);
  for (const element of elements) {
    if (!isPart(element)) continue;
    for (const group of breadboardBondGroups(
      element.type as BreadboardPartType,
    )) {
      const ids = group
        .map((pin) => partPointIds.get(pinKey({ elementId: element.id, pin })))
        .filter((id): id is string => id !== undefined);
      unionAll(ids);
    }
  }

  const firstPointIndex = new Map(
    points.map((point, index) => [point.id, index]),
  );
  const roots = new Map<PointId, PointRecord[]>();
  for (const point of points) {
    const root = find(point.id);
    const members = roots.get(root) ?? [];
    members.push(point);
    roots.set(root, members);
  }
  const strips = new Map<PointId, Map<string, HoleRecord>>();
  for (const [stripKey, ids] of pointsByStrip) {
    const [first] = ids;
    const root = first ? find(first) : undefined;
    const record = stripRecords.get(stripKey);
    if (!root || !record) continue;
    const current = strips.get(root) ?? new Map<string, HoleRecord>();
    current.set(stripKey, record);
    strips.set(root, current);
  }
  const sortedRoots = [...roots.keys()].sort((left, right) => {
    const l = Math.min(
      ...(roots.get(left) ?? []).map((p) => firstPointIndex.get(p.id) ?? 0),
    );
    const r = Math.min(
      ...(roots.get(right) ?? []).map((p) => firstPointIndex.get(p.id) ?? 0),
    );
    return l - r;
  });
  const netByRoot = new Map<PointId, number>();
  const nets: BreadboardNet[] = sortedRoots.map((root, index) => {
    netByRoot.set(root, index);
    const members = roots.get(root) ?? [];
    const pins = members
      .filter((point) => point.pin !== undefined)
      .map((point) => ({
        elementId: point.elementId,
        pin: point.pin as number,
      }));
    const wireIds = [
      ...new Set(
        members
          .filter((point) => point.wireEnd !== undefined)
          .map((point) => point.elementId),
      ),
    ];
    const stripMap = strips.get(root) ?? new Map<string, HoleRecord>();
    const connectedStrips = [...stripMap.values()]
      .map((strip) => ({ boardId: strip.boardId, strip: strip.strip }))
      .sort(
        (a, b) =>
          boards.findIndex((board) => board.id === a.boardId) -
            boards.findIndex((board) => board.id === b.boardId) ||
          a.strip.localeCompare(b.strip),
      );
    return { id: index, pins, strips: connectedStrips, wireIds };
  });
  const pinNet = new Map<string, number>();
  const wireNet = new Map<ElementId, number>();
  for (const point of points) {
    const net = netByRoot.get(find(point.id));
    if (net === undefined) continue;
    if (point.pin !== undefined)
      pinNet.set(pinKey({ elementId: point.elementId, pin: point.pin }), net);
    else wireNet.set(point.elementId, net);
  }
  const pinHole = new Map<string, boolean>();
  for (const element of elements.filter(isPart)) {
    for (const pin of breadboardPins(element)) {
      const ref = { elementId: element.id, pin: pin.number };
      pinHole.set(pinKey(ref), nearLattice(pin) && holeAt.has(pointKey(pin)));
    }
  }
  const validEndpoint = new Map<string, boolean>();
  for (const [wireId, ids] of wireEndIds) {
    ids.forEach((id, end) => {
      const point = pointById.get(id);
      if (!point) return;
      const latticeKey = pointKey(point.point);
      const touchesPin = (byLattice.get(latticeKey) ?? []).some(
        (id) => pointById.get(id)?.pin !== undefined,
      );
      validEndpoint.set(
        `${wireId}:${end}`,
        nearLattice(point.point) && (holeAt.has(latticeKey) || touchesPin),
      );
    });
  }
  const result: BreadboardConnectivity = {
    nets,
    netOfPin: (ref) => pinNet.get(pinKey(ref)),
    netOfWire: (id) => wireNet.get(id),
    pinOnHole: (ref) => pinHole.get(pinKey(ref)) === true,
    wireEndOnHoleOrPin: (id, end) => validEndpoint.get(`${id}:${end}`) === true,
  };
  const netHoles = new Map<number, readonly Vec[]>();
  for (const root of sortedRoots) {
    const net = netByRoot.get(root);
    if (net === undefined) continue;
    const found = new Map<string, Vec>();
    for (const [stripKey, ids] of pointsByStrip) {
      const [first] = ids;
      if (!first || find(first) !== root) continue;
      for (const hole of holesByStrip.get(stripKey) ?? []) {
        found.set(`${hole.x},${hole.y}`, hole);
      }
    }
    netHoles.set(net, [...found.values()]);
  }
  holesByConnectivity.set(result, netHoles);
  return result;
}

export function toBreadboardNetlist(
  document: Document,
  pageId: PageId,
  connectivity: BreadboardConnectivity,
): BreadboardNetlist {
  const page = document.pages.find((entry) => entry.id === pageId);
  const parts = document.elements
    .filter(
      (element) =>
        element.page === pageId && visible(element) && isPart(element),
    )
    .sort((a, b) => {
      const left = a.semantic as { reference?: string };
      const right = b.semantic as { reference?: string };
      return (
        compareReferences(left.reference ?? "", right.reference ?? "") ||
        compareFractional(a.id, b.id)
      );
    });
  const components: BreadboardNetlistComponent[] = parts.map((element) => {
    const semantic = element.semantic as { reference?: string; value?: string };
    const type = element.type as BreadboardPartType;
    const pins = breadboardPins(element).map((pin) => ({
      number: pin.number,
      name: pin.name,
    }));
    return {
      elementId: element.id,
      type,
      reference: semantic.reference ?? "",
      value: semantic.value ?? "",
      description: breadboardDescription(type, element.semantic as never),
      footprint: breadboardFootprint(type, element.semantic as never),
      partName: breadboardPartName(type, element.semantic as never),
      pins,
    };
  });
  const componentIndex = new Map(
    components.map((component, index) => [component.elementId, index]),
  );
  const netGroups = new Map<number, BreadboardPinRef[]>();
  for (const component of components) {
    for (const pin of component.pins) {
      const net = connectivity.netOfPin({
        elementId: component.elementId,
        pin: pin.number,
      });
      if (net === undefined) continue;
      const refs = netGroups.get(net) ?? [];
      refs.push({ elementId: component.elementId, pin: pin.number });
      netGroups.set(net, refs);
    }
  }
  const sortedGroups = [...netGroups.entries()]
    .map(([netId, refs]) => ({
      netId,
      refs: refs.sort(
        (a, b) =>
          (componentIndex.get(a.elementId) ?? 0) -
            (componentIndex.get(b.elementId) ?? 0) || a.pin - b.pin,
      ),
    }))
    .sort((a, b) => {
      const [left] = a.refs;
      const [right] = b.refs;
      return (
        (left ? (componentIndex.get(left.elementId) ?? 0) : 0) -
          (right ? (componentIndex.get(right.elementId) ?? 0) : 0) ||
        (left?.pin ?? 0) - (right?.pin ?? 0)
      );
    });
  const firstBattery = components.find(
    (component) => component.type === "breadboard.battery",
  );
  const gnd = firstBattery
    ? connectivity.netOfPin({ elementId: firstBattery.elementId, pin: 2 })
    : undefined;
  const vcc = firstBattery
    ? connectivity.netOfPin({ elementId: firstBattery.elementId, pin: 1 })
    : undefined;
  const names = new Set<string>();
  const nets = sortedGroups.map(({ netId, refs }, index) => {
    const [first] = refs;
    const component = first
      ? components.find((item) => item.elementId === first.elementId)
      : undefined;
    let name =
      netId === gnd
        ? "GND"
        : netId === vcc
          ? "VCC"
          : `N_${component?.reference ?? ""}_${first?.pin ?? 0}`;
    if (names.has(name)) name = `${name}_${index + 1}`;
    names.add(name);
    const nodes = refs.map((ref) => {
      const part = components.find((item) => item.elementId === ref.elementId);
      const pin = part?.pins.find((item) => item.number === ref.pin);
      return {
        reference: part?.reference ?? "",
        pin: ref.pin,
        pinName: pin?.name ?? String(ref.pin),
      };
    });
    return { code: index + 1, name, nodes };
  });
  return {
    pageId,
    pageName: page?.name ?? "",
    documentTitle: document.title,
    components,
    nets,
  };
}

export function breadboardNetHighlight(
  connectivity: BreadboardConnectivity,
  target: Target,
): BreadboardHighlight {
  const netId =
    "wireId" in target
      ? connectivity.netOfWire(target.wireId)
      : connectivity.netOfPin(target);
  const net = netId === undefined ? undefined : connectivity.nets[netId];
  if (!net) return { pins: [], holes: [], wireIds: [], strips: [] };
  return {
    pins: net.pins,
    holes: holesByConnectivity.get(connectivity)?.get(net.id) ?? [],
    wireIds: net.wireIds,
    strips: net.strips,
  };
}

export function breadboardNetMembers(
  document: Document,
  pageId: PageId,
  connectivity: BreadboardConnectivity,
  target: Target,
): readonly ElementId[] {
  const netId =
    "wireId" in target
      ? connectivity.netOfWire(target.wireId)
      : connectivity.netOfPin(target);
  const net = netId === undefined ? undefined : connectivity.nets[netId];
  if (!net) return [];
  const ids = new Set<ElementId>([
    ...net.pins.map((pin) => pin.elementId),
    ...net.wireIds,
  ]);
  return document.elements
    .filter(
      (element) =>
        element.page === pageId && visible(element) && ids.has(element.id),
    )
    .sort(elementOrder)
    .map((element) => element.id);
}
