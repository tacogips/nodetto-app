import { describe, expect, test } from "bun:test";
import { crc32 } from "./crc32.ts";
import { MIN_NMESH_FIXED_BYTES, MIN_TRIANGLE_BYTES } from "./encode.ts";
import {
  NMESH_INLINE_MAX_CHARS,
  NMESH_INLINE_PREFIX,
  NmeshError,
  canonicalize,
  decodeNmesh,
  encodeNmesh,
  fromInline,
  isCanonical,
  inspectNmesh,
  toInline,
  toTriangleMesh,
} from "./index.ts";
import { plate, prism } from "./testing/meshes.ts";

const header = [0x4e, 0x4d, 0x53, 0x48, 1, 0, 3, 0];

function file(
  body: readonly number[],
  size = header.length + body.length + 4,
): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(header);
  bytes.set(body, header.length);
  const end = bytes.length - 4;
  new DataView(bytes.buffer).setUint32(end, crc32(bytes, end), true);
  return bytes;
}

function varint(input: number): number[] {
  let value = input;
  const bytes: number[] = [];
  while (value >= 128) {
    bytes.push((value % 128) + 128);
    value = Math.floor(value / 128);
  }
  return [...bytes, value];
}

function expectCode(run: () => unknown, code: string): void {
  expect(run).toThrow(new NmeshError(code));
}

