import {
  computePcbConnectivity,
  computePcbRatsnest,
  pcbNetHighlight,
} from "@nodetto/core";
import type {
  Document,
  PageId,
  PcbFootprintSemantic,
  PcbPad,
} from "@nodetto/ir";
import { footprintToBoard, padCopperOutline } from "@nodetto/core";
import { PCB_PAGE_SCALE } from "@nodetto/ir";
import type { PcbViewPrimitive } from "./shapes/pcb-view.ts";
import { pcbViewModel } from "./shapes/pcb-view.ts";

export interface PcbOverlayModel {
  readonly ratsnest: ReturnType<typeof computePcbRatsnest>;
  readonly glow: readonly PcbViewPrimitive[];
}
export function pcbOverlayModel(
  document: Document,
  pageId: PageId,
  highlightedNet: string,
  hidden: ReadonlySet<string> = new Set(),
): PcbOverlayModel {
  const connectivity = computePcbConnectivity(document, pageId);
  const ratsnest = computePcbRatsnest(document, pageId, connectivity);
  if (!highlightedNet) return { ratsnest, glow: [] };
  const members = pcbNetHighlight(document, pageId, highlightedNet);
  const glow: PcbViewPrimitive[] = [];
  for (const id of [...members.tracks, ...members.vias, ...members.zones]) {
    const element = document.elements.find((entry) => entry.id === id);
    if (element) glow.push(...pcbViewModel(element, hidden));
  }
  for (const ref of members.pads) {
    const element = document.elements.find(
      (entry) => entry.id === ref.footprintId,
    );
    if (!element || element.type !== "pcb.footprint") continue;
    const fp = element.semantic as PcbFootprintSemantic;
    const pad = fp.pads[ref.pad] as PcbPad | undefined;
    if (!pad || pad.layers.every((layer) => hidden.has(layer))) continue;
    const outline = padCopperOutline(fp, pad);
    if (outline.kind === "circle")
      glow.push({
        kind: "circle",
        cx: outline.center[0] * PCB_PAGE_SCALE,
        cy: outline.center[1] * PCB_PAGE_SCALE,
        r: outline.radius * PCB_PAGE_SCALE,
        stroke: "#63b3ff",
        width: 3,
        fill: "none",
        layer: "highlight",
      });
    else {
      const points = [
        outline.start,
        ...outline.segments.map((segment) => segment.to),
      ].map(([x, y]) => [x * PCB_PAGE_SCALE, y * PCB_PAGE_SCALE] as const);
      glow.push({
        kind: "path",
        d: `M ${points.map((point) => point.join(" ")).join(" L ")} Z`,
        stroke: "#63b3ff",
        width: 3,
        fill: "none",
        layer: "highlight",
      });
    }
    const anchor = footprintToBoard(fp, pad.at);
    if (pad.drill)
      glow.push({
        kind: "circle",
        cx: anchor[0] * PCB_PAGE_SCALE,
        cy: anchor[1] * PCB_PAGE_SCALE,
        r: (pad.drill.diameter * PCB_PAGE_SCALE) / 2,
        stroke: "#63b3ff",
        width: 2,
        fill: "none",
        layer: "highlight",
      });
  }
  return { ratsnest, glow };
}
