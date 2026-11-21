import { expect, test } from "bun:test";
import { stlToInlineMesh } from "./cad-mesh.ts";
import { decodeNmesh, fromInline } from "./nmesh/index.ts";
import { StlError, writeBinaryStl } from "./stl/index.ts";

const facets =
  "facet normal 0 0 1 outer loop vertex 0 0 0 vertex 2 0 0 vertex 0 2 0 endloop endfacet";

test("CAD mesh import accepts a nonempty STL and rejects inputs with no usable triangles", () => {
  const encoder = new TextEncoder();
  const supported = encoder.encode(
    `solid bracket\n${facets}\nendsolid bracket`,
  );
  const imported = decodeNmesh(fromInline(stlToInlineMesh(supported)));
  expect(imported.triangles.length).toBe(3);
  for (const bytes of [
    encoder.encode(`solid bracket ${facets}\nendsolid bracket`),
    writeBinaryStl([]),
    encoder.encode(
      `solid bracket\n${facets.replace("vertex 0 2 0", "vertex 1 0 0")}\nendsolid bracket`,
    ),
  ]) {
    expect(() => stlToInlineMesh(bytes)).toThrow(
      new StlError("stl.empty", "The STL contains no usable triangles."),
    );
  }
});
