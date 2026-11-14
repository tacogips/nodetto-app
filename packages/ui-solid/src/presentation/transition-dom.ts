import type { SlideTransitionPlan } from "@nodetto/core";
import {
  classifyDrawOn,
  drawOnKeyframes,
  type DrawOnProbe,
  stepKeyframes,
} from "./transition-keyframes.ts";

export type SlideNodeLookup = ReadonlyArray<{
  target: Pick<Element, "animate">;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  onFinish?: () => void;
}>;
type Job = SlideNodeLookup[number];
type Origins = { from: { x: number; y: number }; to: { x: number; y: number } };
const painted =
  "path,rect,circle,ellipse,line,polyline,polygon,text,image,foreignObject,use";
const definitions = new Set([
  "defs",
  "clippath",
  "mask",
  "marker",
  "pattern",
  "lineargradient",
  "radialgradient",
  "filter",
  "symbol",
]);
const markerNames = ["marker-start", "marker-mid", "marker-end"];

function findNode(root: Element, id: string | undefined): Element | undefined {
  if (id === undefined) return undefined;
  return Array.from(root.querySelectorAll("g[data-id]")).find(
    (node) =>
      node.getAttribute("data-id") === id &&
      isPainted(node, root) &&
      node.getAttribute("data-type") !== "group",
  );
}
function wrap(node: Element): Element {
  const wrapper = node.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  wrapper.setAttribute(
    "style",
    "transform-box: view-box; transform-origin: 0 0",
  );
  node.parentNode?.insertBefore(wrapper, node);
  wrapper.appendChild(node);
  return wrapper;
}
function inherited(
  node: Element,
  root: Element,
  name: string,
  fallback: string,
): string {
  let current: Element | null = node;
  while (current) {
    const value = current.getAttribute(name);
    if (value !== null) return value;
    if (current === root) break;
    current = current.parentElement;
  }
  return fallback;
}
function isPainted(node: Element, root: Element): boolean {
  if (definitions.has(node.localName.toLowerCase())) return false;
  let current = node.parentElement;
  while (current && current !== root) {
    if (definitions.has(current.localName.toLowerCase())) return false;
    current = current.parentElement;
  }
  return current === root;
}
function probe(node: Element, root: Element): DrawOnProbe {
  const measure = (node as Element & { getTotalLength?: () => number })
    .getTotalLength;
  let length: number | null = null;
  if (typeof measure === "function") {
    try {
      const measured = measure.call(node);
      if (Number.isFinite(measured) && measured > 0) length = measured;
    } catch {
      /* Some SVG implementations cannot measure every geometry. */
    }
  }
  return {
    tag: node.localName.toLowerCase(),
    fill: inherited(node, root, "fill", "black"),
    stroke: inherited(node, root, "stroke", "none"),
    strokeWidth: Number.parseFloat(inherited(node, root, "stroke-width", "1")),
    dasharray: inherited(node, root, "stroke-dasharray", "") || null,
    fillOpacity: Number.parseFloat(inherited(node, root, "fill-opacity", "1")),
    length,
  };
}
function removeMarkers(root: Element): () => void {
  const saved: Array<{ node: Element; name: string; value: string }> = [];
  for (const node of [
    root,
    ...root.querySelectorAll("[marker-start],[marker-mid],[marker-end]"),
  ]) {
    if (node !== root && !isPainted(node, root)) continue;
    for (const name of markerNames) {
      const value = node.getAttribute(name);
      if (value !== null) {
        saved.push({ node, name, value });
        node.removeAttribute(name);
      }
    }
  }
  return () => {
    for (const { node, name, value } of saved) node.setAttribute(name, value);
  };
}

/** Prepare isolated animation targets without changing exported element transforms. */
export function prepareTransition(
  outgoingSvg: Element,
  incomingSvg: Element,
  plan: SlideTransitionPlan,
  origins: Origins,
): SlideNodeLookup {
  const jobs: Job[] = [];
  if (plan.kind !== "animate") return jobs;
  for (const step of plan.steps) {
    const outgoing = findNode(outgoingSvg, step.from);
    const incoming = findNode(incomingSvg, step.to);
    if (
      (step.from !== undefined && !outgoing) ||
      (step.to !== undefined && !incoming)
    )
      continue;
    if (step.kind === "draw-on" || step.kind === "grow") {
      if (!incoming) continue;
      const wrapper = wrap(incoming);
      const nodes = Array.from(incoming.querySelectorAll(painted)).filter(
        (node) => isPainted(node, incoming),
      );
      const probes = nodes.map((node) => probe(node, incoming));
      const classes = classifyDrawOn(probes);
      const options: KeyframeAnimationOptions = {
        delay: step.start,
        duration: step.duration,
        easing: "ease-in-out",
        fill: "both",
      };
      const restore =
        step.kind === "grow" ? removeMarkers(incoming) : undefined;
      const start = jobs.length;
      if (!classes.includes("outline")) {
        jobs.push({
          target: wrapper,
          keyframes: [{ opacity: 0 }, { opacity: 1 }],
          options,
        });
      } else {
        nodes.forEach((node, index) => {
          const cls = classes[index];
          const item = probes[index];
          if (cls && item && cls !== "none")
            jobs.push({
              target: node,
              keyframes: drawOnKeyframes(
                cls,
                item,
                step.kind as "draw-on" | "grow",
              ),
              options,
            });
        });
      }
      if (restore) {
        const first = jobs[start];
        if (first) jobs[start] = { ...first, onFinish: restore };
        else restore();
      }
      continue;
    }
    const frames = stepKeyframes(step, origins);
    if (
      outgoing &&
      step.kind === "transform" &&
      step.appearanceChanged === false
    )
      outgoing.setAttribute("visibility", "hidden");
    if (outgoing && frames.outgoing)
      jobs.push({ target: wrap(outgoing), ...frames.outgoing });
    if (incoming && frames.incoming)
      jobs.push({ target: wrap(incoming), ...frames.incoming });
  }
  return jobs;
}