describe("NMESH v1", () => {
  test("uses the IEEE CRC-32 and represents an empty mesh", () => {
    const check = new TextEncoder().encode("123456789");
    expect(crc32(check, check.length)).toBe(0xcbf43926);
    const mesh = canonicalize({
      positions: new Float64Array(),
      triangles: new Uint32Array(),
    });
    const bytes = encodeNmesh(mesh);
    expect(bytes).toEqual(file([0, 0, 0]));
    expect(decodeNmesh(bytes)).toEqual(mesh);
  });

  for (const [name, mesh] of [
    ["box", () => plate(0)],
    ["64-gon prism", () => prism(64)],
    ["60-hole plate", () => plate(60)],
  ] as const) {
    test(`round-trips a ${name}`, () => {
      const quantized = canonicalize(mesh());
      const encoded = encodeNmesh(quantized);
      const padded = new Uint8Array(encoded.length + 10);
      padded.set(encoded, 5);
      expect(decodeNmesh(padded.subarray(5, -5))).toEqual(quantized);
      expect(isCanonical(quantized)).toBe(true);
    });
  }

  test("remaps numbering and triangle order without changing bytes", () => {
    const { positions, triangles } = plate(3);
    const triFace = Uint32Array.from(
      { length: triangles.length / 3 },
      (_, index) => (index % 4 === 0 ? 0xffff_ffff : index % 4),
    );
    const reversed = new Float64Array(positions.length);
    const count = positions.length / 3;
    for (let vertex = 0; vertex < count; vertex++) {
      reversed.set(
        positions.subarray(vertex * 3, vertex * 3 + 3),
        (count - vertex - 1) * 3,
      );
    }
    const reordered = new Uint32Array(triangles.length);
    for (let index = 0; index < triangles.length; index += 3) {
      const offset = triangles.length - index - 3;
      for (let corner = 0; corner < 3; corner++) {
        reordered[offset + corner] =
          count - triangles[index + ((corner + 1) % 3)] - 1;
      }
    }
    const original = encodeNmesh(
      canonicalize({ positions, triangles, triFace }),
    );
    const result = canonicalize({
      positions: reversed,
      triangles: reordered,
      triFace: triFace.slice().reverse(),
    });
    expect(encodeNmesh(result)).toEqual(original);
    expect(decodeNmesh(original)).toEqual(result);
    expect(encodeNmesh(canonicalize(toTriangleMesh(result)))).toEqual(original);
    reversed[0] += 0.001;
    expect(
      encodeNmesh(
        canonicalize({
          positions: reversed,
          triangles: reordered,
          triFace: triFace.slice().reverse(),
        }),
      ),
    ).not.toEqual(original);
  });

  test("welds at 1 micrometre, removes collapsed and collinear triangles, and keeps winding", () => {
    const mesh = canonicalize({
      positions: Float64Array.of(
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0.0004,
        0,
        0,
        2,
        0,
        0,
        9,
        9,
        9,
      ),
      triangles: Uint32Array.of(2, 1, 3, 0, 3, 2, 0, 1, 4),
    });
    expect(mesh.positions).toEqual(
      Int32Array.of(0, 0, 0, 0, 1000, 0, 1000, 0, 0),
    );
    expect(mesh.triangles).toEqual(Uint32Array.of(0, 1, 2));
    expect(isCanonical(mesh)).toBe(true);
  });

  test("reads a file whose triangles were emitted out of canonical order", () => {
    // Positions first appear as (0, 0), (1, 1), (0, 1), (1, 0).
    const bytes = file([
      4, 2, 1, 0, 2, 0, 0, 0, 2, 2, 0, 1, 0, 0, 2, 1, 0, 0, 0, 0, 3, 0, 3,
    ]);
    const decoded = decodeNmesh(bytes);
    expect(decoded.triangles).toEqual(Uint32Array.of(0, 1, 2, 0, 3, 1));
    expect(isCanonical(decoded)).toBe(false);
    expectCode(() => encodeNmesh(decoded), "nmesh.canonical");
    const mesh = toTriangleMesh(decoded);
    const canonical = canonicalize(mesh);
    const expected = file([
      4, 2, 1, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 3, 1, 0,
    ]);
    const swapped = canonicalize({
      ...mesh,
      triangles: Uint32Array.of(0, 3, 1, 0, 1, 2),
    });
    expect(encodeNmesh(canonical)).toEqual(expected);
    expect(encodeNmesh(swapped)).toEqual(expected);
    expect(isCanonical(decodeNmesh(encodeNmesh(canonical)))).toBe(true);
  });

  for (const [offset, code] of [
    [0, "nmesh.magic"],
    [4, "nmesh.version"],
    [5, "nmesh.flags"],
    [6, "nmesh.unit"],
    [7, "nmesh.flags"],
  ] as const) {
    test(`rejects a changed header byte at ${offset}`, () => {
      const bytes = file([0, 0, 0]);
      bytes[offset]++;
      expectCode(() => decodeNmesh(bytes), code);
    });
  }

  test("rejects truncated or over-wide varints", () => {
    expectCode(() => decodeNmesh(file([128, 128, 128])), "nmesh.truncated");
    expectCode(
      () => decodeNmesh(file([128, 128, 128, 128, 128, 0, 0, 0])),
      "nmesh.range",
    );
    expectCode(
      () => decodeNmesh(file([255, 255, 255, 255, 16, 0, 0])),
      "nmesh.range",
    );
  });

  test("rejects overlong encodings of counts and group face IDs", () => {
    const triangle = [3, 1, 1, 0, 1, 0, 0, 0, 0, 2, 0, 2, 1, 0, 0, 0, 0];
    expect(decodeNmesh(file(triangle)).triangles).toEqual(
      Uint32Array.of(0, 1, 2),
    );
    expectCode(
      () => decodeNmesh(file([0x83, 0, ...triangle.slice(1)])),
      "nmesh.range",
    );
    expectCode(
      () =>
        decodeNmesh(
          file([...triangle.slice(0, 3), 0x80, 0, ...triangle.slice(4)]),
        ),
      "nmesh.range",
    );
  });

  test("checks the combined count bound before allocating or validating the checksum", () => {
    const size = 1_048_576;
    const claimed = varint(Math.floor((size - 12) / 3));
    const bytes = file([...claimed, ...claimed, 0], size);
    bytes[bytes.length - 1] ^= 1;
    const start = performance.now();
    expectCode(() => decodeNmesh(bytes), "nmesh.count");
    expect(performance.now() - start).toBeLessThan(5);
  });

  test("rejects impossible indices and unused vertices", () => {
    expectCode(
      () => decodeNmesh(file([0, 1, 1, 0, 1, 0, 0, 0])),
      "nmesh.index",
    );
    expectCode(
      () => decodeNmesh(file([0, 1, 1, 0, 1, 1, 0, 0])),
      "nmesh.index",
    );
    expectCode(() => decodeNmesh(file([1, 0, 0, 0, 0, 0])), "nmesh.index");
  });

  test("rejects missing, unordered and mismatched groups", () => {
    expectCode(() => decodeNmesh(file([0, 1, 0, 0, 0, 0])), "nmesh.groups");
    expectCode(() => decodeNmesh(file([0, 0, 2, 1, 0, 1, 0])), "nmesh.groups");
    expectCode(
      () => decodeNmesh(file([0, 1, 1, 0, 0, 0, 0, 0])),
      "nmesh.groups",
    );
    expectCode(() => decodeNmesh(file([0, 0, 1, 0, 1])), "nmesh.groups");
  });

  test("rejects out-of-range absolute and accumulated positions", () => {
    expectCode(
      () => decodeNmesh(file([1, 0, 0, ...varint(20_000_002), 0, 0])),
      "nmesh.range",
    );
    expectCode(
      () => decodeNmesh(file([2, 0, 0, ...varint(20_000_000), 0, 0, 2, 0, 0])),
      "nmesh.range",
    );
    expectCode(
      () =>
        canonicalize({
          positions: Float64Array.of(0, 0, Number.POSITIVE_INFINITY),
          triangles: new Uint32Array(),
        }),
      "nmesh.range",
    );
  });

  test("rejects trailing bytes and bad checksums", () => {
    expectCode(() => decodeNmesh(file([0, 0, 0, 0])), "nmesh.trailing");
    const bytes = file([0, 0, 0]);
    bytes[bytes.length - 1] ^= 1;
    expectCode(() => decodeNmesh(bytes), "nmesh.crc");
  });

  test("handles 2,000 deterministic mutations and truncations", () => {
    const bytes = encodeNmesh(canonicalize(prism(64)));
    let seed = 13;
    for (let trial = 0; trial < 2_000; trial++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const offset = (seed >>> 8) % bytes.length;
      const candidate =
        trial % 3 === 0 ? bytes.slice(0, offset) : bytes.slice();
      if (trial % 3 !== 0) candidate[offset] ^= (seed % 255) + 1;
      if (trial % 3 === 2) {
        const end = candidate.length - 4;
        new DataView(candidate.buffer).setUint32(
          end,
          crc32(candidate, end),
          true,
        );
      }
      try {
        const decoded = decodeNmesh(candidate);
        const canonical = canonicalize(toTriangleMesh(decoded));
        expect(isCanonical(canonical)).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(NmeshError);
      }
    }
  });
});

