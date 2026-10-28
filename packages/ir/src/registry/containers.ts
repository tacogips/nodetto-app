// Frame and group containers, including the PCB fabrication layer a
// group can carry.

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
  FABRICATION_LAYER_KINDS,
  FABRICATION_LAYER_SIDES,
  FRAME_PLATFORMS,
  SCREEN_KINDS,
  PROTOTYPE_OVERFLOWS,
} from "../semantics.ts";
import {
  read,
  type ElementReference,
  type ElementTypeDefinition,
} from "./definition.ts";

export const FRAME: ElementTypeDefinition = {
  type: "frame",
  category: "container",
  keyOrder: {
    keys: [
      "name",
      "platform",
      "screenKind",
      "safeArea",
      "responsiveSource",
      "memberIds",
      "showTitle",
      "layout",
      "layoutGrids",
      "component",
      "variantSet",
      "variantName",
      "variantProperties",
      "instanceOf",
      "autoRefresh",
      "prototypeStart",
      "prototypeOverflow",
      "clipContent",
      "instanceBindings",
    ],
    children: {
      layout: {
        keys: [
          "direction",
          "gap",
          "crossGap",
          "wrap",
          "padding",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "sizing",
          "widthSizing",
          "heightSizing",
          "align",
          "justify",
        ],
      },
      safeArea: { keys: ["top", "right", "bottom", "left"] },
      layoutGrids: {
        keys: [
          "id",
          "kind",
          "size",
          "count",
          "gutter",
          "margin",
          "color",
          "opacity",
          "visible",
        ],
      },
      instanceBindings: { keys: ["source", "target", "baseline"] },
      variantProperties: { keys: ["id", "name", "value"] },
    },
  },
  onReferenceDeleted: "detach",
  references(semantic) {
    const members = read(semantic, "memberIds");
    const instanceOf = read(semantic, "instanceOf");
    const responsiveSource = read(semantic, "responsiveSource");
    const bindings = read(semantic, "instanceBindings");
    return [
      ...(Array.isArray(bindings)
        ? bindings.flatMap((binding, index) =>
            ["source", "target"].flatMap((key) => {
              const id = read(binding, key);
              return typeof id === "string"
                ? [{ id, field: `instanceBindings[${index}].${key}` }]
                : [];
            }),
          )
        : []),
      ...(typeof instanceOf === "string"
        ? [{ id: instanceOf, field: "instanceOf" }]
        : []),
      ...(typeof responsiveSource === "string"
        ? [{ id: responsiveSource, field: "responsiveSource" }]
        : []),
      ...(Array.isArray(members)
        ? members.flatMap((id, index) =>
            typeof id === "string"
              ? [{ id, field: `memberIds[${index}]` }]
              : [],
          )
        : []),
    ];
  },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["name"], `${path}.name`, {
        allowEmpty: true,
      });
      checkEnum(
        out,
        semantic["platform"],
        `${path}.platform`,
        FRAME_PLATFORMS,
        { optional: true },
      );
      checkEnum(
        out,
        semantic["screenKind"],
        `${path}.screenKind`,
        SCREEN_KINDS,
        { optional: true },
      );
      const safeArea = semantic["safeArea"];
      if (
        safeArea !== undefined &&
        checkObject(out, safeArea, `${path}.safeArea`)
      ) {
        for (const side of ["top", "right", "bottom", "left"])
          checkNumber(out, safeArea[side], `${path}.safeArea.${side}`, {
            min: 0,
          });
      }
      const members = semantic["memberIds"];
      checkBoolean(out, semantic["showTitle"], `${path}.showTitle`, {
        optional: true,
      });
      const bindings = semantic["instanceBindings"];
      if (
        bindings !== undefined &&
        checkArray(out, bindings, `${path}.instanceBindings`)
      ) {
        for (const [index, binding] of bindings.entries()) {
          const at = `${path}.instanceBindings[${index}]`;
          if (!checkObject(out, binding, at)) continue;
          checkString(out, binding["source"], `${at}.source`, {
            optional: true,
          });
          checkString(out, binding["target"], `${at}.target`, {
            optional: true,
          });
          checkString(out, binding["baseline"], `${at}.baseline`);
        }
      }
      checkBoolean(out, semantic["clipContent"], `${path}.clipContent`, {
        optional: true,
      });
      checkBoolean(out, semantic["prototypeStart"], `${path}.prototypeStart`, {
        optional: true,
      });
      checkEnum(
        out,
        semantic["prototypeOverflow"],
        `${path}.prototypeOverflow`,
        PROTOTYPE_OVERFLOWS,
        { optional: true },
      );
      checkBoolean(out, semantic["autoRefresh"], `${path}.autoRefresh`, {
        optional: true,
      });
      checkBoolean(out, semantic["component"], `${path}.component`, {
        optional: true,
      });
      for (const key of ["variantSet", "variantName"])
        checkString(out, semantic[key], `${path}.${key}`, { optional: true });
      const variantProperties = semantic["variantProperties"];
      if (
        variantProperties !== undefined &&
        checkArray(out, variantProperties, `${path}.variantProperties`)
      ) {
        if (variantProperties.length > 16)
          out.push(
            error(
              "frame.variantPropertyLimit",
              `${path}.variantProperties`,
              "at most sixteen variant properties are allowed",
            ),
          );
        const ids = new Set<string>();
        const names = new Set<string>();
        for (const [index, property] of variantProperties.entries()) {
          const at = `${path}.variantProperties[${index}]`;
          if (!checkObject(out, property, at)) continue;
          const id = property["id"];
          const name = property["name"];
          if (checkString(out, id, `${at}.id`) && typeof id === "string") {
            if (ids.has(id))
              out.push(
                error(
                  "frame.variantPropertyDuplicateId",
                  `${at}.id`,
                  `duplicate variant property id "${id}"`,
                ),
              );
            ids.add(id);
          }
          if (
            checkString(out, name, `${at}.name`) &&
            typeof name === "string"
          ) {
            const normalized = name.trim().toLowerCase();
            if (!normalized)
              out.push(
                error(
                  "frame.variantPropertyName",
                  `${at}.name`,
                  "variant property names must contain non-whitespace characters",
                ),
              );
            else if (names.has(normalized))
              out.push(
                error(
                  "frame.variantPropertyDuplicateName",
                  `${at}.name`,
                  `duplicate variant property name "${name}"`,
                ),
              );
            names.add(normalized);
          }
          if (
            checkString(out, property["value"], `${at}.value`) &&
            typeof property["value"] === "string" &&
            !property["value"].trim()
          )
            out.push(
              error(
                "frame.variantPropertyValue",
                `${at}.value`,
                "variant property values must contain non-whitespace characters",
              ),
            );
        }
      }
      checkString(out, semantic["instanceOf"], `${path}.instanceOf`, {
        optional: true,
      });
      checkString(
        out,
        semantic["responsiveSource"],
        `${path}.responsiveSource`,
        { optional: true },
      );
      if (
        typeof semantic["instanceOf"] === "string" &&
        typeof semantic["responsiveSource"] === "string"
      )
        out.push(
          error(
            "frame.sourceMode",
            `${path}.responsiveSource`,
            "a frame cannot be both a component instance and a responsive variant",
          ),
        );
      if (
        members !== undefined &&
        checkArray(out, members, `${path}.memberIds`)
      ) {
        for (const [index, id] of members.entries())
          checkString(out, id, `${path}.memberIds[${index}]`);
      }
      const layout = semantic["layout"];
      if (layout !== undefined && checkObject(out, layout, `${path}.layout`)) {
        checkEnum(out, layout["direction"], `${path}.layout.direction`, [
          "horizontal",
          "vertical",
        ]);
        checkEnum(out, layout["sizing"], `${path}.layout.sizing`, [
          "fixed",
          "hug",
        ]);
        checkEnum(out, layout["align"], `${path}.layout.align`, [
          "start",
          "center",
          "end",
          "stretch",
        ]);
        for (const axis of ["widthSizing", "heightSizing"])
          checkEnum(
            out,
            layout[axis],
            `${path}.layout.${axis}`,
            ["fixed", "hug"],
            { optional: true },
          );
        checkNumber(out, layout["gap"], `${path}.layout.gap`, { min: 0 });
        checkNumber(out, layout["crossGap"], `${path}.layout.crossGap`, {
          min: 0,
          optional: true,
        });
        checkBoolean(out, layout["wrap"], `${path}.layout.wrap`, {
          optional: true,
        });
        checkEnum(
          out,
          layout["justify"],
          `${path}.layout.justify`,
          ["start", "center", "end", "space-between"],
          { optional: true },
        );
        checkNumber(out, layout["padding"], `${path}.layout.padding`, {
          min: 0,
        });
        for (const side of [
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
        ])
          checkNumber(out, layout[side], `${path}.layout.${side}`, {
            min: 0,
            optional: true,
          });
      }
      const grids = semantic["layoutGrids"];
      if (
        grids !== undefined &&
        checkArray(out, grids, `${path}.layoutGrids`)
      ) {
        if (grids.length > 8)
          out.push(
            error(
              "frame.layoutGridLimit",
              `${path}.layoutGrids`,
              "at most eight layout grids are allowed",
            ),
          );
        const gridIds = new Set<string>();
        for (const [index, grid] of grids.entries()) {
          const at = `${path}.layoutGrids[${index}]`;
          if (!checkObject(out, grid, at)) continue;
          if (
            checkString(out, grid["id"], `${at}.id`) &&
            typeof grid["id"] === "string"
          ) {
            if (gridIds.has(grid["id"]))
              out.push(
                error(
                  "frame.layoutGridDuplicate",
                  `${at}.id`,
                  `duplicate layout grid id "${grid["id"]}"`,
                ),
              );
            gridIds.add(grid["id"]);
          }
          const kind = grid["kind"];
          checkEnum(out, kind, `${at}.kind`, ["grid", "columns", "rows"]);
          checkString(out, grid["color"], `${at}.color`);
          if (
            typeof grid["color"] === "string" &&
            !/^#[\da-f]{6}$/i.test(grid["color"])
          )
            out.push(
              error(
                "frame.layoutGridColor",
                `${at}.color`,
                "expected a six-digit hex color",
              ),
            );
          checkNumber(out, grid["opacity"], `${at}.opacity`, { min: 0 });
          if (typeof grid["opacity"] === "number" && grid["opacity"] > 1)
            out.push(
              error(
                "frame.layoutGridOpacity",
                `${at}.opacity`,
                "opacity must be less than or equal to 1",
              ),
            );
          checkBoolean(out, grid["visible"], `${at}.visible`, {
            optional: true,
          });
          if (kind === "grid") {
            checkNumber(out, grid["size"], `${at}.size`, { min: 1 });
          } else if (kind === "columns" || kind === "rows") {
            checkNumber(out, grid["count"], `${at}.count`, {
              integer: true,
              min: 1,
            });
            if (typeof grid["count"] === "number" && grid["count"] > 24)
              out.push(
                error(
                  "frame.layoutGridCount",
                  `${at}.count`,
                  "count must be less than or equal to 24",
                ),
              );
            checkNumber(out, grid["gutter"], `${at}.gutter`, { min: 0 });
            checkNumber(out, grid["margin"], `${at}.margin`, { min: 0 });
          }
        }
      }
    }
    return out;
  },
};

