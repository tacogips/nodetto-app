export type PageOrientation = "portrait" | "landscape";
export const PAGE_FRAME_PRESETS = [
  {
    id: "a4",
    label: "A4",
    portrait: { width: 794, height: 1123 },
    defaultOrientation: "portrait",
  },
  {
    id: "a5",
    label: "A5",
    portrait: { width: 559, height: 794 },
    defaultOrientation: "portrait",
  },
  {
    id: "letter",
    label: "Letter",
    portrait: { width: 816, height: 1056 },
    defaultOrientation: "portrait",
  },
  {
    id: "legal",
    label: "Legal",
    portrait: { width: 816, height: 1344 },
    defaultOrientation: "portrait",
  },
  {
    id: "slide-16-9",
    label: "Slide 16:9",
    portrait: { width: 1080, height: 1920 },
    defaultOrientation: "landscape",
  },
  {
    id: "slide-4-3",
    label: "Slide 4:3",
    portrait: { width: 768, height: 1024 },
    defaultOrientation: "landscape",
  },
] as const;
export function pageFrameSize(
  size: string,
  orientation: PageOrientation,
  current?: { width: number; height: number },
): { width: number; height: number } {
  if (size === "custom" && current) return { ...current };
  const preset =
    PAGE_FRAME_PRESETS.find((item) => item.id === size) ??
    PAGE_FRAME_PRESETS[0];
  return orientation === "landscape"
    ? { width: preset.portrait.height, height: preset.portrait.width }
    : { ...preset.portrait };
}
export function pageFramePresetOf(
  box: { width: number; height: number },
  page: { size: string; orientation: string } | undefined,
): string {
  if (
    !page ||
    !PAGE_FRAME_PRESETS.some((preset) => preset.id === page.size) ||
    (page.orientation !== "portrait" && page.orientation !== "landscape")
  )
    return "custom";
  const size = pageFrameSize(page.size, page.orientation);
  return Math.abs(box.width - size.width) <= 0.5 &&
    Math.abs(box.height - size.height) <= 0.5
    ? page.size
    : "custom";
}
