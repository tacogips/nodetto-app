import {
  createPresentationState,
  currentSlide,
  fitSlide,
  reducePresentation,
  resolveSlideRect,
  slideCounter,
  slideList,
  slideSource,
  startIndex,
  svgSize,
  type Editor,
  type PresentationAction,
  type PresentationState,
  type SlideSize,
} from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import { presentationKeyAction, type PresentationKey } from "./keys.ts";

export interface PresentationKeyEvent extends PresentationKey {
  preventDefault(): void;
  stopImmediatePropagation(): void;
}
export interface PresentationControllerOptions {
  editor: Editor;
  from: PageId | null;
  onExit: (page: PageId) => void;
}
export function createPresentationController({
  editor,
  from,
  onExit,
}: PresentationControllerOptions) {
  const pages = editor.store.listPages();
  const slides = slideList(pages);
  const index = startIndex(
    pages.map((p) => p.id),
    slides,
    from,
  );
  let state: PresentationState | null =
    index === null ? null : createPresentationState(slides, index);
  let exited = false;
  let cache:
    | {
        page: PageId;
        revision: number;
        result: { src: string | null; size: SlideSize | null };
      }
    | undefined;
  const exit = (page: PageId | undefined) => {
    if (!exited && page !== undefined) {
      exited = true;
      onExit(page);
    }
  };
  if (!state) exit(from ?? pages[0]?.id);
  function dispatch(action: PresentationAction | "exit") {
    if (!state || exited) return;
    if (action === "exit") {
      if (state.digits)
        state = reducePresentation(state, { type: "clearDigits" });
      else exit(currentSlide(state));
    } else {
      const previous = currentSlide(state);
      state = reducePresentation(state, action);
      if (!state) exit(previous);
    }
  }
  function slide() {
    if (!state) return { src: null, size: null };
    const page = currentSlide(state);
    if (cache?.page === page && cache.revision === editor.revision)
      return cache.result;
    const slideSize = editor.store.getMeta().slideSize;
    let result: { src: string | null; size: SlideSize | null };
    if (slideSize) {
      const rect = resolveSlideRect(editor.store, editor.registry, page, {
        slideSize,
        slideOrigin: editor.store.getPage(page)?.slideOrigin,
      });
      if (!rect) throw new Error("Explicit slide rect is missing");
      const { x, y, width, height } = rect;
      const svg =
        editor.store.getPageElements(page).length === 0
          ? null
          : editor.exportPageSvgOf(page, { viewport: { x, y, width, height } });
      result = {
        src: svg
          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          : null,
        size: { width, height },
      };
    } else {
      const source = slideSource(editor.store, editor.registry, page);
      const svg =
        (source.kind === "artboard"
          ? editor.exportArtboardSvg(source.frameId)
          : null) ?? editor.exportPageSvgOf(page, { padding: 0 });
      result = {
        src: svg
          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
          : null,
        size: svg ? svgSize(svg) : null,
      };
    }
    cache = { page, revision: editor.revision, result };
    return result;
  }
  return {
    state: () => state,
    dispatch,
    refresh: () =>
      dispatch({
        type: "reconcile",
        slides: slideList(editor.store.listPages()),
      }),
    slide,
    layout: (viewport: SlideSize) =>
      fitSlide(slide().size ?? viewport, viewport),
    counterText: () => {
      if (!state) return "0 / 0";
      if (state.digits) return `Go to: ${state.digits}`;
      const { n, total } = slideCounter(state);
      return `${n} / ${total}`;
    },
    handleKeyDown: (event: PresentationKeyEvent) => {
      if (event.key === "F11") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const action = presentationKeyAction(event);
      if (action) dispatch(action);
    },
  };
}
export type PresentationController = ReturnType<
  typeof createPresentationController
>;
