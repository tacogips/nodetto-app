import { expect, test } from "bun:test";
import {
  DEFAULT_SLIDE_SIZE,
  SLIDE_SIZE_PRESETS,
  slideSizePreset,
} from "./slide-size.ts";

test("slide size presets and exact matching", () => {
  expect(SLIDE_SIZE_PRESETS).toEqual([
    { id: "16:9", label: "16:9", width: 1920, height: 1080 },
    { id: "4:3", label: "4:3", width: 1024, height: 768 },
    { id: "16:10", label: "16:10", width: 1920, height: 1200 },
    { id: "a4-landscape", label: "A4 landscape", width: 1123, height: 794 },
  ]);
  expect(DEFAULT_SLIDE_SIZE).toEqual({ width: 1920, height: 1080 });
  expect(slideSizePreset({ width: 1024, height: 768 })).toBe("4:3");
  expect(slideSizePreset({ width: 1000, height: 700 })).toBe("custom");
});
