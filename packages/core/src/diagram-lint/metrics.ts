import {
  type Element,
  getElementTypeDefinition,
  type PageId,
} from "@nodetto/ir";
import { bpmnFlowLabelBox } from "../bpmn/notation.ts";
import type { Box, Vec } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import {
  connectorDecoration,
  endpointReaderFor,
  resolveConnector,
} from "../shapes/connector.ts";
import { connectorLabelBoxAt } from "../shapes/connector/label-box.ts";
import type { Store } from "../store.ts";

export interface PageMetrics {
  readonly edgeCrossings: number;
  readonly labelOverlaps: number;
  readonly segmentOverlaps: number;
}

export function isLabelObstacle(element: Element): boolean {
  if (getElementTypeDefinition(element.type)?.category === "edge") return false;
  if (["frame", "group", "bpmn.lane", "bpmn.group"].includes(element.type))
    return false;
  const data = (element.semantic ?? {}) as Record<string, unknown>;
  if (element.type === "bpmn.participant") return data["collapsed"] === true;
  if (element.type === "bpmn.subProcess") return data["expanded"] !== true;
  return true;
}

export function resolvedLabelBox(
  element: Element,
  points: readonly Vec[],
  anchor: Vec,
): Box | null {
  if (element.type.startsWith("bpmn.")) {
    const bounds = element.visual.labelBounds;
    const at = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : anchor;
    return bpmnFlowLabelBox(element, points, at);
  }
  if (!connectorDecoration(element).label) return null;
  return connectorLabelBoxAt(element, anchor);
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

// Liang-Barsky clipping: finite segments that touch the label rectangle count.
export function segmentOverlapsBox(a: Vec, b: Vec, box: Box): boolean {
  let lo = 0;
  let hi = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ps = [-dx, dx, -dy, dy];
  const qs = [
    a.x - box.x,
    box.x + box.width - a.x,
    a.y - box.y,
    box.y + box.height - a.y,
  ];
  for (let i = 0; i < 4; i += 1) {
    const p = ps[i] ?? 0;
    const q = qs[i] ?? 0;
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return false;
  }
  return true;
}

export function labelOverlapScore(
  box: Box,
  obstacles: readonly Box[],
  labels: readonly Box[],
  routes: readonly (readonly Vec[])[],
): number {
  let score = 0;
  for (const obstacle of obstacles) if (boxesOverlap(box, obstacle)) score += 1;
  for (const label of labels) if (boxesOverlap(box, label)) score += 1;
  for (const points of routes) {
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (a && b && segmentOverlapsBox(a, b, box)) score += 1;
    }
  }
  return score;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}
// Count collinear segment pairs with more than one unit of shared length.
export function countRouteOverlaps(
  a: readonly Vec[],
  b: readonly Vec[],
): number {
  const bounds = (points: readonly Vec[]) => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  };
  const aa = bounds(a);
  const bb = bounds(b);
  const eps = 1e-9;
  if (
    aa.maxX + eps < bb.minX ||
    bb.maxX + eps < aa.minX ||
    aa.maxY + eps < bb.minY ||
    bb.maxY + eps < aa.minY
  )
    return 0;
  let count = 0;
  for (let i = 1; i < a.length; i++) {
    const p = a[i - 1];
    const q = a[i];
    if (!p || !q) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    for (let j = 1; j < b.length; j++) {
      const r = b[j - 1];
      const s = b[j];
      if (!r || !s) continue;
      if (
        Math.max(p.x, q.x) + eps < Math.min(r.x, s.x) ||
        Math.max(r.x, s.x) + eps < Math.min(p.x, q.x) ||
        Math.max(p.y, q.y) + eps < Math.min(r.y, s.y) ||
        Math.max(r.y, s.y) + eps < Math.min(p.y, q.y)
      )
        continue;
      const sx = s.x - r.x;
      const sy = s.y - r.y;
      if (
        Math.hypot(sx, sy) === 0 ||
        Math.abs(cross(dx, dy, sx, sy)) >= eps ||
        Math.abs(cross(r.x - p.x, r.y - p.y, dx, dy)) >= eps
      )
        continue;
      const t0 = ((r.x - p.x) * dx + (r.y - p.y) * dy) / length;
      const t1 = ((s.x - p.x) * dx + (s.y - p.y) * dy) / length;
      if (
        Math.min(length, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) >
        1
      )
        count++;
    }
  }
  return count;
}

function nearEndpoint(point: Vec, points: readonly Vec[]): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  return Boolean(
    (first && Math.hypot(point.x - first.x, point.y - first.y) <= 1) ||
      (last && Math.hypot(point.x - last.x, point.y - last.y) <= 1),
  );
}

