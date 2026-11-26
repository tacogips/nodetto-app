import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import type { KeyOrder } from "../keyOrder.ts";
import {
  SCHEMATIC_ELEMENT_TYPES,
  SCHEMATIC_REFERENCE_PREFIX,
  SCHEMATIC_BJT_POLARITIES,
  SCHEMATIC_MOSFET_CHANNELS,
  SCHEMATIC_SWITCH_STYLES,
  SCHEMATIC_POWER_STYLES,
  SCHEMATIC_IC_SIDES,
  SCHEMATIC_COORDINATE_LIMIT,
  SCHEMATIC_IC_MAX_PINS,
  SCHEMATIC_CONNECTOR_MAX_PINS,
  isSchematicPartType,
  type SchematicElementType,
} from "../semantics.ts";
import { noReferences, type ElementTypeDefinition } from "./definition.ts";

const values = [
  "10k",
  "100n",
  "10u",
  "1N4148",
  "LED",
  "NPN",
  "NMOS",
  "SW",
  "10k",
  "9V",
  "5V",
  "CONN",
  "IC",
] as const;
/** Fresh default payload for a schematic type. */
export function schematicDefaultSemantic(type: SchematicElementType): object {
  if (isSchematicPartType(type)) {
    const index = SCHEMATIC_ELEMENT_TYPES.indexOf(type);
    const base = {
      reference: `${SCHEMATIC_REFERENCE_PREFIX[type]}?`,
      value: values[index],
    };
    switch (type) {
      case "schematic.capacitor":
        return { ...base, polarized: false };
      case "schematic.bjt":
        return { ...base, polarity: "npn" };
      case "schematic.mosfet":
        return { ...base, channel: "n" };
      case "schematic.switch":
        return { ...base, style: "toggle" };
      case "schematic.connector":
        return { ...base, pinCount: 2 };
      case "schematic.ic":
        return {
          ...base,
          pins: Array.from({ length: 8 }, (_, i) => ({
            number: i + 1,
            name: "",
            side: i < 4 ? "left" : "right",
          })),
        };
      default:
        return base;
    }
  }
  switch (type) {
    case "schematic.power":
      return { style: "ground", net: "GND" };
    case "schematic.wire":
      return {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
        ],
      };
    case "schematic.label":
      return { net: "NET" };
    default:
      return {};
  }
}

