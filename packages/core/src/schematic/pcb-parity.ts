import {
  comparePageOrder,
  parseComponentValue,
  type Document,
  type Element,
  type ElementId,
  type PageId,
  type PcbFootprintSemantic,
  type PcbPad,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { toSchematicNetlist } from "./netlist.ts";

export type SchematicPcbParityRuleId =
  | "pcb-parity-missing-connection"
  | "pcb-parity-extra-connection"
  | "pcb-parity-missing-part"
  | "pcb-parity-extra-part"
  | "pcb-parity-value-mismatch";
export interface SchematicPcbParityFinding {
  readonly ruleId: SchematicPcbParityRuleId;
  readonly severity: "error" | "warning";
  readonly elementId: ElementId;
  readonly elementIds: readonly ElementId[];
  readonly message: string;
  readonly pin?: number;
  readonly pageId?: PageId;
}

export function firstSchematicPageId(document: Document): PageId | undefined {
  let first: (typeof document.pages)[number] | undefined;
  for (const page of document.pages)
    if (
      page.kind === "schematic" &&
      (!first || comparePageOrder(page, first) < 0)
    )
      first = page;
  return first?.id;
}

function valuesMatch(left: string, right: string): boolean {
  const a = parseComponentValue(left);
  const b = parseComponentValue(right);
  if (a !== undefined && b !== undefined)
    return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function schematicPcbParityFindings(
  document: Document,
  pcbPageId: PageId,
  schematicPageId: PageId,
): readonly SchematicPcbParityFinding[] {
  if (
    !document.pages.some(
      (page) => page.id === schematicPageId && page.kind === "schematic",
    )
  )
    return [];
  const netlist = toSchematicNetlist(
    document,
    schematicPageId,
    computeSchematicConnectivity(document, schematicPageId),
  );
  const footprints = document.elements
    .filter(
      (element) =>
        element.page === pcbPageId &&
        element.type === "pcb.footprint" &&
        !element.visual.hidden,
    )
    .sort(
      (a, b) =>
        compareFractional(a.index, b.index) || compareFractional(a.id, b.id),
    );
  const byReference = new Map<
    string,
    {
      element: Element;
      semantic: PcbFootprintSemantic;
      pads: Map<string, PcbPad>;
    }
  >();
  for (const element of footprints) {
    const semantic = element.semantic as PcbFootprintSemantic;
    if (byReference.has(semantic.reference)) continue;
    const pads = new Map<string, PcbPad>();
    for (const pad of semantic.pads)
      if (!pads.has(pad.number)) pads.set(pad.number, pad);
    byReference.set(semantic.reference, { element, semantic, pads });
  }
  const findings: SchematicPcbParityFinding[] = [];
  const add = (
    ruleId: SchematicPcbParityRuleId,
    elementId: ElementId,
    message: string,
    pin?: number,
    pageId?: PageId,
  ) =>
    findings.push({
      ruleId,
      severity: ruleId === "pcb-parity-extra-connection" ? "error" : "warning",
      elementId,
      elementIds: [elementId],
      message,
      ...(pin === undefined ? {} : { pin }),
      ...(pageId === undefined ? {} : { pageId }),
    });
  const references = new Set<string>();
  for (const component of netlist.components) {
    references.add(component.reference);
    const footprint = byReference.get(component.reference);
    if (!footprint)
      add(
        "pcb-parity-missing-part",
        component.elementId,
        `${component.reference} has no PCB footprint.`,
        undefined,
        schematicPageId,
      );
    else if (!valuesMatch(component.value, footprint.semantic.value))
      add(
        "pcb-parity-value-mismatch",
        footprint.element.id,
        `${component.reference} has a different value on the PCB.`,
      );
  }
  for (const footprint of footprints) {
    const semantic = footprint.semantic as PcbFootprintSemantic;
    if (!references.has(semantic.reference))
      add(
        "pcb-parity-extra-part",
        footprint.id,
        `${semantic.reference} has no schematic part.`,
      );
  }
  const pcbNets = new Map<
    string | PcbPad,
    { schematicNet: number; reported: boolean }
  >();
  for (const net of netlist.nets) {
    const groups = new Set<string | PcbPad>();
    for (const node of net.nodes) {
      const footprint = byReference.get(node.reference);
      if (!footprint) continue;
      const pad = footprint.pads.get(String(node.pin));
      if (!pad) {
        if (net.nodes.length >= 2)
          add(
            "pcb-parity-missing-connection",
            footprint.element.id,
            `${node.reference} has no pad ${node.pin} for net ${net.name}.`,
            node.pin,
          );
        continue;
      }
      const key = pad.net === "" ? pad : pad.net;
      if (!groups.has(key) && groups.size > 0 && net.nodes.length >= 2)
        add(
          "pcb-parity-missing-connection",
          footprint.element.id,
          `${node.reference} pad ${node.pin} is on a different PCB net from ${net.name}.`,
          node.pin,
        );
      groups.add(key);
      const previous = pcbNets.get(key);
      if (!previous)
        pcbNets.set(key, { schematicNet: net.code, reported: false });
      else if (previous.schematicNet !== net.code && !previous.reported) {
        add(
          "pcb-parity-extra-connection",
          footprint.element.id,
          `PCB net joins different schematic nets at ${node.reference} pad ${node.pin}.`,
          node.pin,
        );
        previous.reported = true;
      }
    }
  }
  return findings;
}
