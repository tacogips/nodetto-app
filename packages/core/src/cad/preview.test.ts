import { expect, test } from "bun:test";
import { extrudePreviewMesh, prepareExtrudePreview } from "./preview.ts";
import {
  cadElement,
  plateElements,
  rectangle,
  sketch,
} from "./testing/documents.ts";

const params = {
  sketch: "base",
  name: "Preview",
  distance: 5,
  op: "new",
} as const;

test("a plate and two holes preview as three separate prisms", () => {
  const elements = [
    ...plateElements(),
    ...rectangle("left", 10, 10, 10, 10).map((edge) => ({
      ...edge,
      semantic: { ...edge.semantic, sketch: "base" },
    })),
    ...rectangle("right", 40, 10, 10, 10).map((edge) => ({
      ...edge,
      semantic: { ...edge.semantic, sketch: "base" },
    })),
  ];
  const mesh = extrudePreviewMesh(elements, params, "preview");
  if ("error" in mesh) throw new Error(mesh.error);
  expect(mesh.positions.length / 3).toBe(24);
  expect(mesh.indices.length / 3).toBe(36);
  expect(
    mesh.indices.slice(12 * 3, 24 * 3).every((i) => i >= 8 && i < 16),
  ).toBe(true);
  expect(mesh.indices.slice(24 * 3).every((i) => i >= 16 && i < 24)).toBe(true);
});

test("open profiles report the same failure as evaluation", () => {
  const elements = plateElements().filter(({ id }) => id !== "base-edge-0");
  expect(extrudePreviewMesh(elements, params, "preview")).toEqual({
    error: "cad.profile.open",
  });
});

test("drag frames reuse topology, support symmetric distances and enforce world bounds", () => {
  const preview = prepareExtrudePreview(
    plateElements(),
    { ...params, symmetric: true },
    "preview",
  );
  if ("error" in preview) throw new Error(preview.error);
  const { mesh: makeMesh } = preview;
  function mesh(distance: number) {
    const result = makeMesh(distance);
    if ("error" in result) throw new Error(result.error);
    return result;
  }
  const forward = mesh(4);
  const longer = mesh(7);
  const backward = mesh(-4);
  expect(longer.indices).toBe(forward.indices);
  expect([...forward.positions.filter((_, i) => i % 3 === 2)]).toEqual([
    -2, -2, -2, -2, 2, 2, 2, 2,
  ]);
  expect([...backward.positions.filter((_, i) => i % 3 === 2)]).toEqual([
    2, 2, 2, 2, -2, -2, -2, -2,
  ]);
  expect([...backward.indices.slice(0, 3)]).toEqual([
    forward.indices[0],
    forward.indices[2],
    forward.indices[1],
  ]);
  expect(preview.mesh(10_001)).toEqual({ error: "cad.limit" });
});

test("concave preview mesh bytes remain stable", () => {
  const vertices = [
    [0, 0],
    [4, 0],
    [4, 1],
    [1, 1],
    [1, 4],
    [0, 4],
  ] as const;
  const edges = vertices.map((a, i) =>
    cadElement(`edge-${i}`, "cad.line", "a1", {
      sketch: "base",
      a,
      b: vertices[(i + 1) % vertices.length],
    }),
  );
  const mesh = extrudePreviewMesh(
    [sketch("base", "a1"), ...edges],
    params,
    "preview",
  );
  if ("error" in mesh) throw new Error(mesh.error);
  expect([...new Uint8Array(mesh.positions.buffer)]).toEqual([
    ...new Uint8Array(
      new Float32Array([
        0, 0, 0, 4, 0, 0, 4, 1, 0, 1, 1, 0, 1, 4, 0, 0, 4, 0, 0, 0, 5, 4, 0, 5,
        4, 1, 5, 1, 1, 5, 1, 4, 5, 0, 4, 5,
      ]).buffer,
    ),
  ]);
  expect([...mesh.indices]).toEqual([
    0, 2, 1, 6, 7, 8, 0, 3, 2, 6, 8, 9, 0, 4, 3, 6, 9, 10, 0, 5, 4, 6, 10, 11,
    0, 1, 7, 0, 7, 6, 1, 2, 8, 1, 8, 7, 2, 3, 9, 2, 9, 8, 3, 4, 10, 3, 10, 9, 4,
    5, 11, 4, 11, 10, 5, 0, 6, 5, 6, 11,
  ]);
});
