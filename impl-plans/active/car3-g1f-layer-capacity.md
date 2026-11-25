# car3-g1f-layer-capacity

- planId: car3-g1f-layer-capacity; planPath: impl-plans/active/car3-g1f-layer-capacity.md
- progressPath: impl-plans/progress/car3-g1f-layer-capacity.md
- wave: 4; dependsOn: car3-g1e-production-layers (C4, same files)
- Finding: function-capture-translucent-layer-visibility (R3-2, high), retained storage.
- Design: `design-ai-capture.md` 21.1 R3-2 ("Storage bound", tests "Staggered dense
  rows", "Band-boundary stripe", "Final-row control"), 21.5 g1f row.
- writePaths: `crates/capture/src/raster.rs`, `crates/capture/src/raster/budget.rs`,
  `crates/capture/src/raster/tests.rs`, `tmp/car3-r3b/car3-g1f-layer-capacity`,
  `impl-plans/progress/car3-g1f-layer-capacity.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

g1e already caps the arena. This plan only measures the retained capacity and proves
the row lifecycle (band restart, rotation, unsampled bottom row) with stripes that
would fail a per-row or never-reset arena. There is no behaviour change.

## Changes

- `budget.rs`:
  - `ScanBudget` gains `layer_capacity: AtomicUsize`, with
    `fn record_layer_capacity(&self, capacity: usize)` (`fetch_max`) and
    `fn layer_capacity(&self) -> usize`.
- `raster.rs`:
  - At the end of `bands()`, record the worker arena's `capacity()`. Capacity never
    shrinks, so this is the maximum.
  - `RenderStats` gains `layer_capacity: usize`.
- `tests.rs`:
  - Builder `stripe_scene(rows: &[usize], sheets: usize, height: u32) -> Scene`: top
    view, width 64, `supersample 3`, 0.25 mm/px, `analyse false`.
  - Sample step `h = 0.25 / 3`. Sample row r has world
    `y_r = cy + (samples_high / 2 - (r + 0.5)) * h`.
  - For each r, add `sheets` open two-triangle strips at z = 3, 4, ..., spanning
    x -1..W+1 and y `y_r - h/4 .. y_r + h/4`, so that exactly one sample row hits them.
  - Layers on a dense row: `L = 192 * sheets`.
  - Helper `compare_capped(s, cap)`: `render_tuned` with `layer_cap: cap` at threads 0
    and 1 to 8 must equal `render_reference` (RGB and report). Return the largest
    `stats.layer_capacity`.

## Pitfalls

- No functional change to the arena, colours or charges. If a test exposes a lifecycle
  bug in g1e code, fix it in the owned files and record it as a g1e defect in the
  progress log.
- Keep stripe rows off band starts (sample rows divisible by 96) except in the
  band-boundary case.
- `reserve_exact` may in theory over-allocate. If `layer_capacity > cap` ever appears,
  record it rather than weakening the assertion.

## Tests (names start `layer_window_`)

- `layer_window_staggered_stripes`: height 512, rows `[100, 201, 302, 403]` (different
  held slot positions), `sheets 8`, `C = L + 192`. Expect success, equality with the
  reference, and `layer_capacity <= C` at every thread count. The sum of the
  per-stripe peaks (4L) exceeds C.
- `layer_window_band_boundary`: height 512, row `[96]` (first sample row of band 2),
  `sheets 8`, `C = L + 192` (< 2L). Expect success, equality with the reference, and
  `layer_capacity <= C` at threads 0 and 1 to 8. At thread count 1 a never-reset arena
  would need 2L and refuse.
- `layer_window_final_row`: height 64, row `[191]` (the last sample row; its lookahead
  slot is unsampled), `sheets 2`, `C = MAX_LAYER_WINDOW`. Expect equality with the
  reference at every thread count.
- These cannot compile before `layer_capacity` exists. Record that as the before-state.

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1f-layer-capacity cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1f-layer-capacity cargo test --release -p nodetto-capture`
   -> all crate tests pass, including the three new ones.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1f-layer-capacity cargo test -p nodetto-capture layer_window_final_row`
   (debug build, so the arena invariant `debug_assert!` runs) -> 1 test passes.

## Done criteria

- [x] `RenderStats.layer_capacity` exists and the three tests pass. No other behaviour
  changed (goldens untouched).
- [x] Progress log `done`, with the C values used, commands, exit codes and log paths.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- The no-stray-test condition is now the plan-delta scan, which is the last manifest
  `verification` entry and overview rule 9. It must exit 0 and leave
  `tmp/car3-r3b/car3-g1f-layer-capacity/stray-delta.txt` empty. Create the evidence
  directory first.
- The 753 inventoried `tmp/car1-r1/*` copies are not this plan's. Do not write them,
  and do not report them as a blocker.
