# car1-a1-nmesh-contract: capture mesh decoder contract (F1 eligibility, F4 seam)

- planId: car1-a1-nmesh-contract. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F1 ("Eligibility
  rule", "Tested boundary", "Decoder contract (plan A)") and the F4 bullet
  "Mesh (the A/B seam ...)" plus "Decoder allocations are counted ...".
- Progress log: `impl-plans/progress/car1-a1-nmesh-contract.md`.

## Intent

Give both mesh decoders (Rust for the native CLI, TypeScript for the
desktop and Bun) one capture contract. The contract returns
`vertexCount`, `bounds`, `booleanTarget` and optional geometry, and
supports a streaming over-limit path. Later plans consume it:
- A2 types and wires it into core and the CLI;
- B2 uses `booleanTarget`;
- B3 uses `maxVertices` and `needTarget`.

## Non-goals

- Do not edit `packages/core`, `apps/cli`, `crates/capture/src/mesh.rs`,
  `packages/nmesh/src/index.ts`, `canonical.ts`, `encode.ts`, `armor.ts` or
  `codec.test.ts`; those are plan M.
- Do not change `decode_inline`, `InlineMesh::to_packet` or the existing
  behaviour of `decodeNmesh(bytes)` called with one argument.
- No renderer classification change: the renderer keeps `is_closed`.

## Changes

1. `crates/capture/src/nmesh.rs`. Add, without changing existing items:
   - The result struct `CaptureDecode`:
     ```
     pub struct CaptureDecode { pub vertex_count: u32, pub bounds: ([f64;3],[f64;3]),
         pub boolean_target: Option<bool>, pub geometry: Option<(Vec<f64>, Vec<u32>)> }
     ```
   - `pub fn decode_capture(text: &str, max_vertices: u64, need_target: bool) -> Option<CaptureDecode>`.
   - A hidden test helper,
     `#[doc(hidden)] pub fn decode_capture_with_stats(..) -> (Option<CaptureDecode>, AllocStats)`.
     `AllocStats` counts every `Vec::with_capacity` site: `quantized`,
     `triangles`, `millimetres`, `edges`.
   - Within the limit (`vertex_count <= max_vertices`), decode fully as
     `decode_inline` does. `geometry` is `Some`, and `boolean_target` is
     always computed.
   - Over the limit, make one streaming pass with O(1) scratch:
     - run the same header, CRC, group, range and index-code checks, in the
       same order, as `decode_inline` (`nmesh.rs:120-166`);
     - keep the previous vertex for the delta decoding, the min and max
       for `bounds`, and the counters (`used`) for the index codes;
     - no `Vec` of positions or indices.
   - If `need_target` is set in the over-limit path, a second pass
     allocates the quantized scratch, indices and edges, computes
     `boolean_target` and drops them. It never builds `millimetres`.
   - `bounds` are millimetre values, `min(q) / UNITS_PER_MILLIMETRE`
     (monotone, so bit-identical to scanning the mm array).
   - `boolean_target` applies rules (a) to (d) of design 19.1 F1:
     - (a) call `crate::mesh::is_closed` on a `scene::Mesh` built from the
       geometry or the scratch;
     - (b) every directed edge `(u,v)` appears once, and `(v,u)` exactly
       once;
     - (c) no two triangles share the same sorted vertex triple;
     - (d) mesh-local origin `o` = vertex 0, `q = p - o` per coordinate,
       `V = sum qa.(qb x qc) / 6`, `A = sum |(qb-qa) x (qc-qa)| / 2`, in
       triangle order; the mesh is a target iff `V != 0 && 2*|V| >= A*5e-7`.
2. Fixtures in `crates/capture/tests/fixtures/`. Each is written by the
   production TS codec (`canonicalize`, `encodeNmesh`, `toInline`): one
   inline text per file, generated once by a script you run and do not
   commit; record the generator command in the progress log. Files:
   - `tetrahedron-reversed.nmesh.txt`;
   - `tetrahedron-mixed.nmesh.txt` (triangles `[0,1,2,0,1,3,0,3,2,1,2,3]`);
   - `triangle.nmesh.txt` (`[0,1,2]`);
   - `double-sided-triangle.nmesh.txt` (`[0,1,2,0,2,1]`);
   - `coplanar-tetrahedron.nmesh.txt`;
   - `thin-bar.nmesh.txt` (outward 1000 x 0.01 x 0.01 mm box);
   - `translated-flat-shell.nmesh.txt` (the design table coordinates at
     9000 mm, `[0,2,1,0,1,3,0,3,2,1,2,3]`);
   - `translated-thin-bar.nmesh.txt` (the thin bar plus (9000,9000,9000)).

   The existing `tetrahedron.nmesh.txt` is fixture 1. Never use data from
   screenshots or issues.
3. `packages/nmesh/src/decode.ts`. `decodeNmesh` gains an optional
   second argument; the existing export name is unchanged and `index.ts`
   is untouched:
   ```
   { maxVertices?: number; onAllocate?: (kind: "quantized" | "triangles", length: number) => void }
   ```
   - Without options, behaviour and allocations are identical to today.
   - With `maxVertices` below the header vertex count, it returns
     `{ over: true, vertexCount, triangleCount, min, max }`, with min and
     max in quantized units, from a streaming pass (same error order). It
     allocates no `Int32Array` or `Uint32Array`.
   - Call `onAllocate` at every array allocation site.
   - Use overload signatures so that one-argument callers keep the
     `QuantizedMesh` return type.
4. `packages/io/src/nmesh/capture-decoder.ts`. `decodeCaptureMesh` has
   exactly two overload signatures, in the pattern of the `decodeNmesh`
   overloads of item 3:
   - `decodeCaptureMesh(data: string): { vertexCount: number; bounds: { min: [number,number,number]; max: [number,number,number] }; booleanTarget: boolean; positions: Float64Array; triangles: Uint32Array }`.
     The one-argument call has no limit, so its geometry and
     `booleanTarget` are always present and required.
   - `decodeCaptureMesh(data: string, options: { maxVertices?: number; needTarget?: boolean; onAllocate?: (kind: "quantized"|"triangles"|"millimetres"|"edges", length: number) => void }): { vertexCount: number; bounds: {...}; booleanTarget: boolean | undefined; positions?: Float64Array; triangles?: Uint32Array }`.
     In the options overload, `booleanTarget` is undefined only over the
     limit without `needTarget`.
   - Within the limit, both overloads return the same `positions` and
     `triangles` arrays as today, plus `booleanTarget`.
   - The one-argument overload stays assignable to today's core
     `CaptureMeshDecoder` (`(data: string) => { readonly positions: Float64Array; readonly triangles: Uint32Array }`).
     That keeps `apps/cli/src/capture-cad.ts:123`,
     `apps/desktop/src/shell/export-handlers.ts:273`,
     `apps/desktop/src/shell/export-handlers.test.ts` (298, 317, 550) and
     `apps/cli/src/capture-cad.test.ts:219` compiling unchanged. Those
     files are not in this plan's writePaths and must not be edited.
   - Port rules (a) to (d) from Rust with the same operation order. In
     the over-limit plus `needTarget` path, compute on quantized scratch
     converted per access (`q / 1000`, the constant `toTriangleMesh`
     uses) and never allocate `millimetres`.
   - The implementation signature can be the union; only the two
     overloads are visible to callers. No `as` casts or `any` to silence
     typing.

## Pitfalls

- Error order must equal the full decode for every corruption case in
  `rejects_what_the_reference_decoder_rejects`. A streaming pass that
  stops early on a count is wrong.
- Rule (d) must use the local origin; a world-coordinate sum is the
  rejected round-5 bug.
- The Rust and TS sums must run in the same triangle order, with the same
  subtraction order.
- Do not add exports to `packages/nmesh/src/index.ts`.
- In the second overload of both `decodeNmesh` and `decodeCaptureMesh`,
  `options` must be required, not optional. An optional `options` makes
  one-argument calls resolve against the wrong overload, so
  `positions`/`triangles` become optional for existing callers and
  typecheck fails.

## Tests (each fails before because the API or fixture does not exist)

- `crates/capture/src/nmesh.rs` tests:
  - for every fixture, `boolean_target` equals the design table: true for
    tetrahedron, reversed, thin bar and translated thin bar; false for
    the others;
  - `bounds` equal the min and max of the decoded mm positions;
  - `decode_capture_with_stats(text, 0, false)` on the tetrahedron gives
    all `AllocStats` zero and the same `bounds`;
  - for each corruption case, the over-limit path rejects exactly like
    `decode_inline`;
  - with `need_target = true`, `millimetres == 0`.
- `packages/io/src/nmesh/capture-decoder.test.ts`:
  - the same table, read from the same fixture files: `booleanTarget`
    and `bounds` equal the Rust values (hard-code the expected bounds from
    the Rust test output);
  - `onAllocate` records nothing for `maxVertices: 0` without
    `needTarget`, and no `millimetres` with it;
  - the within-limit `positions` are byte-equal to today's.
- `packages/cad-kernel/src/worker-host.test.ts`: add one parity case that
  evaluates each fixture alone with the real worker. The status is ok for
  the four eligible fixtures and `cad.mesh.open` for the other five.

## Verification

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-a1 cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-a1 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-a1 cargo test -p nodetto-capture nmesh`
   must exit 0 with the new tests passing.
2. `biome check packages/nmesh/src/decode.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts packages/cad-kernel/src/worker-host.test.ts && bun test packages/io/src/nmesh/capture-decoder.test.ts packages/nmesh/src/codec.test.ts packages/cad-kernel/src/worker-host.test.ts`
   must exit 0. The EPERM roundtrip-log case is pre-existing; if it fails,
   rerun that file in isolation and record it.
3. `bun run typecheck && bun test packages/io/src/nmesh/capture-decoder.test.ts` must exit 0.

## Done when

- All nine fixtures exist.
- Both decoders agree with the table, and the worker agrees too.
- The allocation counters show zero geometry on the over-limit path.
- `decode_inline` and one-argument `decodeNmesh` are unchanged; the
  existing nmesh and codec tests pass.
- Compile-time evidence: verification step 3 (`bun run typecheck`) exits
  0 with `apps/cli/src/capture-cad.ts:123`,
  `apps/desktop/src/shell/export-handlers.ts:273` and their tests
  unedited. This proves that the one-argument overload still satisfies
  the current `CaptureMeshDecoder`.
- The progress log has hashes, commands, exit codes and the reason each
  new test failed before.
