# M10 capture-10-interference (revision 4 repair)

- Stage: wave 1. dependsOn: none (base `be8fa5d`, which implements M10).
- Design: sections 6.6 (steps 1 to 6, guarantee), 6.3 (reply keys), 8.5,
  10.2, 11, 18 (CAP-R4-01, CAP-R4-02, CAP-DR4-01, CAP-DR4-02).
- Reference only: `feat/ai-capture-m10` commits `6280745`, `19c1dbf`. Read
  `git show 19c1dbf -- crates/capture` for the shared-view and guard ideas;
  write own code; do not cherry-pick.
- writePaths: `crates/capture/src/lattice.rs`, `crates/capture/src/interference.rs`,
  `crates/capture/src/prism.rs`, `crates/capture/src/raster.rs`,
  `crates/capture/src/report.rs`, `crates/capture/src/lib.rs`,
  `crates/capture/src/tool_view.rs` (new), `crates/capture/src/overlay.rs`,
  `crates/capture/src/census.rs`, `crates/capture/src/mesh.rs`,
  `crates/capture/src/tiles.rs` (four empty stubs), `crates/capture/tests/interference.rs`,
  `crates/capture/tests/render.rs` (report assertions only),
  `impl-plans/active/capture-10-interference.md`, `tmp/capture/m10r`, `target`
- Pre-authorised: `tests/render.rs` analysis assertions near `:404-408` may
  be replaced by a full `Analysis` equality (stronger). The pixel digest
  and every other assertion stay. `raster.rs` and `report.rs` change only
  if the repair needs it (no behaviour change to the picture).

## Intent

`be8fa5d` is sound in its rules (ratified in design CAP-R4-01: small-loop
first across axes, centre-hit retention, world-coordinate plane ownership,
`cappedCount`/`cappedWithoutHit`/`budget`). Repair what breaks the budget
and totality promises, adopt the reference's stronger tests, and add the
`tool_view` seam plus empty modules so wave 2 can run in parallel.

## Non-goals

No change to the refinement priority, the budgets, the JSON keys or their
order, the M8 pixel digest, the CLI or any TypeScript. No mesh support
(M11). No picture-pass routing through `tool_view` (M23).

## Changes

1. `tool_view.rs` (new, `pub mod tool_view;` in `lib.rs`):
   `pub enum ToolView { Prism(PrismView), Unsupported }` with
   `pub fn new(tool: &Tool, index: u32, family: &RayFamily) -> ToolView`,
   `pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals)`
   (empty for `Unsupported`), `pub fn average_occupancy(&self) -> f64`
   (1.0 for `Unsupported`); free functions moved from `lattice.rs`:
   `pub fn tool_loops(tool: &Tool) -> Vec<Bounds>` (loop boxes; empty for a
   mesh), `pub fn tool_bounds(tool: &Tool) -> Option<Bounds>`, and
   `pub fn is_solid(tool: &Tool) -> bool` (prism true, mesh false until M11).
   `lattice` and `interference` evaluate tools only through these.
   Candidates skip a body whose first step's tool is not solid.
2. Shared views (CAP-R4-02): one lazily built `ToolView` per tool and axis
   (X, Y, Z), at most three per tool, shared read-only by all candidates and
   worker threads (for example `std::sync::OnceLock` slots in a struct
   built once per `analyse_scene`). Replace the per-candidate build in
   `lattice.rs` `AxisFold::new` (around `:199-228`).
3. Streamed level 0 (CAP-DR4-01): replace the whole-axis `base` vector in
   `AxisSampler::sample` (`:362-431`) with a three-row window; decide a
   cell once its row and both neighbour rows are cast; same row order,
   same reservation of small-loop rays, same allowances. No ray is cast
   twice; refinement cost `m * m` is charged before sub-rays are cast; a
   refinement that does not fit is not cast and sets `capped`. Commit a
   cell's volume and box after the choice, from retained leaves only.
   `AxisSample.rays` counts exactly the cast rays.
4. Inputs (CAP-DR4-02): `plan` keeps `f64::INFINITY` as the valid
   minimum-grid marker (16 per side) used identically by work accounting
   and sampling; the reported cell is the finite side actually used
   (rounded up by `report.rs` as today). A target cell that is NaN, `<= 0`
   or infinite returns `(target, 0)` at once. `sample_axis` with axis > 2,
   an empty or inverted box, a NaN coordinate, or a NaN or `<= 0` cell
   returns an empty sample with `rays == 0`. Side counts are clamped after
   conversion so NaN cannot produce 0.
