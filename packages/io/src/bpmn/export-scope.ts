// Page scope of a BPMN export: the page's records grouped by kind, their
// ownership by participants and sub-processes, and process identifiers.

import type { Document, Element } from "@nodetto/ir";
import { bpmnExportId } from "./ids.ts";
import { type BpmnExportWarning, semantic } from "./export-common.ts";

function xmlOnly(page: {
  extensions?: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
  const extension = page.extensions?.["bpmnXml"];
  return extension && typeof extension === "object"
    ? (extension as Record<string, unknown>)
    : {};
}

export interface BpmnExportScope {
  readonly pageId: string;
  readonly extension: Record<string, unknown>;
  readonly records: readonly Element[];
  readonly byId: ReadonlyMap<string, Element>;
  readonly idOf: (id: string) => string;
  readonly participants: readonly Element[];
  readonly lanes: readonly Element[];
  readonly flows: readonly Element[];
  readonly flowNodes: readonly Element[];
  readonly data: readonly Element[];
  readonly artifacts: readonly Element[];
  readonly hasParticipants: boolean;
  readonly collaborationArtifacts: readonly Element[];
  readonly associationOwner: (item: Element) => string | undefined;
  readonly effectiveParent: (item: Element) => string | undefined;
  readonly parentOf: (item: Element) => string | undefined;
  readonly ownerParticipant: (item: Element) => string | undefined;
  readonly subprocessScope: (item: Element) => string | undefined;
  readonly belongsToProcess: (item: Element, participantId: string) => boolean;
  readonly processNodes: ReadonlyMap<string, readonly Element[]>;
  readonly processId: (participantId: string) => string;
}

export function collectExportScope(
  document: Document,
  pageId: string,
  warnings: BpmnExportWarning[],
): BpmnExportScope {
  const page = document.pages.find((item) => item.id === pageId);
  if (!page || page.kind !== "bpmn")
    throw new Error(`BPMN page not found: ${pageId}`);
  const records = document.elements
    .filter((item) => item.page === pageId && item.type.startsWith("bpmn."))
    .slice()
    .sort((a, b) => a.index.localeCompare(b.index) || a.id.localeCompare(b.id));
  const byId = new Map(records.map((item) => [item.id, item]));
  const idOf = (id: string): string => {
    const found = byId.get(id);
    return found
      ? bpmnExportId(found)
      : bpmnExportId({ id, type: "bpmn.task" });
  };
  const extension = xmlOnly(page);
  const participants = records.filter(
    (item) => item.type === "bpmn.participant",
  );
  const lanes = records.filter((item) => item.type === "bpmn.lane");
  const flows = records.filter((item) =>
    [
      "bpmn.sequenceFlow",
      "bpmn.messageFlow",
      "bpmn.association",
      "bpmn.dataAssociation",
    ].includes(item.type),
  );
  const flowNodes = records.filter((item) =>
    [
      "bpmn.task",
      "bpmn.subProcess",
      "bpmn.callActivity",
      "bpmn.event",
      "bpmn.boundaryEvent",
      "bpmn.gateway",
    ].includes(item.type),
  );
  const data = records.filter(
    (item) => item.type === "bpmn.dataObject" || item.type === "bpmn.dataStore",
  );
  const artifacts = records.filter(
    (item) => item.type === "bpmn.textAnnotation" || item.type === "bpmn.group",
  );
  const hasParticipants = participants.length > 0;
  const processFor = new Map<string, Element[]>();
  for (const participant of participants) {
    if (semantic(participant)["collapsed"] === true) continue;
    processFor.set(
      participant.id,
      records.filter(
        (item) =>
          item.id !== participant.id &&
          semantic(item)["parent"] === participant.id &&
          !item.type.includes("Flow") &&
          item.type !== "bpmn.association" &&
          item.type !== "bpmn.dataAssociation",
      ),
    );
  }
  const parentOf = (item: Element): string | undefined =>
    typeof semantic(item)["parent"] === "string"
      ? (semantic(item)["parent"] as string)
      : undefined;
  const effectiveParent = (item: Element): string | undefined => {
    const attachedTo = semantic(item)["attachedTo"];
    if (item.type === "bpmn.boundaryEvent" && typeof attachedTo === "string") {
      const host = byId.get(attachedTo);
      if (host && host.type !== "bpmn.boundaryEvent") return parentOf(host);
    }
    return parentOf(item);
  };
  const ancestor = (item: Element, type: string): Element | undefined => {
    let parent = effectiveParent(item);
    const visited = new Set([item.id]);
    while (parent) {
      if (visited.has(parent)) return undefined;
      visited.add(parent);
      const record = byId.get(parent);
      if (!record) return undefined;
      if (record.type === type) return record;
      parent = effectiveParent(record);
    }
    return undefined;
  };
  const ownerParticipant = (item: Element): string | undefined =>
    ancestor(item, "bpmn.participant")?.id;
  const subprocessScope = (item: Element): string | undefined =>
    ancestor(item, "bpmn.subProcess")?.id;
  const collaborationArtifacts = hasParticipants
    ? artifacts.filter(
        (item) =>
          ownerParticipant(item) === undefined &&
          subprocessScope(item) === undefined,
      )
    : [];
  const associationOwner = (item: Element): string | undefined => {
    const from = byId.get(String(semantic(item)["from"]));
    const to = byId.get(String(semantic(item)["to"]));
    return (from && ownerParticipant(from)) || (to && ownerParticipant(to));
  };
  const belongsToProcess = (item: Element, participantId: string): boolean => {
    if (participantId === "orphan") return ownerParticipant(item) === undefined;
    if (!hasParticipants) return ownerParticipant(item) === undefined;
    return ownerParticipant(item) === participantId;
  };
  const processNodes = new Map<string, Element[]>();
  if (!hasParticipants)
    processNodes.set(
      "",
      records.filter((item) => {
        if (!flowNodes.includes(item)) return false;
        const parent = effectiveParent(item);
        return (
          (!parent || byId.get(parent)?.type === "bpmn.lane") &&
          subprocessScope(item) === undefined
        );
      }),
    );
  else {
    for (const participant of participants)
      processNodes.set(
        participant.id,
        records.filter((item) => {
          if (!flowNodes.includes(item)) return false;
          return (
            ownerParticipant(item) === participant.id &&
            subprocessScope(item) === undefined
          );
        }),
      );
    const orphan = flowNodes.filter(
      (item) =>
        ownerParticipant(item) === undefined &&
        subprocessScope(item) === undefined,
    );
    const orphanContent = data.some(
      (item) => ownerParticipant(item) === undefined && !parentOf(item),
    );
    if (orphan.length || orphanContent) {
      processNodes.set("orphan", orphan);
      warnings.push({
        message:
          "Pool-less elements were exported in an extra unreferenced process.",
      });
    }
    for (const participant of participants) {
      if (semantic(participant)["collapsed"] !== true) continue;
      const hiddenContent = records.filter(
        (item) =>
          item.id !== participant.id &&
          ownerParticipant(item) === participant.id,
      );
      if (hiddenContent.length)
        warnings.push({
          elementId: participant.id,
          message: "Content owned by a collapsed participant was not exported.",
        });
    }
  }
  const processId = (participantId: string): string => {
    if (participantId === "orphan") return `Process_orphan_${pageId}`;
    const participant = byId.get(participantId);
    const original = participant
      ? semantic(participant)["processRef"]
      : extension["processId"];
    if (typeof original === "string" && original.length > 0) return original;
    return `Process_${participantId || pageId}`;
  };
  return {
    pageId,
    extension,
    records,
    byId,
    idOf,
    participants,
    lanes,
    flows,
    flowNodes,
    data,
    artifacts,
    hasParticipants,
    parentOf,
    effectiveParent,
    collaborationArtifacts,
    associationOwner,
    ownerParticipant,
    subprocessScope,
    belongsToProcess,
    processNodes,
    processId,
  };
}
