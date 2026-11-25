# car5-f4-open-mesh-hit

- planId: car5-f4-open-mesh-hit; wave 1; dependsOn: none
- planPath: impl-plans/active/car5-f4-open-mesh-hit.md
- progressPath: impl-plans/progress/car5-f4-open-mesh-hit.md
- Finding: performance-open-mesh-nearest-hit-allocation (R5-4, medium).
- Design: `design-docs/specs/design-ai-capture.md` 23.1 R5-4, 23.3, 23.5.
- writePaths: `crates/capture/src/mesh.rs`, `crates/capture/tests/overlay_alloc.rs`,
  `tmp/car5-r5/car5-f4-open-mesh-hit`, `impl-plans/progress/car5-f4-open-mesh-hit.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car5-00-overview.md`.

## Intent and context

`MeshView::first_surface_hit` (`mesh.rs:336-340`) allocates a `Vec`, collects every
facet hit via `hits_impl::<true>` and sorts it (`mesh.rs:317`), once per covered
open-mesh sample (`raster.rs:191`, `raster/reference.rs:61`). Pick the nearest facet in
one pass with constant scratch space and identical selection.

Non-goals: no change to `hits_impl` behaviour, closed-mesh paths, `intervals`,
`surface_intervals`, `first_hit`, `ToolView`, raster files, or `tool_view.rs` (owned by
f3).

## Changes (`mesh.rs`)

- Move the per-facet test inside `hits_impl` (`mesh.rs:278-315`: projected edge test
  with the `area` orientation, normal, `d`, depth `s`, finiteness) into one private
  helper, e.g. `fn facet_depth(&self, i: u32, q: [f64; 2], ray: &Ray) -> Option<f64>`.
  `hits_impl` calls it and pushes as today; arithmetic identical.
- `first_surface_hit` walks `self.bin(ray)` in order, calls the helper, keeps the first
  candidate and replaces it only when `s.total_cmp(&best_s)` is `Ordering::Less`;
  returns `Boundary { s, tool: self.tool, face: i }`. No allocation.

## Pitfalls

- `sort_by` is stable and uses `total_cmp`, so today's result is the earliest facet in
  bin order among the minimum by `total_cmp` (`-0.0` before `+0.0`). Use strict `Less`;
  `<=` or `f64::min` breaks the tie rule.
- Keep `continue` semantics for degenerate area, zero/non-finite `d`, non-finite `s`.
- Keep `hits_impl` (closed paths and the test oracle use it).

## Tests

Step 1 (before any production edit): add the rendered ordering cases and record their
digests on the unmodified tree (log the run).

`mesh.rs` unit tests (imitate the existing `first_surface_hit` test near `mesh.rs:594`):
oracle `{ let mut v = Vec::new(); view.hits_impl::<true>(&ray, &mut v); v.first().copied() }`
equals `first_surface_hit` (s bits, tool, face) for: overlapping triangles at different
depths; two equal-depth triangles in both stored orders; `-0.0` and `+0.0` depths; a
grid of rays over an open square.

`tests/overlay_alloc.rs`:
- Allocation: open 200 x 200 mm square (two triangles, `Tool::Mesh`, not closed),
  1024 x 1024, `supersample = 2`, view inside the square, one thread ->
  `allocations < samples / 16` (imitate `single_solid_does_not_allocate_per_sample`).
  Fails before (one Vec per sample). RGB at 1 and 4 threads equal.
- Overlap render: open mesh of two triangles with different normals at different
  depths, overlapping on a large area, each with an area the other does not cover.
- Equal-depth render: horizontal triangle and tilted triangle whose planes cross along
  `x = x0`; dyadic coordinates, camera and `x0` on sample centres so depths there are
  exactly equal; stored as AB and BA. Assert AB image != BA image.
- For each render fixture and order: `support::digest` literal recorded in step 1; after
  the change 1 and 4 threads equal it.
- If no dyadic fixture makes AB != BA, report `blocked`; do not drop the case.

## Verification (each exits 0 and runs tests)

1. `rustfmt --edition 2021 crates/capture/src/mesh.rs crates/capture/tests/overlay_alloc.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f4-open-mesh-hit cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f4-open-mesh-hit cargo test --release -p nodetto-capture`
   - evidence: allocation test fails before (log); digests recorded before; after, all
     pass with the full crate suite (goldens, determinism).

A compile failure from f3's in-progress `lattice.rs`/`tool_view.rs` edit is rerun after
f3 is `done`.

## Done criteria

- Oracle equality, allocation bound, pinned digests at 1 and 4 threads, AB != BA;
  progress log `done`.

## Implementation status

One-pass selection, allocation and render regressions are implemented. The oracle confirms both signed-zero depth values. The exact parallel full-suite
gate remains outstanding after a load-sensitive deadline failure; see the progress log.
