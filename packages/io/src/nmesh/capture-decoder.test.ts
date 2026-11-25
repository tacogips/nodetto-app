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

// Construct binary STL as imported meshes are welded by canonicalization.
test("touching shell eligibility preserves invalid mesh rejection", async () => {
  const { readStl, writeBinaryStl } = await import("../stl/index.ts");
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  const box = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0 = 0,
    z1 = 5,
    crossed = false,
  ) => ({
    positions: Float64Array.of(
      x0,
      y0,
      z0,
      x1,
      y0,
      z0,
      x1,
      y1,
      z0,
      x0,
      y1,
      z0,
      x0,
      y0,
      z1,
      x1,
      y0,
      z1,
      x1,
      y1,
      z1,
      x0,
      y1,
      z1,
    ),
    triangles: Uint32Array.from([
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
      ...(crossed ? [3, 0, 7, 0, 4, 7] : [3, 0, 4, 3, 4, 7]),
    ]),
  });
  const a = box(0, 10, 0, 10);
  const edge = box(10, 20, 10, 20);
  const face = box(10, 20, 0, 10);
  const reversed = box(10, 20, 10, 20);
  // Reverse the triangle incident on the shared vertical edge.
  [reversed.triangles[30], reversed.triangles[31]] = [
    reversed.triangles[31] as number,
    reversed.triangles[30] as number,
  ];
  const triangle = {
    positions: Float64Array.of(0, 0, 0, 10, 0, 0, 5, -2, 0),
    triangles: Uint32Array.of(0, 1, 2),
  };
  const fin = {
    positions: Float64Array.of(10, 10, 0, 10, 10, 5, 13, 7, 5, 13, 7, 0),
    triangles: Uint32Array.of(0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2),
  };
  const inverse = box(0, 1, 0, 1, 0, 1);
  for (let i = 0; i < inverse.triangles.length; i += 3) {
    [inverse.triangles[i], inverse.triangles[i + 1]] = [
      inverse.triangles[i + 1] as number,
      inverse.triangles[i] as number,
    ];
  }
  const cases = [
    ["edge", [a, edge], true],
    ["face", [a, face], true],
    ["crossed diagonal", [a, box(10, 20, 0, 10, 0, 5, true)], true],
    ["separated", [a, box(12, 22, 0, 10)], true],
    ["open triangle", [a, triangle], false],
    ["unbalanced", [a, reversed], false],
    ["welded overlap", [a, box(0, 6, 0, 6)], false],
    ["double-sided fin", [a, edge, fin], false],
    [
      "coincident shells",
      [box(0, 1, 0, 1, 0, 1), inverse, box(2, 3, 0, 1, 0, 1)],
      false,
    ],
  ] as const;
  for (const [name, meshes, expected] of cases) {
    const canonical = canonicalize(readStl(writeBinaryStl(meshes)));
    const data = toInline(encodeNmesh(canonical));
    expect(
      decodeCaptureMeshWith(data, { needTarget: true }).booleanTarget,
      name,
    ).toBe(expected);
  }
});

test("face contact with a second overlap and self-touching shells are not targets", async () => {
  const { readStl, writeBinaryStl } = await import("../stl/index.ts");
  const { decodeCaptureMeshWith } = await import("./capture-decoder.ts");
  const box = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0 = 0,
    z1 = 5,
    crossed = false,
  ) => ({
    positions: Float64Array.of(
      x0,
      y0,
      z0,
      x1,
      y0,
      z0,
      x1,
      y1,
      z0,
      x0,
      y1,
      z0,
      x0,
      y0,
      z1,
      x1,
      y0,
      z1,
      x1,
      y1,
      z1,
      x0,
      y1,
      z1,
    ),
    triangles: Uint32Array.from([
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
      ...(crossed ? [3, 0, 7, 0, 4, 7] : [3, 0, 4, 3, 4, 7]),
    ]),
  });
  const prism = (
    outline: number[][],
    sequence: number[],
    tops: number[][],
    z0: number,
    z1: number,
  ) => {
    const positions = Float64Array.from(
      outline.flatMap(([x, y]) => [
        x as number,
        y as number,
        z0,
        x as number,
        y as number,
        z1,
      ]),
    );
    const triangles: number[] = [];
    for (const [a, b, c] of tops) {
      triangles.push(
        (a as number) * 2 + 1,
        (b as number) * 2 + 1,
        (c as number) * 2 + 1,
      );
      triangles.push((c as number) * 2, (b as number) * 2, (a as number) * 2);
    }
    for (let i = 0; i < sequence.length; i++) {
      const a = sequence[i] as number;
      const b = sequence[(i + 1) % sequence.length] as number;
      triangles.push(a * 2, b * 2, b * 2 + 1, a * 2, b * 2 + 1, a * 2 + 1);
    }
    return { positions, triangles: Uint32Array.from(triangles) };
  };
  const bracket = prism(
    [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 5],
      [15, 5],
      [15, 1],
      [18, 1],
      [18, 7],
      [0, 7],
    ],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 4],
      [0, 4, 9],
      [9, 4, 5],
      [9, 5, 8],
      [5, 6, 7],
      [5, 7, 8],
    ],
    0,
    5,
  );
  const slit = prism(
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 5],
      [3, 5],
      [3, 7],
      [7, 7],
      [7, 3],
      [3, 3],
    ],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 5, 4],
    [
      [0, 1, 8],
      [0, 8, 9],
      [1, 2, 7],
      [1, 7, 8],
      [2, 3, 6],
      [2, 6, 7],
      [3, 4, 5],
      [3, 5, 6],
      [4, 0, 9],
      [4, 9, 5],
    ],
    0,
    5,
  );
  // crossed=true uses the bracket's (10,0,0)-(10,2,5) diagonal.
  const cases = [
    ["bracket A", [bracket, box(10, 20, 0, 2, 0, 5, true)], false],
    ["bracket B", [bracket, box(10, 20, 0, 2)], false],
    ["slit ring", [slit], false],
    ["separated guard", [bracket, box(20, 30, 0, 2)], true],
    ["bracket guard", [bracket], true],
  ] as const;
  const results = cases.map(([name, meshes, expected]) => {
    const canonical = canonicalize(readStl(writeBinaryStl(meshes)));
    const actual = decodeCaptureMeshWith(toInline(encodeNmesh(canonical)), {
      needTarget: true,
    }).booleanTarget;
    return { name, actual, expected };
  });
  expect(results).toEqual(
    cases.map(([name, , expected]) => ({ name, actual: expected, expected })),
  );
});
