import type { PageId } from "@nodetto/ir";

export function slideList(
  pages: readonly {
    readonly id: PageId;
    readonly hiddenInPresentation?: boolean;
  }[],
): PageId[] {
  return pages
    .filter((page) => page.hiddenInPresentation !== true)
    .map((page) => page.id);
}

export function startIndex(
  order: readonly PageId[],
  slides: readonly PageId[],
  from: PageId | null,
): number | null {
  if (!slides.length) return null;
  if (from === null) return 0;
  const current = slides.indexOf(from);
  if (current >= 0) return current;
  const position = order.indexOf(from);
  if (position < 0) return 0;
  for (const id of order.slice(position + 1)) {
    const index = slides.indexOf(id);
    if (index >= 0) return index;
  }
  return slides.length - 1;
}
