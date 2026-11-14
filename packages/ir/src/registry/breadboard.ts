// Breadboard board, wire, part and netlist definitions.

import {
  checkArray,
  checkEnum,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import type { KeyOrder } from "../keyOrder.ts";
import {
  BREADBOARD_ELEMENT_TYPES,
  BREADBOARD_PART_TYPES,
  BREADBOARD_BOARD_SIZES,
  BREADBOARD_WIRE_COLORS,
  BREADBOARD_LED_COLORS,
  BREADBOARD_CAPACITOR_STYLES,
  BREADBOARD_TRANSISTOR_POLARITIES,
  BREADBOARD_TRANSISTOR_PINOUTS,
  BREADBOARD_TOLERANCES,
  BREADBOARD_NETLIST_FORMATS,
  isBreadboardPartType,
  type ElementType,
} from "../semantics.ts";
import { noReferences, type ElementTypeDefinition } from "./definition.ts";

function breadboardDefinition(type: ElementType): ElementTypeDefinition {
  const partKeys: Partial<Record<ElementType, readonly string[]>> = {
    "breadboard.resistor": ["reference", "value", "span", "bands", "tolerance"],
    "breadboard.led": ["reference", "value", "color"],
    "breadboard.capacitor": ["reference", "value", "style", "span"],
    "breadboard.diode": ["reference", "value", "span"],
    "breadboard.transistor": ["reference", "value", "polarity", "pinout"],
    "breadboard.button": ["reference", "value"],
    "breadboard.potentiometer": ["reference", "value"],
    "breadboard.ic": ["reference", "value", "pinCount"],
    "breadboard.header": ["reference", "value", "pinCount"],
    "breadboard.battery": ["reference", "value"],
  };
  const keys =
    partKeys[type] ??
    (type === "breadboard.board"
      ? ["size"]
      : type === "breadboard.wire"
        ? ["color", "points"]
        : ["source", "format", "parts", "nets"]);
  const children: KeyOrder["children"] =
    type === "breadboard.wire"
      ? { points: { keys: ["x", "y"] } }
      : type === "breadboard.netlist"
        ? {
            parts: { keys: ["reference", "value", "type"] },
            nets: {
              keys: ["name", "nodes"],
              children: { nodes: { keys: ["reference", "pin"] } },
            },
          }
        : undefined;
  return {
    type,
    category: "node",
    keyOrder: { keys, ...(children ? { children } : {}) },
    onReferenceDeleted: "detach",
    references: noReferences,
    validateSemantic(semantic, path) {
      const out: ValidationIssue[] = [];
      if (!checkObject(out, semantic, path)) return out;
      const get = (name: string) => semantic[name];
      const rangedInt = (name: string, min: number, max: number) => {
        const value = get(name);
        if (
          checkNumber(out, value, `${path}.${name}`, { integer: true, min }) &&
          typeof value === "number" &&
          value > max
        )
          out.push(
            error(
              "value.max",
              `${path}.${name}`,
              `must be less than or equal to ${max}`,
            ),
          );
      };
      if (
        BREADBOARD_PART_TYPES.includes(
          type as (typeof BREADBOARD_PART_TYPES)[number],
        )
      ) {
        checkString(out, get("reference"), `${path}.reference`);
        checkString(out, get("value"), `${path}.value`, { allowEmpty: true });
      }
      switch (type) {
        case "breadboard.board":
          checkEnum(out, get("size"), `${path}.size`, BREADBOARD_BOARD_SIZES);
          break;
        case "breadboard.wire": {
          checkEnum(out, get("color"), `${path}.color`, BREADBOARD_WIRE_COLORS);
          const points = get("points");
          if (checkArray(out, points, `${path}.points`)) {
            if (points.length < 2)
              out.push(
                error(
                  "breadboard.wirePoints",
                  `${path}.points`,
                  "expected at least two points",
                ),
              );
            points.forEach((point, index) => {
              const pointPath = `${path}.points[${index}]`;
              if (checkObject(out, point, pointPath)) {
                checkNumber(out, point["x"], `${pointPath}.x`);
                checkNumber(out, point["y"], `${pointPath}.y`);
              }
            });
          }
          break;
        }
        case "breadboard.resistor":
          rangedInt("span", 2, 10);
          if (
            checkNumber(out, get("bands"), `${path}.bands`, {
              integer: true,
            }) &&
            get("bands") !== 4 &&
            get("bands") !== 5
          )
            out.push(error("value.enum", `${path}.bands`, "expected 4 or 5"));
          if (
            get("tolerance") !== undefined &&
            !BREADBOARD_TOLERANCES.includes(
              get("tolerance") as (typeof BREADBOARD_TOLERANCES)[number],
            )
          )
            out.push(
              error(
                "value.enum",
                `${path}.tolerance`,
                "expected a supported tolerance",
              ),
            );
          break;
        case "breadboard.led":
          checkEnum(out, get("color"), `${path}.color`, BREADBOARD_LED_COLORS);
          break;
        case "breadboard.capacitor":
          checkEnum(
            out,
            get("style"),
            `${path}.style`,
            BREADBOARD_CAPACITOR_STYLES,
          );
          rangedInt("span", 1, 5);
          break;
        case "breadboard.diode":
          rangedInt("span", 2, 10);
          break;
        case "breadboard.transistor":
          checkEnum(
            out,
            get("polarity"),
            `${path}.polarity`,
            BREADBOARD_TRANSISTOR_POLARITIES,
          );
          checkEnum(
            out,
            get("pinout"),
            `${path}.pinout`,
            BREADBOARD_TRANSISTOR_PINOUTS,
          );
          break;
        case "breadboard.ic": {
          const value = get("pinCount");
          rangedInt("pinCount", 4, 40);
          if (
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 4 &&
            value <= 40 &&
            value % 2 !== 0
          )
            out.push(
              error(
                "breadboard.pinCountOdd",
                `${path}.pinCount`,
                "IC pin count must be even",
              ),
            );
          break;
        }
        case "breadboard.header":
          rangedInt("pinCount", 1, 40);
          break;
        case "breadboard.netlist": {
          checkString(out, get("source"), `${path}.source`);
          checkEnum(
            out,
            get("format"),
            `${path}.format`,
            BREADBOARD_NETLIST_FORMATS,
          );
          const parts = get("parts");
          if (checkArray(out, parts, `${path}.parts`))
            parts.forEach((part, index) => {
              const partPath = `${path}.parts[${index}]`;
              if (!checkObject(out, part, partPath)) return;
              checkString(out, part["reference"], `${partPath}.reference`);
              checkString(out, part["value"], `${partPath}.value`, {
                allowEmpty: true,
              });
              if (!isBreadboardPartType(String(part["type"])))
                out.push(
                  error(
                    "value.enum",
                    `${partPath}.type`,
                    "expected a breadboard part type",
                  ),
                );
            });
          const nets = get("nets");
          if (checkArray(out, nets, `${path}.nets`))
            nets.forEach((net, index) => {
              const netPath = `${path}.nets[${index}]`;
              if (!checkObject(out, net, netPath)) return;
              checkString(out, net["name"], `${netPath}.name`, {
                allowEmpty: true,
              });
              const nodes = net["nodes"];
              if (checkArray(out, nodes, `${netPath}.nodes`))
                nodes.forEach((node, nodeIndex) => {
                  const nodePath = `${netPath}.nodes[${nodeIndex}]`;
                  if (!checkObject(out, node, nodePath)) return;
                  checkString(out, node["reference"], `${nodePath}.reference`);
                  checkNumber(out, node["pin"], `${nodePath}.pin`, {
                    integer: true,
                    min: 1,
                  });
                });
            });
          break;
        }
      }
      return out;
    },
  };
}

export const BREADBOARD_DEFINITIONS: readonly ElementTypeDefinition[] =
  BREADBOARD_ELEMENT_TYPES.map(breadboardDefinition);
