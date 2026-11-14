import type { Command } from "@nodetto/core";
import { isPlainObject, type Element, type Visual } from "@nodetto/ir";
import { deepMerge, type JsonObject } from "./operation-input.ts";

export function nullPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value))
    return value.flatMap((child, index) => {
      const path = `${prefix}[${index}]`;
      return child === null ? [path] : nullPaths(child, path);
    });
  if (!isPlainObject(value)) return [];
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child === null) paths.push(path);
    else paths.push(...nullPaths(child, path));
  }
  return paths;
}

export function withBoxLabelAlign(
  type: string,
  patch: JsonObject,
  current: Visual | undefined,
): JsonObject {
  const style = patch["style"];
  if (
    (type !== "node.generic" && type !== "shape.geo") ||
    !isPlainObject(style) ||
    !("verticalAlign" in style)
  )
    return patch;
  const value = style["verticalAlign"];
  return {
    ...patch,
    ...(value !== null && current?.textStyle && !("textStyle" in patch)
      ? { textStyle: null }
      : {}),
    style: {
      ...style,
      ...("boxLabelAlign" in style
        ? {}
        : { boxLabelAlign: value === null ? null : true }),
    },
  };
}

export function visualPatchCommand(
  element: Element,
  patch: JsonObject,
  _index: number,
): Command {
  let normalized = withBoxLabelAlign(element.type, patch, element.visual);
  const style = normalized["style"];
  if (
    isPlainObject(style) &&
    Array.isArray(style["strokeDashArray"]) &&
    style["strokeDashArray"].length === 0
  ) {
    normalized = {
      ...normalized,
      style: {
        ...style,
        strokeDashArray: null,
        ...("dash" in style ? {} : { dash: null }),
      },
    };
  }
  if (
    Object.keys(normalized).every((key) => key === "locked" || key === "hidden")
  ) {
    const visual = Object.fromEntries(
      Object.entries(normalized).map(([key, value]) => [
        key,
        value === null ? false : value,
      ]),
    );
    return {
      type: "updateVisual",
      id: element.id,
      visual: visual as Partial<Visual>,
    };
  }
  const visual = deepMerge(element.visual, normalized) as Record<
    string,
    unknown
  >;
  if (
    isPlainObject(visual["style"]) &&
    Object.keys(visual["style"]).length === 0
  )
    // biome-ignore lint/performance/noDelete: the serialized key must be removed.
    delete visual["style"];
  return { type: "replaceVisual", id: element.id, visual: visual as Visual };
}
