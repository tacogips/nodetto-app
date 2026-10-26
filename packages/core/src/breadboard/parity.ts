import type {
  BreadboardPartType,
  Document,
  Element,
  ElementId,
  PageId,
} from "@nodetto/ir";
import { BREADBOARD_PART_TYPES, parseComponentValue } from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import { breadboardBondGroups } from "./catalogue.ts";
import { computeBreadboardRatsnest } from "./ratsnest.ts";
import type {
  BreadboardConnectivity,
  BreadboardErcFinding,
  BreadboardErcRuleId,
} from "./types.ts";
import { BREADBOARD_ERC_SEVERITY, breadboardTargetNetlist } from "./types.ts";

export type BreadboardTargetPartStatus =
  | "placed"
  | "missing"
  | "value-mismatch";

type TargetPart = {
  readonly reference: string;
  readonly value: string;
  readonly type: BreadboardPartType;
};

function elementOrder(left: Element, right: Element): number {
  return (
    compareFractional(left.index, right.index) ||
    compareFractional(left.id, right.id)
  );
}

function pageParts(document: Document, pageId: PageId): readonly Element[] {
  return document.elements
    .filter(
      (element) =>
        element.page === pageId &&
        element.visual.hidden !== true &&
        BREADBOARD_PART_TYPES.includes(element.type as BreadboardPartType),
    )
    .sort(elementOrder);
}

export function resolveBreadboardReference(
  document: Document,
  pageId: PageId,
  reference: string,
): ElementId | undefined {
  const part = pageParts(document, pageId).find(
    (element) =>
      (element.semantic as { reference?: string }).reference === reference,
  );
  return part?.id;
}

function resolvedPart(
  document: Document,
  pageId: PageId,
  reference: string,
): Element | undefined {
  return pageParts(document, pageId).find(
    (element) =>
      (element.semantic as { reference?: string }).reference === reference,
  );
}

function componentValue(element: Element): string {
  return (element.semantic as { value?: string }).value ?? "";
}

