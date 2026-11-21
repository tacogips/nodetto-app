export interface ToolMesh {
  readonly positions: Float64Array;
  readonly triangles: Uint32Array;
  /** One index into faceNames per triangle. */
  readonly triFace: Uint32Array;
  readonly faceNames: readonly string[];
}

export interface KernelMesh {
  readonly positions: Float32Array;
  readonly triangles: Uint32Array;
  readonly triFace: Uint32Array;
  readonly faceNames: readonly string[];
}

export type KernelHandle = number;

/** Each operation producing a handle returns a new owned solid.
 * Boolean operations leave all input handles live and unchanged.
 */
export interface CadKernel {
  readonly id: string;
  solid(mesh: ToolMesh): KernelHandle;
  boolean(
    op: "add" | "cut" | "intersect",
    target: KernelHandle,
    tools: readonly KernelHandle[],
  ): KernelHandle;
  mesh(handle: KernelHandle): KernelMesh;
  measure(handle: KernelHandle): {
    volume: number;
    area: number;
    empty: boolean;
    triangles: number;
  };
  release(handle: KernelHandle): void;
}
