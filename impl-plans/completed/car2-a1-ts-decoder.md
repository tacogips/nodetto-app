# car2-a1-ts-decoder: budgeted TypeScript mesh decoder (R2-D TS half)

- planId: car2-a1-ts-decoder
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-D
  (Options, Result, Bounds, Over the limit, Eligibility and TypeScript
  bullets) and section 19.1 F1 (rules (a) to (d) and the fixture table).
- Progress log: `impl-plans/progress/car2-a1-ts-decoder.md`

## Intent

Add `decodeCaptureMeshWith(data, options)` next to the unchanged
`decodeCaptureMesh(data)`. It must give the same counts, bounds, eligibility
and error behaviour as the Rust `decode_inline_with` (plan a1-rust-decoder)
on the same fixtures.

## Non-goals

- Do not change `decodeCaptureMesh` or the existing behaviour of
  `decodeNmesh(bytes)` when it is called with one argument.
- Do not touch any caller in `packages/core` or `apps/`. Plan
  a2-core-wiring switches them.
- `packages/io` must not import `@nodetto/core`.

## Changes

1. `packages/nmesh/src/decode.ts`
   - `decodeNmesh(bytes, options?: { onAllocate?: (kind: "positions" |
     "triangles", length: number) => void })`. Call the hook immediately
     before `new Int32Array` and before `new Uint32Array`.
   - Add an exported `inspectNmesh(bytes: Uint8Array): { vertexCount:
     number; triangleCount: number; min: [number, number, number] | null;
     max: [number, number, number] | null }`. These are quantized integer
     bounds.
     - It makes one streaming pass with exactly the same checks and
       `NmeshError` codes in the same order as `decodeNmesh`: header,
       counts, CRC, groups, positions with range checks, triangle codes
       against `used`, then `used === vertexCount` and trailing bytes.
     - It allocates no typed array. Keep the previous vertex in three
       locals.
2. `packages/nmesh/src/index.ts`: export `inspectNmesh`.
3. `packages/io/src/nmesh/capture-decoder.ts`
   - Add the exported types:

         CaptureMeshDecodeOptions { maxVertices?: number; needTarget?: boolean; onAllocate?: (kind: "positions" | "triangles" | "mm" | "target", length: number) => void }

         CaptureMeshDecodeResult { vertexCount; triangleCount; bounds: { min: [n, n, n]; max: [n, n, n] } | null; booleanTarget?: boolean; positions?: Float64Array; triangles?: Uint32Array }

   - Add `decodeCaptureMeshWith(data: string, options:
     CaptureMeshDecodeOptions): CaptureMeshDecodeResult`.
     - Read the vertex count from the first header varint of
       `fromInline(data)`. If the header cannot be read, take the full
       path so that the error is unchanged.
     - Full path (`vertexCount <= maxVertices`, default `Infinity`):
       `decodeNmesh` with the hook mapped to `positions` and `triangles`,
       then `toTriangleMesh` with the millimetre array reported as `mm`.
       Bounds are quantized min and max divided by 1000.
     - Over-limit path: `inspectNmesh` gives the counts and bounds. When
       `needTarget` is set, also run `decodeNmesh` as scratch, and report
       every allocation as `target`.
     - Eligibility: only when `needTarget`. Port rules (a) to (d) with the
       same operation order as Rust, reading vertex `i` as `q[3i + k] /
       1000` from the quantized `Int32Array` (never from an `mm` array).
       The closure rule mirrors `crates/capture/src/mesh.rs:is_closed`.
       Encode edges as `min * vertexCount + max` numbers and sort them.
   - Keep `decodeCaptureMesh` unchanged.
4. `packages/io/src/nmesh/index.ts`: export `decodeCaptureMeshWith` and the
   two types.

## Pitfalls

- Bounds must be computed from the quantized integers and then divided.
- `bounds` is null exactly when `vertexCount === 0`.
- `booleanTarget` must be absent when `needTarget` is falsy.
- Under `noUncheckedIndexedAccess`, read typed arrays with an explicit
  `as number` or `?? 0`, as `decode.ts:75` does.
- Do not allocate the `mm` array on the over-limit path.

## Tests

1. `packages/io/src/nmesh/capture-decoder.test.ts`
   - Read each of the nine fixtures from `crates/capture/tests/fixtures/`
     (the path pattern is the one in
     `packages/cad-kernel/src/worker-host.test.ts:431`). With `needTarget:
     true`, `booleanTarget` equals the 19.1 table.
   - `bounds` equals the min and max of `decodeCaptureMesh(data).positions`,
     bit for bit (use `Object.is` per value).
   - An asymmetric mesh with negative coordinates (built with
     `encodeNmesh`) gives all six extrema.
   - `tetrahedron` with `maxVertices: 3, needTarget: true` gives `true`;
     `triangle` with `maxVertices: 2, needTarget: true` gives `false`. Both
     give the same counts and bounds as the full decode, no
     `positions`/`triangles` in the result, zero `positions`, `triangles`
     and `mm` hook calls, and at least one `target` call.
   - Default options give the same arrays as `decodeCaptureMesh`.
2. `packages/nmesh/src/codec.test.ts`: for every existing corruption case,
   `inspectNmesh` throws the same `NmeshError` code as `decodeNmesh`. With
   `maxVertices: 0`, `decodeCaptureMeshWith` throws the same error and
   records zero `positions`, `triangles` and `mm` calls.

All of these fail before the fix, because the APIs do not exist.

## Verification

- `bun test packages/nmesh/src packages/io/src/nmesh` must exit 0 and
  include the new cases.
- `bunx biome check --diagnostic-level=warn packages/nmesh/src/decode.ts packages/nmesh/src/index.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/index.ts packages/io/src/nmesh/capture-decoder.test.ts packages/nmesh/src/codec.test.ts`
  must exit 0.

## Done when

- All the tests above pass.
- `decodeCaptureMesh` and the one-argument `decodeNmesh` are unchanged in
  behaviour; the existing codec and capture-decoder tests pass unedited.
- The progress log reads `done`.
