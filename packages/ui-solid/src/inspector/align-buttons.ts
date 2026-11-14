import type { AlignMode, DistributeAxis } from "@nodetto/core";
import type { ToolbarIconKey } from "../ToolbarIcon.tsx";

export type AlignButton =
  | {
      readonly kind: "align";
      readonly icon: ToolbarIconKey;
      readonly label: string;
      readonly mode: AlignMode;
    }
  | {
      readonly kind: "distribute";
      readonly icon: ToolbarIconKey;
      readonly label: string;
      readonly axis: DistributeAxis;
    };

/** Horizontal alignment, vertical alignment, then even spacing. */
export const ALIGN_BUTTON_GROUPS: readonly (readonly AlignButton[])[] = [
  [
    { kind: "align", icon: "alignLeft", label: "Align left", mode: "left" },
    {
      kind: "align",
      icon: "alignHCenter",
      label: "Align horizontal centres",
      mode: "hcenter",
    },
    { kind: "align", icon: "alignRight", label: "Align right", mode: "right" },
  ],
  [
    { kind: "align", icon: "alignTop", label: "Align top", mode: "top" },
    {
      kind: "align",
      icon: "alignVCenter",
      label: "Align vertical centres",
      mode: "vcenter",
    },
    {
      kind: "align",
      icon: "alignBottom",
      label: "Align bottom",
      mode: "bottom",
    },
  ],
  [
    {
      kind: "distribute",
      icon: "distributeHorizontal",
      label: "Distribute horizontally",
      axis: "horizontal",
    },
    {
      kind: "distribute",
      icon: "distributeVertical",
      label: "Distribute vertically",
      axis: "vertical",
    },
  ],
];

/** Aligning needs two movable units; even spacing needs three. */
export function alignButtonEnabled(
  button: AlignButton,
  units: number,
): boolean {
  return units >= (button.kind === "align" ? 2 : 3);
}
