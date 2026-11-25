# car3-g1c-production-witness

- planId: car3-g1c-production-witness; planPath: impl-plans/active/car3-g1c-production-witness.md
- progressPath: impl-plans/progress/car3-g1c-production-witness.md
- wave: 2; dependsOn: car3-g1a-cast-flag (C1), car3-g1b-reference-witness (C2)
- Finding: function-capture-touching-cap-interference (R3-1, high).
- Design: `design-ai-capture.md` 21.1 R3-1 ("Shared history until divergence",
  "Budget", "Test-only statistics", "Work accounting"), 21.5 g1c row.
- writePaths: `crates/capture/src/raster.rs`, `crates/capture/src/raster/budget.rs`,
  `crates/capture/src/raster/tests.rs`, `crates/capture/tests/render.rs`,
  `crates/capture/tests/overlay.rs`, `tmp/car3-r3b/car3-g1c-production-witness`,
  `impl-plans/progress/car3-g1c-production-witness.md`, `target`, `tmp/cad3d`
  (`tests/render.rs` and `tests/overlay.rs` only for a golden shown to be a touching contact)
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

`Raster::sample` (`raster.rs:204-208`) copies shading intervals into `body_intervals`,
so touching bodies report a picture pair, a hatch, and exit 1 under
`--fail-on-interference`. After this plan, production uses volume ownership for the
witness, but only on rays that the C1 flag marks. Every unflagged ray does and charges
exactly today's work.

## Step 1 (before any witness edit): baseline telemetry

- `budget.rs`: `ScanBudget::charged(&self) -> u64` reads the existing `charged` atomic.
- `raster.rs`: `RenderStats` gains `charged: u64`, filled from `shared.charged()`.
  No behaviour change.
- Write `disjoint_witness_keeps_reads_and_charges` (release only, like
  `tests.rs:245`). It uses `disjoint_scene(50)` with `analyse = true` and
  `draw_interference = true`, at threads 0 and 1 to 8. Run it now with placeholder
  asserts, record `reads` and `charged` per thread count in the progress log, and
  paste the values as literals. All thread counts must agree. If they do not, stop
  and record it.

## Step 2: witness

- `#[derive(Clone, Copy)] struct Tuning { never_flag: bool }` with
  `const PRODUCTION: Tuning` (`never_flag: false`).
- New `fn render_tuned(scene, threads, allowance, tuning: Tuning) -> (Result<(Vec<u8>, Report), CaptureError>, RenderStats)`
  holds the current `render_with` body. `render_with(scene, threads, allowance)` keeps
  its signature and calls `render_tuned(.., Tuning::PRODUCTION)`, so existing call
  sites stay unedited.
- `Raster` gets a `tuning: Tuning` field, set from `render_tuned`.
- `RayScratch` gains `volume`, `witness` and `witness_next: Intervals`. Do not rename
  or remove existing fields: `reference.rs` uses them.
- `budget.rs`:
  - `ScanBudget` gains `witness: AtomicU64` and `fn witness(&self) -> u64`.
  - `WorkerBudget` gains a local `witness: u64`, published in `Drop` like `reads`.
  - `fn recast(&mut self, tested: usize) -> bool` equals `scan(tested, 0)` and adds
    `tested` to `witness` on success.
  - `fn charge_witness(&mut self, count: u64) -> bool` equals `charge(count)` and adds
    `count` on success.
- `RenderStats` gains `witness: u64`.
- `Raster::sample`, per non-open body, with `track = body.analysed && scene.draw_interference`
  and a local `diverged = false`. In each solid step:
  1. Keep today's surface cast and keep its `bool` (C1). The flag counts only when
     `!tuning.never_flag`.
  2. If `track` and flagged:
     - cast `view.intervals` into `scratch.volume`;
     - `budget.recast(view.scan_cost(&ray))`; on false, `return Sample::default()`;
     - set the witness to `combine(if diverged { witness } else { current }, volume, op)`
       via `witness_next` and swap;
     - `charge_witness((src.len() + volume.len()) as u64)`;
     - set `diverged = true`.
  3. Else if `track && diverged`, combine the witness with `scratch.tool` (the surface
     interval) the same way, charged with `charge_witness`.
  4. Run the shading combine and its charge exactly as today.

  On the `Op::Intersection` clear branch, also clear the witness when `diverged`.
  After the steps:
  - when `diverged`, set `body_intervals[index]` from the witness, even if shading is
    empty;
  - otherwise keep today's clone inside `if let Some(first)`.

## Pitfalls

- The recast must use admitted weight 0 (`recast`, never `scan(cost, weights[..])`).
  Admission paid for one cast only.
- No added work when no step is flagged: `disjoint_boundary_reads_follow_formula` and
  `boundary_read_counts_and_refusal_are_bounded` must pass unedited.
- Shading, edges, liveness, census, `translucent` and `Sample` stay unchanged. Do not
  edit `reference.rs`, `prism.rs`, `interference.rs` or `overlay.rs`.
- A golden may change only if it is a removed false touching-contact hatch. Record
  its name and that proof. Any other change is a defect.

## Tests (`tests.rs`; use `super::reference::fixtures::{stacked_caps, shared_side}`)

- Helper `compare_every_thread_count(s) -> Report`: as `compare`, but threads
  `[0, 1, 2, 3, 4, 5, 6, 7, 8]`. Do not change the existing `compare`.
- Run `stacked_caps(0.0)`, `shared_side(true, 0.0)` and `shared_side(false, 0.0)`
  through the helper. Expect `pairs` empty, `candidates == 0`, and RGB at threads 0
  equal to the same fixture with `draw_interference = false`. Write these first, run
  them on the unmodified `raster.rs`, and record the failures and pair counts.
- Run `stacked_caps(0.01)` and `shared_side(true, 0.01)` through the helper. Expect
  `pairs.len() == 1` and RGB different from the plain render.
- `disjoint_witness_keeps_reads_and_charges` (step 1 literals): `witness == 0`, and
  `reads` and `charged` equal the literals at threads 0 and 1 to 8.
- `stacked_caps_witness_charge_is_the_delta`: at threads 0 and 1 to 8,
  `render_tuned(PRODUCTION)` has `witness > 0`, and its `charged` equals
  `render_tuned(never_flag: true).charged + witness`.

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1c-production-witness cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1c-production-witness cargo test --release -p nodetto-capture`
   -> the new tests, the g1b witness tests, `boundary_read_counts_and_refusal_are_bounded`,
   `tests/boundary_fold.rs`, `tests/overlay_alloc.rs` and all goldens pass.

Format: `rustfmt --edition 2021` on `budget.rs` and `tests.rs`. For `raster.rs`, run
`rustfmt --edition 2021 --check` first. If the diff touches a sibling-owned child module
(`reference.rs`), wait for that sibling (worker rule 10).

## Done criteria

- Step 1 literals are recorded before the step 2 edit, and all tests above pass.
- Progress log `done`, with hashes, literals, fail-before output, golden changes (if
  any) with reasons, commands, exit codes and log paths.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- The no-stray-test condition is now the plan-delta scan, which is the last manifest
  `verification` entry and overview rule 9. It must exit 0 and leave
  `tmp/car3-r3b/car3-g1c-production-witness/stray-delta.txt` empty. Create the
  evidence directory first.
- The 753 inventoried `tmp/car1-r1/*` copies are not this plan's. Do not write them,
  and do not report them as a blocker.
