import {
  PAGE_FRAME_PRESETS,
  pageFramePresetOf,
  pageFrameSize,
  type Command,
  type PageFlow,
  type PageOrientation,
} from "@nodetto/core";
import type { Element, FrameSemantic, PageFrameSize } from "@nodetto/ir";

export function pageFrameSizeCommands(
  element: Element,
  size: PageFrameSize,
  orientation: PageOrientation,
): Command[] {
  const semantic = element.semantic as FrameSemantic;
  const dimensions = pageFrameSize(size, orientation, {
    width: element.visual.width ?? 0,
    height: element.visual.height ?? 0,
  });
  return [
    {
      type: "updateSemantic",
      id: element.id,
      semantic: { ...semantic, page: { size, orientation } },
    },
    { type: "updateVisual", id: element.id, visual: dimensions },
  ];
}

export function pageFrameToggleCommands(
  element: Element,
  flow: PageFlow,
): Command[] {
  const semantic = element.semantic as FrameSemantic;
  if (semantic.page) {
    const { page: _page, ...rest } = semantic;
    return [{ type: "updateSemantic", id: element.id, semantic: rest }];
  }
  return pageFrameSizeCommands(
    element,
    flow === "horizontal" ? "slide-16-9" : "a4",
    flow === "horizontal" ? "landscape" : "portrait",
  );
}

export function pageFramePresetLabel(element: Element): string {
  const semantic = element.semantic as FrameSemantic;
  const id = pageFramePresetOf(
    { width: element.visual.width ?? 0, height: element.visual.height ?? 0 },
    semantic.page,
  );
  return (
    PAGE_FRAME_PRESETS.find((preset) => preset.id === id)?.label ?? "Custom"
  );
}
