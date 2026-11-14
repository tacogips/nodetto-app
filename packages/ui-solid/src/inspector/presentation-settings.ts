import {
  DEFAULT_SLIDE_SIZE,
  SLIDE_SIZE_PRESETS,
  type Command,
  type SlideSizePresetId,
} from "@nodetto/core";
import type { Page, SlideOrigin, SlideSize } from "@nodetto/ir";

export function slideSizeCommand(
  current: SlideSize | undefined,
  choice: SlideSizePresetId | "custom" | "none",
  custom?: SlideSize,
): Command | null {
  if (choice === "none")
    return current
      ? { type: "updateDocument", document: { slideSize: null } }
      : null;
  const preset = SLIDE_SIZE_PRESETS.find((item) => item.id === choice);
  const size = preset
    ? { width: preset.width, height: preset.height }
    : (custom ?? current ?? DEFAULT_SLIDE_SIZE);
  if (current?.width === size.width && current.height === size.height)
    return null;
  return { type: "updateDocument", document: { slideSize: size } };
}
export function slideOriginCommand(
  page: Page,
  origin: SlideOrigin | null,
): Command | null {
  if (
    origin === null
      ? page.slideOrigin === undefined
      : page.slideOrigin?.x === origin.x && page.slideOrigin.y === origin.y
  )
    return null;
  return { type: "updatePage", id: page.id, page: { slideOrigin: origin } };
}
export function clampSlideDimension(n: number): number | null {
  return Number.isFinite(n)
    ? Math.max(1, Math.min(100000, Math.round(n)))
    : null;
}
