// UML class, association and component definitions, sequence diagram
// elements, state machine nodes and transitions, and use-case diagram
// nodes and relationships.

import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkFractionalIndex,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  STATE_NODE_KINDS,
  MESSAGE_KINDS,
  PARTICIPANT_KINDS,
  UML_ASSOCIATION_KINDS,
  UmlComponentType,
  UmlComponentRelationship,
  UML_INTERFACE_KINDS,
  UML_PORT_SIDES,
  UML_VISIBILITIES,
  USECASE_NODE_KINDS,
  USECASE_RELATIONSHIP_KINDS,
} from "../semantics.ts";
import {
  noReferences,
  refFields,
  type ElementTypeDefinition,
} from "./definition.ts";
import { validateConnectorRouting } from "./generic.ts";

export const UML_CLASS: ElementTypeDefinition = {
  type: "uml.class",
  category: "node",
  keyOrder: {
    keys: ["name", "stereotype", "attributes", "methods"],
    children: {
      attributes: {
        keys: ["id", "name", "type", "visibility", "static"],
      },
      methods: {
        keys: [
          "id",
          "name",
          "parameters",
          "returnType",
          "visibility",
          "static",
          "abstract",
        ],
        children: { parameters: { keys: ["name", "type"] } },
      },
    },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    checkString(out, semantic["name"], `${path}.name`);
    checkString(out, semantic["stereotype"], `${path}.stereotype`, {
      optional: true,
    });

    const attributes = semantic["attributes"];
    if (checkArray(out, attributes, `${path}.attributes`)) {
      for (const [i, attribute] of attributes.entries()) {
        const at = `${path}.attributes[${i}]`;
        if (!checkObject(out, attribute, at)) {
          continue;
        }
        checkString(out, attribute["id"], `${at}.id`);
        checkString(out, attribute["name"], `${at}.name`);
        checkString(out, attribute["type"], `${at}.type`, {
          optional: true,
        });
        checkEnum(
          out,
          attribute["visibility"],
          `${at}.visibility`,
          UML_VISIBILITIES,
          { optional: true },
        );
        checkBoolean(out, attribute["static"], `${at}.static`, {
          optional: true,
        });
      }
    }

    const methods = semantic["methods"];
    if (checkArray(out, methods, `${path}.methods`)) {
      for (const [i, method] of methods.entries()) {
        const at = `${path}.methods[${i}]`;
        if (!checkObject(out, method, at)) {
          continue;
        }
        checkString(out, method["id"], `${at}.id`);
        checkString(out, method["name"], `${at}.name`);
        checkString(out, method["returnType"], `${at}.returnType`, {
          optional: true,
        });
        checkEnum(
          out,
          method["visibility"],
          `${at}.visibility`,
          UML_VISIBILITIES,
          { optional: true },
        );
        checkBoolean(out, method["static"], `${at}.static`, {
          optional: true,
        });
        checkBoolean(out, method["abstract"], `${at}.abstract`, {
          optional: true,
        });
        const parameters = method["parameters"];
        if (
          parameters !== undefined &&
          checkArray(out, parameters, `${at}.parameters`)
        ) {
          for (const [j, parameter] of parameters.entries()) {
            const paramAt = `${at}.parameters[${j}]`;
            if (!checkObject(out, parameter, paramAt)) {
              continue;
            }
            checkString(out, parameter["name"], `${paramAt}.name`);
            checkString(out, parameter["type"], `${paramAt}.type`, {
              optional: true,
            });
          }
        }
      }
    }
    return out;
  },
};

