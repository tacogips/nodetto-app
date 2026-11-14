import type { PageId } from "@nodetto/ir";

export interface PresentationState {
  readonly slides: readonly PageId[];
  readonly index: number;
  readonly black: boolean;
  readonly digits: string;
}
export type PresentationAction =
  | {
      type:
        | "next"
        | "prev"
        | "first"
        | "last"
        | "toggleBlack"
        | "enter"
        | "clearDigits";
    }
  | { type: "goto"; n: number }
  | { type: "digit"; digit: string }
  | { type: "reconcile"; slides: readonly PageId[] };
const clamp = (n: number, total: number) =>
  Math.max(0, Math.min(total - 1, Math.trunc(n)));
export function createPresentationState(
  slides: readonly PageId[],
  index: number,
): PresentationState {
  if (!slides.length)
    throw new Error("Presentation requires at least one slide");
  return {
    slides,
    index: clamp(Number.isFinite(index) ? index : 0, slides.length),
    black: false,
    digits: "",
  };
}
export function currentSlide(state: PresentationState): PageId {
  return state.slides[state.index] as PageId;
}
export function slideCounter(state: PresentationState): {
  n: number;
  total: number;
} {
  return { n: state.index + 1, total: state.slides.length };
}
export function reducePresentation(
  state: PresentationState,
  action: PresentationAction,
): PresentationState | null {
  const navigate = (index: number): PresentationState => ({
    ...state,
    index: clamp(index, state.slides.length),
    black: false,
    digits: "",
  });
  switch (action.type) {
    case "next":
      return navigate(state.index + 1);
    case "prev":
      return navigate(state.index - 1);
    case "first":
      return navigate(0);
    case "last":
      return navigate(state.slides.length - 1);
    case "goto":
      return Number.isFinite(action.n) ? navigate(action.n - 1) : state;
    case "toggleBlack":
      return { ...state, black: !state.black, digits: "" };
    case "digit":
      return /^[0-9]$/.test(action.digit) && state.digits.length < 4
        ? { ...state, digits: state.digits + action.digit }
        : state;
    case "clearDigits":
      return { ...state, digits: "" };
    case "enter":
      return state.digits
        ? navigate(Number(state.digits) - 1)
        : navigate(state.index + 1);
    case "reconcile": {
      if (!action.slides.length) return null;
      const index = action.slides.indexOf(currentSlide(state));
      return {
        ...state,
        slides: action.slides,
        index: index < 0 ? clamp(state.index, action.slides.length) : index,
        digits: "",
      };
    }
  }
}
