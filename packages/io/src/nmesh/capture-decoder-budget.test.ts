import { expect, mock, test } from "bun:test";
import * as real from "@nodetto/nmesh";

const sentinel = real.toInline(
  real.encodeNmesh(
    real.canonicalize({
      positions: Float64Array.of(91, 92, 93, 94, 95, 96, 97, 98, 100),
      triangles: Uint32Array.of(0, 1, 2),
    }),
  ),
);
const sentinelBytes = real.fromInline(sentinel);
const inspectReal = real.inspectNmesh;
mock.module("@nodetto/nmesh", () => ({
  ...real,
  inspectNmesh: (bytes: Uint8Array) => {
    const result = inspectReal(bytes);
    return bytes.length === sentinelBytes.length &&
      bytes.every((v, i) => v === sentinelBytes[i])
      ? { ...result, vertexCount: result.vertexCount + 1 }
      : result;
  },
}));

test("capture budget follows the inspection result", async () => {
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  const result = decodeCaptureMeshWith(sentinel, { maxVertices: 3 });
  expect(result.vertexCount).toBe(4);
  expect(result.positions).toBeUndefined();
  expect(result.triangles).toBeUndefined();
});
