import {
  type Document,
  type Element,
  type ElementId,
  getElementTypeDefinition,
  type PageId,
} from "@nodetto/ir";
import {
  isLabelObstacle,
  labelOverlapScore,
  pageMetrics,
  resolvedLabelBox,
} from "./diagram-lint/metrics.ts";
import type { Box, Vec } from "./geometry.ts";
import { createShapeContext } from "./hit-test.ts";
import { connectorLabelExtent, connectorLabelLayout } from "./label-layout.ts";
import {
  connectorDecoration,
  endpointReaderFor,
  resolveConnector,
} from "./shapes/connector.ts";
import { pointAlongRoute } from "./shapes/connector/route.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import { lintTextLayoutPage } from "./text-layout-lint/engine.ts";
import { TEXT_LAYOUT_LINT_PAGE_KINDS } from "./text-layout-lint/rules.ts";

export interface LabelFields {
  readonly labelPosition?: number;
  readonly labelOffsetX?: number;
  readonly labelOffsetY?: number;
}
export interface LabelPlacementEdge {
  readonly element: Element;
  readonly semantic: Record<string, unknown>;
  readonly points: readonly Vec[];
  readonly movable: boolean;
}
export interface LabelMoveFix {
  readonly pageId: PageId;
  readonly elementId: ElementId;
  readonly ruleId: "label-collision";
  readonly field: "labelPosition";
  readonly before: LabelFields;
  readonly after: LabelFields;
}
const positions = [
  0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9, 0.45, 0.55, 0.4, 0.6, 0.3, 0.7, 0.25,
  0.75, 0.15, 0.85, 0.05, 0.95,
];
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function fields(data: Record<string, unknown>): LabelFields {
  const result: {
    labelPosition?: number;
    labelOffsetX?: number;
    labelOffsetY?: number;
  } = {};
  for (const key of ["labelPosition", "labelOffsetX", "labelOffsetY"] as const)
    if (typeof data[key] === "number") result[key] = data[key];
  return result;
}
function boxAt(edge: LabelPlacementEdge, value: LabelFields): Box | null {
  const position = Math.max(0, Math.min(1, value.labelPosition ?? 0.5));
  const point = pointAlongRoute(edge.points, position);
  const bpmn = edge.element.type.startsWith("bpmn.");
  return resolvedLabelBox(edge.element, edge.points, {
    x: point.x + (bpmn ? 0 : (value.labelOffsetX ?? 0)),
    y: point.y + (bpmn ? 0 : (value.labelOffsetY ?? 0)),
  });
}
function hasText(edge: LabelPlacementEdge): boolean {
  const text = edge.element.type.startsWith("bpmn.")
    ? edge.semantic["name"]
    : connectorDecoration(edge.element).label;
  return typeof text === "string" && text.length > 0;
}
interface Segments {
  readonly owners: ElementId[];
  readonly coordinates: number[];
}
function flatBoxes(boxes: readonly Box[]): number[] {
  const out: number[] = [];
  for (const b of boxes) out.push(b.x, b.y, b.width, b.height);
  return out;
}
function overlapFlat(box: Box, data: readonly number[]): number {
  let score = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const x = data[i];
    const y = data[i + 1];
    const w = data[i + 2];
    const h = data[i + 3];
    if (
      x !== undefined &&
      y !== undefined &&
      w !== undefined &&
      h !== undefined &&
      box.x < x + w &&
      x < box.x + box.width &&
      box.y < y + h &&
      y < box.y + box.height
    )
      score++;
  }
  return score;
}
function intersects(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  box: Box,
): boolean {
  if (
    Math.max(ax, bx) < box.x ||
    Math.min(ax, bx) > box.x + box.width ||
    Math.max(ay, by) < box.y ||
    Math.min(ay, by) > box.y + box.height
  )
    return false;
  let lo = 0;
  let hi = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (let i = 0; i < 4; i++) {
    const p = i === 0 ? -dx : i === 1 ? dx : i === 2 ? -dy : dy;
    const q =
      i === 0
        ? ax - box.x
        : i === 1
          ? box.x + box.width - ax
          : i === 2
            ? ay - box.y
            : box.y + box.height - ay;
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return false;
    }
  }
  return true;
}
function segments(edges: readonly LabelPlacementEdge[]): Segments {
  const owners: ElementId[] = [];
  const coordinates: number[] = [];
  for (const edge of edges)
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1];
      const b = edge.points[i];
      if (a && b) {
        owners.push(edge.element.id);
        coordinates.push(a.x, a.y, b.x, b.y);
      }
    }
  return { owners, coordinates };
}
function score(
  box: Box,
  id: ElementId,
  obstacles: readonly number[],
  labels: readonly number[],
  routes: Segments,
): number {
  let value = overlapFlat(box, obstacles) + overlapFlat(box, labels);
  for (let i = 0; i < routes.owners.length; i++) {
    if (routes.owners[i] === id) continue;
    const ax = routes.coordinates[i * 4];
    const ay = routes.coordinates[i * 4 + 1];
    const bx = routes.coordinates[i * 4 + 2];
    const by = routes.coordinates[i * 4 + 3];
    if (
      ax !== undefined &&
      ay !== undefined &&
      bx !== undefined &&
      by !== undefined &&
      intersects(ax, ay, bx, by, box)
    )
      value++;
  }
  return value;
}
/** Test seam for checking the flattened scorer against the lint metric. */
export function scoreLabelPlacementForTest(
  box: Box,
  id: ElementId,
  obstacles: readonly Box[],
  labels: readonly Box[],
  edges: readonly LabelPlacementEdge[],
): number {
  return score(
    box,
    id,
    flatBoxes(obstacles),
    flatBoxes(labels),
    segments(edges),
  );
}
function labelRouteGapSquared(box: Box, points: readonly Vec[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (intersects(a.x, a.y, b.x, b.y, box)) return 0;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    for (const x of [box.x, box.x + box.width]) {
      for (const y of [box.y, box.y + box.height]) {
        const t =
          length === 0
            ? 0
            : Math.max(
                0,
                Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length),
              );
        best = Math.min(
          best,
          (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2,
        );
      }
    }
    for (const point of [a, b]) {
      const x = Math.max(box.x, Math.min(box.x + box.width, point.x));
      const y = Math.max(box.y, Math.min(box.y + box.height, point.y));
      best = Math.min(best, (point.x - x) ** 2 + (point.y - y) ** 2);
    }
  }
  return best;
}

