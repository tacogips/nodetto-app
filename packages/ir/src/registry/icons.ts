import { checkObject } from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import type { ElementTypeDefinition } from "./definition.ts";
export const ICON_NAME_PATTERN = /^(lucide:)?[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_ICON_PATH_LENGTH = 8192;
export interface UiIconSemantic {
  readonly icon?: string;
  readonly path?: string;
  readonly viewBox?: number;
}
export const uiIconDefinition: ElementTypeDefinition = {
  type: "ui.icon",
  category: "node",
  onReferenceDeleted: "detach",
  references: () => [],
  keyOrder: { keys: ["icon", "path", "viewBox"] },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    const icon = semantic["icon"];
    const geometry = semantic["path"];
    if ((icon === undefined) === (geometry === undefined))
      out.push(
        error("icon.source", path, "exactly one icon or path is required"),
      );
    if (
      icon !== undefined &&
      (typeof icon !== "string" || !ICON_NAME_PATTERN.test(icon))
    )
      out.push(error("icon.name", `${path}.icon`, "invalid icon name"));
    if (
      geometry !== undefined &&
      (typeof geometry !== "string" ||
        geometry.length > MAX_ICON_PATH_LENGTH ||
        !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/.test(geometry))
    )
      out.push(error("icon.path", `${path}.path`, "invalid icon path"));
    const box = semantic["viewBox"];
    if (
      box !== undefined &&
      (typeof box !== "number" ||
        !Number.isFinite(box) ||
        box <= 0 ||
        box > 4096)
    )
      out.push(
        error(
          "value.range",
          `${path}.viewBox`,
          "must be finite, greater than 0 and at most 4096",
        ),
      );
    return out;
  },
};
