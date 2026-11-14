// BPMN process element payloads.

import type { ElementId } from "../types.ts";
import type { ConnectorRoutingSemantic } from "./connectors.ts";

export const BPMN_TASK_TYPES = [
  "none",
  "user",
  "service",
  "manual",
  "send",
  "receive",
  "script",
  "businessRule",
] as const;
export type BpmnTaskType = (typeof BPMN_TASK_TYPES)[number];
export const BPMN_LOOP_TYPES = [
  "none",
  "standard",
  "parallelMultiInstance",
  "sequentialMultiInstance",
] as const;
export type BpmnLoopType = (typeof BPMN_LOOP_TYPES)[number];
export const BPMN_EVENT_POSITIONS = [
  "start",
  "intermediateCatch",
  "intermediateThrow",
  "end",
] as const;
export type BpmnEventPosition = (typeof BPMN_EVENT_POSITIONS)[number];
export const BPMN_EVENT_DEFINITION_KINDS = [
  "message",
  "timer",
  "error",
  "escalation",
  "cancel",
  "compensation",
  "conditional",
  "link",
  "signal",
  "terminate",
] as const;
export type BpmnEventDefinitionKind =
  (typeof BPMN_EVENT_DEFINITION_KINDS)[number];
export const BPMN_TIMER_TYPES = ["date", "duration", "cycle"] as const;
export type BpmnTimerType = (typeof BPMN_TIMER_TYPES)[number];
export const BPMN_GATEWAY_TYPES = [
  "exclusive",
  "parallel",
  "inclusive",
  "eventBased",
  "complex",
] as const;
export type BpmnGatewayType = (typeof BPMN_GATEWAY_TYPES)[number];
export const BPMN_DATA_OBJECT_ROLES = ["reference", "input", "output"] as const;
export type BpmnDataObjectRole = (typeof BPMN_DATA_OBJECT_ROLES)[number];
export const BPMN_ASSOCIATION_DIRECTIONS = ["none", "one", "both"] as const;
export type BpmnAssociationDirection =
  (typeof BPMN_ASSOCIATION_DIRECTIONS)[number];

export interface BpmnEventDefinition {
  readonly id: string;
  readonly kind: BpmnEventDefinitionKind;
  readonly ref?: string;
  readonly linkName?: string;
  readonly timer?: { readonly type: BpmnTimerType; readonly value: string };
  readonly condition?: string;
}
export interface BpmnParticipantSemantic {
  readonly name?: string;
  readonly collapsed: boolean;
  readonly processRef?: string;
}
export interface BpmnLaneSemantic {
  readonly name?: string;
  readonly parent: ElementId;
}
export interface BpmnTaskSemantic {
  readonly name?: string;
  readonly taskType: BpmnTaskType;
  readonly loop: BpmnLoopType;
  readonly forCompensation?: boolean;
  readonly parent?: ElementId;
}
export interface BpmnSubProcessSemantic {
  readonly name?: string;
  readonly expanded: boolean;
  readonly triggeredByEvent: boolean;
  readonly adHoc: boolean;
  readonly loop: BpmnLoopType;
  readonly forCompensation?: boolean;
  readonly parent?: ElementId;
}
export interface BpmnCallActivitySemantic {
  readonly name?: string;
  readonly calledElement?: string;
  readonly loop: BpmnLoopType;
  readonly forCompensation?: boolean;
  readonly parent?: ElementId;
}
export interface BpmnEventSemantic {
  readonly name?: string;
  readonly position: BpmnEventPosition;
  readonly definitions: readonly BpmnEventDefinition[];
  readonly interrupting?: boolean;
  readonly parallelMultiple?: boolean;
  readonly parent?: ElementId;
}
export interface BpmnBoundaryEventSemantic {
  readonly parent?: ElementId;
  readonly name?: string;
  readonly attachedTo: ElementId;
  readonly cancelActivity: boolean;
  readonly definitions: readonly BpmnEventDefinition[];
}
export interface BpmnGatewaySemantic {
  readonly gatewayDirection?: string;
  readonly name?: string;
  readonly gatewayType: BpmnGatewayType;
  readonly markerVisible?: boolean;
  readonly parent?: ElementId;
}
export interface BpmnDataObjectSemantic {
  readonly name?: string;
  readonly role: BpmnDataObjectRole;
  readonly collection: boolean;
  readonly parent?: ElementId;
}
export interface BpmnDataStoreSemantic {
  readonly name?: string;
  readonly parent?: ElementId;
}
export interface BpmnTextAnnotationSemantic {
  readonly text: string;
  readonly parent?: ElementId;
}
export interface BpmnGroupSemantic {
  readonly parent?: ElementId;
  readonly name?: string;
}
export interface BpmnSequenceFlowSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly name?: string;
  readonly condition?: string;
  readonly isDefault?: boolean;
}
export interface BpmnMessageFlowSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly name?: string;
  readonly messageRef?: string;
}
export interface BpmnAssociationSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly direction: BpmnAssociationDirection;
}
export interface BpmnDataAssociationSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
}

export const BPMN_ELEMENT_TYPES = [
  "bpmn.participant",
  "bpmn.lane",
  "bpmn.task",
  "bpmn.subProcess",
  "bpmn.callActivity",
  "bpmn.event",
  "bpmn.boundaryEvent",
  "bpmn.gateway",
  "bpmn.dataObject",
  "bpmn.dataStore",
  "bpmn.textAnnotation",
  "bpmn.group",
  "bpmn.sequenceFlow",
  "bpmn.messageFlow",
  "bpmn.association",
  "bpmn.dataAssociation",
] as const;
export function isBpmnElementType(type: string): boolean {
  return (BPMN_ELEMENT_TYPES as readonly string[]).includes(type);
}
