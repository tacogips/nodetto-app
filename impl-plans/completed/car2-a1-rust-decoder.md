# car2-a1-rust-decoder: budgeted Rust mesh decoder and quantized closure (R2-D Rust half)

- planId: car2-a1-rust-decoder
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-D (the
  Options, Result, Bounds, Over the limit, Eligibility, Closure input and
  Rust bullets) and section 19.1 F1 (eligibility rules (a) to (d) and the
  fixture table).
- Progress log: `impl-plans/progress/car2-a1-rust-decoder.md`

## Intent

Add a budgeted decoder next to the existing one in
`crates/capture/src/nmesh.rs`. It returns:

- the vertex and triangle counts;
- millimetre bounds;
- Boolean-target eligibility, only when the caller asks for it;
- the geometry, only when the vertex count fits `max_vertices`.

Over the limit it allocates no position or triangle geometry. Rule (a)
reuses the renderer's closure test through a position-accessor helper, so
quantized positions are read on demand.

## Non-goals

- Do not change `decode_inline`, `InlineMesh` or `InlineMesh::to_packet`.
  `apps/cli/native/src/engine.rs` must keep compiling and behaving
  unchanged; it is not edited here.
- Do not edit `engine.rs`, `native-engine.ts` or any TypeScript file.
- Do not edit `MeshView`, `tool_view.rs` or the renderer. The renderer
  closure behaviour and every existing `is_closed` result stay as they are.
  Plan c2 edits `mesh.rs` after this plan.
- Do not touch the fixtures in `crates/capture/tests/fixtures/`. They
  already exist and are the source of truth.

## Changes

1. `crates/capture/src/mesh.rs`
   - Move the body of `is_closed` (`mesh.rs:6-57`) unchanged into a new
     public helper:

         pub fn closed_by(vertex_count: usize, triangles: &[u32], position: impl Fn(usize) -> [f64; 3]) -> bool

   - The checks, in their current order:
     - triangles non-empty and a multiple of 3;
     - each index below `vertex_count`;
     - no repeated index within a triangle;
     - finite coordinates;
     - non-zero cross-product area;
     - sorted undirected edges, each occurring exactly twice.
   - `is_closed(mesh)` keeps its signature. It keeps the
     `positions.len() % 3` check and then calls `closed_by(positions.len()
     / 3, &mesh.triangles, |i| [p[3i], p[3i + 1], p[3i + 2]])`.
   - Add no counter here; plan c2 adds `CLOSURE_EVALUATIONS`.
2. `crates/capture/src/nmesh.rs`
   - Add the option and result types:

         pub struct DecodeOptions { pub max_vertices: u64, pub need_target: bool }

     (default: `u64::MAX` and `false`)

         pub struct DecodedMesh { pub vertex_count: u32, pub triangle_count: u32,
             pub bounds: Option<([f64; 3], [f64; 3])>, pub boolean_target: Option<bool>,
             pub geometry: Option<InlineMesh> }

   - Add `pub fn decode_inline_with(text: &str, options: DecodeOptions) ->
     Option<DecodedMesh>`. It shares `unarmor` and the header and group
     checks of `decode`.
     - Full path (`vertex_count <= max_vertices`): identical to today's
       `decode`, plus bounds.
     - Over-limit path: one streaming pass with the same checks in the
       same order. Keep the previous vertex and the running min and max in
       `i64`, keep the `used` counter, and allocate no `Vec` for positions
       or triangles.
     - A header that cannot be read takes the full path, so its `None`
       result is unchanged.
   - Bounds: compute min and max over the quantized `i64` values, then
     divide by `UNITS_PER_MILLIMETRE`. They are `None` exactly when
     `vertex_count == 0`.
   - Eligibility (only when `need_target`): rules (a), (b), (c) and (d)
     from section 19.1 F1, in that order.
     - Rule (a) is `mesh::closed_by` with `position = |i| [q[3i] as f64 /
       1000.0, ...]`.
     - Rule (d) uses the local origin at vertex 0. Accumulate `V` and `A`
       in triangle order with the operation order given in 19.1. Reject
       when `V == 0.0 || 2.0 * V.abs() < A * 5e-7`.
     - On the over-limit path, build the quantized scratch `Vec<i64>`, the
       index `Vec<u32>` and the edge list inside the eligibility function.
       They are dropped before return and never placed in `DecodedMesh`.
   - Add `#[cfg(test)] fn decode_with_stats(text, options) -> (Option<DecodedMesh>,
     AllocStats)`. `AllocStats` holds counters `positions`, `triangles` and
     `target`, incremented at each `Vec::with_capacity` site by kind. A
     discarded vector still counts.
   - Add `impl DecodedMesh { pub fn to_packet(&self) -> Vec<u8> }` with the
     exact layout of R2-D:
     - a 64-byte header: `u32 vertexCount`, `u32 triangleCount`, `u32
       flags`, `u32 0`, then six `f64` bounds;
     - the flags: bit 0 geometry present, bit 1 eligibility present, bit 2
       eligibility value, bit 3 bounds present;
     - then the `f64` positions at offset 64 and the `u32` indices at `64 +
       24 * V`, all little-endian.

     Nothing calls it yet; plan a2-native-host does.

