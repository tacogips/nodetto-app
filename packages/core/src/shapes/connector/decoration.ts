// Per-type connector notation: which markers, which label, which dash.

import {
  type Element,
  stateTransitionLabel,
  UmlComponentRelationship,
  UmlComponentType,
} from "@nodetto/ir";
import type { MarkerKind } from "./markers.ts";

export interface ConnectorDecoration {
  readonly start: MarkerKind | null;
  readonly end: MarkerKind | null;
  readonly label: string;
}

function arrowheadMarker(head: unknown): MarkerKind | null {
  switch (head) {
    case "arrow":
      return "arrow";
    case "triangle":
      return "triangle";
    case "dot":
      return "dot";
    case "open":
      return "openArrow";
    case "diamond":
      return "diamondFilled";
    case "diamond-open":
      return "diamondOpen";
    case "circle":
      return "circle";
    case "bar":
      return "bar";
    case "crow-foot":
      return "crowFoot";
    default:
      return null;
  }
}

function readField(source: unknown, field: string): unknown {
  if (typeof source !== "object" || source === null) {
    return undefined;
  }
  return (source as Record<string, unknown>)[field];
}

function readString(source: unknown, field: string): string | undefined {
  const value = readField(source, field);
  return typeof value === "string" ? value : undefined;
}

/**
 * Markers and label text for one connector.
 *
 * The notation is per element type: an ERD relation gets a dot at each end
 * and shows its cardinality when it has no label of its own, a UML
 * association's kind picks the classic inheritance triangle or aggregation
 * diamond, and everything else reads `arrowheads` off the payload with a
 * plain arrow at the far end as the default.
 */
export function connectorDecoration(element: Element): ConnectorDecoration {
  if (
    element.type === "bpmn.sequenceFlow" ||
    element.type === "bpmn.messageFlow" ||
    element.type === "bpmn.association" ||
    element.type === "bpmn.dataAssociation"
  ) {
    return { start: null, end: null, label: "" };
  }
  const semantic = element.semantic;
  if (element.type === "state.transition") {
    return {
      start: null,
      end: "arrow",
      label: stateTransitionLabel(
        semantic as import("@nodetto/ir").StateTransitionSemantic,
      ),
    };
  }
  if (element.type === "erd.relation") {
    return {
      start: "dot",
      end: "dot",
      label:
        readString(semantic, "label") ??
        readString(semantic, "cardinality") ??
        "",
    };
  }
  if (element.type === UmlComponentType.Relationship) {
    const kind = readString(semantic, "kind");
    return {
      start: null,
      end:
        kind === UmlComponentRelationship.Realization
          ? "triangle"
          : kind === UmlComponentRelationship.Dependency
            ? "arrow"
            : null,
      label: readString(semantic, "label") ?? "",
    };
  }
  if (element.type === "uml.association") {
    const label = readString(semantic, "label") ?? "";
    switch (readString(semantic, "kind")) {
      case "inherit":
        return { start: null, end: "triangle", label: "" };
      case "aggregate":
        return { start: "diamondOpen", end: null, label };
      case "compose":
        return { start: "diamondFilled", end: null, label };
      default:
        return { start: null, end: null, label };
    }
  }
  if (element.type === "sequence.message") {
    return {
      start: null,
      end: "arrow",
      label: readString(semantic, "label") ?? "",
    };
  }
  if (
    element.type === "edge.generic" &&
    readField(semantic, "prototype") === true
  ) {
    const action = readString(semantic, "prototypeAction") ?? "navigate";
    const trigger = readString(semantic, "prototypeTrigger") ?? "click";
    const animation = readString(semantic, "prototypeTransition") ?? "instant";
    return {
      start: "dot",
      end: "arrow",
      label: [
        readString(semantic, "label"),
        `${trigger} → ${action} · ${animation}`,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }
  const arrowheads = readField(semantic, "arrowheads");
  return {
    start: arrowheadMarker(readField(arrowheads, "start")),
    end: arrowheadMarker(readField(arrowheads, "end") ?? "arrow"),
    label: readString(semantic, "label") ?? "",
  };
}

/** Semantic default line pattern; explicit visual styling may override it. */
export function connectorDefaultDash(element: Element): string | undefined {
  if (element.type === "bpmn.messageFlow") return "6 4";
  if (
    element.type === "bpmn.association" ||
    element.type === "bpmn.dataAssociation"
  )
    return "1 4";
  if (
    element.type === UmlComponentType.Relationship &&
    readString(element.semantic, "kind") !== UmlComponentRelationship.Connector
  )
    return "6 4";
  if (
    element.type === "sequence.message" &&
    readString(element.semantic, "kind") === "return"
  )
    return "6 4";
  // A logical ERD reference is not a database constraint; dash it so it
  // reads differently from an enforced foreign key.
  if (
    element.type === "erd.relation" &&
    readField(element.semantic, "logical") === true
  )
    return "6 4";
  return undefined;
}
