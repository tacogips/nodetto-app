import {
  CommandError,
  type Editor,
  breadboardNetMembers,
  breadboardPins,
  breadboardTargetNetlist,
  computeBreadboardConnectivity,
  toBreadboardNetlist,
  type BreadboardPinRef,
  type BreadboardProbe,
} from "@nodetto/core";
import {
  BREADBOARD_PART_TYPES,
  isBreadboardPartType,
  type Document,
  type Element,
  type ElementId,
  type PageId,
} from "@nodetto/ir";

export function writeBreadboardSemantic(
  editor: Editor,
  id: ElementId,
  patch: Readonly<Record<string, unknown>>,
): boolean {
  try {
    return editor.updateBreadboardSemantic(id, patch);
  } catch (error) {
    if (error instanceof CommandError) return false;
    throw error;
  }
}

export const E24_VALUES: readonly string[] = [
  "1.0",
  "1.1",
  "1.2",
  "1.3",
  "1.5",
  "1.6",
  "1.8",
  "2.0",
  "2.2",
  "2.4",
  "2.7",
  "3.0",
  "3.3",
  "3.6",
  "3.9",
  "4.3",
  "4.7",
  "5.1",
  "5.6",
  "6.2",
  "6.8",
  "7.5",
  "8.2",
  "9.1",
];

function formatE24(mantissa: number, decade: number): string {
  const value = mantissa * 10 ** decade;
  if (value >= 1_000_000)
    return `${Number((value / 1_000_000).toPrecision(2))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toPrecision(2))}k`;
  return Number(value.toPrecision(3)).toString();
}

export function resistorValueSuggestions(prefix: string): readonly string[] {
  const query = prefix.trim().toLowerCase();
  if (!query) return [];
  const candidates = new Map<string, number>();
  for (let decade = -2; decade <= 8; decade += 1) {
    for (const entry of E24_VALUES) {
      const mantissa = Number(entry);
      const label = formatE24(mantissa, decade);
      if (label.toLowerCase().startsWith(query))
        candidates.set(label, mantissa * 10 ** decade);
    }
  }
  return [...candidates.entries()]
    .sort(([, leftValue], [, rightValue]) => leftValue - rightValue)
    .slice(0, 12)
    .map(([label]) => label);
}

function visibleParts(document: Document, pageId: PageId): readonly Element[] {
  return document.elements.filter(
    (element) =>
      element.page === pageId &&
      element.visual.hidden !== true &&
      BREADBOARD_PART_TYPES.includes(
        element.type as (typeof BREADBOARD_PART_TYPES)[number],
      ),
  );
}

function referenceOf(element: Element): string {
  const reference = (element.semantic as { readonly reference?: unknown })
    .reference;
  return typeof reference === "string" ? reference : "";
}

export function breadboardPinRows(
  document: Document,
  pageId: PageId,
  elementId: ElementId,
): readonly { pin: number; name: string; net: string }[] {
  const element = document.elements.find(
    (candidate) =>
      candidate.id === elementId &&
      candidate.page === pageId &&
      candidate.visual.hidden !== true &&
      isBreadboardPartType(candidate.type),
  );
  if (!element) return [];
  const connectivity = computeBreadboardConnectivity(document, pageId);
  const netlist = toBreadboardNetlist(document, pageId, connectivity);
  const reference = referenceOf(element);
  return breadboardPins(element).map((pin) => ({
    pin: pin.number,
    name: pin.name,
    net:
      netlist.nets.find((net) =>
        net.nodes.some(
          (node) => node.reference === reference && node.pin === pin.number,
        ),
      )?.name ?? "",
  }));
}

export function breadboardNetProbe(
  document: Document,
  pageId: PageId,
  ref: BreadboardPinRef,
): BreadboardProbe {
  const connectivity = computeBreadboardConnectivity(document, pageId);
  return {
    pageId,
    elementIds: breadboardNetMembers(document, pageId, connectivity, ref),
    pin: ref,
  };
}

export function targetNetProbe(
  document: Document,
  pageId: PageId,
  netName: string,
): BreadboardProbe | null {
  const target = breadboardTargetNetlist(document, pageId);
  const net = target?.semantic.nets.find(
    (candidate) => candidate.name === netName,
  );
  if (!net) return null;
  const parts = visibleParts(document, pageId);
  const elementIds: ElementId[] = [];
  let firstPin: BreadboardPinRef | undefined;
  for (const node of net.nodes) {
    const part = parts.find(
      (candidate) => referenceOf(candidate) === node.reference,
    );
    if (!part) continue;
    const pinExists = breadboardPins(part).some(
      (pin) => pin.number === node.pin,
    );
    if (!pinExists) continue;
    if (!elementIds.includes(part.id)) elementIds.push(part.id);
    firstPin ??= { elementId: part.id, pin: node.pin };
  }
  if (elementIds.length === 0) return null;
  return { pageId, elementIds, ...(firstPin ? { pin: firstPin } : {}) };
}

export function targetPartProbe(
  document: Document,
  pageId: PageId,
  reference: string,
): BreadboardProbe | null {
  const target = breadboardTargetNetlist(document, pageId);
  if (!target?.semantic.parts.some((part) => part.reference === reference))
    return null;
  const part = visibleParts(document, pageId).find(
    (candidate) => referenceOf(candidate) === reference,
  );
  return part ? { pageId, elementIds: [part.id] } : null;
}