export function labelRouteGapSquaredForTest(
  box: Box,
  points: readonly Vec[],
): number {
  return labelRouteGapSquared(box, points);
}

export function labelCandidatesForTest(
  edge: LabelPlacementEdge,
): LabelFields[] {
  return [...candidates(edge)];
}

function* candidates(
  edge: LabelPlacementEdge,
  resolveBox: (
    edge: LabelPlacementEdge,
    value: LabelFields,
  ) => Box | null = boxAt,
): Generator<LabelFields> {
  for (const p of positions) yield p === 0.5 ? {} : { labelPosition: p };
  if (edge.element.type.startsWith("bpmn.")) return;
  const offsets: { value: LabelFields; gap: number; index: number }[] = [];
  for (const p of positions) {
    const box = resolveBox(edge, { labelPosition: p });
    if (!box) continue;
    const w = box.width;
    const h = box.height;
    for (const [rawX, rawY] of [
      [0, -h - 4],
      [0, h + 4],
      [-w - 4, 0],
      [w + 4, 0],
      [0, -2 * h - 8],
      [0, 2 * h + 8],
      [-2 * w - 8, 0],
      [2 * w + 8, 0],
      [0, -h / 2 - 2],
      [0, h / 2 + 2],
      [-w / 2 - 2, 0],
      [w / 2 + 2, 0],
      [-w - 4, -h - 4],
      [w + 4, -h - 4],
      [-w - 4, h + 4],
      [w + 4, h + 4],
      [-2 * w - 8, -h - 4],
      [2 * w + 8, -h - 4],
      [-2 * w - 8, h + 4],
      [2 * w + 8, h + 4],
      [-w - 4, -2 * h - 8],
      [w + 4, -2 * h - 8],
      [-w - 4, 2 * h + 8],
      [w + 4, 2 * h + 8],
      [0, -3 * h - 12],
      [0, 3 * h + 12],
      [-3 * w - 12, 0],
      [3 * w + 12, 0],
    ]) {
      const x = Math.round(rawX ?? 0);
      const y = Math.round(rawY ?? 0);
      const value: {
        labelPosition?: number;
        labelOffsetX?: number;
        labelOffsetY?: number;
      } = {};
      if (p !== 0.5) value.labelPosition = Math.round(p * 10000) / 10000;
      if (x) value.labelOffsetX = x;
      if (y) value.labelOffsetY = y;
      const shifted = resolveBox(edge, value);
      if (shifted)
        offsets.push({
          value,
          gap: labelRouteGapSquared(shifted, edge.points),
          index: offsets.length,
        });
    }
  }
  offsets.sort((a, b) => a.gap - b.gap || a.index - b.index);
  for (const item of offsets) yield item.value;
}
export function placeConnectorLabels(input: {
  readonly edges: readonly LabelPlacementEdge[];
  readonly obstacles: readonly Box[];
}): ReadonlyMap<ElementId, LabelFields> {
  const edges = [...input.edges].sort((a, b) =>
    compare(a.element.id, b.element.id),
  );
  const obstacleData = flatBoxes(input.obstacles);
  const routeData = segments(edges);
  const placed = new Map<ElementId, Box>();
  const result = new Map<ElementId, LabelFields>();
  const layouts = new Map<
    ElementId,
    { layout: ReturnType<typeof connectorLabelLayout>; width: number }
  >();
  const cachedBoxAt = (
    edge: LabelPlacementEdge,
    value: LabelFields,
  ): Box | null => {
    if (edge.element.type.startsWith("bpmn.")) return boxAt(edge, value);
    let cached = layouts.get(edge.element.id);
    if (!cached) {
      const base = boxAt(edge, {});
      if (!base) return null;
      cached = {
        layout: connectorLabelLayout(
          connectorDecoration(edge.element).label,
          edge.element.visual,
        ),
        width: base.width,
      };
      layouts.set(edge.element.id, cached);
    }
    const position = Math.max(0, Math.min(1, value.labelPosition ?? 0.5));
    const point = pointAlongRoute(edge.points, position);
    const anchor = {
      x: point.x + (value.labelOffsetX ?? 0),
      y: point.y + (value.labelOffsetY ?? 0),
    };
    const text = connectorLabelExtent(cached.layout, anchor);
    return text
      ? { ...text, x: anchor.x - cached.width / 2, width: cached.width }
      : boxAt(edge, value);
  };
  const movable: LabelPlacementEdge[] = [];
  for (const edge of edges) {
    if (
      edge.movable &&
      hasText(edge) &&
      !(
        edge.element.type.startsWith("bpmn.") && edge.element.visual.labelBounds
      )
    )
      movable.push(edge);
    else {
      const box = boxAt(edge, fields(edge.semantic));
      if (box) placed.set(edge.element.id, box);
    }
  }
  const place = (edge: LabelPlacementEdge) => {
    placed.delete(edge.element.id);
    const labelData = flatBoxes([...placed.values()]);
    let bestScore = Number.POSITIVE_INFINITY;
    let best: LabelFields = {};
    let bestBox: Box | null = null;
    for (const candidate of candidates(edge, cachedBoxAt)) {
      const box = cachedBoxAt(edge, candidate);
      if (!box) continue;
      const value = score(
        box,
        edge.element.id,
        obstacleData,
        labelData,
        routeData,
      );
      if (value < bestScore) {
        bestScore = value;
        best = candidate;
        bestBox = box;
      }
      if (value === 0) break;
    }
    if (bestBox) {
      placed.set(edge.element.id, bestBox);
      result.set(edge.element.id, best);
    }
    return bestScore;
  };
  for (const edge of movable) place(edge);
  for (const edge of movable) {
    const box = placed.get(edge.element.id);
    if (!box) continue;
    const otherLabels: Box[] = [];
    for (const [id, label] of placed)
      if (id !== edge.element.id) otherLabels.push(label);
    if (
      score(
        box,
        edge.element.id,
        obstacleData,
        flatBoxes(otherLabels),
        routeData,
      ) > 0
    )
      place(edge);
  }
  return result;
}
function collectLabelEdges(
  document: Document,
  pageId: PageId,
): {
  edges: LabelPlacementEdge[];
  obstacles: Box[];
  metricEdges: { id: ElementId; points: readonly Vec[]; label: Box | null }[];
} {
  const store = new Store(document);
  const registry = createDefaultRegistry();
  const context = createShapeContext(store, registry, 1);
  const obstacles: Box[] = [];
  const edges: LabelPlacementEdge[] = [];
  const metricEdges: {
    id: ElementId;
    points: readonly Vec[];
    label: Box | null;
  }[] = [];
  for (const element of store.getPageElements(pageId)) {
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
    if (route) {
      metricEdges.push({
        id: element.id,
        points: route.points,
        label: resolvedLabelBox(element, route.points, route.labelPoint),
      });
      if (element.type !== "sequence.message")
        edges.push({
          element,
          semantic: (element.semantic ?? {}) as Record<string, unknown>,
          points: route.points,
          movable: false,
        });
    }
  }
  return { edges, obstacles, metricEdges };
}

