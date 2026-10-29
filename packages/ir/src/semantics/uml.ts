// UML class, component and association payloads, sequence diagram
// payloads, state machine payloads, and use-case diagram payloads.

import type { ElementId, FractionalIndex } from "../types.ts";
import type { ConnectorRoutingSemantic } from "./connectors.ts";

export const UML_VISIBILITIES = ["+", "-", "#", "~"] as const;
export type UmlVisibility = (typeof UML_VISIBILITIES)[number];

export const UML_ASSOCIATION_KINDS = [
  "assoc",
  "aggregate",
  "compose",
  "inherit",
] as const;
export type UmlAssociationKind = (typeof UML_ASSOCIATION_KINDS)[number];

export const PARTICIPANT_KINDS = ["actor", "service", "db"] as const;
export type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];

export const MESSAGE_KINDS = ["sync", "async", "return"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export interface UmlAttribute {
  readonly id: string;
  readonly name: string;
  readonly type?: string;
  readonly visibility?: UmlVisibility;
  readonly static?: boolean;
}

export interface UmlParameter {
  readonly name: string;
  readonly type?: string;
}

export interface UmlMethod {
  readonly id: string;
  readonly name: string;
  readonly parameters?: readonly UmlParameter[];
  readonly returnType?: string;
  readonly visibility?: UmlVisibility;
  readonly static?: boolean;
  readonly abstract?: boolean;
}

export interface UmlClassSemantic {
  readonly name: string;
  readonly stereotype?: string;
  readonly attributes: readonly UmlAttribute[];
  readonly methods: readonly UmlMethod[];
}

/** UML component notation is separate from class associations and UI components. */
export const UmlComponentType = {
  Component: "uml.component",
  Interface: "uml.interface",
  Port: "uml.port",
  Relationship: "uml.component-relationship",
} as const;
export const UmlComponentRelationship = {
  Connector: "connector",
  Dependency: "dependency",
  Realization: "realization",
} as const;
export type UmlComponentRelationshipKind =
  (typeof UmlComponentRelationship)[keyof typeof UmlComponentRelationship];
export const UML_INTERFACE_KINDS = ["provided", "required"] as const;
export type UmlInterfaceKind = (typeof UML_INTERFACE_KINDS)[number];
export const UML_PORT_SIDES = ["top", "right", "bottom", "left"] as const;
export type UmlPortSide = (typeof UML_PORT_SIDES)[number];
export interface UmlComponentSemantic {
  readonly name: string;
}
export interface UmlInterfaceSemantic {
  readonly name: string;
  readonly kind: UmlInterfaceKind;
}
export interface UmlPortSemantic {
  readonly name: string;
  readonly owner: ElementId;
  readonly side: UmlPortSide;
  /** Normalized location along the component boundary. */
  readonly offset: number;
}
export interface UmlComponentRelationshipSemantic
  extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly kind: UmlComponentRelationshipKind;
  readonly label?: string;
}

export interface UmlCardinalities {
  readonly from?: string;
  readonly to?: string;
}

export interface UmlAssociationSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly kind: UmlAssociationKind;
  readonly cardinalities?: UmlCardinalities;
  readonly label?: string;
}

export interface SequenceParticipantSemantic {
  readonly name: string;
  readonly kind: ParticipantKind;
  /** Fractional key; maps to the X axis. Never a pixel coordinate. */
  readonly order: FractionalIndex;
}

export interface SequenceMessageSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  /** Fractional key; maps to the Y axis. Never a pixel coordinate. */
  readonly order: FractionalIndex;
  readonly label?: string;
  readonly kind: MessageKind;
}

export interface SequenceActivationSemantic {
  readonly participant: ElementId;
  readonly fromOrder: FractionalIndex;
  readonly toOrder: FractionalIndex;
}

export const STATE_NODE_KINDS = [
  "state",
  "initial",
  "final",
  "choice",
] as const;
export type StateNodeKind = (typeof STATE_NODE_KINDS)[number];
export interface StateNodeSemantic {
  readonly name: string;
  readonly kind: StateNodeKind;
}
export interface StateTransitionSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly trigger?: string;
  readonly guard?: string;
  readonly effect?: string;
}

export const USECASE_NODE_KINDS = ["actor", "usecase", "system"] as const;
export type UseCaseNodeKind = (typeof USECASE_NODE_KINDS)[number];
export interface UseCaseNodeSemantic {
  readonly name: string;
  readonly kind: UseCaseNodeKind;
}
export const USECASE_RELATIONSHIP_KINDS = [
  "association",
  "include",
  "extend",
  "generalization",
] as const;
export type UseCaseRelationshipKind =
  (typeof USECASE_RELATIONSHIP_KINDS)[number];
export interface UseCaseRelationshipSemantic extends ConnectorRoutingSemantic {
  readonly from: ElementId;
  readonly to: ElementId;
  readonly kind: UseCaseRelationshipKind;
  readonly label?: string;
}
