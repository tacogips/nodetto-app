import { decodeNmesh, fromInline, toTriangleMesh } from "@nodetto/nmesh";

export function decodeCaptureMesh(data: string): {
  positions: Float64Array;
  triangles: Uint32Array;
} {
  const { positions, triangles } = toTriangleMesh(
    decodeNmesh(fromInline(data)),
  );
  return { positions, triangles };
}
