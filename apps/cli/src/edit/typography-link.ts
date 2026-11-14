import { TYPOGRAPHY_FIELDS } from "@nodetto/core";
import { isPlainObject, type ElementId, type Visual } from "@nodetto/ir";
import type { Json } from "./operation-input.ts";

export function normalizeTypography(
  _type: string,
  visual: Json | undefined,
  existing: Visual | undefined,
  _index: number,
): { readonly visual: Json | undefined; readonly detachedStyle?: ElementId } {
  if (!isPlainObject(visual) || !isPlainObject(visual["style"]))
    return { visual };
  const style = visual["style"];
  const aliases: Record<string, string> = {
    left: "start",
    center: "middle",
    right: "end",
  };
  const align = style["textAlign"];
  const normalized =
    typeof align === "string" && aliases[align]
      ? { ...style, textAlign: aliases[align] }
      : style;
  if ("textStyle" in visual)
    return { visual: { ...visual, style: normalized } };
  const link = existing?.textStyle;
  if (
    typeof link === "string" &&
    TYPOGRAPHY_FIELDS.filter((field) => field !== "verticalAlign").some(
      (field) => field in style,
    )
  ) {
    return {
      visual: { ...visual, style: normalized, textStyle: null },
      detachedStyle: link as ElementId,
    };
  }
  return { visual: { ...visual, style: normalized } };
}
