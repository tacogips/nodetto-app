// Page guides, design tokens and raster images.

import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import { isRasterDataUrl } from "../image.ts";
import { isRasterAttachmentPath } from "../attachments.ts";
import { isPlainObject } from "../types.ts";
import {
  noReferences,
  type ElementReference,
  type ElementTypeDefinition,
} from "./definition.ts";

export const DESIGN_GUIDE: ElementTypeDefinition = {
  type: "design.guide",
  category: "resource",
  keyOrder: {
    keys: ["axis", "position", "color", "hidden", "locked"],
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    checkEnum(out, semantic["axis"], `${path}.axis`, ["x", "y"]);
    checkNumber(out, semantic["position"], `${path}.position`);
    checkString(out, semantic["color"], `${path}.color`, {
      optional: true,
    });
    if (
      semantic["color"] !== undefined &&
      (typeof semantic["color"] !== "string" ||
        !/^#[\da-f]{6}$/i.test(semantic["color"]))
    )
      out.push(
        error("guide.color", `${path}.color`, "expected a six-digit hex color"),
      );
    checkBoolean(out, semantic["hidden"], `${path}.hidden`, {
      optional: true,
    });
    checkBoolean(out, semantic["locked"], `${path}.locked`, {
      optional: true,
    });
    return out;
  },
};

export const DESIGN_TOKEN: ElementTypeDefinition = {
  type: "design.token",
  category: "resource",
  keyOrder: {
    keys: ["name", "kind", "value", "alias", "modes"],
    children: { modes: { keys: ["name", "value", "alias"] } },
  },
  onReferenceDeleted: "detach",
  references(semantic) {
    if (!isPlainObject(semantic)) return [];
    const refs: ElementReference[] = [];
    if (typeof semantic["alias"] === "string" && semantic["alias"])
      refs.push({ field: "alias", id: semantic["alias"] });
    const modes = semantic["modes"];
    if (Array.isArray(modes))
      for (const [index, mode] of modes.entries())
        if (
          isPlainObject(mode) &&
          typeof mode["alias"] === "string" &&
          mode["alias"]
        )
          refs.push({
            field: `modes[${index}].alias`,
            id: mode["alias"],
          });
    return refs;
  },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["name"], `${path}.name`);
      checkEnum(out, semantic["kind"], `${path}.kind`, ["color", "number"]);
      if (
        semantic["kind"] === "color" &&
        (typeof semantic["value"] !== "string" ||
          !/^#[\da-f]{6}$/i.test(semantic["value"]))
      )
        out.push(
          error(
            "token.color",
            `${path}.value`,
            "expected a six-digit hex color",
          ),
        );
      if (
        semantic["kind"] === "number" &&
        (typeof semantic["value"] !== "number" ||
          !Number.isFinite(semantic["value"]) ||
          semantic["value"] < 0)
      )
        out.push(
          error(
            "token.number",
            `${path}.value`,
            "expected a finite non-negative number",
          ),
        );
      if (semantic["alias"] !== undefined)
        checkString(out, semantic["alias"], `${path}.alias`);
      const modes = semantic["modes"];
      if (modes !== undefined && checkArray(out, modes, `${path}.modes`)) {
        const names = new Set<string>();
        for (const [index, mode] of modes.entries()) {
          const modePath = `${path}.modes[${index}]`;
          if (!checkObject(out, mode, modePath)) continue;
          const name = mode["name"];
          if (
            checkString(out, name, `${modePath}.name`) &&
            typeof name === "string"
          ) {
            if (names.has(name))
              out.push(
                error(
                  "token.modeDuplicate",
                  `${modePath}.name`,
                  `duplicate token mode "${name}"`,
                ),
              );
            if (name.toLowerCase() === "default")
              out.push(
                error(
                  "token.modeReserved",
                  `${modePath}.name`,
                  'the token mode name "Default" is reserved',
                ),
              );
            names.add(name);
          }
          if (mode["value"] !== undefined && mode["alias"] !== undefined)
            out.push(
              error(
                "token.modeChoice",
                modePath,
                "a mode cannot define both value and alias",
              ),
            );
          if (mode["alias"] !== undefined)
            checkString(out, mode["alias"], `${modePath}.alias`);
          if (
            mode["value"] !== undefined &&
            semantic["kind"] === "color" &&
            (typeof mode["value"] !== "string" ||
              !/^#[\da-f]{6}$/i.test(mode["value"]))
          )
            out.push(
              error(
                "token.color",
                `${modePath}.value`,
                "expected a six-digit hex color",
              ),
            );
          if (
            mode["value"] !== undefined &&
            semantic["kind"] === "number" &&
            (typeof mode["value"] !== "number" ||
              !Number.isFinite(mode["value"]) ||
              mode["value"] < 0)
          )
            out.push(
              error(
                "token.number",
                `${modePath}.value`,
                "expected a finite non-negative number",
              ),
            );
        }
      }
    }
    return out;
  },
};

export const IMAGE_RASTER: ElementTypeDefinition = {
  type: "image.raster",
  category: "node",
  keyOrder: {
    keys: ["src", "alt", "fit", "crop"],
    children: { crop: { keys: ["x", "y", "width", "height"] } },
  },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      if (
        !isRasterDataUrl(semantic["src"]) &&
        !isRasterAttachmentPath(semantic["src"])
      )
        out.push(
          error(
            "image.source",
            `${path}.src`,
            "expected a relative PNG, JPEG, WebP or GIF attachment path, or a legacy embedded image up to 1 MiB",
          ),
        );
      checkString(out, semantic["alt"], `${path}.alt`, { allowEmpty: true });
      checkEnum(
        out,
        semantic["fit"],
        `${path}.fit`,
        ["contain", "cover", "fill"],
        { optional: true },
      );
      const crop = semantic["crop"];
      if (crop !== undefined && checkObject(out, crop, `${path}.crop`)) {
        const fields = ["x", "y", "width", "height"] as const;
        for (const field of fields)
          checkNumber(out, crop[field], `${path}.crop.${field}`, {
            min: field === "width" || field === "height" ? Number.EPSILON : 0,
          });
        const x = crop["x"];
        const y = crop["y"];
        const width = crop["width"];
        const height = crop["height"];
        if (
          typeof x === "number" &&
          typeof y === "number" &&
          typeof width === "number" &&
          typeof height === "number" &&
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          (x + width > 1 || y + height > 1)
        )
          out.push(
            error(
              "image.crop.bounds",
              `${path}.crop`,
              "crop rectangle must stay within the normalized image bounds",
            ),
          );
      }
    }
    return out;
  },
};
