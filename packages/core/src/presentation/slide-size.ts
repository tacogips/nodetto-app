import type { SlideSize } from "./fit.ts";

export type SlideSizePresetId = "16:9" | "4:3" | "16:10" | "a4-landscape";
export const SLIDE_SIZE_PRESETS: readonly {
  readonly id: SlideSizePresetId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}[] = [
  { id: "16:9", label: "16:9", width: 1920, height: 1080 },
  { id: "4:3", label: "4:3", width: 1024, height: 768 },
  { id: "16:10", label: "16:10", width: 1920, height: 1200 },
  { id: "a4-landscape", label: "A4 landscape", width: 1123, height: 794 },
];
export const DEFAULT_SLIDE_SIZE: SlideSize = { width: 1920, height: 1080 };
export function slideSizePreset(size: SlideSize): SlideSizePresetId | "custom" {
  return (
    SLIDE_SIZE_PRESETS.find(
      (preset) => preset.width === size.width && preset.height === size.height,
    )?.id ?? "custom"
  );
}
