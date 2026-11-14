import {
  resolveSlideRect,
  slideSource,
  svgViewBox,
  type Editor,
  type SlideViewBox,
} from "@nodetto/core";
import type { PageId } from "@nodetto/ir";

export function renderSlide(
  editor: Editor,
  page: PageId,
): { svg: string | null; rect: SlideViewBox | null } {
  const slideSize = editor.store.getMeta().slideSize;
  if (slideSize) {
    const rect = resolveSlideRect(editor.store, editor.registry, page, {
      slideSize,
      slideOrigin: editor.store.getPage(page)?.slideOrigin,
    });
    if (!rect) throw new Error("Explicit slide rect is missing");
    const { x, y, width, height } = rect;
    const viewport = { x, y, width, height };
    return {
      svg:
        editor.store.getPageElements(page).length === 0
          ? null
          : editor.exportPageSvgOf(page, { viewport }),
      rect: viewport,
    };
  }
  const source = slideSource(editor.store, editor.registry, page);
  const svg =
    (source.kind === "artboard"
      ? editor.exportArtboardSvg(source.frameId)
      : null) ?? editor.exportPageSvgOf(page, { padding: 0 });
  return { svg, rect: svg ? svgViewBox(svg) : null };
}
