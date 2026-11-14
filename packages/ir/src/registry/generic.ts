// Generic node and edge definitions, plus the arrowhead and connector
// routing validators shared by every edge-like element type.

import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  ARROWHEADS,
  CONNECTOR_ROUTINGS,
  CONNECTOR_PORTS,
  CONNECTOR_ROUTING_AXES,
  MAX_CONNECTOR_WAYPOINTS,
  PROTOTYPE_ACTIONS,
  PROTOTYPE_OVERLAY_POSITIONS,
  PROTOTYPE_TRIGGERS,
  PROTOTYPE_TRANSITIONS,
} from "../semantics.ts";
import {
  noReferences,
  refFields,
  type ElementTypeDefinition,
} from "./definition.ts";

function validateArrowheads(
  out: ValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (value === undefined) {
    return;
  }
  if (!checkObject(out, value, path)) {
    return;
  }
  checkEnum(out, value["start"], `${path}.start`, ARROWHEADS, {
    optional: true,
  });
  checkEnum(out, value["end"], `${path}.end`, ARROWHEADS, {
    optional: true,
  });
}

export function validateConnectorRouting(
  out: ValidationIssue[],
  semantic: Record<string, unknown>,
  path: string,
): void {
  for (const key of ["fromPort", "toPort"])
    checkEnum(out, semantic[key], `${path}.${key}`, CONNECTOR_PORTS, {
      optional: true,
    });
  checkEnum(out, semantic["routing"], `${path}.routing`, CONNECTOR_ROUTINGS, {
    optional: true,
  });
  checkEnum(
    out,
    semantic["routingAxis"],
    `${path}.routingAxis`,
    CONNECTOR_ROUTING_AXES,
    { optional: true },
  );
  if (
    checkNumber(out, semantic["routingBend"], `${path}.routingBend`, {
      optional: true,
      min: 0,
    }) &&
    typeof semantic["routingBend"] === "number" &&
    semantic["routingBend"] > 1
  )
    out.push(
      error(
        "value.max",
        `${path}.routingBend`,
        "must be less than or equal to 1",
      ),
    );
  checkBoolean(
    out,
    semantic["routingAvoidObstacles"],
    `${path}.routingAvoidObstacles`,
    { optional: true },
  );
  const waypoints = semantic["routingWaypoints"];
  if (
    waypoints !== undefined &&
    checkArray(out, waypoints, `${path}.routingWaypoints`)
  ) {
    if (waypoints.length > MAX_CONNECTOR_WAYPOINTS)
      out.push(
        error(
          "value.max",
          `${path}.routingWaypoints`,
          `must contain at most ${MAX_CONNECTOR_WAYPOINTS} waypoints`,
        ),
      );
    for (const [index, waypoint] of waypoints.entries()) {
      const at = `${path}.routingWaypoints[${index}]`;
      if (!checkObject(out, waypoint, at)) continue;
      checkNumber(out, waypoint["u"], `${at}.u`);
      checkNumber(out, waypoint["v"], `${at}.v`);
    }
  }
}

export const GENERIC_NODE: ElementTypeDefinition = {
  type: "node.generic",
  category: "node",
  keyOrder: { keys: ["label"] },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["label"], `${path}.label`, {
        allowEmpty: true,
      });
    }
    return out;
  },
};

