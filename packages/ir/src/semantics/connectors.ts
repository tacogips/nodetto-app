// Generic node and edge payloads: arrowheads, prototype interactions and
// connector routing.

import type { ElementId } from "../types.ts";

export const ARROWHEADS = [
  "none",
  "arrow",
  "triangle",
  "dot",
  "open",
  "diamond",
  "diamond-open",
  "circle",
  "bar",
  "crow-foot",
] as const;
export type Arrowhead = (typeof ARROWHEADS)[number];

export interface GenericNodeSemantic {
  readonly label: string;
}

export interface Arrowheads {
  readonly start?: Arrowhead;
  readonly end?: Arrowhead;
}

export const PROTOTYPE_TRANSITIONS = [
  "instant",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "smart",
] as const;
export type PrototypeTransition = (typeof PROTOTYPE_TRANSITIONS)[number];

export const PROTOTYPE_TRIGGERS = [
  "click",
  "hover",
  "press",
  "after-delay",
] as const;
export type PrototypeTrigger = (typeof PROTOTYPE_TRIGGERS)[number];

export const PROTOTYPE_ACTIONS = [
  "navigate",
  "change-to",
  "open-overlay",
  "close-overlay",
] as const;
export type PrototypeAction = (typeof PROTOTYPE_ACTIONS)[number];

export const PROTOTYPE_OVERLAY_POSITIONS = [
  "center",
  "top-left",
  "bottom-center",
  "manual",
] as const;
export type PrototypeOverlayPosition =
  (typeof PROTOTYPE_OVERLAY_POSITIONS)[number];

export const PROTOTYPE_OVERFLOWS = [
  "none",
  "vertical",
  "horizontal",
  "both",
] as const;
export type PrototypeOverflow = (typeof PROTOTYPE_OVERFLOWS)[number];

export const CONNECTOR_ROUTINGS = ["straight", "orthogonal", "manual"] as const;
export type ConnectorRouting = (typeof CONNECTOR_ROUTINGS)[number];
export const MAX_CONNECTOR_WAYPOINTS = 32;
export const CONNECTOR_ROUTING_AXES = [
  "auto",
  "horizontal",
  "vertical",
] as const;
export type ConnectorRoutingAxis = (typeof CONNECTOR_ROUTING_AXES)[number];

/** A point in the endpoint-centre basis: normalized along, page units across. */
export interface ConnectorWaypoint {
  readonly u: number;
  readonly v: number;
}

export const CONNECTOR_PORTS = ["top", "right", "bottom", "left"] as const;
export type ConnectorPort = (typeof CONNECTOR_PORTS)[number];
export interface ConnectorPorts {
  readonly fromPort?: ConnectorPort;
  readonly toPort?: ConnectorPort;
}

export interface ConnectorRoutingSemantic extends ConnectorPorts {
  readonly routing?: ConnectorRouting;
  readonly routingAxis?: ConnectorRoutingAxis;
  /** Position of the middle channel between endpoints; 0–1, default 0.5. */
  readonly routingBend?: number;
  /** Route around visible layers on the connector's page; default true. */
  readonly routingAvoidObstacles?: boolean;
  /** User-authored points for manual routes, stable as endpoints move together. */
  readonly routingWaypoints?: readonly ConnectorWaypoint[];
}

export interface GenericEdgeSemantic extends ConnectorRoutingSemantic {
  readonly from?: ElementId;
  readonly to?: ElementId;
  /** Page-space positions only for endpoints detached from shapes. */
  readonly fromPoint?: { readonly x: number; readonly y: number };
  readonly toPoint?: { readonly x: number; readonly y: number };
  readonly label?: string;
  readonly arrowheads?: Arrowheads;
  readonly prototype?: boolean;
  readonly prototypeAction?: PrototypeAction;
  readonly prototypeTrigger?: PrototypeTrigger;
  readonly prototypeDelay?: number;
  readonly prototypeTransition?: PrototypeTransition;
  readonly prototypeDuration?: number;
  readonly prototypeOverlayPosition?: PrototypeOverlayPosition;
  readonly prototypeOverlayX?: number;
  readonly prototypeOverlayY?: number;
  readonly prototypeOverlayBackdrop?: boolean;
  readonly prototypeOverlayDismiss?: boolean;
}