describe("inline canonicalization", () => {
  test("refuses too many surviving triangles before sorting", () => {
    const maxBytes =
      Math.floor((NMESH_INLINE_MAX_CHARS - NMESH_INLINE_PREFIX.length) / 4) * 3;
    const count =
      Math.floor((maxBytes - MIN_NMESH_FIXED_BYTES) / MIN_TRIANGLE_BYTES) + 1;
    const triangles = new Uint32Array(count * 3);
    for (let i = 0; i < triangles.length; i += 3) triangles.set([0, 1, 2], i);
    const mesh = {
      positions: Float64Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0),
      triangles,
    };
    const sort = Array.prototype.sort;
    let sorted = false;
    Array.prototype.sort = function (...args) {
      sorted = true;
      return sort.apply(this, args);
    };
    try {
      expectCode(() => canonicalize(mesh, { inline: true }), "nmesh.inline");
      expect(sorted).toBe(false);
    } finally {
      Array.prototype.sort = sort;
    }
  });

  test("encoded triangle indices occupy at least three bytes each", () => {
    let seed = 41;
    for (let trial = 0; trial < 40; trial++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const mesh = canonicalize(prism(3 + (seed % 80)), { inline: true });
      expect(encodeNmesh(mesh).length).toBeGreaterThanOrEqual(
        MIN_NMESH_FIXED_BYTES +
          MIN_TRIANGLE_BYTES * (mesh.triangles.length / 3),
      );
    }
  });
});

describe("NMESH inline armour", () => {
  test("round-trips all padding lengths and matches known base64 bytes", () => {
    expect(toInline(Uint8Array.of(255))).toBe("nmesh1:/w==");
    expect(toInline(Uint8Array.of(255, 238))).toBe("nmesh1:/+4=");
    expect(toInline(Uint8Array.of(255, 238, 221))).toBe("nmesh1:/+7d");
    const bytes = encodeNmesh(canonicalize(plate(60)));
    expect(fromInline(toInline(bytes))).toEqual(bytes);
  });

  test("rejects invalid padding, alphabet and prefix", () => {
    for (const input of [
      "nmesh2:AAAA",
      "nmesh1:",
      "nmesh1:AAA",
      "nmesh1:A===",
      "nmesh1:A A=",
      "nmesh1:AA-_",
      "nmesh1:éAAA",
      "nmesh1:AB==",
      "nmesh1:AAAA\n",
    ]) {
      expectCode(() => fromInline(input), "nmesh.inline");
    }
    expectCode(() => toInline(new Uint8Array()), "nmesh.inline");
  });

  test("caps the whole string including its prefix", () => {
    const maxBytes =
      Math.floor((NMESH_INLINE_MAX_CHARS - NMESH_INLINE_PREFIX.length) / 4) * 3;
    const bytes = new Uint8Array(maxBytes).fill(233);
    const armored = toInline(bytes);
    expect(fromInline(armored)).toEqual(bytes);
    expectCode(() => toInline(new Uint8Array(maxBytes + 1)), "nmesh.inline");
    expectCode(() => fromInline(`${armored}AAAA`), "nmesh.inline");
  });
});

test("inspector preserves corruption errors", () => {
  const invalid = [
    Uint8Array.of(1),
    ...[0, 4, 5, 6, 7].map((offset) => {
      const bytes = file([0, 0, 0]);
      bytes[offset] = (bytes[offset] as number) + 1;
      return bytes;
    }),
    file([128, 128, 128]),
    file([128, 128, 128, 128, 128, 0, 0, 0]),
    file([255, 255, 255, 255, 16, 0, 0]),
    file([0x83, 0, 1, 1, 0, 1, 0, 0, 0, 0, 2, 0, 2, 1, 0, 0, 0, 0]),
    file([0, 1, 1, 0, 1, 0, 0, 0]),
    file([1, 0, 0, 0, 0, 0]),
    file([0, 1, 0, 0, 0, 0]),
    file([0, 0, 2, 1, 0, 1, 0]),
    file([0, 1, 1, 0, 0, 0, 0, 0]),
    file([0, 0, 1, 0, 1]),
    file([1, 0, 0, ...varint(20_000_002), 0, 0]),
    file([2, 0, 0, ...varint(20_000_000), 0, 0, 2, 0, 0]),
    file([0, 0, 0, 0]),
  ];
  const badCrc = file([0, 0, 0]);
  badCrc[badCrc.length - 1] ^= 1;
  invalid.push(badCrc);
  for (const bytes of invalid) {
    let caught: unknown;
    try {
      decodeNmesh(bytes);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NmeshError);
    expect(() => inspectNmesh(bytes)).toThrow(caught as NmeshError);
  }
});
