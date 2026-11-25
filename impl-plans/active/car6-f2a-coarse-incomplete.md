# car6-f2a-coarse-incomplete

- planId: car6-f2a-coarse-incomplete; wave 2; dependsOn: car6-f3-request-scan-budget
- planPath: impl-plans/active/car6-f2a-coarse-incomplete.md
- progressPath: impl-plans/progress/car6-f2a-coarse-incomplete.md
- Finding: function-capture-coarse-scan-reported-as-refinement (R6-2, Rust producer).
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-2 "Rule (Rust)" and Rust tests,
  24.2 timing rule, 24.3.
- writePaths: `crates/capture/src/lattice.rs`, `crates/capture/src/interference.rs`,
  `crates/capture/src/report.rs`, `crates/capture/tests/interference.rs`,
  `crates/capture/tests/render.rs`, `impl-plans/active/car6-f2a-coarse-incomplete.md`,
  `impl-plans/progress/car6-f2a-coarse-incomplete.md`,
  `tmp/car6-r6/car6-f2a-coarse-incomplete`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`. Cargo target: `target/car6-f2a`.

Follow the worker rules in `impl-plans/active/car6-00-overview.md`. Start only after
car6-f3's progress log reads `done`; build on its `triangle_limit` API.

## Intent and context

`AxisSampler::sample` (`lattice.rs:396-502`) casts coarse rows one ahead of accumulation
and exits on exhaustion. A cast-but-unaccumulated coarse hit is lost (`hit` comes from
accumulated volume, `:485`), and the pair is reported only `capped`, so hosts call it
refinement-only and `--fail-on-interference` exits 0.

Non-goals: no change to the census sampler logic, NCS1, goldens, uninterrupted runs,
`checked`, or TS files (car6-f2b/f2c own them).

## Changes

`lattice.rs` (analysis sampler only):
- Successful coarse cast: a level-0 cast after which `budget.exhausted` is still false.
  Count `coarse_ok` per axis.
- `AxisSample` gains `#[doc(hidden)] pub coarse_complete: bool` =
  `coarse_ok == width * height`; `empty_sample` false; census sampler true when its coarse
  loop ended without exhaustion. `#[cfg(test)] pub coarse_casts: Vec<(u64, bool)>`:
  budget `triangles` after each successful coarse cast and its hit (empty elsewhere).
- Witness preservation on every exhaustion exit (`:410`, `:421`, `:427`, `:433`, `:470`
  including the preload): before leaving, add every successfully cast coarse cell not yet
  accumulated (rest of row `y` from the interrupted cell, the preloaded rows) at coarse
  weight with `result.add(grid, corner, grid.side, coarse)`; for the interrupted refined
  cell, if no successful sub-ray hit, add its coarse stretch. Each cell at most once.
  Failed casts (default stretch) add nothing. Uninterrupted runs execute exactly as today.

`interference.rs`:
- `PairSample.coarse_complete = axes.iter().any(|a| a.coarse_complete)`.
- `analyse_scene_with`: a pair with `capped`, no report and `!coarse_complete` is pushed
  to `incomplete` (candidate order), and stays in `capped_count`/`capped_without_hit`.

`report.rs`: `Analysis.incomplete: Vec<(u32, u32)>`; `to_json_with_hidden` writes
`,"incomplete":[[a,b],...]` right after the `cappedWithoutHit` array, only when non-empty.
Update the unit-test literal at `report.rs:203`.

Constructors: add `incomplete: Vec::new()` at `tests/interference.rs:90` and
`tests/render.rs:426` (nothing else in `render.rs`).

Pitfalls: do not derive coverage from `budget.exhausted` (refinement-only exhaustion after
the final coarse cast must stay complete); do not double-add a cell; keep `checked`.

## Tests (write first; record failures)

`lattice.rs` `scan_tests` (exact cuts from an unlimited run's `coarse_casts`):
- abandoned miss: two disjoint plate meshes perpendicular to X spanning the request's Y-Z
  extent; axis 0, refinement 0; limit = `triangles` of the second-to-last record (assert
  the last coarse cast scans >= 1 triangle) -> no hit, capped, `coarse_complete == false`;
  via `sample_pair` same limit -> no report and no complete axis.
- buffered hit: two overlapping cube meshes, request box = overlap, refinement 0; limit =
  `triangles` of the first hit record -> hit, capped, volume > 0 (no hit before).
- refinement-only miss: small prism cube (small loop) in the last coarse row of axis 0 +
  disjoint mesh slab spanning Y-Z; assert last coarse record `triangles` < unlimited
  total; limit = total - 1 -> no hit, capped, `coarse_complete == true`.

`tests/interference.rs` via `render_parsed`, 64x64, `target_cell = 0.25`, default budget,
camera cropped away (use `support::camera`), 1 vs 5 threads equal report and image:
- buffered hit: two coincident meshes of 512 disjoint 1x10x10 mm boxes on a 2 mm X pitch
  -> `pairs` has (0,1) capped, source analysis; `incomplete` empty (pairs empty before).
- abandoned miss: two 512-box meshes on interleaved slots (even/odd) plus one 1 mm cube in
  both meshes in axis-0 cells cast last -> pairs empty, `incomplete == [(0,1)]`, JSON
  contains `"cappedWithoutHit":[[0,1]],"incomplete":[[0,1]]`.
- extend `cap_without_a_hit_is_retained_in_the_report_and_json`: `incomplete` empty, JSON
  has no `"incomplete"`.
If a fixture misses its branch, resize it (box count, pitch); never weaken an assertion.

## Verification (each exits 0 and runs tests)

1. `rustfmt --edition 2021 crates/capture/src/lattice.rs crates/capture/src/interference.rs crates/capture/src/report.rs crates/capture/tests/interference.rs crates/capture/tests/render.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f2a cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f2a cargo test --release -p nodetto-capture`
   - evidence: new tests fail before, pass after; admitted-cube pin, f3 tests and goldens
     unchanged. Timing failures follow overview rule 6 with `target/car6-f2a`.

## Done criteria

- Coverage flag, witness preservation, `incomplete` field and JSON key in place; all
  listed tests pass; progress log `done`.
