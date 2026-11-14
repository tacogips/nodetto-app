import { prototypeFlows, type ShapeContext, type Store } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";

export interface PresentationFlow {
  readonly name: string;
  readonly startId: ElementId;
}

export function presentationFlows(
  store: Store,
  context: ShapeContext,
): readonly PresentationFlow[] {
  return prototypeFlows(store, context).flows.map(({ name, startId }) => ({
    name,
    startId,
  }));
}

export function initialScreen(
  flows: readonly PresentationFlow[],
  requestedFlow: string | undefined,
  selectedFrame: ElementId | undefined,
  fallbackFrames: readonly ElementId[],
): ElementId | undefined {
  return (
    flows.find((flow) => flow.name === requestedFlow)?.startId ??
    flows[0]?.startId ??
    selectedFrame ??
    fallbackFrames[0]
  );
}

export function presentationKeyAction(
  key: string,
  state: { overlays: number; history: number },
): "back" | "close-overlay" | "exit" | "restart" | undefined {
  if (key === "Escape") return state.overlays > 0 ? "close-overlay" : "exit";
  if ((key === "Backspace" || key === "ArrowLeft") && state.history > 0)
    return "back";
  if (key === "r" || key === "R") return "restart";
  return undefined;
}
