// PCB board, footprint, track, via, zone and graphic definitions.

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
  PCB_ELEMENT_TYPES,
  PCB_PAD_SHAPES,
  PCB_PAD_TYPES,
  type PcbElementType,
} from "../pcb.ts";
import { noReferences, type ElementTypeDefinition } from "./definition.ts";

const PCB_SHAPE_KEYS = [
  "kind",
  "start",
  "mid",
  "end",
  "center",
  "radius",
  "points",
  "text",
  "at",
  "rotation",
  "size",
  "thickness",
  "role",
  "justify",
  "hidden",
];

function pcbDefinition(type: PcbElementType): ElementTypeDefinition {
  const shape = { keys: PCB_SHAPE_KEYS };
  const graphic = {
    keys: ["layer", "width", "fill", "shape"],
    children: { shape },
  } satisfies KeyOrder;
  const pad = {
    keys: [
      "number",
      "type",
      "shape",
      "at",
      "rotation",
      "size",
      "layers",
      "net",
      "drill",
      "roundrectRatio",
      "trapezoidDelta",
      "maskMargin",
      "primitives",
    ],
    children: {
      drill: { keys: ["diameter", "slot", "offset"] },
      primitives: { keys: ["width", "fill", "shape"], children: { shape } },
    },
  } satisfies KeyOrder;
  const keyOrders: Readonly<Record<PcbElementType, KeyOrder>> = {
    "pcb.board": {
      keys: [
        "format",
        "source",
        "version",
        "generator",
        "thickness",
        "maskExpansion",
        "layers",
        "nets",
      ],
      children: { layers: { keys: ["id", "name", "type"] } },
    },
    "pcb.footprint": {
      keys: [
        "reference",
        "value",
        "library",
        "at",
        "rotation",
        "side",
        "pads",
        "graphics",
      ],
      children: { pads: pad, graphics: graphic },
    },
    "pcb.track": { keys: ["layer", "width", "net", "points", "mid"] },
    "pcb.via": { keys: ["at", "diameter", "drill", "layers", "net"] },
    "pcb.zone": {
      keys: ["layers", "net", "outline", "filled"],
      children: { filled: { keys: ["layer", "polygons"] } },
    },
    "pcb.graphic": graphic,
  };

  const point = (
    out: ValidationIssue[],
    value: unknown,
    path: string,
  ): void => {
    if (!checkArray(out, value, path)) return;
    if (value.length !== 2)
      out.push(
        error("pcb.pointTuple", path, "expected exactly two coordinates"),
      );
    value.forEach((coordinate, index) =>
      checkNumber(out, coordinate, `${path}[${index}]`),
    );
  };
  const points = (
    out: ValidationIssue[],
    value: unknown,
    path: string,
    min?: number,
  ): void => {
    if (!checkArray(out, value, path)) return;
    if (min !== undefined && value.length < min)
      out.push(
        error("pcb.polygonPoints", path, `expected at least ${min} points`),
      );
    value.forEach((item, index) => point(out, item, `${path}[${index}]`));
  };
  const shapeValue = (
    out: ValidationIssue[],
    value: unknown,
    path: string,
  ): void => {
    if (!checkObject(out, value, path)) return;
    checkEnum(out, value["kind"], `${path}.kind`, [
      "line",
      "arc",
      "circle",
      "rect",
      "polygon",
      "text",
    ]);
    switch (value["kind"]) {
      case "line":
      case "rect":
        point(out, value["start"], `${path}.start`);
        point(out, value["end"], `${path}.end`);
        break;
      case "arc":
        point(out, value["start"], `${path}.start`);
        point(out, value["mid"], `${path}.mid`);
        point(out, value["end"], `${path}.end`);
        break;
      case "circle":
        point(out, value["center"], `${path}.center`);
        if (
          checkNumber(out, value["radius"], `${path}.radius`) &&
          (value["radius"] as number) <= 0
        )
          out.push(
            error("value.min", `${path}.radius`, "must be greater than 0"),
          );
        break;
      case "polygon":
        points(out, value["points"], `${path}.points`, 3);
        break;
      case "text": {
        checkString(out, value["text"], `${path}.text`, { allowEmpty: true });
        point(out, value["at"], `${path}.at`);
        checkNumber(out, value["rotation"], `${path}.rotation`);
        point(out, value["size"], `${path}.size`);
        checkNumber(out, value["thickness"], `${path}.thickness`);
        checkEnum(
          out,
          value["role"],
          `${path}.role`,
          ["reference", "value", "user"],
          { optional: true },
        );
        checkBoolean(out, value["hidden"], `${path}.hidden`, {
          optional: true,
        });
        if (
          value["justify"] !== undefined &&
          checkObject(out, value["justify"], `${path}.justify`)
        ) {
          checkEnum(
            out,
            value["justify"]["horizontal"],
            `${path}.justify.horizontal`,
            ["left", "right"],
            { optional: true },
          );
          checkBoolean(
            out,
            value["justify"]["mirror"],
            `${path}.justify.mirror`,
            { optional: true },
          );
        }
        break;
      }
    }
  };
  const graphicValue = (
    out: ValidationIssue[],
    value: unknown,
    path: string,
  ): void => {
    if (!checkObject(out, value, path)) return;
    checkString(out, value["layer"], `${path}.layer`);
    checkNumber(out, value["width"], `${path}.width`);
    checkBoolean(out, value["fill"], `${path}.fill`);
    shapeValue(out, value["shape"], `${path}.shape`);
  };
  const validate = (semantic: unknown, path: string): ValidationIssue[] => {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    const str = (name: string, allowEmpty = false, optional = false) =>
      checkString(out, semantic[name], `${path}.${name}`, {
        allowEmpty,
        optional,
      });
    const num = (name: string, optional = false) =>
      checkNumber(out, semantic[name], `${path}.${name}`, { optional });
    const stringArray = (value: unknown, at: string, allowEmpty = false) => {
      if (checkArray(out, value, at))
        value.forEach((item, index) =>
          checkString(out, item, `${at}[${index}]`, { allowEmpty }),
        );
    };
    switch (type) {
      case "pcb.board": {
        checkEnum(out, semantic["format"], `${path}.format`, ["kicad_pcb"]);
        str("source", true);
        num("version");
        str("generator", true);
        if (semantic["thickness"] !== undefined) num("thickness");
        num("maskExpansion");
        if (checkArray(out, semantic["layers"], `${path}.layers`))
          semantic["layers"].forEach((item, index) => {
            const at = `${path}.layers[${index}]`;
            if (!checkObject(out, item, at)) return;
            checkNumber(out, item["id"], `${at}.id`, { integer: true });
            checkString(out, item["name"], `${at}.name`);
            checkString(out, item["type"], `${at}.type`, { allowEmpty: true });
          });
        stringArray(semantic["nets"], `${path}.nets`, true);
        break;
      }
      case "pcb.footprint": {
        str("reference", true);
        str("value", true);
        str("library", true);
        point(out, semantic["at"], `${path}.at`);
        num("rotation");
        checkEnum(out, semantic["side"], `${path}.side`, ["top", "bottom"]);
        if (checkArray(out, semantic["pads"], `${path}.pads`))
          semantic["pads"].forEach((item, index) => {
            const at = `${path}.pads[${index}]`;
            if (!checkObject(out, item, at)) return;
            checkString(out, item["number"], `${at}.number`, {
              allowEmpty: true,
            });
            checkEnum(out, item["type"], `${at}.type`, PCB_PAD_TYPES);
            checkEnum(out, item["shape"], `${at}.shape`, PCB_PAD_SHAPES);
            point(out, item["at"], `${at}.at`);
            checkNumber(out, item["rotation"], `${at}.rotation`);
            point(out, item["size"], `${at}.size`);
            if (Array.isArray(item["size"]))
              for (const [axis, dimension] of item["size"].entries())
                if (
                  typeof dimension === "number" &&
                  Number.isFinite(dimension) &&
                  dimension <= 0
                )
                  out.push(
                    error(
                      "value.min",
                      `${at}.size[${axis}]`,
                      "must be greater than 0",
                    ),
                  );
            stringArray(item["layers"], `${at}.layers`);
            checkString(out, item["net"], `${at}.net`, { allowEmpty: true });
            if (
              item["drill"] !== undefined &&
              checkObject(out, item["drill"], `${at}.drill`)
            ) {
              checkNumber(
                out,
                item["drill"]["diameter"],
                `${at}.drill.diameter`,
              );
              if (item["drill"]["slot"] !== undefined)
                point(out, item["drill"]["slot"], `${at}.drill.slot`);
              if (item["drill"]["offset"] !== undefined)
                point(out, item["drill"]["offset"], `${at}.drill.offset`);
            }
            checkNumber(out, item["roundrectRatio"], `${at}.roundrectRatio`, {
              optional: true,
            });
            if (item["trapezoidDelta"] !== undefined)
              point(out, item["trapezoidDelta"], `${at}.trapezoidDelta`);
            checkNumber(out, item["maskMargin"], `${at}.maskMargin`, {
              optional: true,
            });
            if (
              item["primitives"] !== undefined &&
              checkArray(out, item["primitives"], `${at}.primitives`)
            )
              item["primitives"].forEach((primitive, pIndex) => {
                const pAt = `${at}.primitives[${pIndex}]`;
                if (!checkObject(out, primitive, pAt)) return;
                checkNumber(out, primitive["width"], `${pAt}.width`);
                checkBoolean(out, primitive["fill"], `${pAt}.fill`);
                shapeValue(out, primitive["shape"], `${pAt}.shape`);
              });
          });
        if (checkArray(out, semantic["graphics"], `${path}.graphics`))
          semantic["graphics"].forEach((item, index) =>
            graphicValue(out, item, `${path}.graphics[${index}]`),
          );
        break;
      }
      case "pcb.track": {
        str("layer");
        num("width");
        if (
          typeof semantic["width"] === "number" &&
          Number.isFinite(semantic["width"]) &&
          semantic["width"] <= 0
        )
          out.push(
            error("value.min", `${path}.width`, "must be greater than 0"),
          );
        str("net", true);
        points(out, semantic["points"], `${path}.points`);
        if (Array.isArray(semantic["points"]) && semantic["points"].length < 2)
          out.push(
            error(
              "pcb.trackPoints",
              `${path}.points`,
              "expected at least two points",
            ),
          );
        if (semantic["mid"] !== undefined) {
          point(out, semantic["mid"], `${path}.mid`);
          if (
            Array.isArray(semantic["points"]) &&
            semantic["points"].length !== 2
          )
            out.push(
              error(
                "pcb.trackArc",
                `${path}.mid`,
                "arc midpoint requires exactly two points",
              ),
            );
        }
        break;
      }
      case "pcb.via": {
        point(out, semantic["at"], `${path}.at`);
        num("diameter");
        num("drill");
        if (
          typeof semantic["diameter"] === "number" &&
          typeof semantic["drill"] === "number" &&
          Number.isFinite(semantic["diameter"]) &&
          Number.isFinite(semantic["drill"]) &&
          !(semantic["diameter"] > semantic["drill"] && semantic["drill"] > 0)
        )
          out.push(
            error(
              "pcb.viaDrill",
              `${path}.drill`,
              "expected diameter > drill > 0",
            ),
          );
        if (checkArray(out, semantic["layers"], `${path}.layers`)) {
          if (semantic["layers"].length !== 2)
            out.push(
              error("type.tuple", `${path}.layers`, "expected two layer names"),
            );
          semantic["layers"].forEach((layer, index) =>
            checkString(out, layer, `${path}.layers[${index}]`),
          );
        }
        str("net", true);
        break;
      }
      case "pcb.zone": {
        stringArray(semantic["layers"], `${path}.layers`);
        if (
          Array.isArray(semantic["layers"]) &&
          semantic["layers"].length === 0
        )
          out.push(
            error(
              "pcb.zoneLayers",
              `${path}.layers`,
              "expected at least one layer",
            ),
          );
        str("net", true);
        points(out, semantic["outline"], `${path}.outline`);
        if (
          Array.isArray(semantic["outline"]) &&
          semantic["outline"].length < 3
        )
          out.push(
            error(
              "pcb.zoneOutline",
              `${path}.outline`,
              "expected at least three points",
            ),
          );
        if (checkArray(out, semantic["filled"], `${path}.filled`))
          semantic["filled"].forEach((item, index) => {
            const at = `${path}.filled[${index}]`;
            if (!checkObject(out, item, at)) return;
            checkString(out, item["layer"], `${at}.layer`);
            if (checkArray(out, item["polygons"], `${at}.polygons`))
              item["polygons"].forEach((polygon, pIndex) =>
                points(out, polygon, `${at}.polygons[${pIndex}]`, 3),
              );
          });
        break;
      }
      case "pcb.graphic":
        graphicValue(out, semantic, path);
        break;
    }
    return out;
  };
  return {
    type,
    category: "node",
    keyOrder: keyOrders[type],
    onReferenceDeleted: "detach",
    references: noReferences,
    validateSemantic: validate,
  };
}

export const PCB_DEFINITIONS: readonly ElementTypeDefinition[] =
  PCB_ELEMENT_TYPES.map(pcbDefinition);
