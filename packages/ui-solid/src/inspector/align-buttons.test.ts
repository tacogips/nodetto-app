import { expect, test } from "bun:test";
import { TOOLBAR_ICONS } from "../ToolbarIcon.tsx";
import { ALIGN_BUTTON_GROUPS, alignButtonEnabled } from "./align-buttons.ts";

test("align buttons cover both axes and even spacing with known icons", () => {
  const buttons = ALIGN_BUTTON_GROUPS.flat();
  expect(buttons.map((b) => (b.kind === "align" ? b.mode : b.axis))).toEqual([
    "left",
    "hcenter",
    "right",
    "top",
    "vcenter",
    "bottom",
    "horizontal",
    "vertical",
  ]);
  for (const button of buttons) {
    expect(TOOLBAR_ICONS[button.icon]).toBeDefined();
    expect(button.label.length).toBeGreaterThan(0);
  }
});

test("aligning needs two units and distributing three", () => {
  const [left] = ALIGN_BUTTON_GROUPS[0] ?? [];
  const [spread] = ALIGN_BUTTON_GROUPS[2] ?? [];
  if (!left || !spread) throw new Error("missing buttons");
  expect(alignButtonEnabled(left, 1)).toBe(false);
  expect(alignButtonEnabled(left, 2)).toBe(true);
  expect(alignButtonEnabled(spread, 2)).toBe(false);
  expect(alignButtonEnabled(spread, 3)).toBe(true);
});
