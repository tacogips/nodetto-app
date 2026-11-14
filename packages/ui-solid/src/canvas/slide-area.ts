import type { SlideRect, SlideSize } from "@nodetto/core";

export function effectiveShowSlideArea(
  pref: boolean | undefined,
  slideSize: SlideSize | undefined,
): boolean {
  return pref ?? slideSize !== undefined;
}

export function slideAreaModel(input: {
  rect: SlideRect | null;
  label: string | null;
  show: boolean;
}): { rect: SlideRect; label: string | null; dim: boolean } | null {
  if (!input.show || !input.rect) return null;
  return {
    rect: input.rect,
    label: input.label,
    dim: input.rect.kind === "explicit",
  };
}
