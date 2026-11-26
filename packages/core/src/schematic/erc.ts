import {
  isSchematicPartType,
  type Document,
  type ElementId,
  type PageId,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { schematicPins } from "./symbols.ts";

export type SchematicErcRuleId =
  | "unconnected-pin"
  | "single-pin-net"
  | "dangling-wire-end"
  | "duplicate-reference"
  | "shorted-power-nets";
export const SCHEMATIC_ERC_RULE_IDS: readonly SchematicErcRuleId[] = [
  "unconnected-pin",
  "single-pin-net",
  "dangling-wire-end",
  "duplicate-reference",
  "shorted-power-nets",
];
export interface SchematicErcFinding {
  readonly ruleId: SchematicErcRuleId;
  readonly severity: "error" | "warning";
  readonly elementId: ElementId;
  readonly pin?: number;
  readonly elementIds: readonly ElementId[];
  readonly message: string;
  readonly pageId?: PageId;
}
export function lintSchematicPage(
  document: Document,
  pageId: PageId,
): readonly SchematicErcFinding[] {
  const elements = document.elements
    .filter((e) => e.page === pageId && !e.visual.hidden)
    .sort(
      (a, b) =>
        compareFractional(a.index, b.index) || compareFractional(a.id, b.id),
    );
  const byId = new Map(elements.map((e) => [e.id, e]));
  const order = new Map(elements.map((e, i) => [e.id, i]));
  const connectivity = computeSchematicConnectivity(document, pageId);
  const findings: SchematicErcFinding[] = [];
  const add = (
    ruleId: SchematicErcRuleId,
    elementId: ElementId,
    elementIds: readonly ElementId[],
    message: string,
    pin?: number,
  ) => {
    findings.push({
      ruleId,
      severity:
        ruleId === "duplicate-reference" || ruleId === "shorted-power-nets"
          ? "error"
          : "warning",
      elementId,
      elementIds,
      message,
      ...(pin === undefined ? {} : { pin }),
    });
  };
  const references = new Set<string>();
  for (const part of elements.filter((e) => isSchematicPartType(e.type))) {
    const reference = (part.semantic as { reference: string }).reference;
    if (references.has(reference))
      add(
        "duplicate-reference",
        part.id,
        [part.id],
        `${reference} duplicates an earlier part reference.`,
      );
    references.add(reference);
    for (const pin of schematicPins(part)) {
      const ref = { elementId: part.id, pin: pin.number };
      if (connectivity.noConnectAt(ref)) continue;
      const netId = connectivity.netOfPin(ref);
      const net = netId === undefined ? undefined : connectivity.nets[netId];
      if (!net || net.pins.length !== 1 || net.powerIds.length > 0) continue;
      if (net.wireIds.length || net.labelIds.length || net.junctionIds.length)
        add(
          "single-pin-net",
          part.id,
          [part.id, ...net.wireIds, ...net.labelIds],
          `${reference} pin ${pin.number} is the only part pin on its net.`,
          pin.number,
        );
      else
        add(
          "unconnected-pin",
          part.id,
          [part.id],
          `${reference} pin ${pin.number} is unconnected.`,
          pin.number,
        );
    }
  }
  for (const wire of elements.filter((e) => e.type === "schematic.wire")) {
    for (const end of [0, 1] as const) {
      if (connectivity.wireEndAttached(wire.id, end)) continue;
      const other = connectivity.wireEndOnPathOf(wire.id, end);
      const side = end === 0 ? "first" : "last";
      add(
        "dangling-wire-end",
        wire.id,
        other === undefined ? [wire.id] : [wire.id, other],
        other === undefined
          ? `The ${side} end of wire ${wire.id} is unconnected.`
          : `The ${side} end of wire ${wire.id} touches wire ${other}; a junction is missing.`,
      );
    }
  }
  for (const net of connectivity.nets) {
    const names = new Set<string>();
    let second: ElementId | undefined;
    for (const id of net.powerIds) {
      const power = byId.get(id);
      if (!power) continue;
      const name = (power.semantic as { net: string }).net.trim();
      if (!names.has(name) && names.size > 0 && second === undefined)
        second = id;
      names.add(name);
    }
    if (second !== undefined)
      add(
        "shorted-power-nets",
        second,
        net.powerIds,
        "Power symbols with different net names are connected.",
      );
  }
  return findings.sort(
    (a, b) =>
      (order.get(a.elementId) ?? 0) - (order.get(b.elementId) ?? 0) ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0) ||
      (a.pin ?? 0) - (b.pin ?? 0) ||
      a.message.localeCompare(b.message),
  );
}
