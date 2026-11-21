import { expect, test } from "bun:test";
import { extrudePreviewMesh, prepareExtrudePreview } from "./preview.ts";
import { plateElements, rectangle } from "./testing/documents.ts";

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
