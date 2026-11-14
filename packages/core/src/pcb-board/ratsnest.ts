import type { Document, ElementId, PageId, PcbXY } from "@nodetto/ir";
import { pcbNetNames } from "./connectivity.ts";
import type { PcbConnectivity, PcbPadRef } from "./connectivity.ts";

export interface PcbRatsnestLine {
  readonly net: string;
  readonly from: {
    readonly footprintId: ElementId;
    readonly pad: number;
    readonly x: number;
    readonly y: number;
  };
  readonly to: {
    readonly footprintId: ElementId;
    readonly pad: number;
    readonly x: number;
    readonly y: number;
  };
}

interface PadNode {
  readonly ref: PcbPadRef;
  readonly at: PcbXY;
  readonly elementOrder: number;
}
interface Candidate {
  readonly fromGroup: number;
  readonly toGroup: number;
  readonly from: PadNode;
  readonly to: PadNode;
  readonly distance: number;
}

function beforePad(left: PadNode, right: PadNode): boolean {
  return (
    left.elementOrder < right.elementOrder ||
    (left.elementOrder === right.elementOrder && left.ref.pad < right.ref.pad)
  );
}
function beforeCandidate(left: Candidate, right: Candidate): boolean {
  return (
    left.distance < right.distance ||
    (left.distance === right.distance &&
      (beforePad(left.from, right.from) ||
        (!beforePad(right.from, left.from) && beforePad(left.to, right.to))))
  );
}
function end(pad: PadNode) {
  return {
    footprintId: pad.ref.footprintId,
    pad: pad.ref.pad,
    x: pad.at[0],
    y: pad.at[1],
  };
}

export function computePcbRatsnest(
  document: Document,
  pageId: PageId,
  connectivity: PcbConnectivity,
): PcbRatsnestLine[] {
  const lines: PcbRatsnestLine[] = [];
  for (const net of pcbNetNames(document, pageId)) {
    if (!net) continue;
    const groups = new Map<number, PadNode[]>();
    for (const pad of connectivity.pads) {
      if (pad.net !== net) continue;
      const component = connectivity.component({ kind: "pad", ref: pad.ref });
      const group = groups.get(component) ?? [];
      group.push({ ref: pad.ref, at: pad.at, elementOrder: pad.elementOrder });
      groups.set(component, group);
    }
    const groupList = [...groups.values()];
    if (groupList.length < 2) continue;
    const joined = new Set<number>([0]);
    while (joined.size < groupList.length) {
      let best: Candidate | undefined;
      for (const fromGroup of joined) {
        const fromPads = groupList[fromGroup] ?? [];
        for (let toGroup = 0; toGroup < groupList.length; toGroup += 1) {
          if (joined.has(toGroup)) continue;
          for (const from of fromPads) {
            for (const to of groupList[toGroup] ?? []) {
              const dx = from.at[0] - to.at[0];
              const dy = from.at[1] - to.at[1];
              const candidate = {
                fromGroup,
                toGroup,
                from,
                to,
                distance: dx * dx + dy * dy,
              };
              if (!best || beforeCandidate(candidate, best)) best = candidate;
            }
          }
        }
      }
      if (!best) break;
      lines.push({ net, from: end(best.from), to: end(best.to) });
      joined.add(best.toGroup);
    }
  }
  return lines;
}
