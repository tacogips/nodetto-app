import type { Document, Element, PageId } from "@nodetto/ir";
import { boxFullyInside, boxesOverlap } from "../erd-frame-scope.ts";
import { createShapeContext } from "../hit-test.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";

export interface FrameStraddleFinding {
  readonly elementId: string;
  readonly message: string;
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function name(element: Element, key: string): string {
  const value = (element.semantic as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : element.id;
}
export function lintFrameStraddles(
  document: Document,
  pageId: PageId,
): FrameStraddleFinding[] {
  const store = new Store(document);
  if (store.getPage(pageId)?.kind !== "erd") return [];
  const elements = store.getPageElements(pageId);
  const frames = elements
    .filter((e) => e.type === "frame")
    .sort((a, b) => compare(a.id, b.id));
  if (!frames.length) return [];
  const context = createShapeContext(store, createDefaultRegistry(), 1);
  const visible = (e: Element) =>
    !e.visual.hidden &&
    !context.isHidden?.(e.id) &&
    !context.isMaskSource?.(e.id);
  const tables = elements
    .filter((e) => e.type === "erd.table" && visible(e))
    .sort(
      (a, b) =>
        compare(name(a, "tableName"), name(b, "tableName")) ||
        compare(a.id, b.id),
    );
  const findings: FrameStraddleFinding[] = [];
  for (const table of tables) {
    const box = context.boundsOf(table.id);
    if (!box) continue;
    for (const frame of frames) {
      if (!visible(frame)) continue;
      const frameBox = context.boundsOf(frame.id);
      if (
        frameBox &&
        boxesOverlap(box, frameBox) &&
        !boxFullyInside(box, frameBox)
      )
        findings.push({
          elementId: table.id,
          message: `Table ${name(table, "tableName")} straddles the edge of frame ${name(frame, "name")}.`,
        });
    }
  }
  return findings;
}
