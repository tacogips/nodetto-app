# M11 capture-11-mesh-reference (revision 4: mesh units and model decoder)

- Stage: wave 2. dependsOn: M10 (`tool_view` with the `Unsupported` arm,
  empty `mesh.rs`), M20 (`CaptureMeshDecoder`, `decodeMesh` on the request,
  `decodeCaptureMesh`), M17 and M18 (earlier writers of `interference.rs`
  and `lattice.rs`; both accepted).
- Design: sections 6.1 (meshes), 6.4 (mesh intervals), 6.5, 6.7, 8.5, 18 CAP-R4-05.
- writePaths: `crates/capture/src/mesh.rs`, `crates/capture/src/tool_view.rs`,
  `crates/capture/src/lattice.rs` and `crates/capture/src/interference.rs`
  (tool-bounds call sites only, see Amendment),
  `packages/core/src/capture/scene.ts`, `packages/core/src/capture/scene.test.ts`,
  `packages/core/src/capture/cad-request.ts`,
  `packages/core/src/capture/cad-request.test.ts`,
  `impl-plans/active/capture-11-mesh-reference.md`, `tmp/capture/m11`,
  `tmp/capture-s868/capture-11-mesh-reference`, `target`
- Pre-authorised: the M5 test in `scene.test.ts` that expects a mesh
  feature in `skipped` changes to expect it there only when no decoder is
  given. Nothing else in existing tests changes.

## Intent

Closed meshes become solids in the analysis and census through
`tool_view`; open meshes are surfaces; the TypeScript model turns
`cad.mesh` features into mesh tools when a decoder is passed.

## Non-goals

No picture-pass, shading or reference-mix change (M23). In `lattice.rs`
and `interference.rs`, only the tool-bounds call sites change, routed to
`tool_view::tool_bounds`; no other change to pair, view-pair or census
logic. No help text (M18 wrote it), no CLI or desktop edits.

## Amendment 2026-11-23 (integration-paths-outside-writePaths, round 1)

Finding INT-MESH-BOUNDS-SEAM (mid). Analysis takes tool bounds from
`lattice::tool_bounds(&lattice::tool_loops(scene))`, the union of loop
boxes. Loop boxes are empty for a mesh, so a mesh gets the inverted
`empty_bounds()` and never becomes a candidate. Design 8.5 assumed these
callers already used `tool_view`; deviation recorded as CAP-R4-05.

Ordered changes (read each file fresh, log `git hash-object` before and
after, and save an intent snapshot in `tmp/capture-s868/capture-11-mesh-reference/`):

1. `lattice.rs`: add `pub(crate) fn scene_tool_bounds(scene: &Scene) -> Vec<Bounds>`,
   which maps `scene.tools` through `crate::tool_view::tool_bounds(tool)`
   and uses `.unwrap_or_else(empty_bounds)`. Imitate `lattice::tool_loops`
   (`lattice.rs:35`). Keep `tool_loops`, because small-loop boxes still need it.
2. Replace `lattice::tool_bounds(&loops)` with `lattice::scene_tool_bounds(scene)`
   at `interference.rs` `candidates` (:32), `analyse_pair` (:137) and
   `analyse_scene` (:206), at the two unit tests (:311, :332), and at
   `lattice::sample_axis` (:520). If the old loop-derived `tool_bounds`
   is then unused, delete it. Keep it private if anything still uses it.
3. Confirm that `collect_candidates` (`interference.rs:53`) still requires
   `tool_view::is_solid` for the body's first tool, so an open mesh is
   never a candidate. Do not change that rule.
4. Add the regressions to `#[cfg(test)]` in `mesh.rs` (see Tests): a cube
   mesh body overlapping a box prism gives a pair whose volume is within
   2% of exact, and an open mesh body is never a candidate.
5. Run rustfmt on the owned files only.

Invariants: prism results stay identical. For a valid prism, the
`tool_view` bounds equal the union of its loop boxes. An invalid prism
was already `empty_bounds()`. The lines of `sample_body_axis` (M18) and
the pair prefix stay byte-identical except at the bounds call site.

Forbidden: any change to refinement priority, budgets, ray accounting,
JSON reply keys or picture-pass code. No edits to `census.rs`,
`overlay.rs`, `tiles.rs`, `raster.rs`, `report.rs`, `lib.rs` or
`crates/capture/tests/*`. Never weaken or delete an existing
interference, render or census test, or the M8 pixel digest.

## Contract

```rust
// mesh.rs
pub struct MeshView { /* projected triangles binned in a grid for one ray family */ }
impl MeshView {
  pub fn new(mesh: &Mesh, tool: u32, family: &RayFamily, window: Option<([f64; 2], [f64; 2])>) -> MeshView;
  pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals);
  pub fn first_hit(&self, ray: &Ray) -> Option<Boundary>;
  pub fn average_occupancy(&self) -> f64;
  pub fn listings(&self) -> usize;
}
pub fn is_closed(mesh: &Mesh) -> bool;
pub fn mesh_bounds(mesh: &Mesh) -> ([f64; 3], [f64; 3]);
// tool_view.rs: `ToolView::Mesh(MeshView)` replaces `Unsupported` for meshes;
// `is_solid` = `is_closed`; `tool_bounds` covers meshes; `tool_loops` stays empty for meshes.
```

