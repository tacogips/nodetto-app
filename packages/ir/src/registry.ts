import { uiControlDefinition } from "./ui-controls.ts";
import { databaseObjectDefinitions } from "./database-objects.ts";
// Element type registry (v1). See the product design, section 5.2.
//
// Each entry owns three things for its element type:
//   - semantic payload validation,
//   - the outgoing element references (so deletes can cascade or detach),
//   - the declared key order used for deterministic serialization.
//
// Renderers and ShapeUtils live in `core`/`ui-solid`; nothing here touches
// the DOM or any framework.
//
// The definitions themselves live per element family under `registry/`;
// this module assembles them in registration order.

import { GENERIC_NODE, GENERIC_EDGE } from "./registry/generic.ts";
import { ERD_TABLE, ERD_RELATION } from "./registry/erd.ts";
import {
  UML_CLASS,
  UML_ASSOCIATION,
  UML_COMPONENT_TYPES,
  SEQUENCE_PARTICIPANT,
  SEQUENCE_MESSAGE,
  SEQUENCE_ACTIVATION,
  STATE_NODE,
  STATE_TRANSITION,
  USECASE_NODE,
  USECASE_RELATIONSHIP,
} from "./registry/uml.ts";
import {
  DRAW_FREEHAND,
  DRAW_PATH,
  SHAPE_GEO,
  TEXT_NOTE,
  REVIEW_COMMENT,
  TEXT_STYLE,
} from "./registry/drawing.ts";
import { FRAME, GROUP } from "./registry/containers.ts";
import {
  BPMN_PARTICIPANT,
  BPMN_LANE,
  BPMN_TASK,
  BPMN_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
  BPMN_EVENT,
  BPMN_BOUNDARY_EVENT,
  BPMN_GATEWAY,
  BPMN_DATA_OBJECT,
  BPMN_DATA_STORE,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
  BPMN_SEQUENCE_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
} from "./registry/bpmn.ts";
import { BREADBOARD_DEFINITIONS } from "./registry/breadboard.ts";
import { PCB_DEFINITIONS } from "./registry/pcb.ts";
import {
  DESIGN_GUIDE,
  DESIGN_TOKEN,
  IMAGE_RASTER,
} from "./registry/resources.ts";
import type { ElementTypeDefinition } from "./registry/definition.ts";
import type { ElementType } from "./semantics.ts";

export type {
  ElementCategory,
  ElementReference,
  ElementTypeDefinition,
  ReferencePolicy,
} from "./registry/definition.ts";

const DEFINITIONS: readonly ElementTypeDefinition[] = [
  ...BREADBOARD_DEFINITIONS,
  ...PCB_DEFINITIONS,
  DESIGN_GUIDE,
  DESIGN_TOKEN,
  IMAGE_RASTER,
  GENERIC_NODE,
  GENERIC_EDGE,
  ERD_TABLE,
  uiControlDefinition,
  ...databaseObjectDefinitions,
  ERD_RELATION,
  UML_CLASS,
  UML_ASSOCIATION,
  ...UML_COMPONENT_TYPES,
  STATE_NODE,
  STATE_TRANSITION,
  USECASE_NODE,
  USECASE_RELATIONSHIP,
  SEQUENCE_PARTICIPANT,
  SEQUENCE_MESSAGE,
  SEQUENCE_ACTIVATION,
  DRAW_FREEHAND,
  DRAW_PATH,
  SHAPE_GEO,
  TEXT_NOTE,
  REVIEW_COMMENT,
  TEXT_STYLE,
  FRAME,
  GROUP,
  BPMN_PARTICIPANT,
  BPMN_LANE,
  BPMN_TASK,
  BPMN_SUB_PROCESS,
  BPMN_CALL_ACTIVITY,
  BPMN_EVENT,
  BPMN_BOUNDARY_EVENT,
  BPMN_GATEWAY,
  BPMN_DATA_OBJECT,
  BPMN_DATA_STORE,
  BPMN_TEXT_ANNOTATION,
  BPMN_GROUP,
  BPMN_SEQUENCE_FLOW,
  BPMN_MESSAGE_FLOW,
  BPMN_ASSOCIATION,
  BPMN_DATA_ASSOCIATION,
];

const BY_TYPE: ReadonlyMap<string, ElementTypeDefinition> = new Map(
  DEFINITIONS.map((definition) => [definition.type, definition]),
);

/** All registered element types, in registry declaration order. */
export const ELEMENT_TYPES: readonly ElementType[] = DEFINITIONS.map(
  (definition) => definition.type,
);

export function getElementTypeDefinition(
  type: string,
): ElementTypeDefinition | undefined {
  return BY_TYPE.get(type);
}

export function isKnownElementType(type: string): type is ElementType {
  return BY_TYPE.has(type);
}

export function listElementTypeDefinitions(): readonly ElementTypeDefinition[] {
  return DEFINITIONS;
}
