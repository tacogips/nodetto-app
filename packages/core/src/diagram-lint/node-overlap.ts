import {
  getElementTypeDefinition,
  isDatabaseObjectType,
  type Document,
  type Element,
  type ElementId,
  type PageId,
  type PageKind,
} from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";

export const NODE_OVERLAP_PAGE_KINDS: readonly PageKind[] = [
  "erd",
  "state",
  "flowchart",
  "uml",
];
export interface NodeOverlapFinding {
  readonly pageId: PageId;
  readonly elementId: ElementId;
  readonly otherId: ElementId;
  readonly message: string;
  readonly width: number;
  readonly height: number;
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const fmt = (n: number) => String(Math.round(n * 10) / 10);
function name(element: Element): string {
  const semantic = element.semantic as Record<string, unknown>;
  for (const key of ["tableName", "name", "label", "text"]) {
    const value = semantic[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return element.id.slice(0, 6);
}
function contains(a: Box, b: Box): boolean {
  return (
    a.x <= b.x &&
    a.y <= b.y &&
    a.x + a.width >= b.x + b.width &&
    a.y + a.height >= b.y + b.height
  );
}
export function lintNodeOverlaps(
  document: Document,
  pageId: PageId,
): NodeOverlapFinding[] {
  const store = new Store(document);
  const page = store.getPage(pageId);
  if (!page || !NODE_OVERLAP_PAGE_KINDS.includes(page.kind)) return [];
  const registry = createDefaultRegistry();
  const context = createShapeContext(store, registry, 1);
  const candidates: { element: Element; box: Box }[] = [];
  for (const element of store.getPageElements(pageId)) {
    const candidate =
      page.kind === "erd"
        ? element.type === "erd.table" || isDatabaseObjectType(element.type)
        : page.kind === "state"
          ? element.type === "state.node"
          : getElementTypeDefinition(element.type)?.category === "node" &&
            !["frame", "group", "text.note", "image.raster"].includes(
              element.type,
            );
    if (
      !candidate ||
      element.visual.hidden ||
      context.isHidden?.(element.id) ||
      context.isMaskSource?.(element.id)
    )
      continue;
    const box = registry
      .getOrFallback(element.type)
      .getBounds(element, context);
    if (box) candidates.push({ element, box });
  }
  candidates.sort(
    (a, b) => a.box.x - b.box.x || compare(a.element.id, b.element.id),
  );
  const findings: NodeOverlapFinding[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (!a) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (!b) continue;
      if (b.box.x >= a.box.x + a.box.width) break;
      const width =
        Math.min(a.box.x + a.box.width, b.box.x + b.box.width) -
        Math.max(a.box.x, b.box.x);
      const height =
        Math.min(a.box.y + a.box.height, b.box.y + b.box.height) -
        Math.max(a.box.y, b.box.y);
      if (width <= 0 || height <= 0 || width * height <= 1) continue;
      const system = (v: typeof a) =>
        v.element.type === "usecase.node" &&
        (v.element.semantic as Record<string, unknown>).kind === "system";
      if (
        page.kind === "uml" &&
        ((system(a) && contains(a.box, b.box)) ||
          (system(b) && contains(b.box, a.box)))
      )
        continue;
      const first =
        compare(a.element.id, b.element.id) <= 0 ? a.element : b.element;
      const second = first === a.element ? b.element : a.element;
      const noun = (e: Element) =>
        e.type === "erd.table"
          ? "table"
          : e.type === "state.node"
            ? "state"
            : e.type;
      findings.push({
        pageId,
        elementId: first.id,
        otherId: second.id,
        width,
        height,
        message: `${noun(first)} "${name(first)}" overlaps ${noun(second)} "${name(second)}" on page "${page.name}" (${fmt(width)}x${fmt(height)})`,
      });
    }
  }
  return findings.sort(
    (a, b) =>
      compare(a.elementId, b.elementId) || compare(a.otherId, b.otherId),
  );
}
