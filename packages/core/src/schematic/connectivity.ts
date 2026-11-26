import {
  isSchematicPartType,
  sweepAxisContacts,
  type AxisQuery,
  type AxisSegment,
  type Document,
  type ElementId,
  type PageId,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { UnionFind } from "../union-find.ts";
import {
  pinKey,
  pointElementKey,
  wirePointKeys,
  type KeyPoint,
} from "./coordinates.ts";
import { schematicPins } from "./symbols.ts";

export interface SchematicPinRef {
  readonly elementId: ElementId;
  readonly pin: number;
}
export interface SchematicNet {
  readonly id: number;
  readonly pins: readonly SchematicPinRef[];
  readonly powerIds: readonly ElementId[];
  readonly labelIds: readonly ElementId[];
  readonly wireIds: readonly ElementId[];
  readonly junctionIds: readonly ElementId[];
}
export interface SchematicConnectivity {
  readonly nets: readonly SchematicNet[];
  netOfPin(ref: SchematicPinRef): number | undefined;
  netOfElement(id: ElementId): number | undefined;
  noConnectAt(ref: SchematicPinRef): boolean;
  wireEndAttached(id: ElementId, end: 0 | 1): boolean;
  wireEndOnPathOf(id: ElementId, end: 0 | 1): ElementId | undefined;
  readonly stats: { sweepWork: number };
}
type Kind = "pin" | "power" | "wire" | "junction" | "label";
type Point = {
  key: KeyPoint;
  kind: Kind;
  elementId: ElementId;
  pin?: number;
  end?: 0 | 1;
  name?: string;
};
type Wire = {
  id: ElementId;
  points: readonly KeyPoint[];
  node: number;
  order: number;
};
const key = (p: KeyPoint) => `${p.kx},${p.ky}`;
const refKey = (ref: SchematicPinRef) => `${ref.elementId}\u0000${ref.pin}`;
const endKey = (id: ElementId, end: number) => `${id}\u0000${end}`;

export function computeSchematicConnectivity(
  document: Document,
  pageId: PageId,
): SchematicConnectivity {
  const elements = document.elements
    .filter((e) => e.page === pageId && !e.visual.hidden)
    .sort(
      (a, b) =>
        compareFractional(a.index, b.index) || compareFractional(a.id, b.id),
    );
  const points: Point[] = [];
  const wires: Wire[] = [];
  const markers = new Set<string>();
  for (const element of elements) {
    if (
      isSchematicPartType(element.type) ||
      element.type === "schematic.power"
    ) {
      for (const pin of schematicPins(element))
        points.push({
          key: pinKey(element, pin),
          kind: element.type === "schematic.power" ? "power" : "pin",
          elementId: element.id,
          pin: pin.number,
          name:
            element.type === "schematic.power"
              ? (element.semantic as { net: string }).net.trim()
              : undefined,
        });
    } else if (element.type === "schematic.wire") {
      const path = wirePointKeys(element);
      const first = path[0];
      const last = path[path.length - 1];
      if (!first || !last) continue;
      const node = points.length;
      points.push(
        { key: first, kind: "wire", elementId: element.id, end: 0 },
        { key: last, kind: "wire", elementId: element.id, end: 1 },
      );
      wires.push({ id: element.id, points: path, node, order: wires.length });
    } else if (
      element.type === "schematic.junction" ||
      element.type === "schematic.label"
    ) {
      points.push({
        key: pointElementKey(element),
        kind: element.type === "schematic.label" ? "label" : "junction",
        elementId: element.id,
        name:
          element.type === "schematic.label"
            ? (element.semantic as { net: string }).net.trim()
            : undefined,
      });
    } else if (element.type === "schematic.noConnect")
      markers.add(key(pointElementKey(element)));
  }
  const uf = new UnionFind(points.length);
  const groups = new Map<string, number[]>();
  const names = new Map<string, number>();
  for (const [i, p] of points.entries()) {
    const k = key(p.key);
    const group = groups.get(k);
    if (group) {
      const first = group[0];
      if (first !== undefined) uf.union(first, i);
      group.push(i);
    } else groups.set(k, [i]);
    if (p.name !== undefined) {
      const first = names.get(p.name);
      if (first !== undefined) uf.union(first, i);
      else names.set(p.name, i);
    }
  }
  for (const wire of wires) uf.union(wire.node, wire.node + 1);
  type Query = {
    point: KeyPoint;
    kind: "junction" | "label" | "end";
    node: number;
    wireId?: ElementId;
    end?: 0 | 1;
    best?: number;
  };
  const queries: Query[] = [];
  const attached = new Set<string>();
  for (const group of groups.values()) {
    const counts = new Map<ElementId, number>();
    for (const i of group) {
      const p = points[i];
      if (p) counts.set(p.elementId, (counts.get(p.elementId) ?? 0) + 1);
    }
    const nonLabels = group.filter((i) => points[i]?.kind !== "label");
    const label = group.find((i) => points[i]?.kind === "label");
    if (label !== undefined && nonLabels.length === 0) {
      const p = points[label];
      if (p) queries.push({ point: p.key, kind: "label", node: label });
    }
    for (const i of group) {
      const p = points[i];
      if (!p) continue;
      if (p.kind === "junction")
        queries.push({ point: p.key, kind: "junction", node: i });
      if (p.kind === "wire" && p.end !== undefined) {
        if (group.length > (counts.get(p.elementId) ?? 0))
          attached.add(endKey(p.elementId, p.end));
        else
          queries.push({
            point: p.key,
            kind: "end",
            node: i,
            wireId: p.elementId,
            end: p.end,
          });
      }
    }
  }
  const horizontal: AxisSegment[] = [];
  const vertical: AxisSegment[] = [];
  for (const [wi, wire] of wires.entries())
    for (let i = 1; i < wire.points.length; i++) {
      const a = wire.points[i - 1];
      const b = wire.points[i];
      if (!a || !b) continue;
      const horizontalAxis = a.ky === b.ky;
      if (!horizontalAxis && a.kx !== b.kx) continue;
      let start = horizontalAxis ? a.kx : a.ky;
      let end = horizontalAxis ? b.kx : b.ky;
      const direction = Math.sign(end - start);
      if (i === 1) start += direction;
      if (i === wire.points.length - 1) end -= direction;
      if (direction === 0 || (end - start) * direction < 0) continue;
      const segment = {
        id: wi,
        line: horizontalAxis ? a.ky : a.kx,
        from: Math.min(start, end),
        to: Math.max(start, end),
      };
      (horizontalAxis ? horizontal : vertical).push(segment);
    }
  const rows: AxisQuery[] = queries.map((q, id) => ({
    id,
    line: q.point.ky,
    at: q.point.kx,
  }));
  const cols: AxisQuery[] = queries.map((q, id) => ({
    id,
    line: q.point.kx,
    at: q.point.ky,
  }));
  const stats = { sweepWork: 0 };
  const contact = (wi: number, qi: number) => {
    const wire = wires[wi];
    const q = queries[qi];
    if (!wire || !q) return;
    if (q.kind === "junction") uf.union(q.node, wire.node);
    else if (q.kind === "label" || wire.id !== q.wireId) {
      if (q.best === undefined || wire.order < q.best) q.best = wire.order;
    }
  };
  sweepAxisContacts(horizontal, rows, contact, stats);
  sweepAxisContacts(vertical, cols, contact, stats);
  const hints = new Map<string, ElementId>();
  for (const q of queries) {
    const wire = q.best === undefined ? undefined : wires[q.best];
    if (!wire) continue;
    if (q.kind === "label") uf.union(q.node, wire.node);
    else if (q.kind === "end" && q.wireId !== undefined && q.end !== undefined)
      hints.set(endKey(q.wireId, q.end), wire.id);
  }
  const nets: {
    id: number;
    pins: SchematicPinRef[];
    powerIds: ElementId[];
    labelIds: ElementId[];
    wireIds: ElementId[];
    junctionIds: ElementId[];
  }[] = [];
  const roots = new Map<number, number>();
  const pinNets = new Map<string, number>();
  const elementNets = new Map<ElementId, number>();
  const pinMarkers = new Set<string>();
  for (const [i, p] of points.entries()) {
    const root = uf.find(i);
    let n = roots.get(root);
    if (n === undefined) {
      n = nets.length;
      roots.set(root, n);
      nets.push({
        id: n,
        pins: [],
        powerIds: [],
        labelIds: [],
        wireIds: [],
        junctionIds: [],
      });
    }
    const net = nets[n];
    if (!net) continue;
    if (p.kind === "pin" && p.pin !== undefined) {
      const ref = { elementId: p.elementId, pin: p.pin };
      net.pins.push(ref);
      pinNets.set(refKey(ref), n);
      if (markers.has(key(p.key))) pinMarkers.add(refKey(ref));
    } else if (p.kind === "power") {
      net.powerIds.push(p.elementId);
      elementNets.set(p.elementId, n);
    } else if (p.kind === "label") {
      net.labelIds.push(p.elementId);
      elementNets.set(p.elementId, n);
    } else if (p.kind === "junction") {
      net.junctionIds.push(p.elementId);
      elementNets.set(p.elementId, n);
    } else if (p.kind === "wire" && p.end === 0) {
      net.wireIds.push(p.elementId);
      elementNets.set(p.elementId, n);
    }
  }
  return {
    nets,
    stats,
    netOfPin: (ref) => pinNets.get(refKey(ref)),
    netOfElement: (id) => elementNets.get(id),
    noConnectAt: (ref) => pinMarkers.has(refKey(ref)),
    wireEndAttached: (id, end) => attached.has(endKey(id, end)),
    wireEndOnPathOf: (id, end) => hints.get(endKey(id, end)),
  };
}
