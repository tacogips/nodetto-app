import { StlError, type StlMesh } from "./read.ts";

export function writeBinaryStl(
  meshes: readonly StlMesh[],
  header = "nodetto",
): Uint8Array {
  let count = 0;
  for (const { positions, triangles } of meshes) {
    if (positions.length % 3 !== 0 || triangles.length % 3 !== 0) {
      throw new StlError("stl.count");
    }
    count += triangles.length / 3;
  }
  if (count > 0xffff_ffff) throw new StlError("stl.count");

  const bytes = new Uint8Array(84 + count * 50);
  const view = new DataView(bytes.buffer);
  new TextEncoder().encodeInto(header, bytes.subarray(0, 80));
  view.setUint32(80, count, true);
  let offset = 84;
  for (const { positions, triangles } of meshes) {
    for (let index = 0; index < triangles.length; index += 3) {
      for (let vertex = 0; vertex < 3; vertex++) {
        const source = triangles[index + vertex] * 3;
        if (source >= positions.length) throw new StlError("stl.index");
        for (let axis = 0; axis < 3; axis++) {
          const value = Math.fround(positions[source + axis]);
          if (!Number.isFinite(value)) throw new StlError("stl.number");
          view.setFloat32(offset + 12 + vertex * 12 + axis * 4, value, true);
        }
      }
      const abx =
        view.getFloat32(offset + 24, true) - view.getFloat32(offset + 12, true);
      const aby =
        view.getFloat32(offset + 28, true) - view.getFloat32(offset + 16, true);
      const abz =
        view.getFloat32(offset + 32, true) - view.getFloat32(offset + 20, true);
      const acx =
        view.getFloat32(offset + 36, true) - view.getFloat32(offset + 12, true);
      const acy =
        view.getFloat32(offset + 40, true) - view.getFloat32(offset + 16, true);
      const acz =
        view.getFloat32(offset + 44, true) - view.getFloat32(offset + 20, true);
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      const length = Math.hypot(nx, ny, nz);
      if (length !== 0) {
        view.setFloat32(offset, nx / length, true);
        view.setFloat32(offset + 4, ny / length, true);
        view.setFloat32(offset + 8, nz / length, true);
      }
      offset += 50;
    }
  }
  return bytes;
}
