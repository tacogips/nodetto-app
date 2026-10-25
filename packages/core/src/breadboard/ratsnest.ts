import type { Document, Element, PageId } from "@nodetto/ir";
import { BREADBOARD_PART_TYPES } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { breadboardPins } from "./catalogue.ts";
import type {
  BreadboardConnectivity,
  RatsnestEnd,
  RatsnestLine,
} from "./types.ts";
import { breadboardTargetNetlist } from "./types.ts";

interface TargetNode extends RatsnestEnd {
  readonly order: number;
  readonly net: number | undefined;
}

function elementOrder(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    compareFractional(left.id, right.id)
  );
}

function targetPart(
  document: Document,
  pageId: PageId,
  reference: string,
): Element | undefined {
  return document.elements
    .filter(
      (element) =>
        element.page === pageId &&
        element.visual.hidden !== true &&
        BREADBOARD_PART_TYPES.includes(
          element.type as (typeof BREADBOARD_PART_TYPES)[number],
        ) &&
        (element.semantic as { reference?: string }).reference === reference,
    )
    .sort(elementOrder)[0];
}

export function computeBreadboardRatsnest(
  document: Document,
  pageId: PageId,
  connectivity: BreadboardConnectivity,
): readonly RatsnestLine[] {
  const target = breadboardTargetNetlist(document, pageId);
  if (!target) return [];

  const parts = new Map<string, Element | undefined>();
  const lines: RatsnestLine[] = [];
  for (const [netIndex, net] of target.semantic.nets.entries()) {
    const nodes: TargetNode[] = [];
    for (const targetNode of net.nodes) {
      let part = parts.get(targetNode.reference);
      if (!parts.has(targetNode.reference)) {
        part = targetPart(document, pageId, targetNode.reference);
        parts.set(targetNode.reference, part);
      }
      if (!part) continue;
      const pin = breadboardPins(part).find(
        (entry) => entry.number === targetNode.pin,
      );
      if (!pin) continue;
      nodes.push({
        elementId: part.id,
        pin: pin.number,
        x: pin.x,
        y: pin.y,
        order: nodes.length,
        net: connectivity.netOfPin({ elementId: part.id, pin: pin.number }),
      });
    }
    if (nodes.length < 2) continue;

    const groups = new Map<string, TargetNode[]>();
    for (const node of nodes) {
      const groupKey =
        node.net === undefined ? `isolated:${node.order}` : `net:${node.net}`;
      const group = groups.get(groupKey) ?? [];
      group.push(node);
      groups.set(groupKey, group);
    }
    const groupList = [...groups.values()];
    if (groupList.length < 2) continue;

    const joined = new Set<number>([0]);
    while (joined.size < groupList.length) {
      let best:
        | {
            readonly fromGroup: number;
            readonly toGroup: number;
            readonly from: TargetNode;
            readonly to: TargetNode;
            readonly distance: number;
          }
        | undefined;
      for (const fromGroup of joined) {
        for (let toGroup = 0; toGroup < groupList.length; toGroup += 1) {
          if (joined.has(toGroup)) continue;
          for (const from of groupList[fromGroup] ?? []) {
            for (const to of groupList[toGroup] ?? []) {
              const dx = from.x - to.x;
              const dy = from.y - to.y;
              const candidate = {
                fromGroup,
                toGroup,
                from,
                to,
                distance: dx * dx + dy * dy,
              };
              if (
                !best ||
                candidate.distance < best.distance ||
                (candidate.distance === best.distance &&
                  (from.order < best.from.order ||
                    (from.order === best.from.order &&
                      to.order < best.to.order)))
              )
                best = candidate;
            }
          }
        }
      }
      if (!best) break;
      const targetNet = target.semantic.nets[netIndex];
      if (targetNet)
        lines.push({
          targetNet: targetNet.name,
          from: {
            elementId: best.from.elementId,
            pin: best.from.pin,
            x: best.from.x,
            y: best.from.y,
          },
          to: {
            elementId: best.to.elementId,
            pin: best.to.pin,
            x: best.to.x,
            y: best.to.y,
          },
        });
      joined.add(best.toGroup);
    }
  }
  return lines;
}
