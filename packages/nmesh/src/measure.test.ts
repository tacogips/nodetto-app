import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  NMESH_INLINE_MAX_CHARS,
  NMESH_INLINE_PREFIX,
  canonicalize,
  decodeNmesh,
  encodeNmesh,
  toTriangleMesh,
} from "./index.ts";
import { plate, sphere, torus } from "./testing/meshes.ts";

test("measures NMESH size, codec time and estimated inline capacity", () => {
  const maxInlineBytes =
    3 * Math.floor((NMESH_INLINE_MAX_CHARS - NMESH_INLINE_PREFIX.length) / 4);
  const cases = [
    ["1000-hole plate", () => plate(1_000)],
    ["360 x 180 UV sphere", () => sphere(360, 180)],
    ["256 x 96 torus", () => torus(256, 96)],
    ["200 x 100 noisy sphere", () => sphere(200, 100, true)],
  ] as const;
  decodeNmesh(encodeNmesh(canonicalize(plate(60))));
  const metrics = cases.map(([name, generate]) => {
    const source = generate();
    const startEncode = performance.now();
    const canonical = canonicalize(source);
    const bytes = encodeNmesh(canonical);
    const encodeMs = performance.now() - startEncode;
    const startDecode = performance.now();
    const result = decodeNmesh(bytes);
    const decodeMs = performance.now() - startDecode;
    const mesh = toTriangleMesh(result);
    const vertexCount = mesh.positions.length / 3;
    const triangleCount = mesh.triangles.length / 3;
    const rawBytes = 4 * (mesh.positions.length + mesh.triangles.length);
    const jsonBytes = JSON.stringify({
      positions: Array.from(mesh.positions),
      triangles: Array.from(mesh.triangles),
    }).length;
    return {
      name,
      vertexCount,
      triangleCount,
      encodedBytes: bytes.length,
      rawBytes,
      jsonBytes,
      bytesPerVertex: bytes.length / vertexCount,
      rawRatio: bytes.length / rawBytes,
      jsonRatio: bytes.length / jsonBytes,
      encodeMs,
      decodeMs,
      estimatedInlineVertices: Math.floor(
        (maxInlineBytes * vertexCount) / bytes.length,
      ),
    };
  });
  const outputDir = new URL("../../../tmp/cad3d/m12/", import.meta.url);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    new URL("measure.json", outputDir),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );

  expect(metrics[0].vertexCount).toBe(128_008);
  expect(metrics[0].triangleCount).toBe(260_012);
  expect(metrics[0].decodeMs).toBeLessThan(50);
  expect(metrics[0].encodeMs).toBeLessThan(2_000);
  for (const metric of metrics) {
    expect(metric.rawRatio).toBeLessThanOrEqual(0.5);
    expect(metric.jsonRatio).toBeLessThanOrEqual(0.4);
    expect(metric.bytesPerVertex).toBeLessThanOrEqual(18);
  }
});
