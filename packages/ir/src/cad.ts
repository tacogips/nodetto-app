import { roundNm } from "./pcb.ts";
import type { ElementId } from "./types.ts";

export const CAD_PAGE_KIND = "cad3d";
export const CAD_MESH_DATA_MAX_CHARS = 1_048_576 + 7;

export const CAD_ELEMENT_TYPES = [
  "cad.sketch",
  "cad.line",
  "cad.arc",
  "cad.circle",
  "cad.extrude",
  "cad.mesh",
  "cad.pcb",
] as const;

export type CadElementType = (typeof CAD_ELEMENT_TYPES)[number];

export function isCadElementType(type: string): type is CadElementType {
  return (CAD_ELEMENT_TYPES as readonly string[]).includes(type);
}

export function isCadTypeName(type: string): boolean {
  return type.startsWith("cad.");
}

export type CadXY = readonly [number, number];

export interface CadFaceRef {
  readonly feature?: ElementId;
  readonly role: "start" | "end" | "side";
  readonly entity?: ElementId;
}

export type CadPlane =
  | { readonly base: "xy" | "yz" | "zx"; readonly offset?: number }
  | { readonly face: CadFaceRef };

export interface CadSketchSemantic {
  name: string;
  plane: CadPlane;
}

export interface CadLineSemantic {
  sketch?: ElementId;
  a: CadXY;
  b: CadXY;
  construction?: boolean;
}

export interface CadArcSemantic {
  sketch?: ElementId;
  a: CadXY;
  m: CadXY;
  b: CadXY;
  construction?: boolean;
}

export interface CadCircleSemantic {
  sketch?: ElementId;
  c: CadXY;
  r: number;
  construction?: boolean;
}

export const CAD_OPERATIONS = ["new", "add", "cut", "intersect"] as const;

export interface CadExtrudeSemantic {
  name: string;
  sketch?: ElementId;
  loops?: readonly ElementId[];
  distance: number;
  symmetric?: boolean;
  op: (typeof CAD_OPERATIONS)[number];
  bodies?: readonly ElementId[];
  suppressed?: boolean;
}

export interface CadMeshSemantic {
  name: string;
  data: string;
  suppressed?: boolean;
}

export interface CadPcbSemantic {
  name: string;
  board?: ElementId;
  thickness?: number;
  suppressed?: boolean;
}

/** Persisted CAD lengths are millimetres quantized to one nanometre. */
export function isOnCadGrid(value: number): boolean {
  return Number.isFinite(value) && roundNm(value) === value;
}
