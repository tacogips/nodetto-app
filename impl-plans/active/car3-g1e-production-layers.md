# car3-g1e-production-layers

- planId: car3-g1e-production-layers; planPath: impl-plans/active/car3-g1e-production-layers.md
- progressPath: impl-plans/progress/car3-g1e-production-layers.md
- wave: 3; dependsOn: car3-g1c-production-witness (same files), car3-g1d-reference-layers (C3)
- Finding: function-capture-translucent-layer-visibility (R3-2, high), contract C4.
- Design: `design-ai-capture.md` 21.1 R3-2 (all rules), 21.5 C4 and g1e row.
- writePaths: `crates/capture/src/raster.rs`, `crates/capture/src/raster/budget.rs`,
  `crates/capture/src/raster/tests.rs`, `crates/capture/src/shade.rs`,
  `crates/capture/tests/render.rs`, `crates/capture/tests/overlay.rs`,
  `tmp/car3-r3b/car3-g1e-production-layers`,
  `impl-plans/progress/car3-g1e-production-layers.md`, `target`, `tmp/cad3d`
  (`shade.rs` only if a helper must change; goldens only if the scene meets the
  overlap condition)
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

Production keeps one translucent hit per sample (`raster.rs:136,162-165,262-270`, colour
`387-412`). After this plan, production composites every layer exactly like the g1d
reference. Layers are stored in one capped arena per worker, which is bounded from
this checkpoint on.

## Changes

- `raster.rs`:
  - `const MAX_LAYER_WINDOW: usize = 262_144;`.
  - `Tuning` gains `layer_cap: usize`. `PRODUCTION` uses `MAX_LAYER_WINDOW`.
  - `#[derive(Clone, Copy, Default)] struct LayerSpan { offset: u32, count: u32 }`.
  - `Sample { solid: Option<Hit>, layers: LayerSpan, marked: bool }` replaces
    `translucent`.
  - `RayScratch` gains `candidates: Vec<(usize, Boundary)>` and `kept: Vec<Hit>`.
- `Raster::sample`:
  - Collect candidates (open-mesh `first_surface_hit`, the first boundary of each
    reference body; one per body).
  - Take `solid` as today, then filter and `make_hit` each candidate as in g1d.
  - For `k >= 2`: `budget.charge(k + k*(k-1)/2)`. Then
    `sort_unstable_by(depth.total_cmp, then body)`; the key is unique per body, so the
    order is total.
  - Append to the worker arena. If the arena would exceed `tuning.layer_cap`, stop the
    budget (below) and `return Sample::default()`.
  - Mark each layer drawn.
- `bands()`, one `Vec<Hit>` arena per worker and per-slot `sampled` and `multi` flags
  (`factor + 1` slots):
  - Growth: when `len + k > capacity`, set capacity to
    `min(max(2*capacity, len + k), layer_cap)` with `reserve_exact`. If
    `len + k > layer_cap`, call `budget.stop()`.
  - Band restart, before `raster.rs:330`: `truncate(0)` and clear every slot (spans,
    `sampled` and `multi`).
  - Lookahead `y >= samples_high`: clear that slot and leave it unsampled.
  - Rotation (`copy_within`, `raster.rs:435`):
    - if the moved slot is sampled, `copy_within` its layers to the arena start,
      rewrite its offsets and truncate after them. When its `multi` flag is set, charge
      one per moved layer;
    - otherwise `truncate(0)`.
    - Clear every other slot.
  - After every sampled row, `debug_assert!` that each sampled `offset + count <= len`.
- Colour and edges: same rule as g1d. Probe the neighbour's layers for the same body
  and charge one per probe, but only when this sample has `k >= 2`. Read the lower
  neighbour only under the existing `sample_y + dy + 1 < samples_high` guard.
- `budget.rs`: `WorkerBudget::stop(&mut self)` sets the shared `stopped` flag.
  `render_tuned` then returns the existing message unchanged:
  `The scene is too heavy for this picture size (picture boundary scans over {allowance}). Use a smaller --size.`

## Pitfalls

- A sample with at most one layer charges nothing new and paints today's bytes. Do not
  charge storage or probes for it.
- No truncation of layers, no per-row arenas, never shrink capacity below the live
  length, and never grow beyond `layer_cap`.
- A partial sample after a refusal must not leave appended layers (append only after
  all charges succeed).
- Do not touch `reference.rs`, the witness code from g1c, `interference.rs` or `overlay.rs`.
- Goldens: regenerate only a golden whose scene has two or more overlapping translucent
  bodies in front of the nearest opaque surface. Record its name and reason. Otherwise
  it is a defect.

## Tests (`tests.rs`; fixtures from `super::reference::fixtures`; test names start `layers_`)

- Write the single-layer test first: `sheets_over_board(&[], true)` (board alone) at
  threads 0 and 1 to 8. Before the edit, record the FNV-1a 64 digest of the RGB (add a
  small `fn fnv1a(&[u8]) -> u64` helper), the body states and `reads`. Paste them as
  literals. After the change, assert equality.
- `layers_sheet_over_board`, `layers_four_sheets` and `layers_opaque_hides_board`:
  `compare_every_thread_count` on the g1d fixtures, plus the g1d pixel and state
  assertions. Production fails before the edit; record that.
