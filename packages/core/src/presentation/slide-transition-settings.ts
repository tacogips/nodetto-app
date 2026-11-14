import {
  type Element,
  type SlideEnterEffect,
  type SlideExitEffect,
  type SlideLinkedMotion,
  type SlideSide,
  getElementTypeDefinition,
} from "@nodetto/ir";
import {
  PHASE1_TIMING,
  type SlideBox,
  type SlideTiming,
  type SlideViewBox,
} from "./slide-transition-types.ts";

export function slideTiming(durationMs?: number): SlideTiming {
  if (durationMs === undefined) return PHASE1_TIMING;
  const factor = durationMs / 700;
  return {
    move: PHASE1_TIMING.move * factor,
    fadeOut: PHASE1_TIMING.fadeOut * factor,
    entrance: PHASE1_TIMING.entrance * factor,
    entranceOffset: PHASE1_TIMING.entranceOffset * factor,
    stagger: PHASE1_TIMING.stagger * factor,
    staggerBudget: PHASE1_TIMING.staggerBudget * factor,
  };
}
export function mirrorEnter(
  effect?: SlideEnterEffect,
  side?: SlideSide,
): { effect: SlideExitEffect; side?: SlideSide } {
  const effects: Record<SlideEnterEffect, SlideExitEffect> = {
    auto: "auto",
    none: "none",
    "fade-in": "fade-out",
    "draw-on": "undraw",
    grow: "undraw",
    "scale-in": "scale-out",
    "slide-in": "slide-out",
  };
  return { effect: effects[effect ?? "auto"], side };
}
export function mirrorExit(
  effect?: SlideExitEffect,
  side?: SlideSide,
): { effect: SlideEnterEffect; side?: SlideSide } {
  const effects: Record<SlideExitEffect, SlideEnterEffect> = {
    auto: "auto",
    none: "none",
    "fade-out": "fade-in",
    undraw: "draw-on",
    "scale-out": "scale-in",
    "slide-out": "slide-in",
  };
  return { effect: effects[effect ?? "auto"], side };
}
function isEdge(element: Element): boolean {
  return getElementTypeDefinition(element.type)?.category === "edge";
}
export function resolveEntrance(element: Element, effect?: SlideEnterEffect) {
  const edge = isEdge(element);
  if (effect === "none") return "appear";
  if (effect === "fade-in") return effect;
  if (edge && effect === "grow") return effect;
  if (
    !edge &&
    (effect === "draw-on" || effect === "scale-in" || effect === "slide-in")
  )
    return effect;
  return edge
    ? "grow"
    : element.type === "text.note" || element.type === "image.raster"
      ? "fade-in"
      : "draw-on";
}
export function resolveExit(element: Element, effect?: SlideExitEffect) {
  if (effect === "none") return "disappear";
  if (effect === "fade-out" || effect === "undraw") return effect;
  if (!isEdge(element) && (effect === "scale-out" || effect === "slide-out"))
    return effect;
  return "fade-out";
}
export function resolveLinked(
  motion: SlideLinkedMotion | undefined,
  edge: boolean,
) {
  return motion === "cut"
    ? "swap"
    : motion === "crossfade" || edge
      ? "crossfade"
      : "transform";
}
export function slideOffset(
  box: SlideBox,
  rect: SlideViewBox,
  side: SlideSide = "bottom",
): { x: number; y: number } {
  const radians = (box.rotation * Math.PI) / 180;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = [
    [-box.width / 2, -box.height / 2],
    [box.width / 2, -box.height / 2],
    [-box.width / 2, box.height / 2],
    [box.width / 2, box.height / 2],
  ] as const;
  const xs = points.map(([x, y]) => cx + x * cos - y * sin);
  const ys = points.map(([x, y]) => cy + x * sin + y * cos);
  switch (side) {
    case "left":
      return { x: -Math.max(...xs), y: 0 };
    case "right":
      return { x: rect.width - Math.min(...xs), y: 0 };
    case "top":
      return { x: 0, y: -Math.max(...ys) };
    case "bottom":
      return { x: 0, y: rect.height - Math.min(...ys) };
  }
}
