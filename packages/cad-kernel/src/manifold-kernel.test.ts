import { expect, test } from "bun:test";
import type { ToolMesh } from "@nodetto/core";
import { fileURLToPath } from "node:url";
import { createManifoldKernel } from "./index.ts";
import { readManifoldMesh } from "./manifold-kernel.ts";

function box(name: string, x = 0, y = 0, z = 0): ToolMesh {
  return {
    positions: Float64Array.of(
      x,
      y,
      z,
      x + 1,
      y,
      z,
      x + 1,
      y + 1,
      z,
      x,
      y + 1,
      z,
      x,
      y,
      z + 1,
      x + 1,
      y,
      z + 1,
      x + 1,
      y + 1,
      z + 1,
      x,
      y + 1,
      z + 1,
    ),
    triangles: Uint32Array.of(
      0,
      2,
      1,
      0,
      3,
      2,
      4,
      5,
      6,
      4,
      6,
      7,
      0,
      1,
      5,
      0,
      5,
      4,
      1,
      2,
      6,
      1,
      6,
      5,
      2,
      3,
      7,
      2,
      7,
      6,
      3,
      0,
      4,
      3,
      4,
      7,
    ),
    triFace: Uint32Array.of(0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5),
    faceNames: ["start", "end", "south", "east", "north", "west"].map(
      (face) => `${name}:${face}`,
    ),
  };
}

test("loads WASM from a host path and measures a unit box", async () => {
  const wasmUrl = fileURLToPath(
    import.meta.resolve("manifold-3d/manifold.wasm"),
  );
  const kernel = await createManifoldKernel({ wasmUrl });
  const input = box("Box");
  const handle = kernel.solid(input);
  expect(kernel.measure(handle)).toEqual({
    volume: 1,
    area: 6,
    empty: false,
    triangles: 12,
  });
  const mesh = kernel.mesh(handle);
  expect([...mesh.faceNames].sort()).toEqual([...input.faceNames].sort());
  expect(mesh.triFace).toHaveLength(12);
  kernel.release(handle);
  expect(() => kernel.mesh(handle)).toThrow("Unknown CAD kernel handle");
  expect(() => kernel.release(handle)).toThrow("Unknown CAD kernel handle");
  expect(mesh.positions).toHaveLength(24);
});

test("cut retains provenance after the inputs are released", async () => {
  const kernel = await createManifoldKernel();
  const base = kernel.solid(box("Base"));
  const cutter = kernel.solid(box("Cutter", 0.5, 0.25, 0.25));
  const cut = kernel.boolean("cut", base, [cutter]);
  const analyticVolume = 1 - 0.5 * 0.75 * 0.75;
  expect(
    Math.abs(kernel.measure(cut).volume / analyticVolume - 1),
  ).toBeLessThan(1e-5);
  expect(kernel.measure(base).volume).toBe(1);
  expect(kernel.measure(cutter).volume).toBe(1);
  kernel.release(base);
  kernel.release(cutter);
  const { faceNames, triFace, triangles } = kernel.mesh(cut);
  expect(triFace).toHaveLength(triangles.length / 3);
  expect(
    [...new Set(Array.from(triFace, (index) => faceNames[index]))].sort(),
  ).toEqual([
    "Base:east",
    "Base:end",
    "Base:north",
    "Base:south",
    "Base:start",
    "Base:west",
    "Cutter:south",
    "Cutter:start",
    "Cutter:west",
  ]);
  kernel.release(cut);
});

test("a disjoint intersection returns an owned empty solid", async () => {
  const kernel = await createManifoldKernel();
  const first = kernel.solid(box("First"));
  const second = kernel.solid(box("Second", 2));
  const result = kernel.boolean("intersect", first, [second]);
  kernel.release(first);
  kernel.release(second);
  expect(kernel.measure(result)).toEqual({
    volume: 0,
    area: 0,
    empty: true,
    triangles: 0,
  });
  expect(kernel.mesh(result).faceNames).toEqual([]);
  kernel.release(result);
});

test("rejects an open mesh with the native status and can build another solid", async () => {
  const kernel = await createManifoldKernel();
  const valid = box("Box");
  expect(() =>
    kernel.solid({
      ...valid,
      triangles: valid.triangles.slice(3),
      triFace: valid.triFace.slice(1),
    }),
  ).toThrow("NotManifold");
  const handle = kernel.solid(valid);
  expect(kernel.measure(handle).volume).toBe(1);
  kernel.release(handle);
});

test("validates Manifold mesh buffer coverage", () => {
  const valid = {
    numProp: 3,
    vertProperties: Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0),
    triVerts: Uint32Array.of(0, 1, 2),
    runIndex: Uint32Array.of(0, 3),
    runOriginalID: Uint32Array.of(1),
    faceID: Uint32Array.of(0),
  };
  const malformed = [
    { ...valid, vertProperties: new Float32Array(8) },
    { ...valid, numProp: 4, vertProperties: new Float32Array(9) },
    { ...valid, runOriginalID: new Uint32Array() },
    { ...valid, runIndex: Uint32Array.of(0) },
    { ...valid, faceID: new Uint32Array() },
    { ...valid, triVerts: Uint32Array.of(0, 1, 3) },
    { ...valid, runIndex: Uint32Array.of(0, 2) },
  ];
  for (const mesh of malformed) {
    expect(() => readManifoldMesh(mesh, () => ["face"])).toThrow(
      "Invalid Manifold mesh data",
    );
  }
  expect(() => readManifoldMesh(valid, () => [])).toThrow(
    "Missing Manifold face 1/0",
  );
});

test("converts empty and ordered multi-run Manifold buffers", () => {
  const empty = readManifoldMesh(
    {
      numProp: 4,
      vertProperties: Float32Array.of(1, 2, 3, 9),
      triVerts: new Uint32Array(),
      runIndex: Uint32Array.of(7),
      runOriginalID: Uint32Array.of(3),
      faceID: new Uint32Array(),
    },
    () => undefined,
  );
  expect([...empty.positions]).toEqual([1, 2, 3]);
  expect([...empty.triangles]).toEqual([]);
  expect([...empty.triFace]).toEqual([]);
  expect(empty.faceNames).toEqual([]);
  const mesh = readManifoldMesh(
    {
      numProp: 4,
      vertProperties: Float32Array.of(0, 0, 0, 8, 1, 0, 0, 8, 0, 1, 0, 8),
      triVerts: Uint32Array.of(0, 1, 2, 2, 1, 0),
      runIndex: Uint32Array.of(0, 3, 3, 6),
      runOriginalID: Uint32Array.of(1, 99, 2),
      faceID: Uint32Array.of(1, 0),
    },
    (id) =>
      id === 1 ? ["unused", "first"] : id === 2 ? ["second"] : undefined,
  );
  expect([...mesh.positions]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  expect([...mesh.triangles]).toEqual([0, 1, 2, 2, 1, 0]);
  expect([...mesh.triFace]).toEqual([0, 1]);
  expect(mesh.faceNames).toEqual(["first", "second"]);
});
