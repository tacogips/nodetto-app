import {
  type QuantizedMesh,
  type TriangleMesh,
  NmeshError,
  coordinateLimit,
  uint32Max,
  unitsPerMillimetre,
} from "./types.ts";

function compareVertices(positions: Int32Array, a: number, b: number): number {
  return (
    positions[a * 3] - positions[b * 3] ||
    positions[a * 3 + 1] - positions[b * 3 + 1] ||
    positions[a * 3 + 2] - positions[b * 3 + 2]
  );
}

function vertexKey(positions: Int32Array, offset: number): string {
  return `${positions[offset]},${positions[offset + 1]},${positions[offset + 2]}`;
}

function degenerate(
  positions: Int32Array,
  a: number,
  b: number,
  c: number,
): boolean {
  if (a === b || b === c || a === c) return true;
  const abx = positions[b * 3] - positions[a * 3];
  const aby = positions[b * 3 + 1] - positions[a * 3 + 1];
  const abz = positions[b * 3 + 2] - positions[a * 3 + 2];
  const acx = positions[c * 3] - positions[a * 3];
  const acy = positions[c * 3 + 1] - positions[a * 3 + 1];
  const acz = positions[c * 3 + 2] - positions[a * 3 + 2];
  // Products of two coordinate differences remain exact in a JS number.
  return (
    aby * acz === abz * acy &&
    abz * acx === abx * acz &&
    abx * acy === aby * acx
  );
}

function compareTriangles(
  positions: Int32Array,
  a: number,
  b: number,
  c: number,
  x: number,
  y: number,
  z: number,
): number {
  return (
    compareVertices(positions, a, x) ||
    compareVertices(positions, b, y) ||
    compareVertices(positions, c, z)
  );
}

export function canonicalize(mesh: TriangleMesh): QuantizedMesh {
  const { positions, triangles, triFace } = mesh;
  const triangleCount = triangles.length / 3;
  if (
    positions.length % 3 !== 0 ||
    triangles.length % 3 !== 0 ||
    (triFace && triFace.length !== triangleCount)
  ) {
    throw new NmeshError("nmesh.count");
  }

  const quantized = new Int32Array(positions.length);
  const weld = new Uint32Array(positions.length / 3);
  const verticesByPosition = new Map<string, number>();
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const position = Math.round(
        positions[offset + axis] * unitsPerMillimetre,
      );
      if (!Number.isFinite(position) || Math.abs(position) > coordinateLimit) {
        throw new NmeshError("nmesh.range");
      }
      quantized[offset + axis] = position;
    }
    const key = vertexKey(quantized, offset);
    const vertex = verticesByPosition.get(key) ?? offset / 3;
    verticesByPosition.set(key, vertex);
    weld[offset / 3] = vertex;
  }

  const ordered: { a: number; b: number; c: number; faceId: number }[] = [];
  for (let offset = 0; offset < triangles.length; offset += 3) {
    const x = triangles[offset];
    const y = triangles[offset + 1];
    const z = triangles[offset + 2];
    if (x >= weld.length || y >= weld.length || z >= weld.length) {
      throw new NmeshError("nmesh.index");
    }
    const a = weld[x];
    const b = weld[y];
    const c = weld[z];
    if (degenerate(quantized, a, b, c)) continue;
    const faceId = triFace?.[offset / 3] ?? 0;
    // Comparing positions is equivalent to comparing their lexicographic ranks.
    if (
      compareVertices(quantized, b, a) < 0 &&
      compareVertices(quantized, b, c) < 0
    ) {
      ordered.push({ a: b, b: c, c: a, faceId });
    } else if (compareVertices(quantized, c, a) < 0) {
      ordered.push({ a: c, b: a, c: b, faceId });
    } else {
      ordered.push({ a, b, c, faceId });
    }
  }
  ordered.sort(
    (left, right) =>
      left.faceId - right.faceId ||
      compareTriangles(
        quantized,
        left.a,
        left.b,
        left.c,
        right.a,
        right.b,
        right.c,
      ),
  );

  const indices = new Uint32Array(ordered.length * 3);
  const coordinates = new Int32Array(quantized.length);
  const emitted = new Uint32Array(weld.length);
  const groups: { faceId: number; count: number }[] = [];
  let vertexCount = 0;
  let index = 0;
  for (const { a, b, c, faceId } of ordered) {
    for (const vertex of [a, b, c]) {
      if (emitted[vertex] === 0) {
        const offset = vertexCount * 3;
        coordinates[offset] = quantized[vertex * 3];
        coordinates[offset + 1] = quantized[vertex * 3 + 1];
        coordinates[offset + 2] = quantized[vertex * 3 + 2];
        emitted[vertex] = ++vertexCount;
      }
      indices[index++] = emitted[vertex] - 1;
    }
    const previous = groups.at(-1);
    if (previous?.faceId === faceId) previous.count++;
    else groups.push({ faceId, count: 1 });
  }
  return {
    positions: coordinates.slice(0, vertexCount * 3),
    triangles: indices,
    groups,
  };
}

export function isCanonical({
  positions,
  triangles,
  groups,
}: QuantizedMesh): boolean {
  if (positions.length % 3 !== 0 || triangles.length % 3 !== 0) return false;
  const keys = new Set<string>();
  for (let offset = 0; offset < positions.length; offset += 3) {
    if (
      Math.abs(positions[offset]) > coordinateLimit ||
      Math.abs(positions[offset + 1]) > coordinateLimit ||
      Math.abs(positions[offset + 2]) > coordinateLimit
    ) {
      return false;
    }
    const key = vertexKey(positions, offset);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  let used = 0;
  let offset = 0;
  let previousFace = -1;
  for (const { faceId, count } of groups) {
    const end = offset + count * 3;
    if (
      !Number.isInteger(faceId) ||
      faceId <= previousFace ||
      faceId > uint32Max ||
      !Number.isInteger(count) ||
      count <= 0 ||
      end > triangles.length
    ) {
      return false;
    }
    previousFace = faceId;
    for (let axis = offset; axis < end; axis++) {
      const vertex = triangles[axis];
      if (vertex > used || vertex >= positions.length / 3) return false;
      if (vertex === used) used++;
    }
    for (let triangle = offset; triangle < end; triangle += 3) {
      const a = triangles[triangle];
      const b = triangles[triangle + 1];
      const c = triangles[triangle + 2];
      if (
        degenerate(positions, a, b, c) ||
        compareVertices(positions, a, b) >= 0 ||
        compareVertices(positions, a, c) >= 0 ||
        (triangle > offset &&
          compareTriangles(
            positions,
            triangles[triangle - 3],
            triangles[triangle - 2],
            triangles[triangle - 1],
            a,
            b,
            c,
          ) > 0)
      ) {
        return false;
      }
    }
    offset = end;
  }
  return offset === triangles.length && used === positions.length / 3;
}

export function toTriangleMesh(mesh: QuantizedMesh): {
  positions: Float64Array;
  triangles: Uint32Array;
  triFace: Uint32Array;
} {
  const positions = Float64Array.from(
    mesh.positions,
    (value) => value / unitsPerMillimetre,
  );
  const triFace = new Uint32Array(mesh.triangles.length / 3);
  let start = 0;
  for (const { faceId, count } of mesh.groups) {
    triFace.fill(faceId, start, start + count);
    start += count;
  }
  return { positions, triangles: mesh.triangles, triFace };
}
