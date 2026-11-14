import { expect, test } from "bun:test";
import { findIcon } from "@nodetto/core";
import { TOOLBAR_ICONS } from "./ToolbarIcon";

const expectedIcons = {
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

test("toolbar icon mapping matches the accepted contract", () => {
  expect(Object.keys(TOOLBAR_ICONS)).toHaveLength(38);
  expect(TOOLBAR_ICONS).toEqual(expectedIcons);
  expect(new Set(Object.values(TOOLBAR_ICONS)).size).toBe(38);
});

test("every toolbar icon exists in the registry", () => {
  for (const name of Object.values(TOOLBAR_ICONS)) {
    expect(findIcon(name), `Missing toolbar icon: ${name}`).toBeDefined();
  }
});
