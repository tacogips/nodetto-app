import {
  SCHEMA_VERSION,
  assertValidDocument,
  type Document,
  type Element,
  type Page,
} from "@nodetto/ir";
import type { PcbImportPlan } from "@nodetto/ir";

export interface PcbPageOptions {
  readonly pageId?: string;
  readonly pageName: string;
  readonly reservedIds?: Iterable<string>;
}

export function pcbPageFromPlan(
  plan: PcbImportPlan,
  options: PcbPageOptions,
): { readonly page: Page; readonly elements: Element[] } {
  const pageId = options.pageId ?? "pcb-page-1";
  const page: Page = { id: pageId, name: options.pageName, kind: "pcb" };
  const used = new Set(options.reservedIds);
  const elements: Element[] = [];
  const uniqueId = (stem: string): string => {
    let candidate = stem;
    for (let suffix = 2; used.has(candidate); suffix++)
      candidate = `${stem}-${suffix}`;
    used.add(candidate);
    return candidate;
  };
  const add = (id: string, type: string, semantic: unknown): void => {
    elements.push({
      id: uniqueId(id),
      page: pageId,
      type,
      index: `a${String(elements.length + 1).padStart(6, "0")}`,
      semantic,
      visual: {},
    } as Element);
  };
  add("pcb-board", "pcb.board", plan.board);
  plan.graphics.forEach((item, index) =>
    add(`graphic-${index + 1}`, "pcb.graphic", item),
  );
  plan.zones.forEach((item, index) =>
    add(`zone-${index + 1}`, "pcb.zone", item),
  );
  plan.tracks.forEach((item, index) =>
    add(`track-${index + 1}`, "pcb.track", item),
  );
  plan.vias.forEach((item, index) => add(`via-${index + 1}`, "pcb.via", item));
  plan.footprints.forEach((item, index) => {
    const reference = item.reference.replace(/[^A-Za-z0-9_-]/g, "_");
    add(
      reference ? `fp-${reference}` : `fp-${index + 1}`,
      "pcb.footprint",
      item,
    );
  });
  return { page, elements };
}

export function pcbDocumentFromPlan(
  plan: PcbImportPlan,
  options: {
    readonly pageName: string;
    readonly title?: string;
    readonly documentId?: string;
  },
): Document {
  const { page, elements } = pcbPageFromPlan(plan, {
    pageName: options.pageName,
  });
  const document: Document = {
    schemaVersion: SCHEMA_VERSION,
    id: options.documentId ?? "pcb-document",
    title: options.title ?? plan.title,
    pages: [page],
    elements,
  };
  assertValidDocument(document);
  return document;
}
