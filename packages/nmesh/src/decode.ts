import { crc32 } from "./crc32.ts";
import { NmeshError, type QuantizedMesh, coordinateLimit } from "./types.ts";

export function decodeNmesh(bytes: Uint8Array): QuantizedMesh {
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
      const next = bytes[offset++];
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
    groups.push({ faceId, count });
    previousFace = faceId;
  }
  if (groupedTriangles !== triangleCount) throw new NmeshError("nmesh.groups");

  const positions = new Int32Array(vertexCount * 3);
  const triangles = new Uint32Array(triangleCount * 3);
  for (let index = 0; index < positions.length; index++) {
    const encoded = readVarint();
    const delta = encoded % 2 === 0 ? encoded / 2 : -(encoded + 1) / 2;
    const position = delta + (index < 3 ? 0 : positions[index - 3]);
    if (Math.abs(position) > coordinateLimit)
      throw new NmeshError("nmesh.range");
    positions[index] = position;
  }
  let used = 0;
  for (let index = 0; index < triangles.length; index++) {
    const code = readVarint();
    if (code > used || (code === 0 && used === vertexCount)) {
      throw new NmeshError("nmesh.index");
    }
    triangles[index] = used - code;
    if (code === 0) used++;
  }
  if (used !== vertexCount) throw new NmeshError("nmesh.index");
  if (offset !== end) throw new NmeshError("nmesh.trailing");
  return { positions, triangles, groups };
}
