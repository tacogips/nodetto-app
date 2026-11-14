// BPMN process element definitions.

import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  BPMN_ASSOCIATION_DIRECTIONS,
  BPMN_DATA_OBJECT_ROLES,
  BPMN_EVENT_DEFINITION_KINDS,
  BPMN_EVENT_POSITIONS,
  BPMN_GATEWAY_TYPES,
  BPMN_LOOP_TYPES,
  BPMN_TASK_TYPES,
  BPMN_TIMER_TYPES,
  type ElementType,
} from "../semantics.ts";
import {
  refFields,
  type ElementCategory,
  type ElementTypeDefinition,
} from "./definition.ts";
import { validateConnectorRouting } from "./generic.ts";

function bpmnDefinition(
  type: ElementType,
  category: ElementCategory,
  keys: readonly string[],
  referenceFields: readonly string[],
  options: {
    readonly enums?: Readonly<Record<string, readonly string[]>>;
    readonly requiredStrings?: readonly string[];
    readonly optionalStrings?: readonly string[];
    readonly allowEmptyStrings?: readonly string[];
    readonly requiredBooleans?: readonly string[];
    readonly optionalBooleans?: readonly string[];
    readonly definitions?: boolean;
    readonly routing?: boolean;
  } = {},
): ElementTypeDefinition {
  return {
    type,
    category,
    keyOrder: {
      keys,
      ...(type.endsWith("Flow") ||
      type === "bpmn.association" ||
      type === "bpmn.dataAssociation"
        ? { children: { routingWaypoints: { keys: ["u", "v"] } } }
        : {}),
      ...(options.definitions
        ? {
            children: {
              definitions: {
                keys: ["id", "kind", "ref", "linkName", "timer", "condition"],
                children: { timer: { keys: ["type", "value"] } },
              },
            },
          }
        : {}),
    },
    onReferenceDeleted: "cascade",
    references: (semantic) => refFields(semantic, referenceFields),
    validateSemantic(semantic, path) {
      const out: ValidationIssue[] = [];
      if (!checkObject(out, semantic, path)) return out;
      for (const field of options.requiredStrings ?? [])
        checkString(out, semantic[field], `${path}.${field}`, {
          allowEmpty: options.allowEmptyStrings?.includes(field) ?? false,
        });
      for (const field of options.optionalStrings ?? [])
        checkString(out, semantic[field], `${path}.${field}`, {
          optional: true,
          allowEmpty: true,
        });
      for (const field of options.requiredBooleans ?? [])
        checkBoolean(out, semantic[field], `${path}.${field}`);
      for (const field of options.optionalBooleans ?? [])
        checkBoolean(out, semantic[field], `${path}.${field}`, {
          optional: true,
        });
      for (const [field, values] of Object.entries(options.enums ?? {}))
        checkEnum(out, semantic[field], `${path}.${field}`, values);
      if (options.definitions) {
        const definitions = semantic["definitions"];
        if (checkArray(out, definitions, `${path}.definitions`)) {
          const ids = new Set<string>();
          for (const [index, value] of definitions.entries()) {
            const at = `${path}.definitions[${index}]`;
            if (!checkObject(out, value, at)) continue;
            const id = value["id"];
            if (checkString(out, id, `${at}.id`) && typeof id === "string") {
              if (ids.has(id))
                out.push(
                  error(
                    "bpmn.definitionIdDuplicate",
                    `${at}.id`,
                    `duplicate event definition id "${id}"`,
                  ),
                );
              ids.add(id);
            }
            checkEnum(
              out,
              value["kind"],
              `${at}.kind`,
              BPMN_EVENT_DEFINITION_KINDS,
            );
            checkString(out, value["ref"], `${at}.ref`, {
              optional: true,
              allowEmpty: true,
            });
            checkString(out, value["linkName"], `${at}.linkName`, {
              optional: true,
              allowEmpty: true,
            });
            checkString(out, value["condition"], `${at}.condition`, {
              optional: true,
              allowEmpty: true,
            });
            if (
              value["timer"] !== undefined &&
              checkObject(out, value["timer"], `${at}.timer`)
            ) {
              checkEnum(
                out,
                value["timer"]["type"],
                `${at}.timer.type`,
                BPMN_TIMER_TYPES,
              );
              checkString(out, value["timer"]["value"], `${at}.timer.value`);
            }
          }
        }
      }
      if (options.routing) validateConnectorRouting(out, semantic, path);
      return out;
    },
  };
}