function segmentIntersection(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = cross(rx, ry, sx, sy);
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  if (Math.abs(den) < 1e-9) {
    if (Math.abs(cross(qx, qy, rx, ry)) >= 1e-9) return null;
    const length2 = rx * rx + ry * ry;
    if (length2 < 1e-18) return null;
    const t0 = (qx * rx + qy * ry) / length2;
    const t1 = t0 + (sx * rx + sy * ry) / length2;
    const low = Math.max(0, Math.min(t0, t1));
    const high = Math.min(1, Math.max(t0, t1));
    if (high - low <= 1e-9) return null;
    const t = (low + high) / 2;
    return { x: a.x + t * rx, y: a.y + t * ry };
  }
  const t = cross(qx, qy, sx, sy) / den;
  const u = cross(qx, qy, rx, ry) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

function crossingRays(
  points: readonly Vec[],
  segment: number,
  at: Vec,
): readonly Vec[] {
  const start = points[segment - 1];
  const end = points[segment];
  if (!start || !end) return [];
  const near = (point: Vec) =>
    Math.hypot(point.x - at.x, point.y - at.y) < 1e-7;
  const before = near(start) ? points[segment - 2] : start;
  const after = near(end) ? points[segment + 1] : end;
  if (!before || !after) return [];
  return [
    { x: before.x - at.x, y: before.y - at.y },
    { x: after.x - at.x, y: after.y - at.y },
  ];
}

function properCrossing(
  first: readonly Vec[],
  a: number,
  second: readonly Vec[],
  b: number,
  at: Vec,
): boolean {
  const p = first[a - 1];
  const q = first[a];
  const r = second[b - 1];
  const s = second[b];
  if (!p || !q || !r || !s) return false;
  // A collinear overlap has its own counting rule.
  if (Math.abs(cross(q.x - p.x, q.y - p.y, s.x - r.x, s.y - r.y)) < 1e-9)
    return true;
  const firstRays = crossingRays(first, a, at);
  const secondRays = crossingRays(second, b, at);
  if (firstRays.length !== 2 || secondRays.length !== 2) return false;
  const rays = [
    ...firstRays.map((ray) => ({ angle: Math.atan2(ray.y, ray.x), owner: 0 })),
    ...secondRays.map((ray) => ({ angle: Math.atan2(ray.y, ray.x), owner: 1 })),
  ].sort((left, right) => left.angle - right.angle);
  return rays.every(
    (ray, index) => ray.owner !== rays[(index + 1) % rays.length]?.owner,
  );
}

export function pageMetrics(
  store: Store,
  pageId: PageId,
  registry: ShapeUtilRegistry,
): PageMetrics {
  const elements = store.getPageElements(pageId);
  const context = createShapeContext(store, registry, 1);
  const obstacles: Box[] = [];
  const edges: { points: readonly Vec[]; label: Box | null }[] = [];
  for (const element of elements) {
    if (isLabelObstacle(element)) {
      const box = context.boundsOf(element.id);
      if (box) obstacles.push(box);
    }
    if (getElementTypeDefinition(element.type)?.category !== "edge") continue;
    const route = resolveConnector(
      element,
      context,
      endpointReaderFor(element.type),
    );
    if (route)
      edges.push({
        points: route.points,
        label: resolvedLabelBox(element, route.points, route.labelPoint),
      });
  }
  let edgeCrossings = 0;
  let labelOverlaps = 0;
  let segmentOverlaps = 0;
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (!edge) continue;
    if (edge.label) {
      labelOverlaps += labelOverlapScore(
        edge.label,
        obstacles,
        [],
        edges.filter((_, j) => j !== i).map((other) => other.points),
      );
    }
    for (let j = i + 1; j < edges.length; j += 1) {
      const other = edges[j];
      if (!other) continue;
      segmentOverlaps += countRouteOverlaps(edge.points, other.points);
      if (edge.label && other.label && boxesOverlap(edge.label, other.label))
        labelOverlaps += 1;
      const seen: Vec[] = [];
      for (let a = 1; a < edge.points.length; a += 1) {
        const p = edge.points[a - 1];
        const q = edge.points[a];
        if (!p || !q) continue;
        for (let b = 1; b < other.points.length; b += 1) {
          const r = other.points[b - 1];
          const s = other.points[b];
          if (!r || !s) continue;
          const at = segmentIntersection(p, q, r, s);
          if (
            !at ||
            nearEndpoint(at, edge.points) ||
            nearEndpoint(at, other.points) ||
            !properCrossing(edge.points, a, other.points, b, at)
          )
            continue;
          if (
            !seen.some(
              (point) => Math.hypot(point.x - at.x, point.y - at.y) < 1e-6,
            )
          ) {
            seen.push(at);
            edgeCrossings += 1;
          }
        }
      }
    }
  }
  return { edgeCrossings, labelOverlaps, segmentOverlaps };
}
