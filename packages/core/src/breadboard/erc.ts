import type {
  BreadboardErcFinding,
  BreadboardErcRuleId,
  BreadboardPinRef,
} from "./types.ts";
import { BREADBOARD_ERC_RULE_IDS, BREADBOARD_ERC_SEVERITY } from "./types.ts";
import type {
  BreadboardPartType,
  Document,
  Element,
  PageId,
} from "@nodetto/ir";
import { BREADBOARD_PART_TYPES } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { computeBreadboardConnectivity } from "./connectivity.ts";
import { breadboardParityFindings } from "./parity.ts";
import {
  breadboardBondGroups,
  breadboardPins,
  breadboardWireEnds,
} from "./catalogue.ts";

interface PartInfo {
  readonly element: Element;
  readonly type: BreadboardPartType;
  readonly reference: string;
  readonly value: string;
  readonly pins: ReturnType<typeof breadboardPins>;
}
interface SupplyState {
  readonly positive: boolean;
  readonly negative: boolean;
}
interface ConductiveEdge {
  readonly left: number;
  readonly right: number;
  readonly kind: "resistor" | "potentiometer" | "button" | "diode" | "led";
  readonly elementId: string;
}
function visible(element: Element): boolean {
  return element.visual.hidden !== true;
}
function isPart(element: Element): boolean {
  return BREADBOARD_PART_TYPES.includes(element.type as BreadboardPartType);
}
function order(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    compareFractional(left.id, right.id)
  );
}
function pointNear(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return Math.abs(a.x - b.x) <= 0.5 && Math.abs(a.y - b.y) <= 0.5;
}
function pinRef(part: PartInfo, number: number): BreadboardPinRef {
  return { elementId: part.element.id, pin: number };
}
function severity(ruleId: BreadboardErcRuleId): "error" | "warning" {
  return BREADBOARD_ERC_SEVERITY[ruleId];
}
function finding(
  ruleId: BreadboardErcRuleId,
  elementId: string,
  elementIds: readonly string[],
  message: string,
  pin?: number,
): BreadboardErcFinding {
  return {
    ruleId,
    severity: severity(ruleId),
    elementId,
    elementIds,
    ...(pin === undefined ? {} : { pin }),
    message,
  };
}
function label(part: PartInfo, pin?: number): string {
  return pin === undefined ? part.reference : `${part.reference} pin ${pin}`;
}
function conductiveEdges(
  parts: readonly PartInfo[],
  netOf: (ref: BreadboardPinRef) => number | undefined,
): ConductiveEdge[] {
  const edges: ConductiveEdge[] = [];
  for (const part of parts) {
    const nets = (numbers: readonly number[]) =>
      numbers
        .map((number) => netOf(pinRef(part, number)))
        .filter((value): value is number => value !== undefined);
    if (part.type === "breadboard.resistor") {
      const values = nets([1, 2]);
      if (values.length === 2)
        edges.push({
          left: values[0] as number,
          right: values[1] as number,
          kind: "resistor",
          elementId: part.element.id,
        });
    } else if (part.type === "breadboard.potentiometer") {
      const values = [...new Set(nets([1, 2, 3]))];
      for (let i = 0; i < values.length; i += 1)
        for (let j = i + 1; j < values.length; j += 1) {
          edges.push({
            left: values[i] as number,
            right: values[j] as number,
            kind: "potentiometer",
            elementId: part.element.id,
          });
        }
    } else if (part.type === "breadboard.button") {
      const groups = breadboardBondGroups(part.type);
      const left = nets(groups[0] ?? [])[0];
      const right = nets(groups[1] ?? [])[0];
      if (left !== undefined && right !== undefined && left !== right)
        edges.push({
          left,
          right,
          kind: "button",
          elementId: part.element.id,
        });
    } else if (
      part.type === "breadboard.led" ||
      part.type === "breadboard.diode"
    ) {
      const values = nets([1, 2]);
      if (values.length === 2)
        edges.push({
          left: values[0] as number,
          right: values[1] as number,
          kind: part.type === "breadboard.led" ? "led" : "diode",
          elementId: part.element.id,
        });
    }
  }
  return edges;
}
function reachableSupply(
  start: number,
  supplies: ReadonlyMap<number, SupplyState>,
  edges: readonly ConductiveEdge[],
): { positive: boolean; negative: boolean } {
  const seen = new Set<number>([start]);
  const queue = [start];
  let positive = false;
  let negative = false;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    const state = supplies.get(current);
    if (state) {
      positive ||= state.positive;
      negative ||= state.negative;
      if (current !== start || state.positive || state.negative) continue;
    }
    for (const edge of edges) {
      if (
        edge.kind !== "resistor" &&
        edge.kind !== "potentiometer" &&
        edge.kind !== "button"
      )
        continue;
      const next =
        edge.left === current
          ? edge.right
          : edge.right === current
            ? edge.left
            : undefined;
      if (next === undefined || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { positive, negative };
}
function hasZeroOhmSupplyPath(
  start: number,
  wanted: "positive" | "negative",
  supplies: ReadonlyMap<number, SupplyState>,
  edges: readonly ConductiveEdge[],
  excludedElementId: string,
): boolean {
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    const state = supplies.get(current);
    if (state) {
      const wantedIsOnlySupply =
        wanted === "positive"
          ? state.positive && !state.negative
          : state.negative && !state.positive;
      if (wantedIsOnlySupply) return true;
      continue;
    }
    for (const edge of edges) {
      if (
        edge.elementId === excludedElementId ||
        (edge.kind !== "button" && edge.kind !== "diode" && edge.kind !== "led")
      )
        continue;
      const next =
        edge.left === current
          ? edge.right
          : edge.right === current
            ? edge.left
            : undefined;
      if (next === undefined || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

export function lintBreadboardPage(
  document: Document,
  pageId: PageId,
): readonly BreadboardErcFinding[] {
  const elements = document.elements
    .filter((element) => element.page === pageId && visible(element))
    .sort(order);
  const parts: PartInfo[] = elements.filter(isPart).map((element) => {
    const data = element.semantic as { reference?: string; value?: string };
    return {
      element,
      type: element.type as BreadboardPartType,
      reference: data.reference ?? "",
      value: data.value ?? "",
      pins: breadboardPins(element),
    };
  });
  const partById = new Map(parts.map((part) => [part.element.id, part]));
  const connectivity = computeBreadboardConnectivity(document, pageId);
  const findings: BreadboardErcFinding[] = [];
  const pinNotInHole = new Set<string>();
  const pinTouchedByWire = (part: PartInfo, pinNumber: number): boolean => {
    const pin = part.pins.find((entry) => entry.number === pinNumber);
    if (!pin) return false;
    return elements
      .filter((element) => element.type === "breadboard.wire")
      .some((wire) => {
        const ends = breadboardWireEnds(wire);
        return ends?.some((end) => pointNear(pin, end)) ?? false;
      });
  };
  for (const part of parts) {
    for (const pin of part.pins) {
      const ref = pinRef(part, pin.number);
      if (connectivity.pinOnHole(ref) || pinTouchedByWire(part, pin.number))
        continue;
      pinNotInHole.add(`${part.element.id}:${pin.number}`);
      findings.push(
        finding(
          "pin-not-in-hole",
          part.element.id,
          [part.element.id],
          `${label(part, pin.number)} is not inserted in a board hole.`,
          pin.number,
        ),
      );
    }
  }
  const twoPinTypes = new Set<BreadboardPartType>([
    "breadboard.resistor",
    "breadboard.led",
    "breadboard.capacitor",
    "breadboard.diode",
    "breadboard.battery",
  ]);
  for (const part of parts) {
    if (!twoPinTypes.has(part.type)) continue;
    const first = connectivity.netOfPin(pinRef(part, 1));
    const second = connectivity.netOfPin(pinRef(part, 2));
    if (first !== undefined && first === second)
      findings.push(
        finding(
          "shorted-part",
          part.element.id,
          [part.element.id],
          `${part.reference} pins 1 and 2 are on the same net.`,
        ),
      );
  }
  const netElements = new Map<number, Element[]>();
  for (const net of connectivity.nets) {
    const ids = new Set([
      ...net.wireIds,
      ...net.pins.map((pin) => pin.elementId),
    ]);
    netElements.set(
      net.id,
      elements.filter((element) => ids.has(element.id)),
    );
  }
  for (const net of connectivity.nets) {
    const positive = net.strips.some(
      (strip) => strip.strip === "rail:T+" || strip.strip === "rail:B+",
    );
    const negative = net.strips.some(
      (strip) => strip.strip === "rail:T-" || strip.strip === "rail:B-",
    );
    if (!positive || !negative) continue;
    const involved = netElements.get(net.id) ?? [];
    const target =
      involved[0] ??
      elements.find((element) => element.id === net.strips[0]?.boardId);
    if (!target) continue;
    const ids =
      target.type === "breadboard.board"
        ? [target.id]
        : [
            target.id,
            ...involved
              .filter((element) => element.id !== target.id)
              .map((element) => element.id),
          ];
    findings.push(
      finding(
        "rail-short",
        target.id,
        ids,
        `A net joins positive and negative power rails on ${target.id}.`,
      ),
    );
  }
  const supplies = new Map<number, SupplyState>();
  const addSupply = (
    net: number | undefined,
    polarity: "positive" | "negative",
  ) => {
    if (net === undefined) return;
    const current = supplies.get(net) ?? { positive: false, negative: false };
    supplies.set(net, { ...current, [polarity]: true });
  };
  for (const net of connectivity.nets) {
    if (
      net.strips.some(
        (strip) => strip.strip === "rail:T+" || strip.strip === "rail:B+",
      )
    )
      addSupply(net.id, "positive");
    if (
      net.strips.some(
        (strip) => strip.strip === "rail:T-" || strip.strip === "rail:B-",
      )
    )
      addSupply(net.id, "negative");
  }
  for (const part of parts.filter(
    (entry) => entry.type === "breadboard.battery",
  )) {
    addSupply(connectivity.netOfPin(pinRef(part, 1)), "positive");
    addSupply(connectivity.netOfPin(pinRef(part, 2)), "negative");
  }
  const edges = conductiveEdges(
    parts,
    connectivity.netOfPin.bind(connectivity),
  );
  for (const part of parts) {
    if (part.type !== "breadboard.led" && part.type !== "breadboard.diode")
      continue;
    const anode = connectivity.netOfPin(pinRef(part, 1));
    const cathode = connectivity.netOfPin(pinRef(part, 2));
    if (anode === undefined || cathode === undefined || anode === cathode)
      continue;
    const anodeReach = reachableSupply(anode, supplies, edges);
    const cathodeReach = reachableSupply(cathode, supplies, edges);
    if (
      anodeReach.negative &&
      !anodeReach.positive &&
      cathodeReach.positive &&
      !cathodeReach.negative
    ) {
      findings.push(
        finding(
          "reversed-polarity",
          part.element.id,
          [part.element.id],
          `${part.reference} anode pin 1 reaches negative supply while cathode pin 2 reaches positive supply.`,
        ),
      );
    }
    const anodeSupply = supplies.get(anode);
    const cathodeSupply = supplies.get(cathode);
    const shortedSupply =
      (anodeSupply?.positive && anodeSupply.negative) ||
      (cathodeSupply?.positive && cathodeSupply.negative);
    if (
      part.type === "breadboard.led" &&
      !shortedSupply &&
      hasZeroOhmSupplyPath(
        anode,
        "positive",
        supplies,
        edges,
        part.element.id,
      ) &&
      hasZeroOhmSupplyPath(
        cathode,
        "negative",
        supplies,
        edges,
        part.element.id,
      )
    ) {
      findings.push(
        finding(
          "led-no-series-resistor",
          part.element.id,
          [part.element.id],
          `${part.reference} has no resistor in series between its anode and cathode supplies.`,
        ),
      );
    }
  }
  const reportedPins = new Set(pinNotInHole);
  for (const part of parts) {
    for (const pin of part.pins) {
      const key = `${part.element.id}:${pin.number}`;
      if (reportedPins.has(key)) continue;
      const netId = connectivity.netOfPin(pinRef(part, pin.number));
      const net = netId === undefined ? undefined : connectivity.nets[netId];
      const otherPin =
        net?.pins.some((other) => other.elementId !== part.element.id) ?? false;
      if (!otherPin)
        findings.push(
          finding(
            "unconnected-pin",
            part.element.id,
            [part.element.id],
            `${label(part, pin.number)} has no connection to another part.`,
            pin.number,
          ),
        );
    }
  }
  const firstReference = new Map<string, PartInfo>();
  for (const part of parts) {
    const first = firstReference.get(part.reference);
    if (first)
      findings.push(
        finding(
          "duplicate-reference",
          part.element.id,
          [part.element.id],
          `${part.reference} duplicates an earlier part reference.`,
        ),
      );
    else firstReference.set(part.reference, part);
  }
  for (const wire of elements.filter(
    (element) => element.type === "breadboard.wire",
  )) {
    for (const end of [0, 1] as const) {
      if (connectivity.wireEndOnHoleOrPin(wire.id, end)) continue;
      const side = end === 0 ? "first" : "last";
      findings.push(
        finding(
          "wire-end-off-hole",
          wire.id,
          [wire.id],
          `The ${side} end of wire ${wire.id} touches neither a board hole nor a part pin.`,
        ),
      );
    }
  }
  void partById;
  // parity findings (plan 10)
  findings.push(...breadboardParityFindings(document, pageId, connectivity));
  const elementOrder = new Map(
    elements.map((element, index) => [element.id, index]),
  );
  const ruleOrder = new Map(
    BREADBOARD_ERC_RULE_IDS.map((rule, index) => [rule, index]),
  );
  return findings.sort(
    (left, right) =>
      (elementOrder.get(left.elementId) ?? Number.MAX_SAFE_INTEGER) -
        (elementOrder.get(right.elementId) ?? Number.MAX_SAFE_INTEGER) ||
      (ruleOrder.get(left.ruleId) ?? Number.MAX_SAFE_INTEGER) -
        (ruleOrder.get(right.ruleId) ?? Number.MAX_SAFE_INTEGER) ||
      (left.pin ?? 0) - (right.pin ?? 0) ||
      left.message.localeCompare(right.message),
  );
}