## Pitfalls

- Do not call `is_closed(&Mesh { .. })` from the decoder. That builds
  `Vec<f64>` geometry, which is forbidden on the over-limit path.
- Bounds must be min and max of the quantized integers divided by 1000,
  not min and max of the divided values. They are bit-identical, but the
  integer form is the one allowed in the streaming pass.
- Keep the error order identical. `rejects_what_the_reference_decoder_rejects`
  (`nmesh.rs:193`) must give `None` for every corrupt case on both paths.
- When `need_target` is false, `boolean_target` must be `None`. Do not
  compute it.

## Tests (in `nmesh.rs` and `mesh.rs` unit tests)

- Each of the nine fixtures in `crates/capture/tests/fixtures/*.nmesh.txt`
  with `need_target: true` gives `boolean_target` equal to the 19.1 table.
  Fails before: the function does not exist.
- Each fixture: `bounds` equals the min and max of `decode_inline(..)`
  positions, bit for bit.
- An asymmetric mesh with negative coordinates, encoded in the test with
  the existing fixture helper, gives exactly all six extrema.
- Every corruption case of `rejects_what_the_reference_decoder_rejects`,
  run with `max_vertices: 0` and with the default, gives `None` in both
  runs. The limited run records zero `positions` and `triangles`
  allocations.
- `tetrahedron.nmesh.txt` with `max_vertices: 3, need_target: true` gives
  `boolean_target == Some(true)`, counts and bounds equal to the full
  decode, `geometry == None`, zero `positions` and `triangles`
  allocations, and `target > 0`.
- `triangle.nmesh.txt` with `max_vertices: 2, need_target: true` gives the
  same as above but with `Some(false)`.
- `closed_by` over the quantized accessor equals `is_closed` over the
  decoded mesh for all nine fixtures. All existing `mesh.rs` `is_closed`
  tests are unchanged and pass.
- `to_packet` of the asymmetric mesh: the header fields and flags are as
  specified, the first position is at byte 64 and the first index is at
  byte `64 + 24V`.

## Verification

- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo test -p nodetto-capture`
  must exit 0 and include the new `nmesh` and `mesh` tests.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a1-rust-decoder cargo clippy -p nodetto-capture --all-targets`
  must show no new warnings in `nmesh.rs` or `mesh.rs`.
- `rustfmt --edition 2021 crates/capture/src/nmesh.rs crates/capture/src/mesh.rs`

## Done when

- All the tests above pass, and the commands exit 0.
- `decode_inline` and `InlineMesh::to_packet` are byte-for-byte
  unchanged: check with `git diff` on those symbols.
- The progress log reads `done`.
