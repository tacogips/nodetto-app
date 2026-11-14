import type { PageId } from "@nodetto/ir";
import { slideList } from "./slides.ts";

export function slideLabel(
  pages: readonly {
    readonly id: PageId;
    readonly hiddenInPresentation?: boolean;
  }[],
  pageId: PageId,
): string | null {
  const page = pages.find((candidate) => candidate.id === pageId);
  if (!page) return null;
  if (page.hiddenInPresentation === true) return "Hidden from presentation";
  const slides = slideList(pages);
  return `Slide ${slides.indexOf(pageId) + 1} / ${slides.length}`;
}
