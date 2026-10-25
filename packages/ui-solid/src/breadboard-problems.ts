import {
  lintBreadboardPage,
  type BreadboardProbe,
  type Editor,
  type ViewportSize,
} from "@nodetto/core";
import {
  BREADBOARD_PART_TYPES,
  type Document,
  type Element,
  type ElementId,
  type PageId,
} from "@nodetto/ir";

export interface BreadboardProblemRow {
  readonly ruleId: string;
  readonly severity: "error" | "warning";
  readonly elementId: ElementId;
  readonly pin?: number;
  readonly elementIds: readonly ElementId[];
  readonly reference: string;
  readonly message: string;
  readonly chips: readonly {
    readonly elementId: ElementId;
    readonly reference: string;
  }[];
}

function isPart(element: Element): boolean {
  return BREADBOARD_PART_TYPES.includes(
    element.type as (typeof BREADBOARD_PART_TYPES)[number],
  );
}

function partReference(element: Element): string {
  const value = (element.semantic as { readonly reference?: unknown })
    .reference;
  return typeof value === "string" ? value : "";
}

export function breadboardProblemRows(
  document: Document,
  pageId: PageId,
): readonly BreadboardProblemRow[] {
  if (
    !document.pages.some(
      (page) => page.id === pageId && page.kind === "breadboard",
    )
  )
    return [];
  const elements = new Map(
    document.elements.map((element) => [element.id, element]),
  );
  return lintBreadboardPage(document, pageId).map((finding) => {
    const reported = elements.get(finding.elementId);
    return {
      ruleId: finding.ruleId,
      severity: finding.severity,
      elementId: finding.elementId,
      ...(finding.pin === undefined ? {} : { pin: finding.pin }),
      elementIds: finding.elementIds,
      reference: reported && isPart(reported) ? partReference(reported) : "",
      message: finding.message,
      chips: finding.elementIds.flatMap((elementId) => {
        const element = elements.get(elementId);
        if (!element || !isPart(element)) return [];
        return [{ elementId, reference: partReference(element) }];
      }),
    };
  });
}

export function canFixBreadboardReferences(
  document: Document,
  pageId: PageId,
): boolean {
  if (
    !document.pages.some(
      (page) => page.id === pageId && page.kind === "breadboard",
    )
  )
    return false;
  const references = new Set<string>();
  for (const element of document.elements) {
    if (element.page !== pageId || !isPart(element)) continue;
    const reference = partReference(element);
    if (reference.endsWith("?") || references.has(reference)) return true;
    references.add(reference);
  }
  return false;
}

export function focusBreadboardProbe(
  editor: Editor,
  probe: BreadboardProbe,
  viewport?: ViewportSize,
): boolean {
  if (!editor.store.getPage(probe.pageId)) return false;
  const elementIds = probe.elementIds.filter((id) => editor.store.get(id));
  if (elementIds.length === 0) return false;
  const pin =
    probe.pin && elementIds.includes(probe.pin.elementId)
      ? probe.pin
      : undefined;
  editor.setCurrentPage(probe.pageId);
  editor.selection.set(elementIds);
  if (viewport && viewport.width > 0 && viewport.height > 0)
    editor.zoomToSelection(viewport);
  editor.setBreadboardProbe({
    pageId: probe.pageId,
    elementIds,
    ...(pin ? { pin } : {}),
  });
  return true;
}
