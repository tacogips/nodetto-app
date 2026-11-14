import type { SlideBox, SlideTransitionStep } from "@nodetto/core";

type Origin = { readonly x: number; readonly y: number };
type Frames = { keyframes: Keyframe[]; options: KeyframeAnimationOptions };

export function shortestDelta(from: number, to: number): number {
  const delta = ((((from - to) % 360) + 540) % 360) - 180;
  return Object.is(delta, -0) ? 0 : delta;
}

/** Render the geometry of ofBox as asBox in the SVG coordinate system. */
export function poseTransform(
  asBox: SlideBox,
  ofBox: SlideBox,
  origin: Origin,
): string {
  const ax = asBox.x + asBox.width / 2 + origin.x;
  const ay = asBox.y + asBox.height / 2 + origin.y;
  const bx = ofBox.x + ofBox.width / 2 + origin.x;
  const by = ofBox.y + ofBox.height / 2 + origin.y;
  const sx = ofBox.width > 0 ? asBox.width / ofBox.width : 1;
  const sy = ofBox.height > 0 ? asBox.height / ofBox.height : 1;
  const rotation =
    ofBox.rotation + shortestDelta(asBox.rotation, ofBox.rotation);
  return `translate(${ax}px, ${ay}px) rotate(${rotation}deg) scale(${sx}, ${sy}) rotate(${-ofBox.rotation}deg) translate(${-bx}px, ${-by}px)`;
}

export function stepKeyframes(
  step: SlideTransitionStep,
  origins: { readonly from: Origin; readonly to: Origin },
): { incoming?: Frames; outgoing?: Frames } {
  const options: KeyframeAnimationOptions = {
    delay: step.start,
    duration: step.duration,
    easing: "ease-in-out",
    fill: "both",
  };
  const incoming = (keyframes: Keyframe[]): Frames => ({ keyframes, options });
  const outgoing = (keyframes: Keyframe[]): Frames => ({ keyframes, options });
  if (step.kind === "transform" && step.fromBox && step.toBox) {
    const from = step.fromBox;
    const to = step.toBox;
    const first: Keyframe = { transform: poseTransform(from, to, origins.to) };
    const last: Keyframe = { transform: poseTransform(to, to, origins.to) };
    if (step.appearanceChanged) {
      first.opacity = 0;
      last.opacity = 1;
      return {
        incoming: incoming([first, last]),
        outgoing: outgoing([
          { transform: poseTransform(from, from, origins.from), opacity: 1 },
          { transform: poseTransform(to, from, origins.from), opacity: 0 },
        ]),
      };
    }
    return { incoming: incoming([first, last]) };
  }
  if (step.kind === "crossfade")
    return {
      incoming: incoming([{ opacity: 0 }, { opacity: 1 }]),
      outgoing: outgoing([{ opacity: 1 }, { opacity: 0 }]),
    };
  if (step.kind === "fade-in")
    return { incoming: incoming([{ opacity: 0 }, { opacity: 1 }]) };
  if (step.kind === "fade-out")
    return { outgoing: outgoing([{ opacity: 1 }, { opacity: 0 }]) };
  return {};
}

export type DrawOnProbe = {
  tag: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dasharray: string | null;
  fillOpacity: number;
  length: number | null;
};
export type DrawOnClass = "outline" | "fill" | "other" | "none";
const geometry = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

export function classifyDrawOn(probes: readonly DrawOnProbe[]): DrawOnClass[] {
  return probes.map((probe): DrawOnClass => {
    const fill = probe.fill.toLowerCase() !== "none";
    const stroke =
      probe.stroke.toLowerCase() !== "none" && probe.strokeWidth > 0;
    if (!fill && !stroke) return "none";
    if (geometry.has(probe.tag.toLowerCase())) {
      if (
        stroke &&
        (!probe.dasharray || probe.dasharray === "none") &&
        probe.length !== null &&
        probe.length > 0 &&
        Number.isFinite(probe.length)
      )
        return "outline";
      if (!stroke && fill) return "fill";
    }
    return "other";
  });
}

export function drawOnKeyframes(
  cls: DrawOnClass,
  probe: DrawOnProbe,
  kind: "draw-on" | "grow",
): Keyframe[] {
  if (cls === "none") return [];
  if (cls === "fill")
    return [
      { offset: 0, fillOpacity: 0 },
      { offset: 0.5, fillOpacity: 0 },
      { offset: 1, fillOpacity: probe.fillOpacity },
    ];
  if (cls === "other")
    return [
      { offset: 0, opacity: 0 },
      { offset: 0.5, opacity: 0 },
      { offset: 1, opacity: 1 },
    ];
  const length = probe.length ?? 0;
  const end = kind === "grow" ? 1 : 0.6;
  const frames: Keyframe[] = [
    { offset: 0, strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
    { offset: end, strokeDasharray: `${length}`, strokeDashoffset: "0" },
  ];
  if (probe.fill.toLowerCase() !== "none") {
    // Separate offset keyframes preserve both the dash and fill schedules.
    frames.push(
      { offset: 0, fillOpacity: 0 },
      { offset: 0.5, fillOpacity: 0 },
      { offset: 1, fillOpacity: probe.fillOpacity },
    );
    frames.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
  }
  return frames;
}
