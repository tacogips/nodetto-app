import { canonicalize, encodeNmesh, toInline } from "./nmesh/index.ts";
import { readStl, StlError } from "./stl/index.ts";

/** Convert an STL into the canonical payload for a CAD mesh element. */
export function stlToInlineMesh(bytes: Uint8Array): string {
  const mesh = canonicalize(readStl(bytes));
  if (mesh.triangles.length === 0) {
    throw new StlError("stl.empty", "The STL contains no usable triangles.");
  }
  return toInline(encodeNmesh(mesh));
}
