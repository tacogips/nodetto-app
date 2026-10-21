import type { StateTransitionSemantic } from "./semantics.ts";

export function stateTransitionLabel(
  semantic: Partial<StateTransitionSemantic>,
): string {
  return [
    semantic.trigger,
    semantic.guard ? `[${semantic.guard}]` : "",
    semantic.effect ? `/ ${semantic.effect}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