function planLabelFixRound(document: Document, pageId: PageId): LabelMoveFix[] {
  const page = new Store(document).getPage(pageId);
  if (!page) return [];
  const { edges, obstacles } = collectLabelEdges(document, pageId);
  const findings = TEXT_LAYOUT_LINT_PAGE_KINDS.includes(page.kind)
    ? lintTextLayoutPage(document, pageId)
    : [];
  const colliding = new Set(
    findings
      .filter((f) => f.ruleId === "label-collision")
      .map((f) => f.elementId),
  );
  const currentScore = (
    edge: LabelPlacementEdge,
    value: LabelFields,
    accepted?: ReadonlyMap<ElementId, LabelFields>,
  ) => {
    const box = boxAt(edge, value);
    if (!box) return 0;
    return labelOverlapScore(
      box,
      obstacles,
      edges
        .filter((other) => other !== edge)
        .map((other) =>
          boxAt(
            other,
            accepted?.get(other.element.id) ?? fields(other.semantic),
          ),
        )
        .filter((b): b is Box => b !== null),
      edges.filter((other) => other !== edge).map((other) => other.points),
    );
  };
  const selected = edges.map((edge) => ({
    ...edge,
    movable:
      currentScore(edge, fields(edge.semantic)) > 0 ||
      colliding.has(edge.element.id),
  }));
  const proposed = placeConnectorLabels({ edges: selected, obstacles });
  const accepted = new Map<ElementId, LabelFields>();
  for (const edge of edges) {
    const after = proposed.get(edge.element.id);
    if (
      after &&
      JSON.stringify(fields(edge.semantic)) !== JSON.stringify(after)
    )
      accepted.set(edge.element.id, after);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      const after = accepted.get(edge.element.id);
      if (!after) continue;
      const beforeScore = currentScore(edge, fields(edge.semantic));
      const afterScore = currentScore(edge, after, accepted);
      let removed = false;
      if (colliding.has(edge.element.id)) {
        const draft = {
          ...document,
          elements: document.elements.map((item) => {
            const value = accepted.get(item.id);
            if (!value) return item;
            const semantic = { ...(item.semantic as Record<string, unknown>) };
            for (const key of [
              "labelPosition",
              "labelOffsetX",
              "labelOffsetY",
            ] as const) {
              if (value[key] === undefined) delete semantic[key];
              else semantic[key] = value[key];
            }
            return { ...item, semantic };
          }),
        };
        removed = !lintTextLayoutPage(draft, pageId).some(
          (f) =>
            f.elementId === edge.element.id && f.ruleId === "label-collision",
        );
      }
      if (!(afterScore < beforeScore || removed)) {
        accepted.delete(edge.element.id);
        changed = true;
      }
    }
  }
  const fixes: LabelMoveFix[] = [];
  for (const edge of edges) {
    const after = accepted.get(edge.element.id);
    if (after)
      fixes.push({
        pageId,
        elementId: edge.element.id,
        ruleId: "label-collision",
        field: "labelPosition",
        before: fields(edge.semantic),
        after,
      });
  }
  return fixes.sort((a, b) => compare(a.elementId, b.elementId));
}