function definition(type: SchematicElementType): ElementTypeDefinition {
  const extras: Partial<Record<SchematicElementType, string>> = {
    "schematic.capacitor": "polarized",
    "schematic.bjt": "polarity",
    "schematic.mosfet": "channel",
    "schematic.switch": "style",
    "schematic.connector": "pinCount",
    "schematic.ic": "pins",
  };
  const extra = extras[type];
  const keys = isSchematicPartType(type)
    ? ["reference", "value", ...(extra ? [extra] : [])]
    : type === "schematic.power"
      ? ["style", "net"]
      : type === "schematic.wire"
        ? ["points"]
        : type === "schematic.label"
          ? ["net"]
          : [];
  const children: KeyOrder["children"] =
    type === "schematic.wire"
      ? { points: { keys: ["x", "y"], coordinates: ["x", "y"] } }
      : type === "schematic.ic"
        ? { pins: { keys: ["number", "name", "side"] } }
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
      if (isSchematicPartType(type)) {
        checkString(out, semantic["reference"], `${path}.reference`);
        checkString(out, semantic["value"], `${path}.value`, {
          allowEmpty: true,
        });
      }
      switch (type) {
        case "schematic.capacitor":
          checkBoolean(out, semantic["polarized"], `${path}.polarized`);
          break;
        case "schematic.bjt":
          checkEnum(
            out,
            semantic["polarity"],
            `${path}.polarity`,
            SCHEMATIC_BJT_POLARITIES,
          );
          break;
        case "schematic.mosfet":
          checkEnum(
            out,
            semantic["channel"],
            `${path}.channel`,
            SCHEMATIC_MOSFET_CHANNELS,
          );
          break;
        case "schematic.switch":
          checkEnum(
            out,
            semantic["style"],
            `${path}.style`,
            SCHEMATIC_SWITCH_STYLES,
          );
          break;
        case "schematic.power":
          checkEnum(
            out,
            semantic["style"],
            `${path}.style`,
            SCHEMATIC_POWER_STYLES,
          );
          checkString(out, semantic["net"], `${path}.net`);
          break;
        case "schematic.label":
          checkString(out, semantic["net"], `${path}.net`);
          break;
        case "schematic.connector": {
          const count = semantic["pinCount"];
          if (
            checkNumber(out, count, `${path}.pinCount`, {
              integer: true,
              min: 1,
            }) &&
            typeof count === "number" &&
            count > SCHEMATIC_CONNECTOR_MAX_PINS
          )
            out.push(error("value.max", `${path}.pinCount`, "too many pins"));
          break;
        }
        case "schematic.ic": {
          const pins = semantic["pins"];
          if (!checkArray(out, pins, `${path}.pins`)) break;
          if (pins.length === 0 || pins.length > SCHEMATIC_IC_MAX_PINS)
            out.push(
              error(
                "schematic.icPins",
                `${path}.pins`,
                "expected 1 to 256 pins",
              ),
            );
          const seen = new Set<number>();
          pins.forEach((pin, i) => {
            const at = `${path}.pins[${i}]`;
            if (!checkObject(out, pin, at)) return;
            const n = pin["number"];
            if (
              typeof n !== "number" ||
              !Number.isInteger(n) ||
              n < 1 ||
              seen.has(n)
            )
              out.push(
                error(
                  "schematic.icPins",
                  `${at}.number`,
                  "expected a unique positive integer",
                ),
              );
            else seen.add(n);
            checkString(out, pin["name"], `${at}.name`, { allowEmpty: true });
            checkEnum(out, pin["side"], `${at}.side`, SCHEMATIC_IC_SIDES);
          });
          break;
        }
        case "schematic.wire": {
          const points = semantic["points"];
          if (!checkArray(out, points, `${path}.points`)) break;
          if (points.length < 2)
            out.push(
              error(
                "schematic.wirePoints",
                `${path}.points`,
                "expected at least two points",
              ),
            );
          let previous: { x: number; y: number } | undefined;
          points.forEach((point, i) => {
            const at = `${path}.points[${i}]`;
            if (!checkObject(out, point, at)) {
              previous = undefined;
              return;
            }
            const x = point["x"];
            const y = point["y"];
            const validX = checkNumber(out, x, `${at}.x`);
            const validY = checkNumber(out, y, `${at}.y`);
            if (
              validX &&
              typeof x === "number" &&
              Math.abs(x) > SCHEMATIC_COORDINATE_LIMIT
            )
              out.push(
                error(
                  "schematic.coordinateRange",
                  `${at}.x`,
                  "coordinate exceeds limit",
                ),
              );
            if (
              validY &&
              typeof y === "number" &&
              Math.abs(y) > SCHEMATIC_COORDINATE_LIMIT
            )
              out.push(
                error(
                  "schematic.coordinateRange",
                  `${at}.y`,
                  "coordinate exceeds limit",
                ),
              );
            if (
              validX &&
              validY &&
              typeof x === "number" &&
              typeof y === "number"
            ) {
              if (previous && previous.x !== x && previous.y !== y)
                out.push(
                  error(
                    "schematic.wireDiagonal",
                    at,
                    "wire segments must be orthogonal",
                  ),
                );
              previous = { x, y };
            } else previous = undefined;
          });
          break;
        }
      }
      return out;
    },
  };
}
export const SCHEMATIC_DEFINITIONS: readonly ElementTypeDefinition[] =
  SCHEMATIC_ELEMENT_TYPES.map(definition);
