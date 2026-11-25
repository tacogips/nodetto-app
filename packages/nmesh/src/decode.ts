import { crc32 } from "./crc32.ts";
import { NmeshError, type QuantizedMesh, coordinateLimit } from "./types.ts";

type Inspection = {
  vertexCount: number;
  triangleCount: number;
  min: [number, number, number] | null;
  max: [number, number, number] | null;
};
type OnAllocate = (kind: "positions" | "triangles", length: number) => void;

export function readNmesh(
  bytes: Uint8Array,
  mode: "full",
  onAllocate?: OnAllocate,
): QuantizedMesh;
export function readNmesh(
  bytes: Uint8Array,
  mode: "inspect",
  onAllocate?: OnAllocate,
): Inspection;
export function readNmesh(
  bytes: Uint8Array,
  mode: "full" | "inspect",
  onAllocate?: OnAllocate,
): QuantizedMesh | Inspection {
  if (bytes.length < 12) throw new NmeshError("nmesh.truncated");
  if (
    bytes[0] !== 0x4e ||
    bytes[1] !== 0x4d ||
    bytes[2] !== 0x53 ||
    bytes[3] !== 0x48
  ) {
    throw new NmeshError("nmesh.magic");
  }
  if (bytes[4] !== 1) throw new NmeshError("nmesh.version");
  if (bytes[5] !== 0 || bytes[7] !== 0) throw new NmeshError("nmesh.flags");
  if (bytes[6] !== 3) throw new NmeshError("nmesh.unit");

  let offset = 8;
  const end = bytes.length - 4;
  function readVarint(): number {
    let value = 0;
    let factor = 1;
    for (let place = 0; place < 5; place++) {
      if (offset >= end) throw new NmeshError("nmesh.truncated");
      const next = bytes[offset++] as number;
      if (place === 4 && next > 15) throw new NmeshError("nmesh.range");
      value += (next % 128) * factor;
      if (next < 128) {
        if (place !== 0 && next === 0) throw new NmeshError("nmesh.range");
        return value;
      }
      factor *= 128;
    }
    throw new NmeshError("nmesh.range");
  }

  const vertexCount = readVarint();
  const triangleCount = readVarint();
  const groupCount = readVarint();
  if (
    3 * vertexCount + 3 * triangleCount + 2 * groupCount >
    bytes.length - 12
  ) {
    throw new NmeshError("nmesh.count");
  }
  const expectedCrc = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(end, true);
  if (crc32(bytes, end) !== expectedCrc) throw new NmeshError("nmesh.crc");
  if (triangleCount > 0 && groupCount === 0)
    throw new NmeshError("nmesh.groups");

  const groups: { faceId: number; count: number }[] = [];
  let previousFace = -1;
  let groupedTriangles = 0;
  for (let index = 0; index < groupCount; index++) {
    const faceId = readVarint();
    const count = readVarint();
    groupedTriangles += count;
    if (faceId <= previousFace || groupedTriangles > triangleCount) {
      throw new NmeshError("nmesh.groups");
    }
    if (mode === "full") groups.push({ faceId, count });
    previousFace = faceId;
  }
  if (groupedTriangles !== triangleCount) throw new NmeshError("nmesh.groups");

  let positions: Int32Array | undefined;
  let triangles: Uint32Array | undefined;
  if (mode === "full") {
    onAllocate?.("positions", vertexCount * 3);
    positions = new Int32Array(vertexCount * 3);
    onAllocate?.("triangles", triangleCount * 3);
    triangles = new Uint32Array(triangleCount * 3);
  }
  const previous: [number, number, number] = [0, 0, 0];
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (let index = 0; index < vertexCount * 3; index++) {
    const encoded = readVarint();
    const delta = encoded % 2 === 0 ? encoded / 2 : -(encoded + 1) / 2;
    const axis = index % 3;
    const position = delta + (previous[axis] as number);
    if (Math.abs(position) > coordinateLimit)
      throw new NmeshError("nmesh.range");
    previous[axis] = position;
    if (positions) positions[index] = position;
    min[axis] = Math.min(min[axis] as number, position);
    max[axis] = Math.max(max[axis] as number, position);
  }
  let used = 0;
  for (let index = 0; index < triangleCount * 3; index++) {
    const code = readVarint();
    if (code > used || (code === 0 && used === vertexCount)) {
      throw new NmeshError("nmesh.index");
    }
    if (triangles) triangles[index] = used - code;
    if (code === 0) used++;
  }
  if (used !== vertexCount) throw new NmeshError("nmesh.index");
  if (offset !== end) throw new NmeshError("nmesh.trailing");
  if (positions && triangles) return { positions, triangles, groups };
  return {
    vertexCount,
    triangleCount,
    min: vertexCount ? min : null,
    max: vertexCount ? max : null,
  };
}

export function decodeNmesh(
  bytes: Uint8Array,
  options?: { onAllocate?: OnAllocate },
): QuantizedMesh {
  return readNmesh(bytes, "full", options?.onAllocate);
}
export function inspectNmesh(bytes: Uint8Array): Inspection {
  return readNmesh(bytes, "inspect");
}