function valuesMatch(left: string, right: string): boolean {
  const leftParsed = parseComponentValue(left);
  const rightParsed = parseComponentValue(right);
  if (leftParsed !== undefined && rightParsed !== undefined)
    return (
      Math.abs(leftParsed - rightParsed) <=
      1e-9 * Math.max(Math.abs(leftParsed), Math.abs(rightParsed))
    );
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function targetParts(
  document: Document,
  pageId: PageId,
): readonly TargetPart[] {
  return breadboardTargetNetlist(document, pageId)?.semantic.parts ?? [];
}

function finding(
  ruleId: BreadboardErcRuleId,
  elementId: ElementId,
  elementIds: readonly ElementId[],
  message: string,
  pin?: number,
): BreadboardErcFinding {
  return {
    ruleId,
    severity: BREADBOARD_ERC_SEVERITY[ruleId],
    elementId,
    elementIds,
    ...(pin === undefined ? {} : { pin }),
    message,
  };
}

function targetNetAssignments(
  element: Element,
  pin: number,
  targetNets: ReadonlyMap<string, string>,
): string {
  const direct = targetNets.get(
    `${(element.semantic as { reference?: string }).reference ?? ""}\u0000${pin}`,
  );
  if (direct) return direct;
  const groups = breadboardBondGroups(element.type as BreadboardPartType);
  for (const group of groups) {
    if (!group.includes(pin)) continue;
    for (const twin of group) {
      const net = targetNets.get(
        `${(element.semantic as { reference?: string }).reference ?? ""}\u0000${twin}`,
      );
      if (net) return net;
    }
  }
  const reference =
    (element.semantic as { reference?: string }).reference ?? "";
  return `unconnected ${reference} pin ${pin}`;
}

export function breadboardParityFindings(
  document: Document,
  pageId: PageId,
  connectivity: BreadboardConnectivity,
): readonly BreadboardErcFinding[] {
  const target = breadboardTargetNetlist(document, pageId);
  if (!target) return [];

  const parts = pageParts(document, pageId);
  const targetReferences = new Set(
    target.semantic.parts.map((part) => part.reference),
  );
  const targetNets = new Map<string, string>();
  for (const net of target.semantic.nets) {
    for (const node of net.nodes) {
      const key = `${node.reference}\u0000${node.pin}`;
      if (!targetNets.has(key)) targetNets.set(key, net.name);
    }
  }

  const findings: BreadboardErcFinding[] = [];
  for (const line of computeBreadboardRatsnest(
    document,
    pageId,
    connectivity,
  )) {
    const fromPart = parts.find((part) => part.id === line.from.elementId);
    const fromReference = fromPart
      ? ((fromPart.semantic as { reference?: string }).reference ??
        line.from.elementId)
      : line.from.elementId;
    findings.push(
      finding(
        "parity-missing-connection",
        line.to.elementId,
        [line.to.elementId, line.from.elementId],
        `${line.targetNet} is missing a connection from ${fromReference} pin ${line.from.pin}.`,
        line.to.pin,
      ),
    );
  }

  for (const net of connectivity.nets) {
    const assigned = new Map<string, { element: Element; pin: number }>();
    const involved = new Set<ElementId>();
    const netPins = [...net.pins].sort((left, right) => {
      const leftPart = parts.find((part) => part.id === left.elementId);
      const rightPart = parts.find((part) => part.id === right.elementId);
      if (!leftPart || !rightPart)
        return left.elementId.localeCompare(right.elementId);
      return elementOrder(leftPart, rightPart) || left.pin - right.pin;
    });
    for (const pinRef of netPins) {
      const part = parts.find((candidate) => candidate.id === pinRef.elementId);
      if (!part) continue;
      const reference =
        (part.semantic as { reference?: string }).reference ?? "";
      if (!targetReferences.has(reference)) continue;
      involved.add(part.id);
      const assignment = targetNetAssignments(part, pinRef.pin, targetNets);
      if (!assigned.has(assignment))
        assigned.set(assignment, { element: part, pin: pinRef.pin });
    }
    if (assigned.size < 2) continue;
    const [, second] = assigned.values();
    if (!second) continue;
    findings.push(
      finding(
        "parity-extra-connection",
        second.element.id,
        [...involved],
        `Breadboard net ${net.id} merges target nets ${[...assigned.keys()].join(", ")}.`,
        second.pin,
      ),
    );
  }

  for (const targetPart of target.semantic.parts) {
    if (resolvedPart(document, pageId, targetPart.reference)) continue;
    findings.push(
      finding(
        "parity-missing-part",
        target.element.id,
        [target.element.id],
        `Target part ${targetPart.reference} (${targetPart.value}) is missing from the breadboard.`,
      ),
    );
  }

  const firstReference = new Set<string>();
  for (const part of parts) {
    const reference = (part.semantic as { reference?: string }).reference ?? "";
    if (firstReference.has(reference)) continue;
    firstReference.add(reference);
    if (!targetReferences.has(reference))
      findings.push(
        finding(
          "parity-extra-part",
          part.id,
          [part.id],
          `Part ${reference} is not present in the target netlist.`,
        ),
      );
  }

  for (const targetPart of target.semantic.parts) {
    const part = resolvedPart(document, pageId, targetPart.reference);
    if (!part || valuesMatch(targetPart.value, componentValue(part))) continue;
    findings.push(
      finding(
        "parity-value-mismatch",
        part.id,
        [part.id],
        `${targetPart.reference} value ${componentValue(part)} does not match target value ${targetPart.value}.`,
      ),
    );
  }
  return findings;
}

export function breadboardTargetStatus(
  document: Document,
  pageId: PageId,
): readonly {
  reference: string;
  value: string;
  status: BreadboardTargetPartStatus;
  elementId?: ElementId;
}[] {
  return targetParts(document, pageId).map((targetPart) => {
    const part = resolvedPart(document, pageId, targetPart.reference);
    if (!part)
      return {
        reference: targetPart.reference,
        value: targetPart.value,
        status: "missing",
      };
    return {
      reference: targetPart.reference,
      value: targetPart.value,
      status: valuesMatch(targetPart.value, componentValue(part))
        ? "placed"
        : "value-mismatch",
      elementId: part.id,
    };
  });
}
