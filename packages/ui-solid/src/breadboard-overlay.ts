import {
  breadboardNetHighlight,
  computeBreadboardConnectivity,
  computeBreadboardRatsnest,
  type BreadboardHighlight,
  type BreadboardPinRef,
  type BreadboardProbe,
  type RatsnestLine,
} from "@nodetto/core";
import type { Document, ElementId, PageId } from "@nodetto/ir";

export interface BreadboardOverlayModel {
  readonly highlight: BreadboardHighlight | null;
  readonly ratsnest: readonly RatsnestLine[];
}

export function breadboardOverlayModel(
  document: Document,
  pageId: PageId,
  input: {
    readonly hover: BreadboardPinRef | { readonly wireId: ElementId } | null;
    readonly probe: BreadboardProbe | null;
    readonly selection: readonly ElementId[];
  },
): BreadboardOverlayModel {
  const connectivity = computeBreadboardConnectivity(document, pageId);
  const [selectedId, ...otherSelected] = input.selection;
  const selectedWire =
    selectedId !== undefined &&
    !otherSelected.length &&
    document.elements.some(
      (element) =>
        element.id === selectedId && element.type === "breadboard.wire",
    )
      ? { wireId: selectedId as ElementId }
      : null;
  const probeTarget =
    input.probe?.pageId === pageId
      ? (input.probe.pin ??
        input.probe.elementIds
          .map((elementId) => {
            const element = document.elements.find(
              (entry) => entry.id === elementId,
            );
            return element?.type === "breadboard.wire"
              ? { wireId: elementId }
              : null;
          })
          .find((target) => target !== null))
      : null;
  const target = input.hover ?? probeTarget ?? selectedWire;
  return {
    highlight: target ? breadboardNetHighlight(connectivity, target) : null,
    ratsnest: computeBreadboardRatsnest(document, pageId, connectivity),
  };
}
