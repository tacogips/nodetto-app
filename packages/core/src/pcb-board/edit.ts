import type {
  Element,
  FractionalIndex,
  PageId,
  PcbFootprintSemantic,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbXY,
} from "@nodetto/ir";
import { PCB_PAGE_SCALE, isPcbElementType, roundNm } from "@nodetto/ir";
import type { Command } from "../commands.ts";
import type { Store } from "../store.ts";
import { keyBetween } from "../fractional.ts";
import { pcbAnchor, translatePcbSemantic } from "./geometry.ts";

export const PCB_TRACK_DEFAULT_WIDTH = 0.25;
export const PCB_VIA_DEFAULT = { diameter: 0.6, drill: 0.3 } as const;

export type PcbTrackInput = Omit<PcbTrackSemantic, "points"> & {
  readonly points: readonly PcbXY[];
};
export type PcbViaInput = Omit<PcbViaSemantic, "layers"> & {
  readonly layers?: readonly [string, string];
};

export function pcbMoveCommand(
  element: Element,
  targetPageX: number,
  targetPageY: number,
): Command | undefined {
  if (!isPcbElementType(element.type)) return undefined;
  const anchor = pcbAnchor(
    element.type,
    element.semantic as Record<string, unknown>,
  );
  if (!anchor) return undefined;
  const dx = (targetPageX - anchor[0] * PCB_PAGE_SCALE) / PCB_PAGE_SCALE;
  const dy = (targetPageY - anchor[1] * PCB_PAGE_SCALE) / PCB_PAGE_SCALE;
  if (dx === 0 && dy === 0) return undefined;
  return {
    type: "updateSemantic",
    id: element.id,
    semantic: translatePcbSemantic(
      element.type,
      element.semantic as Record<string, unknown>,
      dx,
      dy,
    ),
  };
}

export function rotatePcbFootprintSemantic(
  semantic: PcbFootprintSemantic,
  degrees: number,
): PcbFootprintSemantic {
  return {
    ...semantic,
    rotation: (((semantic.rotation + degrees) % 360) + 360) % 360,
  };
}

export function pcbInsertIndex(
  store: Store,
  pageId: PageId,
  type: "pcb.track" | "pcb.via",
): FractionalIndex {
  const elements = store.getPageElements(pageId);
  const firstFootprint = elements.find(
    (element) => element.type === "pcb.footprint",
  );
  const firstFootprintIndex = firstFootprint
    ? elements.indexOf(firstFootprint)
    : elements.length;
  const kinds =
    type === "pcb.track"
      ? ["pcb.track", "pcb.zone", "pcb.graphic", "pcb.board"]
      : ["pcb.via", "pcb.track"];
  let lower: Element | undefined;
  for (const kind of kinds) {
    lower = elements
      .slice(0, firstFootprintIndex)
      .filter((element) => element.type === kind)
      .at(-1);
    if (lower) break;
  }
  const lowerAt = lower ? elements.indexOf(lower) : -1;
  const upper = elements[lowerAt + 1]?.index ?? null;
  return keyBetween(lower?.index ?? null, upper);
}

export function roundPcbTrackInput(input: PcbTrackInput): PcbTrackSemantic {
  return {
    ...input,
    points: input.points.map(([x, y]): PcbXY => [roundNm(x), roundNm(y)]),
  };
}
