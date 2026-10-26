import type {
  BreadboardNetlistSemantic,
  Element,
  ElementId,
  PageId,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";

export interface BreadboardPinRef {
  readonly elementId: ElementId;
  readonly pin: number;
}

export interface BreadboardNet {
  readonly id: number;
  readonly pins: readonly BreadboardPinRef[];
  readonly strips: readonly {
    readonly boardId: ElementId;
    readonly strip: string;
  }[];
  readonly wireIds: readonly ElementId[];
}

export interface BreadboardConnectivity {
  readonly nets: readonly BreadboardNet[];
  netOfPin(ref: BreadboardPinRef): number | undefined;
  netOfWire(id: ElementId): number | undefined;
  pinOnHole(ref: BreadboardPinRef): boolean;
  wireEndOnHoleOrPin(id: ElementId, end: 0 | 1): boolean;
}

export type BreadboardErcRuleId =
  | "pin-not-in-hole"
  | "shorted-part"
  | "rail-short"
  | "reversed-polarity"
  | "led-no-series-resistor"
  | "unconnected-pin"
  | "duplicate-reference"
  | "wire-end-off-hole"
  | "parity-missing-connection"
  | "parity-extra-connection"
  | "parity-missing-part"
  | "parity-extra-part"
  | "parity-value-mismatch";

export const BREADBOARD_ERC_RULE_IDS: readonly BreadboardErcRuleId[] = [
  "pin-not-in-hole",
  "shorted-part",
  "rail-short",
  "reversed-polarity",
  "led-no-series-resistor",
  "unconnected-pin",
  "duplicate-reference",
  "wire-end-off-hole",
  "parity-missing-connection",
  "parity-extra-connection",
  "parity-missing-part",
  "parity-extra-part",
  "parity-value-mismatch",
];

export const BREADBOARD_ERC_SEVERITY: Readonly<
  Record<BreadboardErcRuleId, "error" | "warning">
> = {
  "pin-not-in-hole": "error",
  "shorted-part": "error",
  "rail-short": "error",
  "reversed-polarity": "error",
  "led-no-series-resistor": "warning",
  "unconnected-pin": "warning",
  "duplicate-reference": "error",
  "wire-end-off-hole": "error",
  "parity-missing-connection": "warning",
  "parity-extra-connection": "error",
  "parity-missing-part": "warning",
  "parity-extra-part": "warning",
  "parity-value-mismatch": "warning",
};

export interface BreadboardErcFinding {
  readonly ruleId: BreadboardErcRuleId;
  readonly severity: "error" | "warning";
  readonly elementId: ElementId;
  readonly pin?: number;
  readonly elementIds: readonly ElementId[];
  readonly message: string;
}

export interface RatsnestEnd {
  readonly elementId: ElementId;
  readonly pin: number;
  readonly x: number;
  readonly y: number;
}

export interface RatsnestLine {
  readonly targetNet: string;
  readonly from: RatsnestEnd;
  readonly to: RatsnestEnd;
}

export interface BreadboardProbe {
  readonly pageId: PageId;
  readonly elementIds: readonly ElementId[];
  readonly pin?: BreadboardPinRef;
}

export function breadboardTargetNetlist(
  document: import("@nodetto/ir").Document,
  pageId: PageId,
):
  | { readonly element: Element; readonly semantic: BreadboardNetlistSemantic }
  | undefined {
  const [target] = document.elements
    .filter(
      (element) =>
        element.page === pageId &&
        element.type === "breadboard.netlist" &&
        element.visual.hidden !== true,
    )
    .sort(
      (left, right) =>
        compareFractional(left.index, right.index) ||
        compareFractional(left.id, right.id),
    );
  if (!target) return undefined;
  return {
    element: target,
    semantic: target.semantic as BreadboardNetlistSemantic,
  };
}
