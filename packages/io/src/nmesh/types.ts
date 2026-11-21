export interface TriangleMesh {
  readonly positions: Float64Array | Float32Array;
  readonly triangles: Uint32Array;
  readonly triFace?: Uint32Array;
}

export interface QuantizedMesh {
  readonly positions: Int32Array;
  readonly triangles: Uint32Array;
  readonly groups: readonly { faceId: number; count: number }[];
}

export class NmeshError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "NmeshError";
  }
}

export const coordinateLimit = 10_000_000;
export const unitsPerMillimetre = 1_000;
export const uint32Max = 0xffff_ffff;
