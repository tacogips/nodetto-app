import type { CadDisplayBody, CadIds, Command } from "@nodetto/core";
import { stlToInlineMesh } from "@nodetto/io/cad-mesh";
import { NmeshError } from "@nodetto/io/nmesh";
import { StlError, writeBinaryStl } from "@nodetto/io/stl";
import type { CadMeshSemantic, PageId } from "@nodetto/ir";

export const STL_MAX_BYTES = 64 * 1024 * 1024;
export const STL_SIZE_ERROR = "The STL exceeds the 64 MiB file limit.";
export const STL_IMPORT_NOTE =
  "Check imported meshes for self-intersections and mixed winding across separate shells. Either can produce incorrect volumes and boolean results.";

export function stlToMeshCommands(
  pageId: PageId,
  bytes: Uint8Array,
  name: string,
  ids: CadIds,
  after?: string,
): { commands: Command[] } | { error: string } {
  if (bytes.byteLength > STL_MAX_BYTES) return { error: STL_SIZE_ERROR };
  let data: string;
  try {
    data = stlToInlineMesh(bytes);
  } catch (error) {
    if (error instanceof NmeshError && error.code === "nmesh.inline")
      return {
        error:
          "Mesh too large for an inline body (limit 1 MiB encoded). Simplify it first.",
      };
    if (error instanceof NmeshError && error.code === "nmesh.range")
      return {
        error: "The STL coordinates exceed the CAD limit of ±10,000 mm.",
      };
    if (error instanceof StlError) {
      if (error.code === "stl.count")
        return { error: "The STL exceeds the 2,000,000 triangle limit." };
      if (error.code === "stl.empty") return { error: error.message };
    }
    return { error: "Could not read the STL file." };
  }
  const semantic: CadMeshSemantic = {
    name: name.replace(/\.stl$/i, "").trim() || "Mesh",
    data,
  };
  return {
    commands: [
      {
        type: "createElement",
        element: {
          id: ids.next(),
          page: pageId,
          type: "cad.mesh",
          index: ids.indexAfter(after),
          semantic,
          visual: {},
        },
      },
    ],
  };
}

/**
 * Serialize rounded display buffers. Callers must filter out hidden bodies.
 * Use the worker's full-precision STL request for document export.
 */
export function bodiesToStl(
  bodies: readonly CadDisplayBody[],
  options?: { includeReference?: boolean },
): Uint8Array {
  return writeBinaryStl(
    bodies
      .filter(({ reference }) => !reference || options?.includeReference)
      .map(({ positions, indices }) => ({ positions, triangles: indices })),
  );
}
