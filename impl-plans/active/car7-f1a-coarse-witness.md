# car7-f1a-coarse-witness

- planId: car7-f1a-coarse-witness; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car7-f1a-coarse-witness.md
- Finding: function-capture-coarse-scan-reported-as-refinement (Rust producer + release CLI).
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-2 "Rule (Rust)" and 25.1 R7-1
  (positions, buffered-hit volume, native case, parity). Cargo target: `target/car7-f1a`.
- Follow `impl-plans/active/car7-00-overview.md` worker rules.

## Intent and context

`AxisSampler::sample` (`lattice.rs:408`) casts coarse rows one ahead of accumulation
(preload `:421-428`, row `y + 1` preload `:437-448`) and leaves on exhaustion (`:434`,
`:437-448`, `break 'sampling` at `:484`). Cast-but-unaccumulated hits are lost because
`hit` comes from accumulated volume (`:498`); the pair becomes a capped miss
(`interference.rs:396-428`) and nothing says the coarse scan did not finish.

Non-goals: no change to the census sampler logic, `checked`, budget constants, NCS1,
goldens, uninterrupted runs, TypeScript sources, `raster*`, `mesh.rs`, `tool_view.rs`.
Do not loosen or rewrite `tests/interference.rs:989` (`dense_and_admitted_pairs_are_deterministic`).

## Changes

`lattice.rs` (analysis sampler only):
- Successful coarse cast = a level-0 cast (`divisions == 1`, sub `[0,0]`) after which
  `budget.exhausted` is still false. Count `coarse_ok` per axis.
- `AxisSample` (`:85`) gains `#[doc(hidden)] pub coarse_complete: bool` =
  `coarse_ok == width * height`; `empty_sample` (`:616`) false; census sampler true when
  its coarse loop ended without exhaustion (not read). Also
  `#[cfg(test)] pub coarse_casts: Vec<(u64, bool)>`: budget `triangles` after each
  successful coarse cast and whether it hit; empty in `empty_sample` and the census.
- Witness preservation on every exhaustion exit: before leaving, add each successfully
  cast coarse cell not yet accumulated at coarse weight, like an unrefined cell
  (`result.add(grid, self.corner([x, y]), grid.side, coarse)`): rest of row `y` from the
  interrupted cell, the preloaded row(s) (`y + 1`, or rows 0/1 when the initial preload
  was cut). Failed casts (the last pushed default stretch) add nothing. For the cell whose
  refinement was cut, keep its accumulated sub-rays; if none hit, add its coarse stretch.
  Each cell at most once. Pitfall: rows can be shorter than `width` after a cut preload;
  never index past `row.len()`; a pushed entry is successful only if it is not the one
  whose cast set `exhausted`.
- Pitfall: never derive coverage from `budget.exhausted`; exhaustion during refinement
  after the final coarse cast must leave `coarse_complete == true`.

`interference.rs`: `PairSample` (`:206`) gains `coarse_complete = axes.iter().any(..)`.
In the classification loop, a pair with `capped`, no report and `!coarse_complete` is
pushed to `incomplete` in candidate order and still counted in `capped_count` and
`capped_without_hit`. A pair with a report is never incomplete.

`report.rs`: `Analysis` (`:36`) gains `pub incomplete: Vec<(u32, u32)>`; JSON writes
`,"incomplete":[[a,b],...]` right after the `cappedWithoutHit` array (`:106`), only when
non-empty. Update the literal at `report.rs:203`. Add `incomplete: Vec::new()` to the
literals at `tests/interference.rs:90` and `tests/render.rs:426` (nothing else in
`render.rs`).

## Tests (write first; record failures before the production change)

`lattice.rs` `scan_tests` (`:918`, imitate `moderate_scene` and the existing
`sample_pair` calls): each test runs once unlimited to read `coarse_casts`, then with an
exact `triangle_limit` cut.
- buffered hit: two overlapping cube meshes, overlap 4 x 4 x 4 mm = request box, target
  cell 1 mm, refinement 0. Assert unlimited `cell == 0.25` (16 x 16 grid, `side_count`
  `:140`) and every record hits. Cut = first record's `triangles` -> cut run has
  `coarse_casts.len() == 1`, `hit`, `capped`, `!coarse_complete`, `volume == 0.25`
  (|diff| <= 1e-9). Before: volume 0.0. Duplicate would be 0.50.
