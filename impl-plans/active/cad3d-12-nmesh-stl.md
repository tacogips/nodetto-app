# M12 cad3d-12-nmesh-stl

- dependsOn: none
- Design: sections 7.3, 9, 12, 14
- writePaths (all new): `packages/io/src/nmesh/types.ts`,
  `packages/io/src/nmesh/canonical.ts`, `packages/io/src/nmesh/encode.ts`,
  `packages/io/src/nmesh/decode.ts`, `packages/io/src/nmesh/armor.ts`,
  `packages/io/src/nmesh/crc32.ts`, `packages/io/src/nmesh/index.ts`,
  `packages/io/src/stl/read.ts`, `packages/io/src/stl/write.ts`,
  `packages/io/src/stl/index.ts`, tests beside them,
  `packages/io/src/nmesh/testing/meshes.ts`; existing:
  `packages/io/src/index.ts`, `packages/io/package.json` (subpath exports
  `./nmesh`, `./stl`)

## Intent

Two self-contained format modules. Files under `nmesh/` and `stl/` import
nothing outside their own folder (a test enforces it), so each can be
extracted as a library.

## Contract

```ts
// nmesh/types.ts
export interface TriangleMesh { readonly positions: Float64Array | Float32Array; // xyz mm
  readonly triangles: Uint32Array; readonly triFace?: Uint32Array }
export interface QuantizedMesh { readonly positions: Int32Array; // micrometres
  readonly triangles: Uint32Array; readonly groups: readonly { faceId: number; count: number }[] }
export class NmeshError extends Error { readonly code: string }
// nmesh/index.ts
export const NMESH_INLINE_PREFIX = "nmesh1:";
export const NMESH_INLINE_MAX_CHARS = 1_048_576;
export function canonicalize(mesh: TriangleMesh): QuantizedMesh;
export function isCanonical(mesh: QuantizedMesh): boolean;
export function encodeNmesh(mesh: QuantizedMesh): Uint8Array; // input must be canonical
export function decodeNmesh(bytes: Uint8Array): QuantizedMesh; // throws NmeshError
export function toInline(bytes: Uint8Array): string; // throws when over the cap
export function fromInline(text: string): Uint8Array; // throws NmeshError
export function toTriangleMesh(mesh: QuantizedMesh): TriangleMesh;
// stl/index.ts
export function writeBinaryStl(meshes: readonly TriangleMesh[], header?: string): Uint8Array;
export function readStl(bytes: Uint8Array, limits?: { maxBytes?: number; maxTriangles?: number }): TriangleMesh; // binary or ASCII
```

## Behavior

- Byte layout, canonical form and reader rules exactly as design 7.3.
  Error codes: `nmesh.magic`, `nmesh.version`, `nmesh.flags`, `nmesh.unit`,
  `nmesh.truncated`, `nmesh.count`, `nmesh.index`, `nmesh.groups`,
  `nmesh.range`, `nmesh.trailing`, `nmesh.crc`, `nmesh.inline`,
  `nmesh.canonical`.
- Allocation bound: before allocating, the decoder requires
  `3 * V + 3 * T + 2 * G <= length - 12` (else `nmesh.count`), so the two
  output arrays (12 bytes per vertex, 12 per triangle) total at most four
  times the input length.
- The decoder accepts a well-formed file that is not in canonical order
  and `isCanonical` reports it; `encodeNmesh` throws `nmesh.canonical` for
  a non-canonical input, so nodetto never writes one.
- Varints are decoded with multiplication, not 32-bit shifts, and are
  limited to 5 bytes. Decode loops index typed arrays directly, allocate
  only the two output arrays, and never destructure per element.
- Base64 is implemented in the module on `Uint8Array` (no `atob`, no
  `Buffer`), accepting standard alphabet with padding and no whitespace.
- `canonicalize` welds by quantised position with a `Map` keyed by a
  string of the three integers, removes degenerate triangles, applies the
  ordering of 7.3. `encodeNmesh(canonicalize(m))` is the canonical file.
- STL write: 80 byte header (default "nodetto"), little-endian count, per
  triangle the computed normal, three Float32 vertices, attribute 0.
- STL read: binary when `84 + 50 * count === length`, else ASCII parsed
  with an index scanner (no regex over the whole text, no `split` on the
  whole text); defaults `maxBytes` 64 MiB, `maxTriangles` 2,000,000;
  non-finite numbers and truncated facets throw `Error` with a code.

## Tests

- Round trip: `decode(encode(c))` deep-equals `c` for a box, a 64-gon
  prism and a 60 hole plate generated in `testing/meshes.ts` (own code).
- Canonical: shuffling triangle order, rotating triangle vertices and
  permuting vertex numbering of the input gives byte-identical output;
  changing one coordinate by 1 micrometre changes the bytes.
- Malformed input: one test per error code, plus a fuzz loop of 2,000
  single-byte mutations and truncations of a valid file where every result
  is either a valid mesh or an `NmeshError`, with no other exception; a
  crafted header claiming `V = T = floor((length - 12) / 3)` is rejected
  with `nmesh.count` before allocation (assert with a counting allocator
  seam or by checking that decode of such a 1 MB file returns in under
  5 ms).
- Non-canonical input: a file hand-built with two triangles swapped
  decodes, `isCanonical` is false, and `encodeNmesh(canonicalize(...))` of
  its triangles equals the canonical file byte for byte.
- Inline: round trip; a payload over the cap throws; a wrong prefix throws.
- Measurement (`nmesh/measure.test.ts`): meshes from own generators in
  `testing/meshes.ts`: the 128,008 vertex / 260,012 triangle plate, a UV
  sphere 360 x 180, a torus 256 x 96, and a sphere 200 x 100 with
  seeded pseudo-random radial noise (a stand-in for scanned data). For
  each, encoded size is at most 50% of the raw Float32 + Uint32 size and
  at most 40% of `JSON.stringify` of number arrays, and bytes per vertex
  is at most 18 (spike: 13.9 to 16.0); the test also reports how many
  vertices of each mesh class fit the inline cap. For the plate: decode takes under 50 ms and `canonicalize + encode` under
  2,000 ms; the numbers are written to `tmp/cad3d/m12/measure.json`.
- STL: write then read returns the same triangles (Float32 precision); an
  ASCII sample written by the test itself parses; wrong length, oversized
  count and `nan` are rejected.
- Isolation test: every import specifier in `nmesh/*.ts` and `stl/*.ts`
  starts with `./`.

## Acceptance criteria

- Measured ratios and times recorded; design table 7.3 is updated in the
  same commit if the measured ratios differ by more than five points.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/io/src/nmesh packages/io/src/stl'`
2. `sh -c 'bunx biome check packages/io/src/nmesh packages/io/src/stl && bun test packages/io/src/nmesh/measure.test.ts'`