export const UML_ASSOCIATION: ElementTypeDefinition = {
  type: "uml.association",
  category: "edge",
  keyOrder: {
    keys: [
      "from",
      "to",
      "kind",
      "cardinalities",
      "label",
      "routing",
      "routingAxis",
      "routingBend",
      "routingAvoidObstacles",
      "routingWaypoints",
      "fromPort",
      "toPort",
    ],
    children: {
      cardinalities: { keys: ["from", "to"] },
      routingWaypoints: { keys: ["u", "v"] },
    },
  },
  onReferenceDeleted: "cascade",
  references: (semantic) => refFields(semantic, ["from", "to"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    checkString(out, semantic["from"], `${path}.from`);
    checkString(out, semantic["to"], `${path}.to`);
    checkEnum(out, semantic["kind"], `${path}.kind`, UML_ASSOCIATION_KINDS);
    const cardinalities = semantic["cardinalities"];
    if (
      cardinalities !== undefined &&
      checkObject(out, cardinalities, `${path}.cardinalities`)
    ) {
      checkString(out, cardinalities["from"], `${path}.cardinalities.from`, {
        optional: true,
      });
      checkString(out, cardinalities["to"], `${path}.cardinalities.to`, {
        optional: true,
      });
    }
    checkString(out, semantic["label"], `${path}.label`, {
      optional: true,
      allowEmpty: true,
    });
    validateConnectorRouting(out, semantic, path);
    return out;
  },
};

export const UML_COMPONENT_TYPES: readonly ElementTypeDefinition[] = [
  ...[
    UmlComponentType.Component,
    UmlComponentType.Interface,
    UmlComponentType.Port,
  ].map(
    (type): ElementTypeDefinition => ({
      type,
      category: "node",
      keyOrder: {
        keys:
          type === UmlComponentType.Interface
            ? ["name", "kind", "owner", "side", "offset"]
            : ["name", "owner", "side", "offset"],
      },
      onReferenceDeleted: "cascade",
      references: (semantic) =>
        type === UmlComponentType.Port ? refFields(semantic, ["owner"]) : [],
      validateSemantic(semantic, path) {
        const out: ValidationIssue[] = [];
        if (!checkObject(out, semantic, path)) return out;
        checkString(out, semantic["name"], `${path}.name`, {
          allowEmpty: true,
        });
        if (type === UmlComponentType.Interface)
          checkEnum(out, semantic["kind"], `${path}.kind`, UML_INTERFACE_KINDS);
        if (type === UmlComponentType.Port) {
          checkString(out, semantic["owner"], `${path}.owner`);
          checkEnum(out, semantic["side"], `${path}.side`, UML_PORT_SIDES);
          checkNumber(out, semantic["offset"], `${path}.offset`, { min: 0 });
          if (typeof semantic["offset"] === "number" && semantic["offset"] > 1)
            out.push(
              error(
                "uml.port.offset",
                `${path}.offset`,
                "offset must be at most 1",
              ),
            );
        }
        return out;
      },
    }),
  ),
  {
    type: UmlComponentType.Relationship,
    category: "edge",
    keyOrder: {
      keys: [
        "from",
        "to",
        "kind",
        "label",
        "routing",
        "routingAxis",
        "routingBend",
        "routingAvoidObstacles",
        "routingWaypoints",
        "fromPort",
        "toPort",
      ],
      children: { routingWaypoints: { keys: ["u", "v"] } },
    },
    onReferenceDeleted: "cascade",
    references: (semantic) => refFields(semantic, ["from", "to"]),
    validateSemantic(semantic, path) {
      const out: ValidationIssue[] = [];
      if (!checkObject(out, semantic, path)) return out;
      checkString(out, semantic["from"], `${path}.from`);
      checkString(out, semantic["to"], `${path}.to`);
      checkEnum(
        out,
        semantic["kind"],
        `${path}.kind`,
        Object.values(UmlComponentRelationship),
      );
      checkString(out, semantic["label"], `${path}.label`, {
        optional: true,
        allowEmpty: true,
      });
      validateConnectorRouting(out, semantic, path);
      return out;
    },
  },
];

export const SEQUENCE_PARTICIPANT: ElementTypeDefinition = {
  type: "sequence.participant",
  category: "node",
  keyOrder: { keys: ["name", "kind", "order"] },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["name"], `${path}.name`);
      checkEnum(out, semantic["kind"], `${path}.kind`, PARTICIPANT_KINDS);
      checkFractionalIndex(out, semantic["order"], `${path}.order`);
    }
    return out;
  },
};

