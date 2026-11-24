import {
  decodeNmesh,
  fromInline,
  inspectNmesh,
  toTriangleMesh,
} from "@nodetto/nmesh";

export function decodeCaptureMesh(data: string): {
  positions: Float64Array;
  triangles: Uint32Array;
} {
  const { positions, triangles } = toTriangleMesh(
    decodeNmesh(fromInline(data)),
  );
  return { positions, triangles };
}

export interface CaptureMeshDecodeOptions {
  maxVertices?: number;
  needTarget?: boolean;
  onAllocate?: (
    kind: "positions" | "triangles" | "mm" | "target",
    length: number,
  ) => void;
}
export interface CaptureMeshDecodeResult {
  vertexCount: number;
  triangleCount: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  } | null;
  booleanTarget?: boolean;
  positions?: Float64Array;
  triangles?: Uint32Array;
}

function eligible(q: Int32Array, triangles: Uint32Array): boolean {
  const count = q.length / 3;
  if (!triangles.length) return false;
  const edges: { key: number; direction: number }[] = [];
  const faces = new Set<string>();
  const origin = [
    (q[0] as number) / 1000,
    (q[1] as number) / 1000,
    (q[2] as number) / 1000,
  ];
  let volume = 0;
  let area = 0;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] as number;
    const b = triangles[i + 1] as number;
    const c = triangles[i + 2] as number;
    if (a >= count || b >= count || c >= count || a === b || b === c || a === c)
      return false;
    const face = [a, b, c].sort((x, y) => x - y).join(",");
    if (faces.has(face)) return false;
    faces.add(face);
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as [number, number][]) {
      edges.push({
        key: Math.min(u, v) * count + Math.max(u, v),
        direction: u < v ? 1 : -1,
      });
    }
    const point = (index: number) =>
      [0, 1, 2].map(
        (axis) =>
          (q[index * 3 + axis] as number) / 1000 - (origin[axis] as number),
      );
    const pa = point(a);
    const pb = point(b);
    const pc = point(c);
    const ab = pb.map((v, j) => v - (pa[j] as number));
    const ac = pc.map((v, j) => v - (pa[j] as number));
    const cross = (x: number[], y: number[]) => [
      (x[1] as number) * (y[2] as number) - (x[2] as number) * (y[1] as number),
      (x[2] as number) * (y[0] as number) - (x[0] as number) * (y[2] as number),
      (x[0] as number) * (y[1] as number) - (x[1] as number) * (y[0] as number),
    ];
    const world = (index: number) =>
      [0, 1, 2].map((axis) => (q[index * 3 + axis] as number) / 1000);
    const wa = world(a);
    const wb = world(b);
    const wc = world(c);
    const closureNormal = cross(
      wb.map((v, j) => v - (wa[j] as number)),
      wc.map((v, j) => v - (wa[j] as number)),
    );
    const closureSquared =
      (closureNormal[0] as number) ** 2 +
      (closureNormal[1] as number) ** 2 +
      (closureNormal[2] as number) ** 2;
    if (!Number.isFinite(closureSquared) || closureSquared === 0) return false;
    const normal = cross(ab, ac);
    const squared =
      (normal[0] as number) ** 2 +
      (normal[1] as number) ** 2 +
      (normal[2] as number) ** 2;
    area += Math.sqrt(squared) / 2;
    const bc = cross(pb, pc);
    volume +=
      ((pa[0] as number) * (bc[0] as number) +
        (pa[1] as number) * (bc[1] as number) +
        (pa[2] as number) * (bc[2] as number)) /
      6;
  }
  edges.sort((a, b) => a.key - b.key);
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i];
    const b = edges[i + 1];
    if (
      !a ||
      !b ||
      a.key !== b.key ||
      a.direction === b.direction ||
      edges[i + 2]?.key === a.key
    )
      return false;
  }
  return volume !== 0 && 2 * Math.abs(volume) >= area * 5e-7;
}

export function decodeCaptureMeshWith(
  data: string,
  options: CaptureMeshDecodeOptions = {},
): CaptureMeshDecodeResult {
  const bytes = fromInline(data);
  // Read only a valid first varint here; validation remains with the decoder.
  let count = 0;
  let factor = 1;
  let complete = false;
  for (let i = 8; i < Math.min(bytes.length - 4, 13); i++) {
    const value = bytes[i] as number;
    if (i === 12 && value > 15) break;
    count += (value % 128) * factor;
    if (value < 128) {
      complete = !(i > 8 && value === 0);
      break;
    }
    factor *= 128;
  }
  const over =
    complete && count > (options.maxVertices ?? Number.POSITIVE_INFINITY);
  const inspection = inspectNmesh(bytes);
  const bounds =
    inspection.min && inspection.max
      ? {
          min: inspection.min.map((v) => v / 1000) as [number, number, number],
          max: inspection.max.map((v) => v / 1000) as [number, number, number],
        }
      : null;
  const result: CaptureMeshDecodeResult = {
    vertexCount: inspection.vertexCount,
    triangleCount: inspection.triangleCount,
    bounds,
  };
  if (!over || options.needTarget) {
    const mesh = decodeNmesh(bytes, {
      onAllocate: (kind, length) =>
        options.onAllocate?.(over ? "target" : kind, length),
    });
    if (options.needTarget)
      result.booleanTarget = eligible(mesh.positions, mesh.triangles);
    if (!over) {
      options.onAllocate?.("mm", mesh.positions.length);
      const geometry = toTriangleMesh(mesh);
      result.positions = geometry.positions;
      result.triangles = geometry.triangles;
    }
  }
  return result;
}
