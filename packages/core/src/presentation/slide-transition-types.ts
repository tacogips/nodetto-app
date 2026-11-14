import type { ElementId } from "@nodetto/ir";

export interface SlideViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface SlideBox extends SlideViewBox {
  readonly rotation: number;
}
export interface SlideAppearance {
  readonly opacity: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}
export type SlideStepKind =
  | "transform"
  | "crossfade"
  | "draw-on"
  | "grow"
  | "fade-in"
  | "fade-out"
  | "undraw"
  | "scale-in"
  | "scale-out"
  | "slide-in"
  | "slide-out"
  | "appear"
  | "disappear"
  | "swap"
  | "slide-fade";
export interface SlideTransitionStep {
  readonly kind: SlideStepKind;
  readonly from?: ElementId;
  readonly to?: ElementId;
  readonly start: number;
  readonly duration: number;
  readonly easing: "ease-in-out";
  readonly fromBox?: SlideBox;
  readonly toBox?: SlideBox;
  readonly fromAppearance?: SlideAppearance;
  readonly toAppearance?: SlideAppearance;
  readonly appearanceChanged?: boolean;
  readonly offset?: { readonly x: number; readonly y: number };
}
export type SlideTransitionPlan =
  | {
      readonly kind: "cut";
      readonly reason: "size-mismatch" | "empty" | "setting";
    }
  | {
      readonly kind: "animate";
      readonly duration: number;
      readonly steps: readonly SlideTransitionStep[];
    };

export type SlideNavigation = "forward" | "backward";
export interface SlideTiming {
  readonly move: number;
  readonly fadeOut: number;
  readonly entrance: number;
  readonly entranceOffset: number;
  readonly stagger: number;
  readonly staggerBudget: number;
}

export const SLIDE_MOVE_MS = 700;
export const SLIDE_FADE_OUT_MS = 300;
export const SLIDE_ENTRANCE_MS = 700;
export const SLIDE_ENTRANCE_OFFSET_MS = 300;
export const SLIDE_STAGGER_MS = 60;
export const SLIDE_STAGGER_BUDGET_MS = 480;

export const PHASE1_TIMING: SlideTiming = {
  move: SLIDE_MOVE_MS,
  fadeOut: SLIDE_FADE_OUT_MS,
  entrance: SLIDE_ENTRANCE_MS,
  entranceOffset: SLIDE_ENTRANCE_OFFSET_MS,
  stagger: SLIDE_STAGGER_MS,
  staggerBudget: SLIDE_STAGGER_BUDGET_MS,
};

export function staggerStart(
  rank: number,
  count: number,
  timing: SlideTiming = PHASE1_TIMING,
): number {
  return count <= 1
    ? 0
    : rank * Math.min(timing.stagger, timing.staggerBudget / (count - 1));
}

export function scopeSvgIds(svg: string, prefix: string): string {
  const ids = new Set<string>();
  for (const match of svg.matchAll(/\sid="([^"]*)"/g)) {
    if (match[1] !== undefined) ids.add(match[1]);
  }
  if (ids.size === 0) return svg;
  return svg
    .replace(
      /(\sid=")([^"]*)(")/g,
      (_match, before: string, id: string, after: string) =>
        `${before}${prefix}${id}${after}`,
    )
    .replace(
      /url\(#([^)]*)\)|(\s(?:xlink:)?href="#)([^"]*)(")/g,
      (
        match,
        urlId: string | undefined,
        before: string | undefined,
        hrefId: string | undefined,
        after: string | undefined,
      ) => {
        if (urlId !== undefined && ids.has(urlId))
          return `url(#${prefix}${urlId})`;
        if (hrefId !== undefined && ids.has(hrefId))
          return `${before}${prefix}${hrefId}${after}`;
        return match;
      },
    );
}

export function svgViewBox(svg: string): SlideViewBox | null {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0];
  const value = tag && /(?:^|\s)viewBox="([^"]+)"/.exec(tag)?.[1];
  if (!value?.trim()) return null;
  const parts = value.trim().split(/\s+/).map(Number);
  const [x, y, width, height] = parts;
  if (
    parts.length !== 4 ||
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    !parts.every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  return { x, y, width, height };
}
