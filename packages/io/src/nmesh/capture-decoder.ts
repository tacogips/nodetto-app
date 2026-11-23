import { fromInline } from "./armor.ts";
import { toTriangleMesh } from "./canonical.ts";
import { decodeNmesh } from "./decode.ts";

export function decodeCaptureMesh(data: string): {
  positions: Float64Array;
  triangles: Uint32Array;
} {
  const { positions, triangles } = toTriangleMesh(
    decodeNmesh(fromInline(data)),
  );
  return { positions, triangles };
}
