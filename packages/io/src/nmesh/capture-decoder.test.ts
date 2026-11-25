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

test("budgeted capture decoder matches eligibility fixtures", async () => {
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  for (const [name, expected] of [
    ["tetrahedron", true],
    ["tetrahedron-reversed", true],
    ["tetrahedron-mixed", false],
    ["triangle", false],
    ["double-sided-triangle", false],
    ["coplanar-tetrahedron", false],
    ["thin-bar", true],
    ["translated-flat-shell", false],
    ["translated-thin-bar", true],
  ] as const) {
    const data = (
      await Bun.file(`crates/capture/tests/fixtures/${name}.nmesh.txt`).text()
    ).trim();
    const original = decodeCaptureMesh(data);
    const full = decodeCaptureMeshWith(data, { needTarget: true });
    expect(full.booleanTarget).toBe(expected);
    expect(full.positions).toEqual(original.positions);
    expect(full.triangles).toEqual(original.triangles);
    for (let axis = 0; axis < 3; axis++) {
      const values = Array.from(original.positions).filter(
        (_, i) => i % 3 === axis,
      );
      expect(Object.is(full.bounds?.min[axis], Math.min(...values))).toBe(true);
      expect(Object.is(full.bounds?.max[axis], Math.max(...values))).toBe(true);
    }
    const defaults = decodeCaptureMeshWith(data, {});
    expect(defaults.booleanTarget).toBeUndefined();
    expect(defaults.positions).toEqual(original.positions);
    expect(defaults.triangles).toEqual(original.triangles);
    if (name === "triangle" || name === "tetrahedron") {
      const calls: string[] = [];
      const limited = decodeCaptureMeshWith(data, {
        maxVertices: name === "triangle" ? 2 : 3,
        needTarget: true,
        onAllocate: (kind) => calls.push(kind),
      });
      expect(limited.booleanTarget).toBe(expected);
      expect(limited.vertexCount).toBe(full.vertexCount);
      expect(limited.triangleCount).toBe(full.triangleCount);
      expect(limited.bounds).toEqual(full.bounds);
      expect(limited.positions).toBeUndefined();
      expect(limited.triangles).toBeUndefined();
      expect(calls).toContain("target");
      expect(calls.some((kind) => kind !== "target")).toBe(false);
    }
  }
});

test("budgeted decoder preserves extrema, empty bounds and corruption errors", async () => {
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  const mesh = canonicalize({
    positions: Float64Array.of(-4, 2, 7, 3, -5, 1, 2, 6, -8),
    triangles: Uint32Array.of(0, 1, 2),
  });
  const bytes = encodeNmesh(mesh);
  const full = decodeCaptureMeshWith(toInline(bytes), {});
  expect(full.bounds).toEqual({ min: [-4, -5, -8], max: [3, 6, 7] });
  const empty = canonicalize({
    positions: new Float64Array(),
    triangles: new Uint32Array(),
  });
  expect(
    decodeCaptureMeshWith(toInline(encodeNmesh(empty)), {}).bounds,
  ).toBeNull();
  for (let i = 0; i < bytes.length; i++) {
    const corrupt = bytes.slice();
    corrupt[i] = (corrupt[i] as number) ^ 0x80;
    let error: unknown;
    try {
      decodeCaptureMesh(toInline(corrupt));
    } catch (caught) {
      error = caught;
    }
    if (!(error instanceof NmeshError)) continue;
    const calls: string[] = [];
    expect(() =>
      decodeCaptureMeshWith(toInline(corrupt), {
        maxVertices: 0,
        needTarget: true,
        onAllocate: (kind) => calls.push(kind),
      }),
    ).toThrow(error);
    expect(calls).toEqual([]);
  }
});

