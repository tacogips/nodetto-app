import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import {
  pageFramePresetLabel,
  pageFrameSizeCommands,
  pageFrameToggleCommands,
} from "./page-frame-edits.ts";

const frame: Element = {
  id: "frame",
  page: "page",
  index: "a0",
  type: "frame",
  semantic: { name: "Frame" },
  visual: { width: 100, height: 200 },
};

test("page toggle follows flow and removes the page role", () => {
  expect(pageFrameToggleCommands(frame, "vertical")).toEqual([
    {
      type: "updateSemantic",
      id: "frame",
      semantic: {
        name: "Frame",
        page: { size: "a4", orientation: "portrait" },
      },
    },
    { type: "updateVisual", id: "frame", visual: { width: 794, height: 1123 } },
  ]);
  expect(pageFrameToggleCommands(frame, "horizontal")[1]).toEqual({
    type: "updateVisual",
    id: "frame",
    visual: { width: 1920, height: 1080 },
  });
  expect(
    pageFrameToggleCommands(
      {
        ...frame,
        semantic: {
          name: "Frame",
          page: { size: "a4", orientation: "portrait" },
        },
      },
      "vertical",
    ),
  ).toEqual([
    { type: "updateSemantic", id: "frame", semantic: { name: "Frame" } },
  ]);
});

test("page presets resize and custom dimensions remain unchanged", () => {
  expect(pageFrameSizeCommands(frame, "letter", "landscape")[1]).toEqual({
    type: "updateVisual",
    id: "frame",
    visual: { width: 1056, height: 816 },
  });
  expect(pageFrameSizeCommands(frame, "custom", "portrait")[1]).toEqual({
    type: "updateVisual",
    id: "frame",
    visual: { width: 100, height: 200 },
  });
  expect(
    pageFramePresetLabel({
      ...frame,
      semantic: {
        name: "Frame",
        page: { size: "a4", orientation: "portrait" },
      },
      visual: { width: 795, height: 1123 },
    }),
  ).toBe("Custom");
});
