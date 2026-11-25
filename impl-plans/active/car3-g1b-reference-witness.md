# car3-g1b-reference-witness

- planId: car3-g1b-reference-witness; planPath: impl-plans/active/car3-g1b-reference-witness.md
- progressPath: impl-plans/progress/car3-g1b-reference-witness.md
- wave: 1; dependsOn: none
- Finding: function-capture-touching-cap-interference (R3-1, high), contract C2.
- Design: `design-ai-capture.md` 21.1 R3-1 ("Reference rasterizer", tests), 21.5 C2.
- writePaths: `crates/capture/src/raster/reference.rs`,
  `tmp/car3-r3b/car3-g1b-reference-witness`,
  `impl-plans/progress/car3-g1b-reference-witness.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

The reference rasterizer is the oracle for production. Today it copies the shading
intervals into `body_intervals` (`reference.rs:84-86`). Shading intervals are closed at
both caps, so bodies that only touch report a picture pair. After this plan, the
reference always builds the witness from volume intervals (`ToolView::intervals`).
`tmp/audit/r3/g1-partial.patch` shows an earlier attempt; use it as a reference only.

## Changes (`reference.rs` only)

- `ReferenceRaster::reference_sample`, for a body with `body.analysed` while
  `self.scene.draw_interference` is on:
  - Fold a local witness over the same steps and ops as the shading loop. For each solid
    step in the rect, cast `prism.view.intervals(&ray, &mut scratch.crossings, &mut volume)`
    and combine into the witness with `combine`.
  - On the `Op::Intersection` branch without a tool, clear the witness.
  - After the steps, set `scratch.body_intervals[index]` to the witness, even when the
    shading accumulator is empty.
  - Remove the shading clone for this case.
  - Keep all scratch as locals in `reference_sample`. Do not add `RayScratch` fields,
    because `raster.rs` belongs to car3-g1c.
- Shading, liveness, `translucent`, `nearest`, colours and the bands loop: unchanged.
- New `pub(in crate::raster) mod fixtures` at the end of `reference.rs` (C2). It has a
  private `blank()` that parses `include_bytes!("../../tests/fixtures/plate-iso.ncs1")`
  and clears tools and bodies (as `tests.rs:base`), then sets `width 64`,
  `height 512`, `supersample 1`, `analyse true`, `draw_interference true` and
  `tolerance 0.001`.
  - `pub(in crate::raster) fn stacked_caps(overlap: f64) -> Scene`:
    - Two analysed prism bodies with a 16 x 8 mm footprint at origin: the lower one
      from z 0 to 0.9375, the upper one from z `0.9375 - overlap` to 2.
    - Camera: `right [1,0,0]`, `up [0,0,1]`, `forward [0,1,0]`, 0.25 mm/px,
      `centre [8, -4, cz]`.
    - Sample row k = 300 (band 9, not the first) lies at `cz + (256 - 300.5) * 0.25`.
      Pick `cz` so that row is exactly z = 0.9375 when `overlap == 0`, otherwise
      `0.9375 - overlap / 2` (strictly inside the overlap). All values are dyadic, so
      this is exact.
  - `pub(in crate::raster) fn shared_side(opposed: bool, overlap: f64) -> Scene`:
    - Left box covers world x 0..8, y 0..8, z 0..2. When `opposed`, it is a `Prism`
      with `o [8,8,0]`, `u [-1,0,0]`, `v [0,-1,0]`, `n [0,0,1]` and an 8 x 8
      rectangle; otherwise it is a plain box.
    - Right box: `o [8 - overlap, 0, 0]`, width `8 + overlap`.
    - Camera: top (`right x`, `up y`, `forward [0,0,-1]`), 0.25 mm/px.
    - Column j = 40 lies at `cx + (40.5 - 32) * 0.25`. Pick `cx` so it is x = 8 when
      `overlap == 0`, otherwise `8 - overlap / 2`. Use `cy = 4`.
  - `Scene` is not `Clone`. Callers build a second copy and set
    `draw_interference = false` for the plain render.
- New `mod witness_tests` in `reference.rs`, reference-only through `render_reference`.

## Pitfalls

- Use the volume cast only for the witness. Shading must keep `surface_intervals`.
- Witness steps must match shading steps, including the rect filter and
  `solid_tools`. Otherwise genuine overlaps change.
- Do not edit `raster.rs`, `raster/tests.rs`, `prism.rs`, `interference.rs` or `overlay.rs`.
- No fixture function may be unused, because clippy runs with `-D warnings` and
  `dead_code` applies to `pub(in ...)` items.

## Tests (`witness_tests`; s = fixture, p = same fixture with `draw_interference = false`)

- `stacked_caps(0.0)` -> `report.pairs` is empty,
  `report.analysis.unwrap().candidates == 0`, and RGB equals the RGB of p.
- `shared_side(true, 0.0)` -> same assertions. This must fail before the edit
  (one pair). Record the pair and the failure.
- `shared_side(false, 0.0)` -> same assertions. This is a control that also passes
  before the edit.
- `stacked_caps(0.01)` and `shared_side(true, 0.01)` -> `pairs.len() == 1` and RGB
  differs from p (hatch drawn).
- Fail-before: write the tests first and run them on the unmodified `reference.rs`.
  `stacked_caps(0.0)` and `shared_side(true, 0.0)` must fail. If one passes, fix the
  fixture placement until it fails, then record the output.

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1b-reference-witness cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1b-reference-witness cargo test --release -p nodetto-capture`
   -> the five witness tests and all existing crate tests pass. Production-versus-
   reference tests such as `intersections_match_reference` must still pass. Those
   scenes have no touching contact.

## Done criteria

- `reference.rs` builds the witness from volume intervals, and the fixtures exist and
  are used.
- Fail-before output is recorded for the two failing cases. Five tests pass.
- Progress log `done`, with hashes, commands, exit codes and log paths.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- Blocker: the absolute stray-test scan found 753 inventoried round-1 copies under
  `tmp/car1-r1/`. This plan does not own them, and it still must not write
  `tmp/car1-r1/*`.
- Decision: the per-plan stray condition is the plan-delta scan, which is the last
  `verification` entry in the manifest and overview rule 9. It writes
  `tmp/car3-r3b/car3-g1b-reference-witness/stray-delta.txt`. It must exit 0, and that
  file must be empty.
- Resume (no new code): (1) Rerun the crate gate; the five witness tests must pass.
  (2) Run the delta scan. (3) In the progress log, record both commands with exit
  codes and log paths, keep the existing `fail-before-final.log` evidence, and
  record the post-gate sha256 of `reference.rs`. (4) Set the status to `done`.
- The absolute scan remains an integration gate owned by the checkpoint operator.
  Do not report it as this plan's blocker.