export const GENERIC_EDGE: ElementTypeDefinition = {
  type: "edge.generic",
  category: "edge",
  keyOrder: {
    keys: [
      "from",
      "to",
      "fromPoint",
      "toPoint",
      "label",
      "arrowheads",
      "routing",
      "routingAxis",
      "routingBend",
      "routingAvoidObstacles",
      "routingWaypoints",
      "fromPort",
      "toPort",
      "prototype",
      "prototypeAction",
      "prototypeTrigger",
      "prototypeDelay",
      "prototypeTransition",
      "prototypeDuration",
      "prototypeOverlayPosition",
      "prototypeOverlayX",
      "prototypeOverlayY",
      "prototypeOverlayBackdrop",
      "prototypeOverlayDismiss",
    ],
    children: {
      fromPoint: { keys: ["x", "y"] },
      toPoint: { keys: ["x", "y"] },
      arrowheads: { keys: ["start", "end"] },
      routingWaypoints: { keys: ["u", "v"] },
    },
  },
  onReferenceDeleted: "cascade",
  references: (semantic) => refFields(semantic, ["from", "to"]),
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      for (const end of ["from", "to"] as const) {
        const point = semantic[`${end}Point`];
        if (point !== undefined && semantic["prototype"] !== true) {
          if (semantic[end] !== undefined)
            out.push(
              error(
                "connector.endpointConflict",
                `${path}.${end}`,
                "choose a shape reference or a free endpoint, not both",
              ),
            );
          if (semantic[`${end}Port`] !== undefined)
            out.push(
              error(
                "connector.detachedPort",
                `${path}.${end}Port`,
                "a free endpoint cannot have a shape port",
              ),
            );
          if (checkObject(out, point, `${path}.${end}Point`)) {
            checkNumber(out, point["x"], `${path}.${end}Point.x`);
            checkNumber(out, point["y"], `${path}.${end}Point.y`);
          }
        } else {
          checkString(out, semantic[end], `${path}.${end}`);
          if (point !== undefined)
            out.push(
              error(
                "connector.prototypeEndpoint",
                `${path}.${end}Point`,
                "prototype interactions require shape endpoints",
              ),
            );
        }
      }
      checkBoolean(out, semantic["prototype"], `${path}.prototype`, {
        optional: true,
      });
      checkEnum(
        out,
        semantic["prototypeAction"],
        `${path}.prototypeAction`,
        PROTOTYPE_ACTIONS,
        { optional: true },
      );
      checkEnum(
        out,
        semantic["prototypeTrigger"],
        `${path}.prototypeTrigger`,
        PROTOTYPE_TRIGGERS,
        { optional: true },
      );
      checkNumber(out, semantic["prototypeDelay"], `${path}.prototypeDelay`, {
        optional: true,
        min: 100,
      });
      if (
        typeof semantic["prototypeDelay"] === "number" &&
        semantic["prototypeDelay"] > 60_000
      )
        out.push(
          error(
            "value.max",
            `${path}.prototypeDelay`,
            "must be at most 60000 milliseconds",
          ),
        );
      checkEnum(
        out,
        semantic["prototypeTransition"],
        `${path}.prototypeTransition`,
        PROTOTYPE_TRANSITIONS,
        { optional: true },
      );
      checkNumber(
        out,
        semantic["prototypeDuration"],
        `${path}.prototypeDuration`,
        { optional: true, min: 0 },
      );
      if (
        typeof semantic["prototypeDuration"] === "number" &&
        semantic["prototypeDuration"] > 5000
      )
        out.push(
          error(
            "value.max",
            `${path}.prototypeDuration`,
            "must be at most 5000 milliseconds",
          ),
        );
      checkEnum(
        out,
        semantic["prototypeOverlayPosition"],
        `${path}.prototypeOverlayPosition`,
        PROTOTYPE_OVERLAY_POSITIONS,
        { optional: true },
      );
      for (const field of ["prototypeOverlayX", "prototypeOverlayY"])
        checkNumber(out, semantic[field], `${path}.${field}`, {
          optional: true,
        });
      checkBoolean(
        out,
        semantic["prototypeOverlayBackdrop"],
        `${path}.prototypeOverlayBackdrop`,
        { optional: true },
      );
      checkBoolean(
        out,
        semantic["prototypeOverlayDismiss"],
        `${path}.prototypeOverlayDismiss`,
        { optional: true },
      );
      checkString(out, semantic["label"], `${path}.label`, {
        optional: true,
        allowEmpty: true,
      });
      validateArrowheads(out, semantic["arrowheads"], `${path}.arrowheads`);
      validateConnectorRouting(out, semantic, path);
    }
    return out;
  },
};