function applyLabelRound(
  document: Document,
  fixes: readonly LabelMoveFix[],
): Document {
  const byId = new Map(fixes.map((fix) => [fix.elementId, fix.after]));
  return {
    ...document,
    elements: document.elements.map((item) => {
      const value = byId.get(item.id);
      if (!value) return item;
      const semantic = { ...(item.semantic as Record<string, unknown>) };
      for (const key of [
        "labelPosition",
        "labelOffsetX",
        "labelOffsetY",
      ] as const) {
        if (value[key] === undefined) delete semantic[key];
        else semantic[key] = value[key];
      }
      return { ...item, semantic };
    }),
  };
}

export function planLabelFixes(
  document: Document,
  pageId: PageId,
): LabelMoveFix[] {
  const page = document.pages.find((item) => item.id === pageId);
  if (!page) return [];
  const registry = createDefaultRegistry();
  const measure = (state: Document): readonly [number, number] => [
    pageMetrics(new Store(state), pageId, registry).labelOverlaps,
    TEXT_LAYOUT_LINT_PAGE_KINDS.includes(page.kind)
      ? lintTextLayoutPage(state, pageId).filter(
          (f) => f.ruleId === "label-collision",
        ).length
      : 0,
  ];
  let state = document;
  let current = measure(state);
  const touched = new Set<ElementId>();
  while (true) {
    const round = planLabelFixRound(state, pageId);
    if (round.length > 0) {
      const draft = applyLabelRound(state, round);
      const next = measure(draft);
      if (
        next[1] <= current[1] &&
        (next[0] < current[0] ||
          (next[0] === current[0] && next[1] < current[1]))
      ) {
        for (const fix of round) touched.add(fix.elementId);
        state = draft;
        current = next;
        continue;
      }
    }
    if (!TEXT_LAYOUT_LINT_PAGE_KINDS.includes(page.kind)) break;
    const findings = lintTextLayoutPage(state, pageId).filter(
      (f) => f.ruleId === "label-collision",
    );
    const ids = [...new Set(findings.map((f) => f.elementId))].sort(compare);
    let advanced = false;
    for (const id of ids) {
      const { edges, obstacles, metricEdges } = collectLabelEdges(
        state,
        pageId,
      );
      const edge = edges.find((item) => item.element.id === id);
      if (
        !edge ||
        edge.element.type.startsWith("bpmn.") ||
        edge.element.visual.labelBounds ||
        !hasText(edge)
      )
        continue;
      const before = fields(edge.semantic);
      const ownBox = metricEdges.find((item) => item.id === id)?.label;
      if (!ownBox) continue;
      const others = metricEdges.filter((item) => item.id !== id);
      const otherBoxes = others
        .map((item) => item.label)
        .filter((box): box is Box => box !== null);
      const otherRoutes = others.map((item) => item.points);
      const ownScore = labelOverlapScore(
        ownBox,
        obstacles,
        otherBoxes,
        otherRoutes,
      );
      for (const after of candidates(edge)) {
        const candidateBox = boxAt(edge, after);
        if (!candidateBox) continue;
        const overlap =
          current[0] -
          ownScore +
          labelOverlapScore(candidateBox, obstacles, otherBoxes, otherRoutes);
        if (overlap > current[0]) continue;
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const fix: LabelMoveFix = {
          pageId,
          elementId: id,
          ruleId: "label-collision",
          field: "labelPosition",
          before,
          after,
        };
        const draft = applyLabelRound(state, [fix]);
        const remaining = lintTextLayoutPage(draft, pageId).filter(
          (f) => f.ruleId === "label-collision",
        );
        if (
          remaining.length >= current[1] ||
          remaining.some((f) => f.elementId === id)
        )
          continue;
        const exactOverlap = pageMetrics(
          new Store(draft),
          pageId,
          registry,
        ).labelOverlaps;
        if (exactOverlap > current[0]) continue;
        state = draft;
        current = [exactOverlap, remaining.length];
        touched.add(id);
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }
  const original = new Map(document.elements.map((item) => [item.id, item]));
  const fixes: LabelMoveFix[] = [];
  for (const item of state.elements) {
    if (!touched.has(item.id)) continue;
    const beforeItem = original.get(item.id);
    if (!beforeItem) continue;
    const before = fields(
      (beforeItem.semantic ?? {}) as Record<string, unknown>,
    );
    const after = fields((item.semantic ?? {}) as Record<string, unknown>);
    if (JSON.stringify(before) !== JSON.stringify(after))
      fixes.push({
        pageId,
        elementId: item.id,
        ruleId: "label-collision",
        field: "labelPosition",
        before,
        after,
      });
  }
  return fixes.sort((a, b) => compare(a.elementId, b.elementId));
}
