// Theme, export options, and the stroke and padding shared by renderers.

import type { Box } from "../geometry.ts";
import { TEXT_NOTE_PADDING_X } from "../text-layout.ts";

/** Colours and type, mirroring the app stylesheet's custom properties. */
export interface SvgTheme {
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly surface: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly fontFamily: string;
  readonly fontSize: number;
}

export const DEFAULT_SVG_THEME: SvgTheme = {
  ink: "#1d2a2e",
  muted: "#596366",
  line: "#d8d2c3",
  surface: "#fffdf8",
  accent: "#335c67",
  accentSoft: "#dbe6e8",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontSize: 13,
};

export interface SvgExportOptions {
  readonly resolveAsset?: (source: string) => string;
  /** Page units of empty space around the content. Defaults to 16. */
  readonly padding?: number;
  /** Paint behind the diagram. `null` (the default) leaves it transparent. */
  readonly background?: string | null;
  readonly theme?: Partial<SvgTheme>;
  /** Exact page-space viewport; ignores padding and clips overflow. */
  readonly viewport?: Box;
}

export const STROKE_WIDTH = 1.5;
/** Horizontal breathing room inside a shape, matching the stylesheet. */
export const TEXT_PADDING = TEXT_NOTE_PADDING_X;
