import {
  footprintToBoard,
  outlineContains,
  padCopperOutline,
  padPrimitiveOutlines,
} from "@nodetto/core";
import type { PcbTrackInput, PcbViaInput } from "@nodetto/core";
import type {
  Document,
  PageId,
  PcbFootprintSemantic,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbXY,
} from "@nodetto/ir";
import { isPcbElementType } from "@nodetto/ir";
import type { PcbToolOptions } from "./pcb-state.ts";
import { isPcbElementShown } from "./pcb-state.ts";

export interface PcbSnapTarget {
  readonly point: PcbXY;
  readonly net: string;
  readonly layer: string;
  readonly elementId: string;
}
export interface PcbTrackDraft {
  readonly start: PcbXY;
  readonly vertices: readonly PcbXY[];
  readonly startTarget?: PcbSnapTarget;
}
export type PcbTrackDraftAction =
  | {
      readonly kind: "start";
      readonly point: PcbXY;
      readonly target?: PcbSnapTarget;
    }
  | { readonly kind: "vertex"; readonly point: PcbXY }
  | { readonly kind: "cancel" }
  | {
      readonly kind: "finish";
      readonly point: PcbXY;
      readonly target?: PcbSnapTarget;
    };
export function pcbTrackDraft(
  draft: PcbTrackDraft | null,
  action: PcbTrackDraftAction,
  options: PcbToolOptions,
): { readonly draft: PcbTrackDraft | null; readonly input?: PcbTrackInput } {
  if (action.kind === "cancel") return { draft: null };
  if (action.kind === "start")
    return {
      draft: {
        start: action.target?.point ?? action.point,
        vertices: [],
        startTarget: action.target,
      },
    };
  if (!draft) return { draft: null };
  if (action.kind === "vertex")
    return { draft: { ...draft, vertices: [...draft.vertices, action.point] } };
  const end = action.target?.point ?? action.point;
  if (
    end[0] === draft.start[0] &&
    end[1] === draft.start[1] &&
    draft.vertices.length === 0
  )
    return { draft };
  const points: PcbXY[] = [draft.start];
  for (const point of [...draft.vertices, end]) {
    const previous = points.at(-1);
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1])
      points.push(point);
  }
  if (points.length < 2) return { draft: null };
  return {
    draft: null,
    input: {
      layer: options.layer,
      width: options.width,
      net: draft.startTarget?.net || options.net,
      points,
    },
  };
}
export function pcbViaInput(
  point: PcbXY,
  snap: PcbSnapTarget | undefined,
  options: PcbToolOptions,
): PcbViaInput {
  return {
    at: snap?.point ?? point,
    diameter: options.viaDiameter,
    drill: options.viaDrill,
    layers: ["F.Cu", "B.Cu"],
    net: snap?.net || options.net,
  };
}
function close(a: PcbXY, b: PcbXY, tolerance: number): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}
export function pcbSnapTarget(
  document: Document,
  pageId: PageId,
  pointMm: PcbXY,
  hidden: ReadonlySet<string> = new Set(),
  tolerance = 0.35,
): PcbSnapTarget | undefined {
  const elements = document.elements.filter(
    (element) =>
      element.page === pageId &&
      isPcbElementType(element.type) &&
      isPcbElementShown(element, hidden),
  );
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    if (!element) continue;
    if (element.type === "pcb.footprint") {
      const fp = element.semantic as PcbFootprintSemantic;
      for (const pad of fp.pads) {
        if (pad.layers.every((layer) => hidden.has(layer))) continue;
        const copper = [
          padCopperOutline(fp, pad),
          ...padPrimitiveOutlines(fp, pad),
        ];
        if (copper.some((outline) => outlineContains(outline, pointMm)))
          return {
            point: footprintToBoard(fp, pad.at),
            net: pad.net,
            layer: pad.layers.find((layer) => layer.endsWith(".Cu")) ?? "F.Cu",
            elementId: element.id,
          };
      }
    } else if (element.type === "pcb.via") {
      const via = element.semantic as PcbViaSemantic;
      if (close(via.at, pointMm, Math.max(tolerance, via.diameter / 2)))
        return {
          point: via.at,
          net: via.net,
          layer: via.layers[0],
          elementId: element.id,
        };
    } else if (element.type === "pcb.track") {
      const track = element.semantic as PcbTrackSemantic;
      for (const end of [track.points[0], track.points.at(-1)])
        if (end && close(end, pointMm, Math.max(tolerance, track.width / 2)))
          return {
            point: end,
            net: track.net,
            layer: track.layer,
            elementId: element.id,
          };
    }
  }
  return undefined;
}
