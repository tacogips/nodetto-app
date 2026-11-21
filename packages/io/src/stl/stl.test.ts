import { expect, test } from "bun:test";
import { StlError, readStl, writeBinaryStl } from "./index.ts";

const mesh = {
  positions: Float64Array.of(
    0.002845,
    0,
    0,
    1.2,
    0,
    0,
    0.002845,
    1.5,
    0,
    0.002845,
    0,
    2.75,
  ),
  triangles: Uint32Array.of(0, 1, 2, 0, 3, 1),
};
const text = `solid calibration wedge
  facet normal 0e0 0 1
    outer loop
      vertex .5 0 -0.25
      vertex +1.5e0 0 -0.25
      vertex .5 2. -0.25
    endloop
  endfacet
endsolid calibration wedge`;
const ascii = new TextEncoder();

test("writes little-endian binary facets, computes normals and keeps Float32 corner positions", () => {
  const binary = writeBinaryStl([mesh, mesh], "solid first and second wedges");
  expect(binary.length).toBe(84 + 4 * 50);
  expect(new TextDecoder().decode(binary.subarray(0, 29))).toBe(
    "solid first and second wedges",
  );
  const view = new DataView(binary.buffer);
  expect(view.getUint32(80, true)).toBe(4);
  expect([84, 88, 92].map((index) => view.getFloat32(index, true))).toEqual([
    0, 0, 1,
  ]);
  expect([134, 138, 142].map((index) => view.getFloat32(index, true))).toEqual([
    0, 1, 0,
  ]);
  expect(view.getUint16(132, true)).toBe(0);
  const padded = new Uint8Array(binary.length + 6);
  padded.set(binary, 3);
  const stl = readStl(padded.subarray(3, -3));
  const vertices = Array.from(mesh.triangles, (vertex) =>
    Array.from(mesh.positions.subarray(vertex * 3, vertex * 3 + 3)),
  ).flat();
  expect(stl.positions).toEqual(Float32Array.from([...vertices, ...vertices]));
  expect(stl.triangles).toEqual(
    Uint32Array.from({ length: 12 }, (_, index) => index),
  );
});

test("writes an empty STL with the default header", () => {
  const bytes = writeBinaryStl([]);
  expect(new TextDecoder().decode(bytes.subarray(0, 7))).toBe("nodetto");
  expect(readStl(bytes, { maxTriangles: 0 }).triangles.length).toBe(0);
});

test("scans ASCII facets with names, line endings and decimal exponents", () => {
  const mesh = readStl(
    ascii.encode(`\uFEFF${text.replaceAll("\n", "\r\n")}\r\n`),
  );
  expect(mesh.positions).toEqual(
    Float64Array.of(0.5, 0, -0.25, 1.5, 0, -0.25, 0.5, 2, -0.25),
  );
  expect(mesh.triangles).toEqual(Uint32Array.of(0, 1, 2));
});

test("rejects the wrong binary length, counts over the limit and input over the byte limit", () => {
  const bytes = writeBinaryStl([mesh]);
  expect(() => readStl(bytes.subarray(0, -1))).toThrow(StlError);
  expect(() => readStl(bytes, { maxTriangles: 1 })).toThrow(
    new StlError("stl.count"),
  );
  expect(() => readStl(bytes, { maxBytes: bytes.length - 1 })).toThrow(
    new StlError("stl.size"),
  );
  expect(() => readStl(ascii.encode(text), { maxTriangles: 0 })).toThrow(
    new StlError("stl.count"),
  );
  new DataView(bytes.buffer).setUint32(80, 0xffff_ffff, true);
  expect(() => readStl(bytes)).toThrow(StlError);
});

test("rejects non-finite coordinates and normals in both STL representations", () => {
  for (const invalid of ["nan", "1e400"]) {
    expect(() => readStl(ascii.encode(text.replace(".5", invalid)))).toThrow(
      new StlError("stl.number"),
    );
  }
  const bytes = writeBinaryStl([mesh]);
  for (const field of [84, 96]) {
    const bad = bytes.slice();
    new DataView(bad.buffer).setFloat32(field, Number.NaN, true);
    expect(() => readStl(bad)).toThrow(new StlError("stl.number"));
  }
  const overflowing = { ...mesh, positions: mesh.positions.slice() };
  overflowing.positions[0] = 1e100;
  expect(() => writeBinaryStl([overflowing])).toThrow(
    new StlError("stl.number"),
  );
});

test("rejects an incomplete facet, an overlong token and trailing facets", () => {
  expect(() =>
    readStl(ascii.encode(text.slice(0, text.indexOf("endfacet")))),
  ).toThrow(new StlError("stl.truncated"));
  expect(() =>
    readStl(ascii.encode(text.replace(".5", "0".repeat(129)))),
  ).toThrow(new StlError("stl.syntax"));
  expect(() => readStl(ascii.encode(`${text}\nfacet`))).toThrow(
    new StlError("stl.syntax"),
  );
});
