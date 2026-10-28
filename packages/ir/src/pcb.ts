import type { BreadboardImportDiagnostic } from "./breadboard.ts";

export type PcbXY = readonly [number, number];

export type PcbShape =
  | { readonly kind: "line"; readonly start: PcbXY; readonly end: PcbXY }
  | {
      readonly kind: "arc";
      readonly start: PcbXY;
      readonly mid: PcbXY;
      readonly end: PcbXY;
    }
  | { readonly kind: "circle"; readonly center: PcbXY; readonly radius: number }
  | { readonly kind: "rect"; readonly start: PcbXY; readonly end: PcbXY }
  | { readonly kind: "polygon"; readonly points: readonly PcbXY[] }
  | {
      readonly kind: "text";
      readonly text: string;
      readonly at: PcbXY;
      readonly rotation: number;
      readonly size: PcbXY;
      readonly thickness: number;
      readonly role?: "reference" | "value" | "user";
      readonly justify?: {
        readonly horizontal?: "left" | "right";
        readonly mirror?: boolean;
      };
      readonly hidden?: boolean;
    };

export interface PcbGraphicItem {
  readonly layer: string;
  readonly width: number;
  readonly fill: boolean;
  readonly shape: PcbShape;
}

export interface PcbPadPrimitive {
  readonly width: number;
  readonly fill: boolean;
  readonly shape: PcbShape;
}

export const PCB_PAD_TYPES = [
  "thru_hole",
  "smd",
  "np_thru_hole",
  "connect",
] as const;
export type PcbPadType = (typeof PCB_PAD_TYPES)[number];
export const PCB_PAD_SHAPES = [
  "circle",
  "rect",
  "oval",
  "roundrect",
  "trapezoid",
  "custom",
] as const;
export type PcbPadShape = (typeof PCB_PAD_SHAPES)[number];

export interface PcbPad {
  readonly number: string;
  readonly type: PcbPadType;
  readonly shape: PcbPadShape;
  readonly at: PcbXY;
  readonly rotation: number;
  readonly size: PcbXY;
  readonly layers: readonly string[];
  readonly net: string;
  readonly drill?: {
    readonly diameter: number;
    readonly slot?: PcbXY;
    readonly offset?: PcbXY;
  };
  readonly roundrectRatio?: number;
  readonly trapezoidDelta?: PcbXY;
  readonly maskMargin?: number;
  readonly primitives?: readonly PcbPadPrimitive[];
}

export interface PcbBoardSemantic {
  readonly format: "kicad_pcb";
  readonly source: string;
  readonly version: number;
  readonly generator: string;
  readonly thickness?: number;
  readonly maskExpansion: number;
  readonly layers: readonly {
    readonly id: number;
    readonly name: string;
    readonly type: string;
  }[];
  readonly nets: readonly string[];
}

export interface PcbFootprintSemantic {
  readonly reference: string;
  readonly value: string;
  readonly library: string;
  readonly at: PcbXY;
  readonly rotation: number;
  readonly side: "top" | "bottom";
  readonly pads: readonly PcbPad[];
  readonly graphics: readonly PcbGraphicItem[];
}

export interface PcbTrackSemantic {
  readonly layer: string;
  readonly width: number;
  readonly net: string;
  readonly points: readonly PcbXY[];
  readonly mid?: PcbXY;
}

export interface PcbViaSemantic {
  readonly at: PcbXY;
  readonly diameter: number;
  readonly drill: number;
  readonly layers: readonly [string, string];
  readonly net: string;
}

export interface PcbZoneSemantic {
  readonly layers: readonly string[];
  readonly net: string;
  readonly outline: readonly PcbXY[];
  readonly filled: readonly {
    readonly layer: string;
    readonly polygons: readonly (readonly PcbXY[])[];
  }[];
}

export type PcbGraphicSemantic = PcbGraphicItem;

export interface PcbImportPlan {
  readonly title: string;
  readonly board: PcbBoardSemantic;
  readonly graphics: readonly PcbGraphicSemantic[];
  readonly zones: readonly PcbZoneSemantic[];
  readonly tracks: readonly PcbTrackSemantic[];
  readonly vias: readonly PcbViaSemantic[];
  readonly footprints: readonly PcbFootprintSemantic[];
}

export interface PcbImportResult {
  readonly plan?: PcbImportPlan;
  readonly diagnostics: readonly BreadboardImportDiagnostic[];
}

export const PCB_ELEMENT_TYPES = [
  "pcb.board",
  "pcb.footprint",
  "pcb.track",
  "pcb.via",
  "pcb.zone",
  "pcb.graphic",
] as const;
export type PcbElementType = (typeof PCB_ELEMENT_TYPES)[number];

export function isPcbElementType(type: string): type is PcbElementType {
  return (PCB_ELEMENT_TYPES as readonly string[]).includes(type);
}

export const PCB_PAGE_SCALE = 10;

export function roundNm(value: number): number {
  const rounded =
    (Math.sign(value) * Math.floor(Math.abs(value) * 1_000_000 + 0.5)) /
    1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function pcbRotate([x, y]: PcbXY, degrees: number): PcbXY {
  const angle = ((degrees % 360) + 360) % 360;
  let cos: number;
  let sin: number;
  if (angle % 90 === 0) {
    const quarter = angle / 90;
    cos = [1, 0, -1, 0][quarter] ?? 1;
    sin = [0, 1, 0, -1][quarter] ?? 0;
  } else if (angle % 45 === 0) {
    const diagonal = Math.SQRT1_2;
    const eighth = angle / 45;
    cos = [1, diagonal, 0, -diagonal, -1, -diagonal, 0, diagonal][eighth] ?? 1;
    sin = [0, diagonal, 1, diagonal, 0, -diagonal, -1, -diagonal][eighth] ?? 0;
  } else {
    const radians = (angle * Math.PI) / 180;
    cos = Math.cos(radians);
    sin = Math.sin(radians);
  }
  const rotatedX = x * cos + y * sin;
  const rotatedY = -x * sin + y * cos;
  return [
    Object.is(rotatedX, -0) ? 0 : rotatedX,
    Object.is(rotatedY, -0) ? 0 : rotatedY,
  ];
}
