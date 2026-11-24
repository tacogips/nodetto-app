# car3-g1-capture-raster

- planId: car3-g1-capture-raster
- planPath: impl-plans/active/car3-g1-capture-raster.md
- progressPath: impl-plans/progress/car3-g1-capture-raster.md
- wave: 1; dependsOn: none
- Findings: function-capture-touching-cap-interference (R3-1, high),
  function-capture-translucent-layer-visibility (R3-2, high).
- Design: `design-docs/specs/design-ai-capture.md` 21.1 R3-1 and R3-2, 21.2, 21.3.
- writePaths: `crates/capture/src/raster.rs`, `crates/capture/src/raster/budget.rs`,
  `crates/capture/src/raster/reference.rs`, `crates/capture/src/raster/tests.rs`,
  `crates/capture/src/prism.rs`, `crates/capture/src/mesh.rs`,
  `crates/capture/src/tool_view.rs`, `crates/capture/src/shade.rs`,
  `crates/capture/tests/render.rs`, `crates/capture/tests/overlay.rs`,
  `apps/cli/src/native-parity/capture.test.ts`, `docs/capture.md`,
  `apps/cli/src/capture-help.ts`, `apps/cli/src/capture-docs.test.ts`,
  `tmp/capture/m09/timing.json`, `tmp/capture/m23/timing.json`,
  `tmp/car3-r3/car3-g1-capture-raster`, `impl-plans/progress/car3-g1-capture-raster.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md`.

## Intent and context

R3-1: two bodies that only touch get a false picture-interference pair when a sample
ray lies in the shared cap or side plane, because `Raster::sample` copies shading
intervals (`PrismView::surface_intervals`, closed caps) into `body_intervals`
(`raster.rs:204-208`; reference `raster/reference.rs:82-85`). Volume mode
(`ToolView::intervals`, `prism.rs` `cast::<false>`) already owns such a ray on one side.
R3-2: each sample keeps one translucent hit (`raster.rs:136,162-165,209-216`), so an
open sheet over a PCB hides the board from pixels and from the drawn report.

Do not edit: `interference.rs`, `overlay.rs`, `capture-interference-options.ts`,
`lattice.rs`, `census.rs`, any NCS1 reader/writer, or any TS scene code.

## Changes: R3-1 witness

- `prism.rs` `PrismView::surface_intervals` and `mesh.rs` `MeshView::surface_intervals`
  return `bool` (`ambiguous`): true when the facet cast resolved a boundary inside the
  volume-mode ownership band: coplanar slab within the cap error
  (`prism.rs` `slab`), edge endpoint within `c_error`, parallel crossing within `error`;
  for meshes, any case where `hits_impl::<false>` would differ from `::<true>`. Compute
  the same error terms the `FACETS = false` path uses. `tool_view.rs` forwards it.
- `raster.rs` `Raster::sample`: per analysed body while `scene.draw_interference`,
  keep the witness aliased to `scratch.current` until the first step whose cast is
  ambiguous. At that step, before the shading combine: cast `view.intervals` into new
  scratch, charge `budget.scan(view.scan_cost(&ray), 0)`, combine
  `witness = combine(current, volume, op)` charged with `budget.charge(len + len)`.
  After divergence every later step also combines the witness (volume interval on
  ambiguous steps, surface interval otherwise), each charged. Fill
  `body_intervals[index]` from the witness if diverged, else from `current`.
- `budget.rs`: add `charged` and `witness` counters (worker-local, flushed like
  `reads`) and expose them in `RenderStats`; add a test-only switch on `render_with`
  that treats `ambiguous` as always false (for the accounting test only).
- `raster/reference.rs`: always build the witness with `ToolView::intervals` over the
  same steps (no flag, no budget).

## Changes: R3-2 layers

- `Sample` keeps `solid`, `marked`, and `layers: (offset: u32, count: u32)` into one
  per-worker `Vec<Hit>` arena (`Raster::bands`). Each held row slot has a `sampled`
  flag.
- Candidates: open-mesh `first_surface_hit` and reference bodies' first interval
  boundary; a layer if nearer than the nearest opaque hit by more than `MERGE_EPS`
  (all if no opaque hit); one per body; sort by `(depth.total_cmp, body index)`.
  Every layer is composited and marks `visibility[body].1 = true`.
- Colour: opaque colour as today, then layers farthest to nearest with
  `shade::reference_mix`. Layer edge: probe the right/lower neighbour's layers for the
  same body (only if that slot is `sampled`), then `shade::is_edge`.
- Arena lifecycle (design "Row lifecycle"): truncate to 0 and clear all slots at band
  restart (before `raster.rs:330`); a lookahead slot with `y >= samples_high` is
  cleared/unsampled; at `copy_within` (`raster.rs:435`) compact the moved slot if
  sampled, else truncate to 0; debug-assert every sampled `offset + count <= len`.
