import { isCanonical } from "./canonical.ts";
import { crc32 } from "./crc32.ts";
import { NmeshError, type QuantizedMesh } from "./types.ts";

export function encodeNmesh(mesh: QuantizedMesh): Uint8Array {
  if (!isCanonical(mesh)) throw new NmeshError("nmesh.canonical");
  const { positions, triangles, groups } = mesh;
  // At most four bytes per coordinate delta and five per other varint.
  const bytes = new Uint8Array(
    27 + groups.length * 10 + positions.length * 4 + triangles.length * 5,
  );
  bytes.set([0x4e, 0x4d, 0x53, 0x48, 1, 0, 3, 0]);
  let offset = 8;
  function writeVarint(input: number): void {
    let value = input;
    while (value >= 128) {
      bytes[offset++] = (value % 128) + 128;
      value = Math.floor(value / 128);
    }
    bytes[offset++] = value;
  }

  writeVarint(positions.length / 3);
  writeVarint(triangles.length / 3);
  writeVarint(groups.length);
  for (const { faceId, count } of groups) {
    writeVarint(faceId);
    writeVarint(count);
  }
  for (let index = 0; index < positions.length; index++) {
    const delta =
      (positions[index] as number) -
      (index < 3 ? 0 : (positions[index - 3] as number));
    writeVarint(delta < 0 ? -2 * delta - 1 : 2 * delta);
  }
  let used = 0;
  for (const vertex of triangles) {
    writeVarint(used - vertex);
    if (vertex === used) used++;
  }
  new DataView(bytes.buffer).setUint32(offset, crc32(bytes, offset), true);
  return bytes.slice(0, offset + 4);
}
