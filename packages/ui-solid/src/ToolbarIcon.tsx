import { findIcon, renderIconMarkup } from "@nodetto/core";
import type { JSX } from "solid-js";

export const TOOLBAR_ICONS = {
  duplicate: "copy",
  delete: "trash-2",
  comment: "message-square-plus",
  straightenConnector: "minus",
  colors: "palette",
  text: "type",
  arrange: "layers",
  properties: "sliders-horizontal",
  bringToFront: "bring-to-front",
  sendToBack: "send-to-back",
  frameSelection: "frame",
  group: "group",
  ungroup: "ungroup",
  booleanUnion: "squares-unite",
  booleanSubtract: "squares-subtract",
  booleanIntersect: "squares-intersect",
  booleanExclude: "squares-exclude",
  flattenBoolean: "layers-2",
  alignLeft: "align-start-vertical",
  alignHCenter: "align-center-vertical",
  alignRight: "align-end-vertical",
  alignTop: "align-start-horizontal",
  alignVCenter: "align-center-horizontal",
  alignBottom: "align-end-horizontal",
  fontSmaller: "a-arrow-down",
  fontLarger: "a-arrow-up",
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikethrough: "strikethrough",
  textAlignStart: "text-align-start",
  textAlignMiddle: "text-align-center",
  textAlignEnd: "text-align-end",
  verticalTop: "align-vertical-justify-start",
  verticalMiddle: "align-vertical-justify-center",
  verticalBottom: "align-vertical-justify-end",
  distributeHorizontal: "align-horizontal-distribute-center",
  distributeVertical: "align-vertical-distribute-center",
} as const;

export type ToolbarIconKey = keyof typeof TOOLBAR_ICONS;

export function ToolbarIcon(props: {
  readonly name: ToolbarIconKey;
}): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      {...{ focusable: "false" }}
      class="nodetto-toolbar-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      innerHTML={renderIconMarkup(
        findIcon(TOOLBAR_ICONS[props.name]) ?? { path: "" },
        { x: 0, y: 0, width: 24, height: 24 },
        { stroke: "currentColor", strokeWidth: 2, fill: "none", viewBox: 24 },
      )}
    />
  );
}
