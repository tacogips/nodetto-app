import {
  type Element,
  type ElementId,
  erdEndpointColumnIds,
  type ErdEndpoint,
  getElementTypeDefinition,
  type PageId,
  type PageKind,
} from "@nodetto/ir";
import { applyCommands, type Command } from "./commands.ts";
import {
  isLabelObstacle,
  labelOverlapScore,
  resolvedLabelBox,
} from "./diagram-lint/metrics.ts";
import { boxCenter, type Box, type Vec } from "./geometry.ts";
import { createShapeContext } from "./hit-test.ts";
import type { ShapeUtilRegistry } from "./shape-util.ts";
import {
  connectorDecoration,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";
import { pointAlongRoute } from "./shapes/connector/route.ts";
import { Store } from "./store.ts";

export const ROUTE_PAGE_KINDS: readonly PageKind[] = [
  "state",
  "flowchart",
  "freeform",
  "architecture",
  "uml",
  "erd",
  "bpmn",
];
export interface RouteOptions {
  readonly targetIds?: readonly ElementId[];
  readonly resetManual: boolean;
}
type Side = "right" | "top" | "bottom" | "left";
type End = "from" | "to";
interface Endpoint {
  edge: Element;
  end: End;
  node: string;
  opposite: string;
  side: Side;
  movable: boolean;
  position: number;
  projection: number;
}
const sides: readonly Side[] = ["right", "top", "bottom", "left"];
const resetFields = [
  "routingWaypoints",
  "routingBend",
  "fromPort",
  "toPort",
  "fromPortPosition",
  "toPortPosition",
  "labelPosition",
] as const;
const round = (value: number) => Math.round(value * 10000) / 10000;
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
function equalSemantic(a: Record<string, unknown>, b: unknown): boolean {
  if (!b || typeof b !== "object") return false;
  const other = b as Record<string, unknown>;
  const keys = Object.keys(a).sort(compare);
  const otherKeys = Object.keys(other).sort(compare);
  return (
    keys.length === otherKeys.length &&
    keys.every(
      (key, i) =>
        key === otherKeys[i] &&
        JSON.stringify(a[key]) === JSON.stringify(other[key]),
    )
  );
}
function isEdge(element: Element): boolean {
  return getElementTypeDefinition(element.type)?.category === "edge";
}
function columnEnd(element: Element, end: End): boolean {
  if (element.type !== "erd.relation") return false;
  const value = (element.semantic as Record<string, unknown>)[end];
  return (
    !!value &&
    typeof value === "object" &&
    erdEndpointColumnIds(value as ErdEndpoint).length > 0
  );
}
function manual(data: Record<string, unknown>): boolean {
  return (
    data["routing"] === "manual" ||
    data["fromPort"] != null ||
    data["toPort"] != null
  );
}
function port(value: unknown): Side | undefined {
  return typeof value === "string" && sides.includes(value as Side)
    ? (value as Side)
    : undefined;
}

export function planRoute(
  store: Store,
  pageId: PageId,
  registry: ShapeUtilRegistry,
  options: RouteOptions,
): Command[] {
  const draft = new Store(store.getSnapshot());
  const context = createShapeContext(draft, registry, 1);
  const edges = draft
    .getPageElements(pageId)
    .filter(isEdge)
    .sort((a, b) => compare(a.id, b.id));
  const selected = options.targetIds ? new Set(options.targetIds) : undefined;
  const data = new Map<string, Record<string, unknown>>();
  const targets = new Set<string>();
  const movable = new Set<string>();
  for (const edge of edges) {
    const ends = endpointReaderFor(edge.type)(edge.semantic);
    if (
      !ends ||
      !draft.get(ends.from) ||
      !draft.get(ends.to) ||
      edge.type === "sequence.message" ||
      (selected && !selected.has(edge.id))
    )
      continue;
    targets.add(edge.id);
    const next = { ...(edge.semantic as Record<string, unknown>) };
    if (options.resetManual) {
      next["routing"] = "orthogonal";
      for (const key of resetFields) {
        if (
          key === "labelPosition" &&
          edge.type.startsWith("bpmn.") &&
          edge.visual.labelBounds
        )
          continue;
        delete next[key];
      }
    }
    if (
      !manual(next) &&
      !(edge.type === "erd.relation" && ends.from === ends.to)
    ) {
      movable.add(edge.id);
      next["routing"] = "orthogonal";
      if (next["routingAvoidObstacles"] === false) {
        // biome-ignore lint/performance/noDelete: the serialized field must be absent.
        delete next["routingAvoidObstacles"];
      }
      const from = context.boundsOf(ends.from);
      const to = context.boundsOf(ends.to);
      if (from && to && ends.from !== ends.to) {
        const a = boxCenter(from);
        const b = boxCenter(to);
        const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
        const fromSide: Side = horizontal
          ? b.x >= a.x
            ? "right"
            : "left"
          : b.y >= a.y
            ? "bottom"
            : "top";
        const toSide: Side = horizontal
          ? b.x >= a.x
            ? "left"
            : "right"
          : b.y >= a.y
            ? "top"
            : "bottom";
        if (!columnEnd(edge, "from")) next["fromPort"] = fromSide;
        if (!columnEnd(edge, "to")) next["toPort"] = toSide;
      }
    }
    data.set(edge.id, next);
  }
  const current = (edge: Element) =>
    data.get(edge.id) ?? (edge.semantic as Record<string, unknown>);
  // Count existing non-loop ends and manual loop ends before allocating new loops.
  const used = new Map<string, Map<Side, number>>();
  const addUse = (node: string, side: Side) => {
    const count = used.get(node) ?? new Map<Side, number>();
    count.set(side, (count.get(side) ?? 0) + 1);
    used.set(node, count);
  };
  for (const edge of edges) {
    const ends = endpointReaderFor(edge.type)(edge.semantic);
    if (!ends || (ends.from === ends.to && movable.has(edge.id))) continue;
    const resolved = resolveConnector(
      edge,
      context,
      endpointReaderFor(edge.type),
    );
    for (const end of ["from", "to"] as const) {
      if (columnEnd(edge, end)) continue;
      let side = port(current(edge)[`${end}Port`]);
      const box = context.boundsOf(ends[end]);
      const point = end === "from" ? resolved?.start : resolved?.end;
      if (!side && box && point) {
        const center = boxCenter(box);
        const x = (point.x - center.x) / Math.max(box.width / 2, 1e-9);
        const y = (point.y - center.y) / Math.max(box.height / 2, 1e-9);
        side =
          Math.abs(x) >= Math.abs(y)
            ? x >= 0
              ? "right"
              : "left"
            : y >= 0
              ? "bottom"
              : "top";
      }
      if (side) addUse(ends[end], side);
    }
  }
  for (const edge of edges) {
    const ends = endpointReaderFor(edge.type)(edge.semantic);
    if (!ends || ends.from !== ends.to || !movable.has(edge.id)) continue;
    const count = used.get(ends.from);
    let side: Side = "right";
    for (const candidate of sides)
      if ((count?.get(candidate) ?? 0) < (count?.get(side) ?? 0))
        side = candidate;
    const next = current(edge);
    next["fromPort"] = side;
    next["toPort"] = side;
    next["fromPortPosition"] = 0.3;
    next["toPortPosition"] = 0.7;
    addUse(ends.from, side);
    addUse(ends.from, side);
  }
  const groups = new Map<string, Endpoint[]>();
  for (const edge of edges) {
    const ends = endpointReaderFor(edge.type)(edge.semantic);
    if (!ends || ends.from === ends.to) continue;
    for (const end of ["from", "to"] as const) {
      if (columnEnd(edge, end)) continue;
      const d = current(edge);
      const side = port(d[`${end}Port`]);
      const opposite = end === "from" ? ends.to : ends.from;
      const bounds = context.boundsOf(opposite);
      if (!side || !bounds) continue;
      const center = boxCenter(bounds);
      const position = d[`${end}PortPosition`];
      const item: Endpoint = {
        edge,
        end,
        node: ends[end],
        opposite,
        side,
        movable: movable.has(edge.id),
        position: typeof position === "number" ? position : 0.5,
        projection: side === "left" || side === "right" ? center.y : center.x,
      };
      const key = `${item.node}\0${side}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        a.projection - b.projection ||
        compare(a.edge.id, b.edge.id) ||
        compare(a.end, b.end),
    );
    const fixed = group
      .filter((item) => !item.movable)
      .map((item) => item.position)
      .sort((a, b) => a - b);
    const moving = group.filter((item) => item.movable);
    if (!moving.length) continue;
    if (!fixed.length) {
      for (let i = 0; i < moving.length; i++) {
        const item = moving[i];
        if (!item) continue;
        if (moving.length === 1)
          delete current(item.edge)[`${item.end}PortPosition`];
        else
          current(item.edge)[`${item.end}PortPosition`] = round(
            (i + 1) / (moving.length + 1),
          );
      }
      continue;
    }
    const boundaries = [0, ...fixed, 1];
    const gaps: Endpoint[][] = Array.from(
      { length: boundaries.length - 1 },
      () => [],
    );
    let previous = 0;
    for (let i = 0; i < moving.length; i++) {
      const item = moving[i];
      if (!item) continue;
      const ideal = (i + 1) / (moving.length + 1);
      let index =
        boundaries.findIndex((value, j) => j > 0 && value > ideal) - 1;
      if (index < 0) index = gaps.length - 1;
      index = Math.max(index, previous);
      previous = index;
      gaps[index]?.push(item);
    }
    const occupied = [...fixed];
    const valid = (value: number, left: number, right: number) =>
      value > left &&
      value < right &&
      occupied.every((other) => Math.abs(value - other) >= 0.0001 - 1e-10);
    const available = (
      left: number,
      right: number,
      desired: number,
    ): number | undefined => {
      const first = Math.max(1, Math.floor(left * 10000) + 1);
      const last = Math.min(9999, Math.ceil(right * 10000) - 1);
      const target = Math.max(
        first,
        Math.min(last, Math.round(desired * 10000)),
      );
      for (let delta = 0; delta <= last - first; delta++) {
        for (const slot of delta === 0
          ? [target]
          : [target + delta, target - delta]) {
          const value = slot / 10000;
          if (slot >= first && slot <= last && valid(value, left, right))
            return value;
        }
      }
      return undefined;
    };
    const widest = gaps
      .map((_, index) => index)
      .sort(
        (a, b) =>
          (boundaries[b + 1] ?? 1) -
            (boundaries[b] ?? 0) -
            ((boundaries[a + 1] ?? 1) - (boundaries[a] ?? 0)) || a - b,
      );
    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i] ?? [];
      const left = boundaries[i] ?? 0;
      const right = boundaries[i + 1] ?? 1;
      for (let j = 0; j < gap.length; j++) {
        const item = gap[j];
        if (!item) continue;
        const desired = round(
          left + ((right - left) * (j + 1)) / (gap.length + 1),
        );
        let position = available(left, right, desired);
        if (position === undefined) {
          for (const alternate of widest) {
            const lo = boundaries[alternate] ?? 0;
            const hi = boundaries[alternate + 1] ?? 1;
            position = available(lo, hi, (lo + hi) / 2);
            if (position !== undefined) break;
          }
        }
        if (position !== undefined) {
          current(item.edge)[`${item.end}PortPosition`] = position;
          occupied.push(position);
        }
      }
    }
  }
  const portCommands: Command[] = [];
  for (const edge of edges) {
    const next = data.get(edge.id);
    if (next && !equalSemantic(next, edge.semantic))
      portCommands.push({
        type: "updateSemantic",
        id: edge.id,
        semantic: next,
      });
  }
  applyCommands(draft, portCommands);
  const routedContext = createShapeContext(draft, registry, 1);
  const routed = edges
    .map((edge) => draft.get(edge.id))
    .filter((edge): edge is Element => !!edge);
  const routes = new Map<string, readonly Vec[]>();
  for (const edge of routed) {
    const route = resolveConnector(
      edge,
      routedContext,
      endpointReaderFor(edge.type),
    );
    if (route) routes.set(edge.id, route.points);
  }
  const obstacles: Box[] = [];
  for (const element of draft.getPageElements(pageId)) {
    if (!isLabelObstacle(element)) continue;
    const bounds = routedContext.boundsOf(element.id);
    if (bounds) obstacles.push(bounds);
  }
  const labels: Box[] = [];
  for (const edge of routed) {
    if (
      targets.has(edge.id) &&
      !(edge.type.startsWith("bpmn.") && edge.visual.labelBounds)
    )
      continue;
    const points = routes.get(edge.id);
    if (!points) continue;
    const position = current(edge)["labelPosition"];
    const at =
      typeof position === "number" && Number.isFinite(position)
        ? Math.max(0, Math.min(1, position))
        : 0.5;
    const box = resolvedLabelBox(edge, points, pointAlongRoute(points, at));
    if (box) labels.push(box);
  }
  const commands: Command[] = [];
  for (const edge of routed) {
    const points = routes.get(edge.id);
    if (!points) continue;
    const semantic = { ...current(edge) };
    const text = edge.type.startsWith("bpmn.")
      ? semantic["name"]
      : connectorDecoration(edge).label;
    if (
      targets.has(edge.id) &&
      typeof text === "string" &&
      text.length > 0 &&
      !(edge.type.startsWith("bpmn.") && edge.visual.labelBounds)
    ) {
      let best = 0.5;
      let bestScore = Number.POSITIVE_INFINITY;
      const others = [...routes.entries()]
        .filter(([id]) => id !== edge.id)
        .map(([, route]) => route);
      for (const candidate of [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]) {
        const box = resolvedLabelBox(
          edge,
          points,
          pointAlongRoute(points, candidate),
        );
        if (!box) break;
        const score = labelOverlapScore(box, obstacles, labels, others);
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
        if (score === 0) break;
      }
      if (best === 0.5) {
        // biome-ignore lint/performance/noDelete: midpoint is represented by an absent field.
        delete semantic["labelPosition"];
      } else semantic["labelPosition"] = best;
    }
    const position =
      typeof semantic["labelPosition"] === "number"
        ? semantic["labelPosition"]
        : 0.5;
    const box = resolvedLabelBox(
      edge,
      points,
      pointAlongRoute(points, position),
    );
    if (
      box &&
      targets.has(edge.id) &&
      !(edge.type.startsWith("bpmn.") && edge.visual.labelBounds)
    )
      labels.push(box);
    const original = store.get(edge.id);
    if (
      targets.has(edge.id) &&
      original &&
      !equalSemantic(semantic, original.semantic)
    )
      commands.push({ type: "updateSemantic", id: edge.id, semantic });
  }
  return commands;
}
