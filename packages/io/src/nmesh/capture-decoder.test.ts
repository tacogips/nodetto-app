import { expect, test } from "bun:test";
import {
  NmeshError,
  canonicalize,
  encodeNmesh,
  toInline,
  toTriangleMesh,
} from "@nodetto/nmesh";
import { decodeCaptureMesh } from "./capture-decoder.ts";

test("capture decoder round trips a cube and rejects corruption", () => {
  const cube = canonicalize({
    positions: new Float64Array([
      0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
    ]),
    triangles: new Uint32Array([
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
      3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ]),
  });
  const decoded = decodeCaptureMesh(toInline(encodeNmesh(cube)));
  expect(decoded.positions).toBeInstanceOf(Float64Array);
  expect(decoded.positions).toEqual(toTriangleMesh(cube).positions);
  expect(decoded.triangles).toEqual(cube.triangles);
  expect(decoded.triangles.length).toBe(36);
  expect(() => decodeCaptureMesh("nmesh1:!!!!")).toThrow(NmeshError);
});