- abandoned miss: two disjoint plate meshes perpendicular to X spanning the request Y-Z;
  axis 0, refinement 0; cut = second-to-last record's `triangles` (assert the last cast
  scans >= 1 triangle) -> no hit, capped, `!coarse_complete`; `sample_pair` with the same
  limit -> no report and no complete axis.
- refinement-only miss: small marked prism cube in the last coarse row of axis 0 plus a
  disjoint mesh slab spanning Y-Z; assert last coarse record `triangles` < unlimited
  total; cut = total - 1 -> no hit, capped, `coarse_complete == true`.

`tests/interference.rs`, 64 x 64, `target_cell = 0.25`, default budget, camera cropped
away from the bodies (`support::camera`), via
`nodetto_capture::render_parsed(&scene, ImageFormat::Png, t)` at t = 1 and 5, asserting
equal `report` and `image` (imitate `:993-997`):
- buffered hit: two coincident meshes of 512 disjoint 1 x 10 x 10 mm boxes on a 2 mm X
  pitch -> `pairs` has (0,1) capped, source analysis; `incomplete` empty.
- abandoned miss: two 512-box meshes on interleaved slots (even/odd) plus one 1 mm cube in
  both meshes in the axis-0 cells cast last -> pairs empty, `incomplete == [(0,1)]`, JSON
  contains `"cappedWithoutHit":[[0,1]],"incomplete":[[0,1]]`.
- extend `cap_without_a_hit_is_retained_in_the_report_and_json` (`:571`): keep every
  existing assertion, add a threads-1 render compared with the threads-5 one (report JSON
  and PNG via `render_parsed`), `analysis.incomplete.is_empty()`, no `"incomplete"` key.
If a fixture misses its branch, resize it (box count, pitch); never weaken an assertion.

`apps/cli/src/native-parity/capture.test.ts`: new `nativeTest`
`"native capture keeps the analysis hit of a cropped dense pair"` (30 s timeout like its
neighbours). Build the document in the test with `encodeNmesh`, `canonicalize`,
`toInline`, `cadElement(.., "cad.mesh", ..)` as at `:706-721`: exactly the two coincident
512-box meshes, no other body. Spawn the binary directly (as at `:830-848`):
`capture <doc> --view top --size 64x64 --target 2000,2000,0 --zoom 10
--fail-on-interference --output dense.png --force`, once plain and once `--json`.
- both runs exit 1;
- text: the two-body pair line ends in `, approximate`; no `incomplete:` line; no
  `(found in the picture only)`;
- JSON: `interference.pairs` has exactly one record for the two bodies with
  `approximate: true`, `source: "analysis"`; `interference.incomplete` absent.
Before the Rust change the run exits 0 with no pair. Never accept `incomplete` here.

## Verification (each exits 0 and runs tests)

1. `rustfmt --edition 2021 crates/capture/src/lattice.rs crates/capture/src/interference.rs crates/capture/src/report.rs crates/capture/tests/interference.rs crates/capture/tests/render.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f1a cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f1a cargo test --release -p nodetto-capture`
   - evidence: new tests listed as passed, failing output recorded before the change;
     admitted-cube pin, car6-f3 tests and goldens unchanged. Timing: overview rule 6.
2. `bunx biome check --diagnostic-level=warn apps/cli/src/native-parity/capture.test.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f1a cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car7-f1a/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   - evidence: the new case passed (not skipped); existing native cases pass;
     `tmp/capture/m09/timing.json` and `tmp/capture/m23/timing.json` written.

## Done criteria

- `coarse_complete`, witness preservation, `Analysis.incomplete` and its JSON key exist;
  all listed tests pass; both commands exit 0; progress log reads `done`.

## Implementation status

Producer, serialization and assigned regression coverage are implemented. The CLI gate passed
(16 tests); focused interference and render suites passed (29 and 16 tests). The full Rust
gate remains unsatisfied: all three attempts failed the existing tile deadline, although its
single-test isolated comparison passed. See `impl-plans/progress/car7-f1a-coarse-witness.md`
and `tmp/car7-r7/car7-f1a-coarse-witness/` for exact outcomes and logs. Formal review and
integration are downstream.