test("budgeted decoding preserves explicit codec corruption errors", async () => {
  const { crc32 } = await import("../../../nmesh/src/crc32.ts");
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  const file = (body: number[]) => {
    const bytes = Uint8Array.from([
      0x4e,
      0x4d,
      0x53,
      0x48,
      1,
      0,
      3,
      0,
      ...body,
      0,
      0,
      0,
      0,
    ]);
    new DataView(bytes.buffer).setUint32(
      bytes.length - 4,
      crc32(bytes, bytes.length - 4),
      true,
    );
    return bytes;
  };
  const varint = (input: number) => {
    const result: number[] = [];
    let value = input;
    while (value >= 128) {
      result.push((value % 128) + 128);
      value = Math.floor(value / 128);
    }
    return [...result, value];
  };
  const triangle = [3, 1, 1, 0, 1, 0, 0, 0, 0, 2, 0, 2, 1, 0, 0, 0, 0];
  const cases = [
    Uint8Array.of(1),
    ...[0, 4, 5, 6, 7].map((i) => {
      const b = file([0, 0, 0]);
      b[i] = (b[i] as number) + 1;
      return b;
    }),
    file([128, 128, 128]),
    file([128, 128, 128, 128, 128, 0, 0, 0]),
    file([255, 255, 255, 255, 16, 0, 0]),
    file([0x83, 0, ...triangle.slice(1)]),
    file([...triangle.slice(0, 3), 0x80, 0, ...triangle.slice(4)]),
    file([0, 1, 1, 0, 1, 0, 0, 0]),
    file([0, 1, 1, 0, 1, 1, 0, 0]),
    file([1, 0, 0, 0, 0, 0]),
    file([0, 1, 0, 0, 0, 0]),
    file([0, 0, 2, 1, 0, 1, 0]),
    file([0, 1, 1, 0, 0, 0, 0, 0]),
    file([0, 0, 1, 0, 1]),
    file([1, 0, 0, ...varint(20_000_002), 0, 0]),
    file([2, 0, 0, ...varint(20_000_000), 0, 0, 2, 0, 0]),
    file([0, 0, 0, 0]),
  ];
  const crc = file([0, 0, 0]);
  crc[crc.length - 1] = (crc[crc.length - 1] as number) ^ 1;
  cases.push(crc);
  const count = file([255, 255, 255, 255, 15, 0, 0]);
  cases.push(count);
  for (const bytes of cases) {
    const data = toInline(bytes);
    let caught: unknown;
    try {
      decodeCaptureMesh(data);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NmeshError);
    const allocations: string[] = [];
    expect(() =>
      decodeCaptureMeshWith(data, {
        maxVertices: 0,
        onAllocate: (kind) => allocations.push(kind),
      }),
    ).toThrow(caught as NmeshError);
    expect(allocations).toEqual([]);
  }
});

test("multi-byte vertex counts respect the geometry budget", async () => {
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  const positions = new Float64Array(129 * 3);
  const triangles = new Uint32Array(129);
  for (let i = 0; i < 129; i++) {
    positions[i * 3] = i;
    positions[i * 3 + 1] = i % 2;
    triangles[i] = i;
  }
  const mesh = canonicalize({ positions, triangles });
  const count = mesh.positions.length / 3;
  expect(count).toBeGreaterThanOrEqual(128);
  const data = toInline(encodeNmesh(mesh));
  const calls: string[] = [];
  const kept = decodeCaptureMeshWith(data, {
    maxVertices: count,
    onAllocate: (kind) => calls.push(kind),
  });
  expect(kept.positions).toBeDefined();
  expect(calls).toEqual(["positions", "triangles", "mm"]);
  calls.length = 0;
  const omitted = decodeCaptureMeshWith(data, {
    maxVertices: count - 1,
    onAllocate: (kind) => calls.push(kind),
  });
  expect(omitted.positions).toBeUndefined();
  expect(omitted.triangles).toBeUndefined();
  expect(omitted.vertexCount).toBe(count);
  expect(omitted.bounds).toEqual(kept.bounds);
  expect(calls).toEqual([]);
});
