import {
  scopeSvgIds,
  type SlideTransitionPlan,
  type SlideViewBox,
} from "@nodetto/core";
import { onCleanup, onMount } from "solid-js";
import { prepareTransition } from "./transition-dom.ts";
import type { SlideTransitionRunner } from "./transition-runner.ts";

let nextSvgId = 0;
export interface TransitionLayerProps {
  outgoingSvg: string;
  incomingSvg: string;
  plan: Extract<SlideTransitionPlan, { kind: "animate" }>;
  fromRect: SlideViewBox;
  toRect: SlideViewBox;
  runner: SlideTransitionRunner;
  onDone: (result: "finished" | "cancelled") => void;
}

export function TransitionLayer(props: TransitionLayerProps) {
  let outgoing!: HTMLDivElement;
  let incoming!: HTMLDivElement;
  onMount(() => {
    outgoing.innerHTML = scopeSvgIds(
      props.outgoingSvg,
      `nodetto-slide-${nextSvgId++}-`,
    );
    incoming.innerHTML = scopeSvgIds(
      props.incomingSvg,
      `nodetto-slide-${nextSvgId++}-`,
    );
    const fromSvg = outgoing.querySelector("svg");
    const toSvg = incoming.querySelector("svg");
    if (!fromSvg || !toSvg) {
      props.onDone("cancelled");
      return;
    }
    for (const svg of [fromSvg, toSvg]) {
      svg.style.width = "100%";
      svg.style.height = "100%";
    }
    const jobs = prepareTransition(fromSvg, toSvg, props.plan, {
      from: props.fromRect,
      to: props.toRect,
    });
    void props.runner.play(jobs).then(props.onDone);
  });
  onCleanup(() => props.runner.cancel());
  const slideStyle = {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
  } as const;
  return (
    <div style={{ position: "absolute", inset: "0", "pointer-events": "none" }}>
      <div ref={outgoing} style={slideStyle} />
      <div ref={incoming} style={slideStyle} />
    </div>
  );
}
