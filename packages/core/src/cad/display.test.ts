import { expect, test } from "bun:test";
import { displayBody } from "./display.ts";
import { baseFrame } from "./frames.ts";
import type { KernelMesh } from "./kernel.ts";
import { buildLoops } from "./loops.ts";
import { rectangle } from "./testing/documents.ts";
import { prismTool } from "./tool-solid.ts";

function prism(
  points: readonly number[],
  sources: readonly string[],
): KernelMesh {
  const mesh = prismTool(
    { points, sources, depth: 0, reversed: [], members: [] },
    baseFrame("xy"),
    { t0: 0, t1: 5 },
    "body",
  );
  return { ...mesh, positions: new Float32Array(mesh.positions) };
}

test("a box has twelve edges, including same-name right angles", () => {
  const loop = buildLoops(rectangle("profile", 0, 0, 4, 3));
  if ("error" in loop) throw new Error(loop.error);
  const mesh = prism(loop.loops[0].points, ["wall", "wall", "wall", "wall"]);
  const display = displayBody("ex1", false, mesh);
  expect(display.edges).toHaveLength(12 * 6);
  expect(display.id).toBe("ex1");
  expect(display.reference).toBe(false);
});

test("a named 32-gon wall has cap edges and no facet seams", () => {
  const points = Array.from({ length: 32 }, (_, i) => {
    const angle = (i * Math.PI) / 16;
    return [5 * Math.cos(angle), 5 * Math.sin(angle)];
  }).flat();
  const mesh = prism(
    points,
    Array.from({ length: 32 }, () => "wall"),
  );
  const { edges } = displayBody("ex1", false, mesh);
  expect(edges).toHaveLength(64 * 6);
  for (let offset = 0; offset < edges.length; offset += 6) {
    expect(edges[offset + 2]).toBe(edges[offset + 5]);
  }
});

test("display buffers are independent and include open triangle boundaries", () => {
  const mesh: KernelMesh = {
    positions: Float32Array.of(0.12345, 0, 0, 0, 1, 0, 0, 0, 1),
    triangles: Uint32Array.of(0, 1, 2),
    triFace: Uint32Array.of(0),
    faceNames: ["face"],
  };
  const display = displayBody("ref1", true, mesh);
  const again = displayBody("ref1", true, mesh);
  expect(display.reference).toBe(true);
  expect(display.indices).toEqual(mesh.triangles);
  expect(display.triFace).toEqual(mesh.triFace);
  expect(display.faceNames).toEqual(mesh.faceNames);
  expect(display.positions[0]).toBe(Math.fround(0.123));
  expect(display.edges).toHaveLength(3 * 6);
  expect(display.positions.buffer).not.toBe(mesh.positions.buffer);
  expect(display.indices.buffer).not.toBe(mesh.triangles.buffer);
  expect(display.triFace.buffer).not.toBe(mesh.triFace.buffer);
  expect(display.edges.buffer).not.toBe(again.edges.buffer);
  expect(display.faceNames).not.toBe(mesh.faceNames);
});
