import {
  documentPageSequence,
  resolveSlideRect,
  slideSource,
  svgViewBox,
  type Editor,
  type SlideViewBox,
  type SlideRef,
} from "@nodetto/core";

export function renderSlide(
  editor: Editor,
  ref: SlideRef,
): { svg: string | null; rect: SlideViewBox | null } {
  const page = ref.page;
  if (ref.frame) {
    const rect =
      documentPageSequence(editor.store, editor.registry).find(
        (item) => item.pageId === page && item.frameId === ref.frame,
      )?.rect ?? null;
    return {
      rect,
      svg:
        rect && editor.store.getPageElements(page).length
          ? editor.exportPageSvgOf(page, { viewport: rect })
          : null,
    };
  }
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
