import {
  createPresentationState,
  expandSlides,
  currentSlide,
  fitSlide,
  reducePresentation,
  planSlideTransition,
  slideCounter,
  slideList,
  startSlideIndex,
  svgSize,
  type Editor,
  type PresentationAction,
  type PresentationState,
  type SlideSize,
  type SlideRef,
} from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import { renderSlide } from "./slide-render.ts";
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
  const slides = expandSlides(editor.store, editor.registry, slideList(pages));
  const index = startSlideIndex(
    pages.map((p) => p.id),
    slides,
    from,
  );
  let state: PresentationState | null =
    index === null ? null : createPresentationState(slides, index);
  let exited = false;
  let transition: {
    fromPage: PageId;
    toPage: PageId;
    fromSvg: string;
    toSvg: string;
    fromRect: NonNullable<ReturnType<typeof renderSlide>["rect"]>;
    toRect: NonNullable<ReturnType<typeof renderSlide>["rect"]>;
    plan: Extract<ReturnType<typeof planSlideTransition>, { kind: "animate" }>;
  } | null = null;
  let cache:
    | {
        ref: SlideRef;
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
      transition = null;
      if (state.digits)
        state = reducePresentation(state, { type: "clearDigits" });
      else exit(currentSlide(state).page);
    } else {
      const before = state;
      const previous = currentSlide(before);
      state = reducePresentation(before, action);
      if (!state) {
        transition = null;
        exit(previous.page);
        return;
      }
      if (action.type === "digit" || action.type === "clearDigits") return;
      transition = null;
      const adjacent =
        action.type === "next" ||
        action.type === "prev" ||
        (action.type === "enter" && !before.digits);
      if (
        adjacent &&
        previous.page !== currentSlide(state).page &&
        !before.black &&
        !state.black &&
        Math.abs(state.index - before.index) === 1
      ) {
        const toPage = currentSlide(state);
        const from = renderSlide(editor, previous);
        const to = renderSlide(editor, toPage);
        if (from.rect && to.rect) {
          const plan = planSlideTransition(editor.store, editor.registry, {
            from: { page: previous.page, rect: from.rect },
            to: { page: toPage.page, rect: to.rect },
            navigation: state.index > before.index ? "forward" : "backward",
          });
          if (plan.kind === "animate") {
            const emptySvg = (rect: typeof from.rect & {}) =>
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${rect.x} ${rect.y} ${rect.width} ${rect.height}"></svg>`;
            transition = {
              fromPage: previous.page,
              toPage: toPage.page,
              fromSvg: from.svg ?? emptySvg(from.rect),
              toSvg: to.svg ?? emptySvg(to.rect),
              fromRect: from.rect,
              toRect: to.rect,
              plan,
            };
          }
        }
      }
    }
  }
  function slide() {
    if (!state) return { src: null, size: null };
    const page = currentSlide(state);
    if (
      cache?.ref.page === page.page &&
      cache.ref.frame === page.frame &&
      cache.revision === editor.revision
    )
      return cache.result;
    const { svg, rect } = renderSlide(editor, page);
    const result = {
      src: svg
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        : null,
      size:
        (page.frame || editor.store.getMeta().slideSize) && rect
          ? { width: rect.width, height: rect.height }
          : svg
            ? svgSize(svg)
            : null,
    };
    cache = { ref: page, revision: editor.revision, result };
    return result;
  }
  return {
    state: () => state,
    dispatch,
    transition: () => transition,
    clearTransition: () => {
      transition = null;
    },
    refresh: () =>
      dispatch({
        type: "reconcile",
        slides: expandSlides(
          editor.store,
          editor.registry,
          slideList(editor.store.listPages()),
        ),
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