const BPMN_TYPES = {
  participant: { type: "bpmn.participant" },
  lane: { type: "bpmn.lane" },
  task: { type: "bpmn.task" },
  subProcess: { type: "bpmn.subProcess" },
  callActivity: { type: "bpmn.callActivity" },
  event: { type: "bpmn.event" },
  boundaryEvent: { type: "bpmn.boundaryEvent" },
  gateway: { type: "bpmn.gateway" },
  dataObject: { type: "bpmn.dataObject" },
  dataStore: { type: "bpmn.dataStore" },
  textAnnotation: { type: "bpmn.textAnnotation" },
  group: { type: "bpmn.group" },
  sequenceFlow: { type: "bpmn.sequenceFlow" },
  messageFlow: { type: "bpmn.messageFlow" },
  association: { type: "bpmn.association" },
  dataAssociation: { type: "bpmn.dataAssociation" },
} as const;

export const BPMN_PARTICIPANT = bpmnDefinition(
  BPMN_TYPES.participant.type,
  "container",
  ["name", "collapsed", "processRef"],
  [],
  { optionalStrings: ["name", "processRef"], requiredBooleans: ["collapsed"] },
);
export const BPMN_LANE = bpmnDefinition(
  BPMN_TYPES.lane.type,
  "container",
  ["name", "parent"],
  ["parent"],
  { optionalStrings: ["name"], requiredStrings: ["parent"] },
);
export const BPMN_TASK = bpmnDefinition(
  BPMN_TYPES.task.type,
  "node",
  ["name", "taskType", "loop", "forCompensation", "parent"],
  ["parent"],
  {
    optionalStrings: ["name"],
    requiredBooleans: [],
    optionalBooleans: ["forCompensation"],
    enums: { taskType: BPMN_TASK_TYPES, loop: BPMN_LOOP_TYPES },
  },
);
export const BPMN_SUB_PROCESS = bpmnDefinition(
  BPMN_TYPES.subProcess.type,
  "container",
  [
    "name",
    "expanded",
    "triggeredByEvent",
    "adHoc",
    "loop",
    "forCompensation",
    "parent",
  ],
  ["parent"],
  {
    optionalStrings: ["name"],
    requiredBooleans: ["expanded", "triggeredByEvent", "adHoc"],
    optionalBooleans: ["forCompensation"],
    enums: { loop: BPMN_LOOP_TYPES },
  },
);
export const BPMN_CALL_ACTIVITY = bpmnDefinition(
  BPMN_TYPES.callActivity.type,
  "node",
  ["name", "calledElement", "loop", "forCompensation", "parent"],
  ["parent"],
  {
    optionalStrings: ["name", "calledElement"],
    optionalBooleans: ["forCompensation"],
    enums: { loop: BPMN_LOOP_TYPES },
  },
);
export const BPMN_EVENT = bpmnDefinition(
  BPMN_TYPES.event.type,
  "node",
  [
    "name",
    "position",
    "definitions",
    "interrupting",
    "parallelMultiple",
    "parent",
  ],
  ["parent"],
  {
    optionalStrings: ["name"],
    optionalBooleans: ["interrupting", "parallelMultiple"],
    enums: { position: BPMN_EVENT_POSITIONS },
    definitions: true,
  },
);
export const BPMN_BOUNDARY_EVENT = bpmnDefinition(
  BPMN_TYPES.boundaryEvent.type,
  "node",
  ["name", "attachedTo", "cancelActivity", "definitions"],
  ["attachedTo"],
  {
    optionalStrings: ["name"],
    requiredStrings: ["attachedTo"],
    requiredBooleans: ["cancelActivity"],
    definitions: true,
  },
);
export const BPMN_GATEWAY = bpmnDefinition(
  BPMN_TYPES.gateway.type,
  "node",
  ["name", "gatewayType", "markerVisible", "parent"],
  ["parent"],
  {
    optionalStrings: ["name"],
    optionalBooleans: ["markerVisible"],
    enums: { gatewayType: BPMN_GATEWAY_TYPES },
  },
);
export const BPMN_DATA_OBJECT = bpmnDefinition(
  BPMN_TYPES.dataObject.type,
  "node",
  ["name", "role", "collection", "parent"],
  ["parent"],
  {
    optionalStrings: ["name"],
    requiredBooleans: ["collection"],
    enums: { role: BPMN_DATA_OBJECT_ROLES },
  },
);
export const BPMN_DATA_STORE = bpmnDefinition(
  BPMN_TYPES.dataStore.type,
  "node",
  ["name", "parent"],
  ["parent"],
  { optionalStrings: ["name"] },
);
export const BPMN_TEXT_ANNOTATION = bpmnDefinition(
  BPMN_TYPES.textAnnotation.type,
  "annotation",
  ["text", "parent"],
  ["parent"],
  { requiredStrings: ["text"], allowEmptyStrings: ["text"] },
);
export const BPMN_GROUP = bpmnDefinition(
  BPMN_TYPES.group.type,
  "annotation",
  ["name"],
  [],
  {
    optionalStrings: ["name"],
  },
);
export const BPMN_SEQUENCE_FLOW = bpmnDefinition(
  BPMN_TYPES.sequenceFlow.type,
  "edge",
  [
    "from",
    "to",
    "name",
    "condition",
    "isDefault",
    "messageRef",
    "direction",
    "routing",
    "routingAxis",
    "routingBend",
    "routingAvoidObstacles",
    "routingWaypoints",
    "fromPort",
    "toPort",
  ],
  ["from", "to"],
  {
    requiredStrings: ["from", "to"],
    optionalStrings: ["name", "condition"],
    optionalBooleans: ["isDefault"],
    routing: true,
  },
);
export const BPMN_MESSAGE_FLOW = bpmnDefinition(
  BPMN_TYPES.messageFlow.type,
  "edge",
  [
    "from",
    "to",
    "name",
    "condition",
    "isDefault",
    "messageRef",
    "direction",
    "routing",
    "routingAxis",
    "routingBend",
    "routingAvoidObstacles",
    "routingWaypoints",
    "fromPort",
    "toPort",
  ],
  ["from", "to"],
  {
    requiredStrings: ["from", "to"],
    optionalStrings: ["name", "messageRef"],
    routing: true,
  },
);
export const BPMN_ASSOCIATION = bpmnDefinition(
  BPMN_TYPES.association.type,
  "edge",
  [
    "from",
    "to",
    "name",
    "condition",
    "isDefault",
    "messageRef",
    "direction",
    "routing",
    "routingAxis",
    "routingBend",
    "routingAvoidObstacles",
    "routingWaypoints",
    "fromPort",
    "toPort",
  ],
  ["from", "to"],
  {
    requiredStrings: ["from", "to"],
    enums: { direction: BPMN_ASSOCIATION_DIRECTIONS },
    routing: true,
  },
);
export const BPMN_DATA_ASSOCIATION = bpmnDefinition(
  BPMN_TYPES.dataAssociation.type,
  "edge",
  [
    "from",
    "to",
    "name",
    "condition",
    "isDefault",
    "messageRef",
    "direction",
    "routing",
    "routingAxis",
    "routingBend",
    "routingAvoidObstacles",
    "routingWaypoints",
    "fromPort",
    "toPort",
  ],
  ["from", "to"],
  { requiredStrings: ["from", "to"], routing: true },
);
