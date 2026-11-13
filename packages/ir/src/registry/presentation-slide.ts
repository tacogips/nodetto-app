import { checkObject, checkString } from "../checks.ts";
import { warning, type ValidationIssue } from "../issues.ts";
import type { Element, SlideSettings } from "../types.ts";
import { noReferences, type ElementTypeDefinition } from "./definition.ts";

export const SLIDE_SETTINGS_TYPE = "presentation.slide";
export const PRESENTATION_SLIDE: ElementTypeDefinition = {
  type: SLIDE_SETTINGS_TYPE,
  category: "resource",
  keyOrder: { keys: ["note"] },
  onReferenceDeleted: "detach",
  references: noReferences,
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    checkString(out, semantic["note"], `${path}.note`, {
      optional: true,
      allowEmpty: true,
    });
    for (const key of Object.keys(semantic)) {
      if (key !== "note")
        out.push(
          warning(
            "field.unknown",
            `${path}.${key}`,
            "unknown slide semantic field; preserved but ignored",
          ),
        );
    }
    return out;
  },
};

export function readSlideSettings(
  pageElements: readonly Element[],
): SlideSettings | undefined {
  const carriers = pageElements.filter(
    (element) => element.type === SLIDE_SETTINGS_TYPE,
  );
  carriers.sort((a, b) =>
    a.index < b.index
      ? -1
      : a.index > b.index
        ? 1
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0,
  );
  return carriers[0]?.visual.animation?.slide;
}
