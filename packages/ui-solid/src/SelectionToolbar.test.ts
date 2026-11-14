import { expect, test } from "bun:test";
import { findIcon } from "@nodetto/core";
import { TOOLBAR_ICONS } from "./ToolbarIcon.tsx";
import { getAction } from "./shortcuts.ts";
import { ARRANGE_BUTTONS, placeAbove } from "./SelectionToolbar.tsx";

test("placeAbove clamps a compact selection toolbar inside its host", () => {
  expect(
    placeAbove(
      180,
      220,
      8,
      { width: 140, height: 32 },
      { width: 400, height: 300 },
    ),
  ).toEqual({ x: 130, y: 4 });
  expect(
    placeAbove(
      390,
      410,
      100,
      { width: 140, height: 32 },
      { width: 400, height: 300 },
    ),
  ).toEqual({ x: 256, y: 58 });
});

test("arrange icons resolve for the six alignment actions", () => {
  expect(ARRANGE_BUTTONS.map((entry) => entry.id)).toEqual([
    "alignLeft",
    "alignHCenter",
    "alignRight",
    "alignTop",
    "alignVCenter",
    "alignBottom",
  ]);
  for (const entry of ARRANGE_BUTTONS) {
    expect(() => getAction(entry.id)).not.toThrow();
    expect(Object.hasOwn(TOOLBAR_ICONS, entry.icon)).toBe(true);
    expect(findIcon(TOOLBAR_ICONS[entry.icon])).toBeDefined();
  }
});
