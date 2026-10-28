// Page guides, frames, groups, fabrication layers, images and design
// tokens.

import type { ElementId } from "../types.ts";
import type { PrototypeOverflow } from "./connectors.ts";

export const GUIDE_AXES = ["x", "y"] as const;
export type GuideAxis = (typeof GUIDE_AXES)[number];

export interface PageGuideSemantic {
  /** x is a vertical guide; y is a horizontal guide. */
  readonly axis: GuideAxis;
  readonly position: number;
  readonly color?: string;
  readonly hidden?: boolean;
  readonly locked?: boolean;
}

export interface FrameLayout {
  readonly direction: "horizontal" | "vertical";
  readonly gap: number;
  /** Wrap overflowing children into additional rows or columns. */
  readonly wrap?: boolean;
  /** Spacing between wrapped rows or columns; defaults to gap. */
  readonly crossGap?: number;
  readonly padding: number;
  readonly paddingTop?: number;
  readonly paddingRight?: number;
  readonly paddingBottom?: number;
  readonly paddingLeft?: number;
  readonly sizing: "fixed" | "hug";
  /** Optional per-axis overrides; omitted axes retain legacy sizing behavior. */
  readonly widthSizing?: "fixed" | "hug";
  readonly heightSizing?: "fixed" | "hug";
  readonly align: "start" | "center" | "end" | "stretch";
  readonly justify?: "start" | "center" | "end" | "space-between";
}

export interface SquareLayoutGrid {
  /** Stable item identity enables field-level collaboration and reordering. */
  readonly id: string;
  readonly kind: "grid";
  /** Distance between adjacent grid lines in canvas units. */
  readonly size: number;
  readonly color: string;
  readonly opacity: number;
  readonly visible?: boolean;
}

export interface AxisLayoutGrid {
  /** Stable item identity enables field-level collaboration and reordering. */
  readonly id: string;
  readonly kind: "columns" | "rows";
  readonly count: number;
  readonly gutter: number;
  readonly margin: number;
  readonly color: string;
  readonly opacity: number;
  readonly visible?: boolean;
}

/** Editor-only construction guides. They never appear in preview or export. */
export type LayoutGrid = SquareLayoutGrid | AxisLayoutGrid;

export const FRAME_PLATFORMS = ["web", "ios", "android", "document"] as const;
export type FramePlatform = (typeof FRAME_PLATFORMS)[number];

/** Editor-space insets for content that must avoid device system UI. */
export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Omitted memberIds retains legacy geometric containment. */
export interface ComponentVariantProperty {
  /** Stable identity for field-granular collaboration inside this definition. */
  readonly id: string;
  readonly name: string;
  readonly value: string;
}

export const SCREEN_KINDS = [
  "screen",
  "popup",
  "bottom-sheet",
  "popover",
] as const;
export type ScreenKind = (typeof SCREEN_KINDS)[number];

export interface FrameSemantic {
  readonly screenKind?: ScreenKind;
  readonly name: string;
  /** Target platform informs presets and generated implementation handoff. */
  readonly platform?: FramePlatform;
  /** Editor-only safe content boundary; never painted into exports. */
  readonly safeArea?: SafeAreaInsets;
  /** Source artboard for refreshable cross-viewport content/style inheritance. */
  readonly responsiveSource?: ElementId;
  readonly showTitle?: boolean;
  /** Clip descendants to the frame's exact transformed outline. */
  readonly clipContent?: boolean;
  readonly component?: boolean;
  /** Named family/state for component definitions. */
  readonly variantSet?: string;
  readonly variantName?: string;
  /** Multi-dimensional component state, for example State=Hover, Size=Large. */
  readonly variantProperties?: readonly ComponentVariantProperty[];
  readonly prototypeStart?: boolean;
  /** Preview-only viewport scrolling; omitted is a fixed viewport. */
  readonly prototypeOverflow?: PrototypeOverflow;
  readonly instanceOf?: ElementId;
  readonly autoRefresh?: boolean;
  /** Component text/style/geometry or responsive text/style refresh tracking. */
  readonly instanceBindings?: readonly {
    readonly source?: ElementId;
    readonly target?: ElementId;
    /** JSON snapshot used only for comparisons, never as replacement content. */
    readonly baseline: string;
  }[];
  readonly memberIds?: readonly ElementId[];
  readonly layout?: FrameLayout;
  readonly layoutGrids?: readonly LayoutGrid[];
}

export const BOOLEAN_OPERATIONS = [
  "union",
  "subtract",
  "intersect",
  "exclude",
] as const;
export type BooleanOperation = (typeof BOOLEAN_OPERATIONS)[number];

export interface GroupSemantic {
  readonly memberIds: readonly ElementId[];
  /** One member whose visible geometry clips the other members. */
  readonly maskId?: ElementId;
  /** Raster mask interpretation; omitted means alpha. Requires `maskId`. */
  readonly maskMode?: "alpha" | "luminance";
  /** Non-destructive ordered combination of the members' visible outlines. */
  readonly booleanOperation?: BooleanOperation;
  /** Force a compositing boundary while retaining ordinary member geometry. */
  readonly isolate?: boolean;
  /** The PCB fabrication layer this group draws, set by Gerber import. */
  readonly fabricationLayer?: FabricationLayer;
}

export const FABRICATION_LAYER_KINDS = [
  "copper",
  "soldermask",
  "silkscreen",
  "paste",
  "outline",
  "drill",
  "other",
] as const;
export type FabricationLayerKind = (typeof FABRICATION_LAYER_KINDS)[number];
export const FABRICATION_LAYER_SIDES = [
  "top",
  "bottom",
  "inner",
  "board",
] as const;
export type FabricationLayerSide = (typeof FABRICATION_LAYER_SIDES)[number];

/**
 * A group's PCB layer and its page placement: page point (x, y) is board
 * point (originX + x / unitsPerMm, originY - y / unitsPerMm) in millimetres,
 * y pointing up.
 */
export interface FabricationLayer {
  readonly kind: FabricationLayerKind;
  readonly side: FabricationLayerSide;
  /** Inner copper layer number, 1 for the first inner layer. */
  readonly inner?: number;
  /** Drill files only: whether the holes are plated. */
  readonly plating?: "plated" | "nonPlated";
  /** The imported file name, reused when the layer is exported. */
  readonly file?: string;
  readonly unitsPerMm: number;
  readonly originX: number;
  readonly originY: number;
}

export interface ImageSemantic {
  readonly src: string;
  readonly alt: string;
  readonly fit?: "contain" | "cover" | "fill";
  /** Normalized, non-destructive source rectangle. Fit is ignored when set. */
  readonly crop?: ImageCrop;
}

export interface ImageCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ColorTokenMode {
  readonly name: string;
  readonly value?: string;
  readonly alias?: ElementId;
}

export interface NumberTokenMode {
  readonly name: string;
  readonly value?: number;
  readonly alias?: ElementId;
}

export interface ColorTokenSemantic {
  readonly name: string;
  readonly kind: "color";
  /** Portable Default-mode fallback, retained even when an alias is broken. */
  readonly value: string;
  readonly alias?: ElementId;
  readonly modes?: readonly ColorTokenMode[];
}

/** A reusable non-negative design measurement, expressed in page/CSS pixels. */
export interface NumberTokenSemantic {
  readonly name: string;
  readonly kind: "number";
  /** Portable Default-mode fallback, retained even when an alias is broken. */
  readonly value: number;
  readonly alias?: ElementId;
  readonly modes?: readonly NumberTokenMode[];
}

export type DesignTokenSemantic = ColorTokenSemantic | NumberTokenSemantic;
