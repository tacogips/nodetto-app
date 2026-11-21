import type { ElementId } from "@nodetto/ir";
import type { KernelMesh } from "./kernel.ts";

export interface CadDisplayBody {
  readonly id: ElementId;
  readonly reference: boolean;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly triFace: Uint32Array;
  readonly faceNames: readonly string[];
  readonly edges: Float32Array;
}

const COS_30_DEGREES = 0.8660254037844386;
const MICROMETRES_PER_MM = 1000;

function meshValue(data: ArrayLike<number>, index: number): number {
  const value = data[index];
  if (value === undefined) throw new RangeError("Missing CAD mesh value");
  return value;
}

function edgeSegments(mesh: KernelMesh, positions: Float32Array): Float32Array {
  const vertexCount = positions.length / 3;
  const normals = new Float64Array(mesh.triangles.length);
  const unmatched = new Map<number, number>();
  const visible: number[] = [];

  for (let offset = 0; offset < mesh.triangles.length; offset += 3) {
    const a = meshValue(mesh.triangles, offset);
    const b = meshValue(mesh.triangles, offset + 1);
    const c = meshValue(mesh.triangles, offset + 2);
    const p = mesh.positions;
    const ux = meshValue(p, b * 3) - meshValue(p, a * 3);
    const uy = meshValue(p, b * 3 + 1) - meshValue(p, a * 3 + 1);
    const uz = meshValue(p, b * 3 + 2) - meshValue(p, a * 3 + 2);
    const vx = meshValue(p, c * 3) - meshValue(p, a * 3);
    const vy = meshValue(p, c * 3 + 1) - meshValue(p, a * 3 + 1);
    const vz = meshValue(p, c * 3 + 2) - meshValue(p, a * 3 + 2);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length !== 0) {
      normals[offset] = nx / length;
      normals[offset + 1] = ny / length;
      normals[offset + 2] = nz / length;
    }
    for (let side = 0; side < 3; side++) {
      const from = meshValue(mesh.triangles, offset + side);
      const to = meshValue(mesh.triangles, offset + ((side + 1) % 3));
      const key = Math.min(from, to) * vertexCount + Math.max(from, to);
      const neighbour = unmatched.get(key);
      if (neighbour === undefined) {
        unmatched.set(key, offset);
        continue;
      }
      unmatched.delete(key);
      const dot =
        meshValue(normals, offset) * meshValue(normals, neighbour) +
        meshValue(normals, offset + 1) * meshValue(normals, neighbour + 1) +
        meshValue(normals, offset + 2) * meshValue(normals, neighbour + 2);
      const face = mesh.faceNames[meshValue(mesh.triFace, offset / 3)];
      const adjacentFace =
        mesh.faceNames[meshValue(mesh.triFace, neighbour / 3)];
      if (face !== adjacentFace || dot < COS_30_DEGREES) visible.push(key);
    }
  }

  const edges = new Float32Array((visible.length + unmatched.size) * 6);
  let write = 0;
  function append(key: number): void {
    const low = Math.floor(key / vertexCount) * 3;
    const high = (key % vertexCount) * 3;
    for (let axis = 0; axis < 3; axis++) {
      edges[write + axis] = meshValue(positions, low + axis);
      edges[write + 3 + axis] = meshValue(positions, high + axis);
    }
    write += 6;
  }
  for (const key of visible) append(key);
  for (const key of unmatched.keys()) append(key);
  return edges;
}

export function displayBody(
  id: ElementId,
  reference: boolean,
  mesh: KernelMesh,
): CadDisplayBody {
  const positions = Float32Array.from(
    mesh.positions,
    (mm) => Math.round(mm * MICROMETRES_PER_MM) / MICROMETRES_PER_MM + 0,
  );
  return {
    id,
    reference,
    positions,
    indices: new Uint32Array(mesh.triangles),
    triFace: new Uint32Array(mesh.triFace),
    faceNames: [...mesh.faceNames],
    edges: edgeSegments(mesh, positions),
  };
}