- Capacity: grow only via `reserve_exact` to `min(max(2*cap, needed), cap_limit)`;
  `MAX_LAYER_WINDOW = 262_144`; `needed > cap_limit` stops the shared budget (existing
  "too heavy" refusal). `render_with` takes the cap (production passes the constant);
  `RenderStats.layer_capacity` = max capacity seen.
- Charges only for samples with `k >= 2` layers: `k` + `k*(k-1)/2` + one per neighbour
  probe; compaction copies charged only for rows with such a sample.
- Reference rasterizer: same layer selection, order, colour, edge and visibility rule,
  no arena, no cap, no budget.
- `docs/capture.md:74-78`: every translucent body in front of the nearest solid is
  mixed in depth order; a body seen through them counts as drawn; very deep stacks are
  refused with the existing message. Touch `capture-help.ts` and
  `capture-docs.test.ts` only if `capture-docs.test.ts` fails because of the sentence.

## Pitfalls

- Never charge the recast through `scan(cost, admitted)`; admission already paid one
  cast, so surplus would be zero. Use admitted `0`.
- Unflagged rays must do and charge exactly today's work; the exact read tests
  (`disjoint_boundary_reads_follow_formula`, `boundary_read_counts_and_refusal_are_bounded`)
  must pass unedited.
- Single-layer samples must keep today's bytes: no new charges, same edge result.
- Do not truncate layers; do not keep per-row arenas; do not shrink capacity below
  live length.
- A golden may change only for scenes with two or more overlapping translucent
  bodies (R3-2) or a removed false touching-contact hatch (R3-1); record name and
  reason. Any other golden change is a defect.

## Tests (`raster/tests.rs` unless noted; all compare production with reference and
across thread counts 0 and 1..=8 unless noted)

- Stacked caps 16 x 8 mm, lower z 0..0.9375, upper 0.9375..2, front view 0.25 mm/px,
  picture >= 64 x 512, shared plane on a supersample row in a non-first band ->
  no marked sample, `analysis.candidates == 0`, `pairs` empty, RGB equal to the
  `draw_interference = false` render.
- Shared side, opposed frames (left box `u` rotated 180 degrees about Z, world bounds
  x 0..8 kept), top view with a column at x = 8 -> same assertions; run first on
  `a964ad5` and record the false pair; identically oriented copy kept as control.
- 0.01 mm overlap controls (caps and opposed sides) -> one pair, marked samples.
- Accounting: `disjoint_scene(50)` with analysis on -> `witness == 0`, `reads` equal to
  the pre-fix literal; stacked caps -> `witness > 0` and
  `charged == charged(no-flag switch) + witness`.
- Sheet over 10 x 10 mm reference box (z 0..1), sheet -1..11 at z 3 -> board interior
  pixels differ from sheet alone, outline edge-mixed, both bodies drawn.
- Four sheets (z 3, 4, 5, 6) over the board -> five layers composited, all drawn.
- Opaque box between board and sheet -> board `hidden`.
- One reference body only -> RGB, report, `reads` equal pre-fix literals.
- Storage cap below one window -> refused with the existing message at every thread
  count (no reference comparison).
- Staggered dense stripes, cap C between largest live window and the sum of stripe
  peaks -> success, `layer_capacity <= C`.
- Band-boundary stripe on the first row of band 2, C between the live window and
  twice the stripe -> success at threads 0 and 1..=8, `layer_capacity <= C`.
- Layered final row with unsampled lookahead -> matches reference, invariant holds.
- `apps/cli/src/native-parity/capture.test.ts`: `--size 64x64 --zoom 1.08
  --fail-on-interference`; stacked caps `--view front` -> exit 0, `interference: 0`;
  shared side `--view top` -> exit 0; each 0.01 mm overlap control -> exit 1, one
  pair. For the side case, first try a document whose frames are X-opposed (left box
  on a start face); if it gives exit 1 on the `a964ad5` binary, use it, else record
  that the native side case is a regression guard only. PCB plus imported STL sheet
  (production STL importer), top view -> both bodies listed without
  `[hidden behind other bodies]`.

## Verification (each exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1-capture-raster cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1-capture-raster cargo test --release -p nodetto-capture`
   -> all crate tests pass, including release-only reference comparisons and
   `boundary_read_counts_and_refusal_are_bounded`.
2. `bunx biome check --diagnostic-level=warn apps/cli/src/native-parity/capture.test.ts apps/cli/src/capture-help.ts apps/cli/src/capture-docs.test.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1-capture-raster cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car3-g1-capture-raster/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/capture-docs.test.ts`
   -> biome clean; new native cases, existing parity and the docs test pass.

## Done criteria

- All tests above exist and pass; pre-fix failing evidence (stacked caps, opposed
  side, sheet-over-board) recorded with literals.
- Progress log `done` with hashes, commands, exit codes, log paths and any golden
  change with its reason.
