// Freehand, vector path, geometric shape, text, review comment and
// typography payloads.

import type {
  ElementId,
  FontFeatureSetting,
  FontVariationAxis,
} from "../types.ts";

export const GEO_KINDS = [
  "rect",
  "ellipse",
  "diamond",
  "triangle",
  "hexagon",
  "parallelogram",
  "cylinder",
  "star",
  "trapezoid",
  "pentagon",
  "octagon",
  "cross",
  "arrow",
  "chevron",
  "cloud",
  "callout",
  "note",
  "cube",
  "document",
  "manual-input",
  "delay",
  "predefined-process",
  "internal-storage",
  "off-page",
  "card",
  "tape",
  "stored-data",
  "display",
  "loop-limit",
  "collate",
  "sort",
  "summing-junction",
  "or",
  "multi-document",
  "direct-data",
  "sequential-data",
  "double-arrow",
  "right-triangle",
  "person",
] as const;
export type GeoKind = (typeof GEO_KINDS)[number];

export const TEXT_MARK_KINDS = [
  "bold",
  "italic",
  "code",
  "strike",
  "underline",
  "link",
] as const;
export type TextMarkKind = (typeof TEXT_MARK_KINDS)[number];

/** Raw input sample; variable-width outline geometry remains derived. */
export interface FreehandPoint {
  readonly x: number;
  readonly y: number;
  readonly pressure?: number;
  readonly controlIn?: { readonly x: number; readonly y: number };
  readonly controlOut?: { readonly x: number; readonly y: number };
}

export interface FreehandSemantic {
  readonly points: readonly FreehandPoint[];
  readonly closed?: boolean;
}

export const PATH_FILL_RULES = ["nonzero", "evenodd"] as const;
export type PathFillRule = (typeof PATH_FILL_RULES)[number];

/** Most contours and points one `draw.path` element may hold. */
export const MAX_PATH_CONTOURS = 1024;
export const MAX_PATH_POINTS = 20000;

/** One editable closed contour in a compound vector path. */
export interface PathContour {
  readonly points: readonly FreehandPoint[];
}

/** Portable vector geometry supporting holes and disconnected islands. */
export interface PathSemantic {
  readonly name?: string;
  readonly contours: readonly PathContour[];
  readonly fillRule: PathFillRule;
}

export interface GeoShapeSemantic {
  readonly geo: GeoKind;
  readonly label?: string;
}

/** Offsets are UTF-16 code unit indices into `text`, half-open [start, end). */
export interface TextMark {
  readonly start: number;
  readonly end: number;
  readonly kind: TextMarkKind;
  readonly href?: string;
}

export interface TextNoteSemantic {
  readonly text: string;
  readonly marks?: readonly TextMark[];
}

export interface ReviewCommentMessage {
  /** Stable identity keeps replies mergeable in collaborative documents. */
  readonly id: string;
  readonly author: string;
  readonly body: string;
  /** ISO-8601 timestamp supplied by the authoring client. */
  readonly createdAt: string;
}

/** A page-space review thread. Its visual x/y is the durable pin position. */
export interface ReviewCommentSemantic {
  /** Optional contextual layer; deleting it detaches rather than loses feedback. */
  readonly target?: ElementId;
  readonly resolved?: boolean;
  readonly messages: readonly ReviewCommentMessage[];
}

/** Complete reusable typography; applying one produces deterministic literals. */
export interface TypographyStyleValue {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly fontStyle: "normal" | "italic";
  readonly fontVariations?: readonly FontVariationAxis[];
  readonly fontFeatures?: readonly FontFeatureSetting[];
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly textAlign: "start" | "middle" | "end";
  readonly textDecoration:
    | "none"
    | "underline"
    | "line-through"
    | "underline line-through";
  readonly verticalAlign: "top" | "middle" | "bottom";
}

export interface TextStyleSemantic {
  readonly name: string;
  readonly value: TypographyStyleValue;
}