5. Four empty modules `overlay.rs`, `census.rs`, `mesh.rs`, `tiles.rs`, each
   a single `//!` line naming its milestone, declared `pub mod` in `lib.rs`.

## Pitfalls

- Do not change which cells refine or their order; the Plate report must
  stay exactly 590.404 mm3 with box (85,45,2)..(100,60,5).
- `OnceLock<ToolView>` must be `Sync`; do not wrap in `Mutex` per ray.
- Keep `#[cfg_attr(debug_assertions, ignore = "release only")]` for timing
  tests; replace `#[cfg(not(debug_assertions))]` at
  `tests/interference.rs:578-600` with it (one test per timed case).

## Tests (`tests/interference.rs`; existing tests keep their assertions)

- Exact allowance: allowance equal to the cost of the first two
  refinements -> counted rays == level 0 + that allowance, never one more.
- A coarse hit cell whose sub-rays hit only an inner square -> reported box
  equals the sub-ray footprint, strictly smaller than the coarse cell.
- Centre-only witness: all sub-rays miss a real coarse hit -> pair reported.
- `candidate_table_bounds_and_unchecked_order` (`:440-464`) gains: all
  1,302 checked candidates sampled and reported as hits, unchecked order
  unchanged, finite reported cell.
- Invalid `plan` targets (NaN, 0, -1, infinity) -> `(_, 0)` promptly; invalid
  `sample_axis` requests -> empty sample, zero rays.
- Guarantee with a wide box (from the reference): 100 x 100 x 20 mm box,
  cell 1, zero refinement, 200 seeded triangle corners -> every one found;
  an overlap one cell square and 0.002 mm thick seen only along Z -> found.
- Release only: 200 bodies sharing one 20,000-point loop (19,900 pairs),
  one thread, under 5,000 ms; existing pin (< 500 ms), 2,000-box and
  600-hole (< 2,000 ms) cases unchanged.
- `tests/render.rs`: full `Analysis` equality for the Plate scene.

## Acceptance criteria

- Setup work is bounded by three views per tool; every cast is counted.
- The minimum-grid fallback samples and reports its prefix; invalid inputs
  never panic, loop or divide by zero.
- Plate result and M8 digest unchanged; `tool_view` and the four stub
  modules exist as `pub mod`.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/lattice.rs crates/capture/src/interference.rs crates/capture/src/prism.rs crates/capture/src/tool_view.rs crates/capture/src/lib.rs crates/capture/tests/interference.rs crates/capture/tests/render.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m10 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m10 cargo test -p nodetto-capture'`
   (evidence: interference and render tests pass, 0 failed)
2. `sh -c 'mkdir -p tmp/capture/m10r && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m10 cargo test --release -p nodetto-capture --test interference -- --nocapture > tmp/capture/m10r/interference.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m10r/interference.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m10r/interference.txt'`
   (evidence: release timings printed, including the 200-body case)
3. `sh -c '! grep -rnE "mul_add|\.sin\(|\.cos\(|\.tan\(|powf|powi|unsafe " crates/capture/src && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m10 cargo test -p nodetto-capture --test render'`

## Progress

- Before revision 4: implemented at `be8fa5d` (68 passed, 2 ignored,
  `tmp/capture/m10/v1-committed.log`; 15 release tests,
  `tmp/capture/m10/interference.txt`). Review findings: design 18 CAP-R4-01/02.
- Revision 4 repair: in progress. Shared lazy tool views, streamed sampling and input guards implemented; exact allowance, leaf footprint, centre witness, invalid input, wide-box guarantee, 1,302 candidates and release timing regressions added. Scoped format, clippy and debug tests passed (72 passed, 7 ignored); release interference passed (22 tests, 200-body case 199 ms); render gate passed (14 passed, 2 ignored). Formal review and acceptance remain downstream.

- M10-TI-01: invalid-target coverage now uses a real candidate and a valid-target control. Fresh verification passed: `tmp/capture-s868/capture-10-interference/ti-01-gate-1.log`, `ti-01-gate-2.log`, and `ti-01-gate-3.log`; independent review remains pending.
