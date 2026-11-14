import {
  type Element,
  type ElementId,
  erdEndpointColumnIds,
  type ErdEndpoint,
  getElementTypeDefinition,
  type PageId,
  type PageKind,
} from "@nodetto/ir";
import { planRouteLanes } from "./arrange-route-lanes.ts";
import { applyCommands, type Command } from "./commands.ts";
import { placeConnectorLabels } from "./connector-label-placement.ts";
import { isLabelObstacle } from "./diagram-lint/metrics.ts";
import { boxCenter, type Box } from "./geometry.ts";
import { createShapeContext } from "./hit-test.ts";
import type { ShapeUtilRegistry } from "./shape-util.ts";
import { endpointReaderFor, resolveConnector } from "./shapes/connector.ts";
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
  readonly separation?: boolean;
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
const sides: readonly Side[] = ["top", "right", "bottom", "left"];
const resetFields = [
  "routingWaypoints",
  "routingBend",
  "routingLane",
  "labelOffsetX",
  "labelOffsetY",
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
          (options.separation === false &&
            (key === "labelPosition" ||
              key === "labelOffsetX" ||
              key === "labelOffsetY")) ||
          ((key === "labelPosition" ||
            key === "labelOffsetX" ||
            key === "labelOffsetY") &&
            edge.type.startsWith("bpmn.") &&
            edge.visual.labelBounds)
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
  // Keep inferred and already stored ends fixed; only ports written here can move.
  type Usage = { edge: Element; end: End; opposite: string; movable: boolean };
  const used = new Map<string, Map<Side, Usage[]>>();
  const uses = (node: string, side: Side): Usage[] => {
    let bySide = used.get(node);
    if (!bySide) {
      bySide = new Map();
      used.set(node, bySide);
    }
    let list = bySide.get(side);
    if (!list) {
      list = [];
      bySide.set(side, list);
    }
    return list;
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
      const written = !!side && movable.has(edge.id) && ends.from !== ends.to;
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
      if (side)
        uses(ends[end], side).push({
          edge,
          end,
          opposite: end === "from" ? ends.to : ends.from,
          movable: written,
        });
    }
  }
  for (const edge of edges) {
    const ends = endpointReaderFor(edge.type)(edge.semantic);
    if (!ends || ends.from !== ends.to || !movable.has(edge.id)) continue;
    const node = ends.from;
    let side = sides.find((candidate) => uses(node, candidate).length === 0);
    if (!side) {
      const freeable = sides.filter((candidate) =>
        uses(node, candidate).every((item) => item.movable),
      );
      const choices = freeable.length ? freeable : sides;
      side = choices[0] ?? "top";
      for (const candidate of choices)
        if (uses(node, candidate).length < uses(node, side).length)
          side = candidate;
      if (freeable.length) {
        const centerBox = context.boundsOf(node);
        const center = centerBox && boxCenter(centerBox);
        for (const item of uses(node, side)) {
          const oppositeBox = context.boundsOf(item.opposite);
          const opposite = oppositeBox && boxCenter(oppositeBox);
          const destination: Side =
            side === "top" || side === "bottom"
              ? center && opposite && opposite.x >= center.x
                ? "right"
                : "left"
              : center && opposite && opposite.y > center.y
                ? "bottom"
                : "top";
          current(item.edge)[`${item.end}Port`] = destination;
          uses(node, destination).push(item);
        }
        uses(node, side).length = 0;
      }
    }
    const next = current(edge);
    next["fromPort"] = side;
    next["toPort"] = side;
    next["fromPortPosition"] = 0.3;
    next["toPortPosition"] = 0.7;
    uses(node, side).push(
      { edge, end: "from", opposite: node, movable: false },
      { edge, end: "to", opposite: node, movable: false },
    );
  }
  const groups = new Map<string, Endpoint[]>();
  for (const edge of edges) {
    const ends = endpointReaderFor(edge.type)(edge.semantic);
    if (!ends) continue;
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
        movable: ends.from !== ends.to && movable.has(edge.id),
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
  if (options.separation !== false) {
    const patches = planRouteLanes(
      routed.map((element) => {
        const ends = endpointReaderFor(element.type)(element.semantic);
        return {
          element,
          movable: movable.has(element.id) && !!ends && ends.from !== ends.to,
        };
      }),
      routedContext,
    );
    const laneCommands: Command[] = [];
    for (const edge of routed) {
      const patch = patches.get(edge.id);
      if (!patch) continue;
      const semantic = { ...current(edge), ...patch };
      data.set(edge.id, semantic);
      laneCommands.push({ type: "updateSemantic", id: edge.id, semantic });
    }
    applyCommands(draft, laneCommands);
  }
  const finalEdges = routed
    .map((edge) => draft.get(edge.id))
    .filter((edge): edge is Element => !!edge);
  const finalContext = createShapeContext(draft, registry, 1);
  if (options.separation !== false) {
    const obstacles: Box[] = [];
    for (const element of draft.getPageElements(pageId)) {
      if (!isLabelObstacle(element)) continue;
      const bounds = finalContext.boundsOf(element.id);
      if (bounds) obstacles.push(bounds);
    }
    const labelEdges = finalEdges.flatMap((element) => {
      const route = resolveConnector(
        element,
        finalContext,
        endpointReaderFor(element.type),
      );
      return route
        ? [
            {
              element,
              semantic: current(element),
              points: route.points,
              movable: targets.has(element.id),
            },
          ]
        : [];
    });
    for (const [id, fields] of placeConnectorLabels({
      edges: labelEdges,
      obstacles,
    })) {
      const semantic = data.get(id);
      if (!semantic) continue;
      for (const key of ["labelPosition", "labelOffsetX", "labelOffsetY"]) {
        delete semantic[key];
      }
      Object.assign(semantic, fields);
    }
  }
  const commands: Command[] = [];
  for (const edge of finalEdges) {
    const semantic = data.get(edge.id);
    const original = store.get(edge.id);
    if (semantic && original && !equalSemantic(semantic, original.semantic))
      commands.push({ type: "updateSemantic", id: edge.id, semantic });
  }
  return commands;
}
