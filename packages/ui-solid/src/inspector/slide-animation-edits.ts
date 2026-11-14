import type { Command } from "@nodetto/core";
import {
  SLIDE_SETTINGS_TYPE,
  type Element,
  type ElementAnimation,
} from "@nodetto/ir";
type ShapeKey = Exclude<keyof ElementAnimation, "slide">;
export type AnimationPatch = { [K in ShapeKey]?: ElementAnimation[K] | null };
const keys: readonly ShapeKey[] = [
  "enter",
  "enterFrom",
  "exit",
  "exitTo",
  "linked",
  "delayMs",
  "durationMs",
  "order",
];
function normalized(
  animation: ElementAnimation | undefined,
  patch: AnimationPatch = {},
): ElementAnimation {
  const result: Record<string, unknown> = { ...animation, ...patch };
  for (const key of keys)
    if (
      result[key] == null ||
      ((key === "enter" || key === "exit" || key === "linked") &&
        result[key] === "auto")
    )
      delete result[key];
  return result as ElementAnimation;
}
export function planAnimationEdit(
  elements: readonly Element[],
  patch: AnimationPatch,
): Command[] {
  const commands: Command[] = [];
  for (const element of elements) {
    if (element.type === SLIDE_SETTINGS_TYPE) continue;
    const before = normalized(element.visual.animation);
    const after = normalized(element.visual.animation, patch);
    if (keys.every((key) => before[key] === after[key])) continue;
    const { animation: _animation, ...rest } = element.visual;
    const visual = Object.keys(after).length
      ? { ...rest, animation: after }
      : rest;
    commands.push({ type: "replaceVisual", id: element.id, visual });
  }
  return commands;
}
export function sharedAnimationValue<K extends ShapeKey>(
  elements: readonly Element[],
  key: K,
): ElementAnimation[K] | "mixed" {
  const values = elements
    .filter((e) => e.type !== SLIDE_SETTINGS_TYPE)
    .map((e) => normalized(e.visual.animation)[key]);
  const first = values[0];
  return values.every((value) => value === first) ? first : "mixed";
}