export const GROUP: ElementTypeDefinition = {
  type: "group",
  category: "container",
  keyOrder: {
    keys: [
      "memberIds",
      "maskId",
      "maskMode",
      "booleanOperation",
      "isolate",
      "fabricationLayer",
    ],
  },
  onReferenceDeleted: "detach",
  references(semantic) {
    const members = read(semantic, "memberIds");
    if (!Array.isArray(members)) {
      return [];
    }
    const refs: ElementReference[] = [];
    const mask = read(semantic, "maskId");
    if (typeof mask === "string" && mask.length > 0)
      refs.push({ field: "maskId", id: mask });
    for (const [i, member] of members.entries()) {
      if (typeof member === "string" && member.length > 0) {
        refs.push({ field: `memberIds[${i}]`, id: member });
      }
    }
    return refs;
  },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) {
      return out;
    }
    const members = semantic["memberIds"];
    if (!checkArray(out, members, `${path}.memberIds`)) {
      return out;
    }
    for (const [i, member] of members.entries()) {
      checkString(out, member, `${path}.memberIds[${i}]`);
    }
    const mask = semantic["maskId"];
    if (checkString(out, mask, `${path}.maskId`, { optional: true })) {
      if (typeof mask === "string" && !members.includes(mask))
        out.push(
          error(
            "group.maskMember",
            `${path}.maskId`,
            "a mask must also be a group member",
          ),
        );
    }
    checkEnum(
      out,
      semantic["maskMode"],
      `${path}.maskMode`,
      ["alpha", "luminance"],
      { optional: true },
    );
    if (semantic["maskMode"] !== undefined && mask === undefined)
      out.push(
        error(
          "group.maskMode",
          `${path}.maskMode`,
          "a mask mode requires a mask member",
        ),
      );
    checkEnum(
      out,
      semantic["booleanOperation"],
      `${path}.booleanOperation`,
      ["union", "subtract", "intersect", "exclude"],
      { optional: true },
    );
    if (semantic["booleanOperation"] !== undefined && members.length < 2)
      out.push(
        error(
          "group.booleanMembers",
          `${path}.memberIds`,
          "a boolean group requires at least two members",
        ),
      );
    if (mask !== undefined && semantic["booleanOperation"] !== undefined)
      out.push(
        error(
          "group.clipConflict",
          path,
          "a group cannot be both a layer mask group and a boolean group",
        ),
      );
    checkBoolean(out, semantic["isolate"], `${path}.isolate`, {
      optional: true,
    });
    validateFabricationLayer(
      out,
      semantic["fabricationLayer"],
      `${path}.fabricationLayer`,
    );
    return out;
  },
};

function validateFabricationLayer(
  out: ValidationIssue[],
  layer: unknown,
  path: string,
): void {
  if (layer === undefined || !checkObject(out, layer, path)) return;
  checkEnum(out, layer["kind"], `${path}.kind`, FABRICATION_LAYER_KINDS);
  checkEnum(out, layer["side"], `${path}.side`, FABRICATION_LAYER_SIDES);
  checkNumber(out, layer["inner"], `${path}.inner`, {
    optional: true,
    integer: true,
    min: 1,
  });
  checkEnum(out, layer["plating"], `${path}.plating`, ["plated", "nonPlated"], {
    optional: true,
  });
  checkString(out, layer["file"], `${path}.file`, { optional: true });
  if (
    checkNumber(out, layer["unitsPerMm"], `${path}.unitsPerMm`) &&
    (layer["unitsPerMm"] as number) <= 0
  )
    out.push(
      error("value.min", `${path}.unitsPerMm`, "must be greater than 0"),
    );
  checkNumber(out, layer["originX"], `${path}.originX`);
  checkNumber(out, layer["originY"], `${path}.originY`);
}
