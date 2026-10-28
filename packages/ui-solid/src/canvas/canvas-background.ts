import type { PageKind } from "@nodetto/ir";

export type CanvasMode = "light" | "dark";

export interface CanvasBackgroundSetting {
  readonly diagram: CanvasMode;
  readonly pcb: CanvasMode;
}

export function canvasModeFor(
  pageKind: PageKind | undefined,
  setting: CanvasBackgroundSetting | undefined,
): CanvasMode {
  if (!setting) {
    return "light";
  }
  return pageKind === "pcb" ? setting.pcb : setting.diagram;
}

export const CANVAS_DARK_CLASS = "nodetto-canvas-dark";
