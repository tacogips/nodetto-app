# car2-c2-closure-once: one closure classification per mesh tool per render (R2-7)

- planId: car2-c2-closure-once
- Wave: 2
- dependsOn:
  - car2-c1-sweep, which rewrites `collect_candidates`;
  - car2-a1-rust-decoder, which adds `mesh::closed_by`.
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-7 and
  section 19.1 F16.
- Progress log: `impl-plans/progress/car2-c2-closure-once.md`

## Intent

Today one render recomputes mesh closure for every picture view, axis view,
census slot and eligibility check. Classify each tool once at the start of
`render_with`, and pass that result to every consumer on the render path.

An actual-evaluation counter proves the count. Public and test-facing
interfaces stay source-compatible.

## Non-goals

- Do not change `LatticeRequest`'s fields or any existing public or
  `pub(crate)` function signature listed below.
- Do not edit `raster/reference.rs` or
  `crates/capture/tests/{boundary_fold,interference,census,mesh}.rs`.
- Do not change closure semantics, the first-tool body rule, report
  contents or image bytes.
- Renderer closure is not editor eligibility (`booleanTarget`). Do not
  mix them.

## Changes

1. `mesh.rs`
   - Add `#[doc(hidden)] pub static CLOSURE_EVALUATIONS: AtomicU64`. It is
     incremented with `Relaxed` on entry to `closed_by`.
   - Add `MeshView::with_closure(mesh, index, family, window, closed:
     bool)`, which never calls `is_closed`.
   - `MeshView::new(mesh, index, family, window)` keeps its signature and
     calls `with_closure(.., is_closed(mesh))`. The unit tests at
     `:424-556` stay unchanged.
2. `tool_view.rs`
   - Add `pub(crate) fn classify(scene: &Scene) -> Vec<bool>`. It is
     `is_solid` per tool.
   - Add `ToolView::classified(tool, index, family, closed)` and
     `ToolView::picture_classified(tool, index, family, window, closed)`.
     Their mesh arm uses `MeshView::with_closure`.
   - `ToolView::new` and `ToolView::picture` keep their signatures, compute
     `is_solid(tool)` and delegate.
   - `ViewCache::new` becomes `ViewCache::new(solid: Vec<bool>)`. It is
     crate-private, so every caller is internal. Its `get` uses
     `ToolView::classified(tool, index, family, self.solid[index])`.
3. `lattice.rs`
   - `sample_axis(request, axis)` keeps its signature and builds
     `ViewCache::new(classify(request.scene))`.
   - Add `pub(crate) fn sample_body_axis_with(request, axis, liveness,
     budget_left, solid: &[bool])`.
     - The slot bounds at `:654` use `solid[id]` instead of `is_solid`.
     - The lazy slot view at `:705` uses `ToolView::classified(tool,
       index, &family, solid[index])`.
   - `sample_body_axis(..)` keeps its signature and calls `_with` with
     `&classify(request.scene)`.
   - `sample_pair` already takes a `cache`, so it is unchanged apart from
     the cache carrying the classification.
4. `census.rs`
   - Add `pub(crate) fn resolve_with(scene, bodies, picture, cell,
     budget_rays, solid: &[bool]) -> CensusStats`. It calls
     `sample_body_axis_with`.
   - `resolve(..)` keeps its signature and delegates with
     `&classify(scene)`.
5. `interference.rs`
   - `collect_candidates` gains a `solid: &[bool]` parameter and uses
     `solid[first_tool]` instead of `is_solid` (`:48-52`).
   - `candidates()` and `analyse_pair()` keep their signatures and
     classify for themselves.
   - Add `pub(crate) fn analyse_scene_with(scene, threads, solid)` and
     `pub fn add_view_pairs_with(scene, pairs, seen, cell, solid)`. Their
     `ViewCache::new(solid.to_vec())` replaces `:236`, `:318`, `:361` and
     `:397`.
   - `analyse_scene` and `add_view_pairs` keep their signatures and
     delegate after `classify`.
6. `raster.rs`
   - In `render_with` (`:642`), compute `let solid =
     tool_view::classify(scene);` once.
   - `Raster::prepare(scene, &solid)` uses `ToolView::picture_classified`
     (`:468`) and `solid` for `open_bodies` (`:473`).
   - Call `census::resolve_with`, `interference::analyse_scene_with` and
     `add_view_pairs_with` with `&solid`.
7. New `crates/capture/tests/closure_count.rs`. A single `#[test]` runs
   the scenarios one after another and reads `CLOSURE_EVALUATIONS` before
   and after each `render_scene` call.

## Pitfalls

- The counter is process-wide. Keep `closure_count.rs` a separate test
  binary with exactly one `#[test]`, and never assert on the counter in
  another binary.
- `classify` is the only render-path caller of `is_closed`. After the
  change, `grep -n "is_solid\|is_closed\|ToolView::new\|ToolView::picture("
  crates/capture/src/{raster,lattice,interference,census}.rs` may show
  only wrapper bodies. `render_with` must reach none of them.
- Thread fan-out passes `&solid` or `&ViewCache`. Do not reclassify per
  thread.

## Tests (`closure_count.rs`)

Build the scenes with the existing helpers used by
`crates/capture/tests/mesh.rs` and `census.rs`. Each scene has one open
and one closed mesh tool.

- Analysis disabled: one `render_scene` adds exactly 2 (the number of
  mesh tools) at 1 thread and at 8 threads. Fails before: at least 4.
- An overlapping three-axis analysed pair, with interference enabled:
  adds exactly 2.
- A census case, with a suspect body: adds exactly 2.
- Each scenario at 1 and 8 threads gives equal image bytes and equal
  reports.
- Existing digests: the crate tests that pin digests pass unedited.

## Verification

- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c2-closure-once cargo test -p nodetto-capture`
  must exit 0. This is the full crate: `closure_count.rs`,
  `boundary_fold.rs`, `interference.rs`, `census.rs`, `mesh.rs`, and the
  reference renderer unit tests.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c2-closure-once cargo clippy -p nodetto-capture --all-targets`
  must show no new warnings in touched files.
- `rustfmt --edition 2021` on the touched `.rs` files.

## Done when

- The counter test passes.
- `git diff` shows no change to `LatticeRequest`, `raster/reference.rs` or
  the existing test files.
- The progress log reads `done`.