```ts
// scene.ts
export function buildCadCaptureModel(elements: readonly Element[], pageId: PageId,
  options?: { readonly decodeMesh?: CaptureMeshDecoder }): CadCaptureModel;
// cad-request.ts: prepareCadCapture passes { decodeMesh: request.decodeMesh } through. Nothing else.
```

## Behaviour

- `is_closed`: every undirected edge used by exactly two triangles, no
  degenerate triangle; found by sorting the edge list (no hash map).
- `MeshView::new`: project vertices onto the two axes perpendicular to the
  family direction; uniform grid over projected bounds (or `window`) with
  about two triangles per cell, at most 1,048,576 cells; listings at most
  `4 * triangles + cells`.
- `intervals` (closed): triangles of the ray's cell with the half-open
  edge rule of design 6.4 (zero counts for an edge whose direction is up,
  or horizontal and leftward); sort crossings; pair; an odd count drops the
  last. Face id 0; normal the triangle's.
- Open meshes: `intervals` empty; `first_hit` the nearest triangle.
- `scene.ts`: with a decoder, a `cad.mesh` feature becomes a
  `CaptureMeshTool` (type exists in `scene-binary.ts`) and a body whose
  first step is the union with it; later features may target it; a
  throwing decoder sets status `cad.mesh.invalid` for the feature and no
  body. Without a decoder, behaviour is today's (`scene.ts:240-244`).

## Pitfalls

- Only `+ - * /` and `sqrt`; no hash iteration order in any output.
- Do not compare floats for edge identity; use vertex indices.
- `scene.ts` runs in Boa: bulk typed-array copies, no per-vertex objects.

## Tests (`#[cfg(test)]` in `mesh.rs`; meshes built in code: 12-triangle
cube, tetrahedron, cube missing one triangle, 64 x 32 sphere made with
square roots only)

- Cube closed; centre ray -> one interval of the edge length; rays through
  a shared edge and a corner -> one interval or none; 10,000 lattice rays
  hitting vertices and edges -> never an odd count.
- Sphere chords within tessellation error.
- Open cube: `is_closed` false; `first_hit` nearest triangle.
- Through `tool_view`: a scene with the cube mesh body and an overlapping
  box prism -> `interference::analyse_pair` volume within 2% of exact; an
  open mesh body is not a candidate.
- Grid listings <= `4 * triangles + cells`; occupancy exposed.
- `scene.test.ts`: decoder -> mesh tool and body; cut targeting the mesh
  appends a step; throwing decoder -> `cad.mesh.invalid`; no decoder ->
  `skipped`.
- `cad-request.test.ts`: a mesh-only page with a fake `decodeMesh` that
  returns a cube's typed arrays produces scene bytes with one mesh tool;
  without it -> `CaptureInputError` (no body). Core tests use fake
  decoders only; they never import `@nodetto/io`.

## Acceptance criteria

- Meshes take part in analysis and census through `tool_view`; open meshes
  never as solids; the model builds mesh bodies when given a decoder.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/mesh.rs crates/capture/src/tool_view.rs crates/capture/src/lattice.rs crates/capture/src/interference.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m11 cargo clippy -p nodetto-capture --all-targets -- -D warnings'`
2. `sh -c 'mkdir -p tmp/capture/m11 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m11 cargo test -p nodetto-capture --lib -- mesh:: tool_view:: lattice:: interference:: > tmp/capture/m11/unit.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m11/unit.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m11/unit.txt && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m11 cargo test -p nodetto-capture --test interference --test render'`
3. `sh -c 'bun run typecheck && bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts && bun test packages/core/src/capture'`
4. `sh -c 'mkdir -p tmp/capture/m11; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m11/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m11/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/scene.test.ts'`
5. `sh -c 'mkdir -p tmp/capture/m11 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m11 cargo test --release -p nodetto-capture -- --include-ignored > tmp/capture/m11/release.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m11/release.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m11/release.txt && ! grep -Eq "[1-9][0-9]* failed" tmp/capture/m11/release.txt'`.
   This gate shows that all suites pass with the release-only interference
   timings included (17 + 5) and that prism results are unchanged. Timing
   tests may be retried up to three times, then run in isolation, with
   every attempt logged.

## Progress

Partial implementation: mesh views, solid classification and decoder-backed
model construction are present. The four listed gates passed on the shared
tree; logs are in `tmp/capture-s868/capture-11-mesh-reference/`.
Blocked: `lattice.rs` derives active tool bounds from loop bounds, while mesh
loop bounds must remain empty. Mesh analysis and its cube-box and open-candidate
regressions require an authorized repair to `lattice.rs` before completion.
