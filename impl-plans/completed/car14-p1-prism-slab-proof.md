# car14-p1-prism-slab-proof

- planId: car14-p1-prism-slab-proof; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car14-p1-prism-slab-proof.md
- Finding: `function-capture-mesh-prism-touching-face` (high).
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-1, 31.2.
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p1-prism-slab-proof/`.

## Intent and context

The upper body has a main prism and a boss. The boss lies 0.5 mm clear
of the STL box but widens the body box, so the R13-1 box filter
(`raster.rs:309-316`) keeps the pair. The pair comes from
`PrismView::slab::<false>`, in its cap-parallel branch
(`crates/capture/src/prism.rs:225-240`). There, a ray at
Z = -7.105e-15 lies strictly below the main prism's base (span
[0, 156.75]). It still falls inside `cap_error`, which scales with
`max(|lo|, |hi|)`, about 2.8e-13. The tie rule at the lower cap then
admits the ray.

Fix: reject a cap-parallel volume ray that is proven strictly outside the
stored slab.

Non-goals:
- Do not touch `raster.rs`, `lattice.rs`, `interference.rs`, `mesh.rs`,
  `cap_error`, the tie rule, the oblique branch or the side rules.
- Do not touch the `FACETS = true` path or the flag `cap_band` in `cast`
  (`prism.rs:297-300`).
- Do not edit the helpers `production_touching` (`raster/tests.rs:336`)
  or `witness_tests::touching` (`raster/reference.rs`, near `:675`).
- Do not regenerate goldens.

## Changes

1. `crates/capture/src/prism.rs`, in `PrismView::slab::<FACETS>`, the
   branch `self.dz.abs() <= 1e-12`, under `!FACETS` only:
   - Compute `proof = 8.0 * f64::EPSILON * dot(self.basis[2].map(f64::abs), offset.map(f64::abs))`.
     This is the first term of `cap_error`; reuse that expression and do
     not add the `lo`/`hi` term.
   - With `(lo, hi)` as today, return `None` when `z < lo - proof` or
     `z > hi + proof`.
   - Otherwise run today's code unchanged: the tie rule inside
     `cap_error`, else `(lo..hi).contains(&z)`.
   - Add one comment explaining that the stored slab is exact and `proof`
     bounds only the rounding of `z`.
2. `prism.rs` tests module: add the unit test
   `cap_parallel_rays_outside_the_slab_are_rejected` (cases below).
   Imitate `ownership_sensitive_surface_casts`.
3. `crates/capture/src/raster/reference.rs`, in `mod fixtures`:
   - Add `pub(in crate::raster) fn tall_mesh_with_boss(back: bool, overlap: f64, boss: bool) -> Scene`.
   - Tools:
     - tool 0: the mesh of `tall_mesh_under_prism`;
     - tool 1: `box_tool([-1.0, 0.0, -overlap], 2.0, 10.0, 156.75 + overlap, false)`;
     - tool 2, only when `boss`: `box_tool([-0.5, 8.5, -1.0], 1.0, 1.0, 2.0, false)`.
   - Bodies: body 0 is `[Union 0]`; body 1 is `[Union 1]`, plus
     `Union 2` when `boss`.
   - Both bodies have `analysed: true` and `reference: false`.
   - Width 64, height 64, supersample 2.
   - Camera: probe it once with `tmp/car14-r14/car14-p1-prism-slab-proof/camera-probe.ts`
     (plain `.ts`, never `*.test.ts`). The probe runs `prepareCadCapture`
     on the finding's boss document in the `front` and `back` views.
     Copy the literals into the fixture, with a comment naming the
     probe log. The literals are expected to equal the
     `tall_mesh_under_prism` camera (centre `[0, 0, 60.75]`,
     3.24 mm/px); the probe decides.
4. `reference.rs` `witness_tests`:
   - Add the sibling `touching_with_candidates(scene, plain, candidates: usize)`.
     It has the body of `touching`, except that it asserts
     `candidates == candidates`.
   - New tests:
     - the boss fixture in both views gives one candidate;
     - `touching` (zero candidates) on `tall_mesh_with_boss(back, 0.0, false)`.
5. `crates/capture/src/raster/tests.rs`:
   - Add `fn production_touching_with_candidates(scene: Scene, candidates: usize)`
     as a copy of `production_touching` with that one change.
   - Add three tests:
     - `production_touching_tall_mesh_boss`:
       `production_touching_with_candidates(tall_mesh_with_boss(back, 0.0, true), 1)`
       for `back` in `[false, true]`.
     - `production_touching_tall_mesh_boss_suppressed`:
       `production_touching(tall_mesh_with_boss(back, 0.0, false))`.
     - `production_tall_mesh_boss_penetration`:
       `compare_every_thread_count(&tall_mesh_with_boss(back, 0.01, true))`
       gives `pairs.len() == 1` with the pair `(0, 1)`. Imitate
       `production_tall_mesh_penetration` (near `:363`).

Pitfalls:
- Why one candidate: candidates count body-box overlaps before any
  sampling (`interference.rs:131-136`). The boss makes the boxes overlap
  by [2, 8, 1] mm, so one candidate is correct before and after the fix.
  Do not assert zero candidates for the boss.
- Do not change the flag. The existing test expects `flag == true` at
  `z = -1e-16`.
- Fail-before: run the new tests before step 1. Save the log as
  `fail-before.log`. It must fail on the zero-pairs or RGB assertion in
  at least one view.
  - If it fails on the candidate count instead, or passes, the camera or
    fixture is wrong. Fix the camera or fixture, never the assertion.
  - `cap_parallel_rays_outside_the_slab_are_rejected` must also fail at
    `z = -7.105427357601002e-15`.

## Tests

- Unit test cases. Prism: origin `[-1, 0, 0]`, basis X, Y, Z,
  `t0 = 0`, `t1 = 156.75`, the rectangle 2 x 10. Forward `[0, 1, 0]`,
  ray origin `[0, -1, z]`:
  - `z = -7.105427357601002e-15` -> `intervals` is empty, and
    `surface_intervals` returns `true` with no boundaries.
  - `z = 0.0` -> two boundaries.
  - `z = 156.75` -> empty.
  - `z = 7.105427357601002e-15` and `z = 78.0` -> two boundaries.
- Boss contact, both views -> zero pairs, one candidate, equal RGB at
  threads 0..=8 and against the reference, and RGB equal to the
  `draw_interference = false` render.
- Suppressed boss -> zero pairs and zero candidates.
- Penetration of 0.01 mm -> exactly the pair `(0, 1)`.
- All existing tests pass unedited:
  - `ownership_sensitive_surface_casts`;
  - `production_touching_*`;
  - `production_overlap_witness`;
  - `stacked_caps_witness_charge_is_the_delta`;
  - sub-cell witness, golden and determinism tests.
  If a census or charge count moves, record both values and the ray in
  the progress log, and stop as `blocked`.

## Verification (each exits 0)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo test -p nodetto-capture --lib -- prism:: raster:: lattice:: interference::`
   - The log lists the new tests as passed.
4. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p1 cargo test -p nodetto-capture --test render --test overlay --test interference --test census`

## Done criteria

Implementation status: done; formal review and native parity are downstream.

- Commands 1-4 exit 0.
- `fail-before.log` and the camera probe log are saved.
- The diff touches only `prism.rs`, `raster/reference.rs`,
  `raster/tests.rs`, and this plan's progress and evidence files.
- The progress log reads `done`.
