import type { PageId } from "@nodetto/ir";
import { slideList } from "./slides.ts";

export function slideLabel(
  pages: readonly {
    readonly id: PageId;
    readonly hiddenInPresentation?: boolean;
  }[],
  pageId: PageId,
  slidesPerPage?: ReadonlyMap<PageId, number>,
): string | null {
  const page = pages.find((candidate) => candidate.id === pageId);
  if (!page) return null;
  if (page.hiddenInPresentation === true) return "Hidden from presentation";
  const slides = slideList(pages);
  if (!slidesPerPage)
    return `Slide ${slides.indexOf(pageId) + 1} / ${slides.length}`;
  const total = slides.reduce(
    (sum, id) => sum + (slidesPerPage.get(id) ?? 1),
    0,
  );
  const start =
    1 +
    slides
      .slice(0, slides.indexOf(pageId))
      .reduce((sum, id) => sum + (slidesPerPage.get(id) ?? 1), 0);
  const count = slidesPerPage.get(pageId) ?? 1;
  return count > 1
    ? `Slides ${start}-${start + count - 1} / ${total}`
    : `Slide ${start} / ${total}`;
}