export const SEQUENCE_MESSAGE: ElementTypeDefinition = {
  type: "sequence.message",
  category: "edge",
  keyOrder: { keys: ["from", "to", "order", "label", "kind"] },
  onReferenceDeleted: "cascade",
  references: (semantic) => refFields(semantic, ["from", "to"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["from"], `${path}.from`);
      checkString(out, semantic["to"], `${path}.to`);
      checkFractionalIndex(out, semantic["order"], `${path}.order`);
      checkString(out, semantic["label"], `${path}.label`, {
        optional: true,
        allowEmpty: true,
      });
      checkEnum(out, semantic["kind"], `${path}.kind`, MESSAGE_KINDS);
    }
    return out;
  },
};

export const SEQUENCE_ACTIVATION: ElementTypeDefinition = {
  type: "sequence.activation",
  category: "annotation",
  keyOrder: { keys: ["participant", "fromOrder", "toOrder"] },
  onReferenceDeleted: "cascade",
  references: (semantic) => refFields(semantic, ["participant"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["participant"], `${path}.participant`);
      checkFractionalIndex(out, semantic["fromOrder"], `${path}.fromOrder`);
      checkFractionalIndex(out, semantic["toOrder"], `${path}.toOrder`);
    }
    return out;
  },
};

export const STATE_NODE: ElementTypeDefinition = {
  type: "state.node",
  category: "node",
  keyOrder: { keys: ["name", "kind"] },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["name"], `${path}.name`, {
        allowEmpty: true,
      });
      checkEnum(out, semantic["kind"], `${path}.kind`, STATE_NODE_KINDS);
    }
    return out;
  },
};

export const STATE_TRANSITION: ElementTypeDefinition = {
  type: "state.transition",
  category: "edge",
  keyOrder: {
    keys: [
      "from",
      "to",
      "trigger",
      "guard",
      "effect",
      "routing",
      "routingAxis",
      "routingBend",
      "routingAvoidObstacles",
      "routingWaypoints",
      "fromPort",
      "toPort",
    ],
    children: { routingWaypoints: { keys: ["u", "v"] } },
  },
  onReferenceDeleted: "cascade",
  references: (semantic) => refFields(semantic, ["from", "to"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["from"], `${path}.from`);
      checkString(out, semantic["to"], `${path}.to`);
      for (const field of ["trigger", "guard", "effect"])
        checkString(out, semantic[field], `${path}.${field}`, {
          optional: true,
          allowEmpty: true,
        });
      validateConnectorRouting(out, semantic, path);
    }
    return out;
  },
};

export const USECASE_NODE: ElementTypeDefinition = {
  type: "usecase.node",
  category: "node",
  keyOrder: { keys: ["name", "kind"] },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["name"], `${path}.name`, {
        allowEmpty: true,
      });
      checkEnum(out, semantic["kind"], `${path}.kind`, USECASE_NODE_KINDS);
    }
    return out;
  },
};

export const USECASE_RELATIONSHIP: ElementTypeDefinition = {
  type: "usecase.relationship",
  category: "edge",
  keyOrder: {
    keys: [
      "from",
      "to",
      "kind",
      "label",
      "routing",
      "routingAxis",
      "routingBend",
      "routingAvoidObstacles",
      "routingWaypoints",
      "fromPort",
      "toPort",
    ],
    children: { routingWaypoints: { keys: ["u", "v"] } },
  },
  onReferenceDeleted: "cascade",
  references: (semantic) => refFields(semantic, ["from", "to"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["from"], `${path}.from`);
      checkString(out, semantic["to"], `${path}.to`);
      checkEnum(
        out,
        semantic["kind"],
        `${path}.kind`,
        USECASE_RELATIONSHIP_KINDS,
      );
      checkString(out, semantic["label"], `${path}.label`, {
        optional: true,
        allowEmpty: true,
      });
      validateConnectorRouting(out, semantic, path);
    }
    return out;
  },
};