- `layers_storage_cap_refuses`:
  `render_tuned(&sheets_over_board(&[3.0, 4.0, 5.0, 6.0], true), t, SCAN_ALLOWANCE, Tuning { layer_cap: 4, ..Tuning::PRODUCTION })`
  at threads 0 and 1 to 8. Expect `Err` with exactly the message above (allowance
  16000000000), `stats.liveness` empty and `stats.census.rays == 0`.

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1e-production-layers cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1e-production-layers cargo test --release -p nodetto-capture`
   -> all crate tests, goldens and the round-1/2 protections pass.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1e-production-layers cargo test -p nodetto-capture layers_`
   (debug build, so the arena `debug_assert!` runs) -> the `layers_` tests pass.

## Done criteria

- Layers are composited with a capped worker arena, and the over-cap refusal works.
  The single-layer literals hold.
- Progress log `done`, with literals measured before the edit, fail-before output,
  goldens (if any) with reasons, commands, exit codes and log paths.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- The no-stray-test condition is now the plan-delta scan, which is the last manifest
  `verification` entry and overview rule 9. It must exit 0 and leave
  `tmp/car3-r3b/car3-g1e-production-layers/stray-delta.txt` empty. Create the
  evidence directory first.
- The 753 inventoried `tmp/car1-r1/*` copies are not this plan's. Do not write them,
  and do not report them as a blocker.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 2)

Blocker: `fail-before.log` exited 101 on `error: Option 'quiet' given more than once`
(`CARGO_TERM_QUIET=true` plus `-q`/`--quiet`) before any assertion ran. The pre-edit
source is gone, and this plan forbids pre-fix builds, so the run cannot be repeated.

Decision: the fail-before evidence for the sheet fixtures becomes the substitute
evidence below. The criterion is not dropped. The implementation, tests, plan IDs,
writePaths, dependsOn and waves do not change, and no source file is edited.

- S1, the pre-edit production model. `tmp/car3-r3b/car3-g1e-production-layers/raster-before-edit.txt`
  is the implementer's pre-edit copy of `raster.rs` (781 lines). Line 54
  `translucent: Option<Hit>,` and lines 151-178 show one nearest translucent hit per
  sample.
- S2, the same assertions failing on that model. `tmp/car3-r3b/car3-g1d-reference-layers/fail-before.log`
  (read-only here) shows the single-slot reference failing `one_sheet_over_board` and
  `four_sheets_over_board` at the "board interior" assertion, with exit 101 and
  1 passed, 2 failed. `tests.rs:layers_check_sheets` uses the same fixtures, the same
  pixel coordinates (48,48) and (67,48), and the same all-Drawn check as
  `reference.rs:layer_tests::check_sheets`.
- S3, the production/reference comparison. `layers_check_sheets` calls
  `compare_every_thread_count` against the composited g1d reference. A single-slot
  production would differ at the board-interior pixel shown in S2.
- Keep `fail-before.log` byte-unchanged. It is the disclosed invalid attempt; do not
  rename, overwrite or delete it.

Resume steps (no source edits):
1. `grep -n 'translucent' tmp/car3-r3b/car3-g1e-production-layers/raster-before-edit.txt > tmp/car3-r3b/car3-g1e-production-layers/fail-before-substitute.log 2>&1; echo "exit=$?" >> tmp/car3-r3b/car3-g1e-production-layers/fail-before-substitute.log`.
   Expect exit 0 and line 54 `translucent: Option<Hit>,`.
2. `grep -nE 'FAILED|test result|board interior' tmp/car3-r3b/car3-g1d-reference-layers/fail-before.log >> tmp/car3-r3b/car3-g1e-production-layers/fail-before-substitute.log`.
   Expect both test names, `board interior` and `1 passed; 2 failed`.
3. `grep -nE 'pixel\(&(rgb|plain), (48|67), 48\)|compare_every_thread_count|BodyState::Drawn' crates/capture/src/raster/tests.rs crates/capture/src/raster/reference.rs >> tmp/car3-r3b/car3-g1e-production-layers/fail-before-substitute.log`.
   Expect exit 0 and coordinate lines from both files: `tests.rs:421-423`
   (`layers_check_sheets`) and `reference.rs:665-669` (`check_sheets`), written as
   `pixel(&rgb, 48, 48)` and `pixel(&rgb, 67, 48)`, plus `compare_every_thread_count`
   and `BodyState::Drawn` lines in both files.
4. Rerun the three manifest verification commands on the current tree. Write fresh
   logs: `gate-r2.log`, `focused-r2.log`, `stray-r2.log`. Each must exit 0, and the
   test commands must report more than 0 tests. Never pass `-q`/`--quiet`, because
   `CARGO_TERM_QUIET=true` already sets it.
5. Progress log: set status `done`. Record S1-S3 with `fail-before-substitute.log`,
   the invalid `fail-before.log` and its cause, the round-2 commands, exit codes,
   test counts and log paths, and `goldens: none changed`.

Done for this resume: `fail-before-substitute.log` shows the evidence from steps 1-3,
the three round-2 logs exit 0, and the progress log reads `done`.
