# car7-f2-picture-triangle-bound

- planId: car7-f2-picture-triangle-bound; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car7-f2-picture-triangle-bound.md
- Finding: performance-capture-picture-mesh-triangle-scans.
- Design: `design-docs/specs/design-ai-capture.md` 25.1 R7-2. Cargo target:
  `target/car7-f2`. Follow `impl-plans/active/car7-00-overview.md` worker rules.

## Intent and context

`Raster::sample` (`raster.rs:149`) charges mesh traversals through `WorkerBudget::scan`
(`raster/budget.rs:108-117`) only above the admitted tool weight, so a picture can
traverse about 2e10 mesh-bin entries; three diagonal-strip slabs at 64 x 64 need at least
1,610,612,736 and are admitted. Mesh traversals in painting: open-body
`first_surface_hit` (around `raster.rs:186-193`), solid-step `surface_intervals` (around
`:210-218`) and the witness recast `intervals` (around `:222-228`).

Non-goals: no change to `scan`, `charge`, `recast`, `charge_witness`, `flush`, CHUNK,
`SCAN_ALLOWANCE`, `stats.charged`, `stats.reads`, the refusal string, census, lattice,
interference, `mesh.rs`, `tool_view.rs`, `tiles.rs`, goldens or the tile deadline.

## Changes

- `raster.rs`: `const PICTURE_TRIANGLE_LIMIT: u64 = 768_000_000;` (comment: equals
  `lattice::request_triangles(24_000_000)`, kept as a literal). Only allowed fallback:
  `1_536_000_000`, used only if an existing test/pin/golden changes at 768M; if it still
  changes, stop `blocked`. Record the chosen value in the progress log.
- `raster/budget.rs`: `ScanBudget::new(allowance: u64, triangle_limit: u64)`; new fields
  `triangle_limit: u64`, `triangles: AtomicU64` (every reservation request, granted or
  not), `visited: AtomicU64`; accessors `triangles()` and `visited()`. `WorkerBudget`
  gains a local `visited: u64` published in `Drop`. New
  `pub(super) fn traverse(&mut self, entries: usize) -> bool`:
  1. `entries == 0` -> true, touches nothing;
  2. `after = shared.triangles.fetch_add(entries) + entries` directly on the shared
     atomic (never via `pending`/CHUNK);
  3. `after > triangle_limit` -> set `stopped`, return false (bin not traversed);
  4. else local `visited += entries`, return true.
- `raster.rs` `Raster::sample`: immediately before each of the three traversals call
  `budget.traverse(view.triangle_cost(&ray))` on the same view and ray; on false return
  `Sample::default()` (as existing budget failures). For the recast, reserve before the
  `intervals` call; keep the existing `recast` call after it. `render_tuned` passes
  `PICTURE_TRIANGLE_LIMIT` to `ScanBudget::new`; `render_with`/`render_tuned` signatures
  stay. `RenderStats` gains `triangles` and `visited`.
- Refusal path after `paint` (`raster.rs:847-849`) is unchanged and returns the existing
  string for every stop reason.

Pitfalls: a worker-local pending count for triangles allows overshoot (review finding);
the reservation must be the shared `fetch_add` before traversal. Do not reserve for
prisms (`triangle_cost` is 0). Do not move the existing `scan` call or change its
arguments. Do not add a new message.

## Tests (`crates/capture/src/raster/tests.rs`, `#[cfg_attr(debug_assertions, ignore = "release only")]`)

- Builder `diagonal_strip_scene(strips, bodies, height) -> Scene` from `base()` (imitate
  `dense_band_scene`, `tests.rs:181`, and mesh construction in `lattice.rs` scan_tests):
  strip boundary `i` in `0..=strips` has points `(x, x + (i - strips/2) * 32 / strips, z)`
  for `x = -128, 128`, `z = 0, 1`; two triangles per strip per broad face; long sides and
  two end quads close it (8,192 strips -> 65,540 triangles). Width 64, given height,
  supersample 2, top view at the origin, `mm_per_pixel` 0.0486, `bodies` coincident bodies
  each a union of its own mesh copy, `analyse = false`, `draw_interference = false`.
- audit case `(8192, 3, 64)`, threads 1 and 5 via `render_with(&s, t, SCAN_ALLOWANCE)` ->
  equal error string (the existing one), `stats.workers` 1 and 2,
  `stats.visited <= PICTURE_TRIANGLE_LIMIT`, `stats.triangles > PICTURE_TRIANGLE_LIMIT`,
  `stats.charged <= SCAN_ALLOWANCE`, empty liveness, `census.rays == 0`.
- five-worker case `(8192, 2, 160)`, threads 1 and 5 -> `stats.workers == 5` at 5, same
  error string at both, `visited <= limit`, `triangles > limit`. If tile admission refuses
  it (work error, zero workers), use 6,144 strips; keep every assertion.
- admitted control `(256, 3, 160)`, threads 1 and 5 -> both Ok; `stats.workers == 5` at 5;
  equal RGB, equal `crate::encode::png::png_rgb8` bytes, equal `report.to_json()`, equal
  `visited`; `0 < visited == triangles <= PICTURE_TRIANGLE_LIMIT`.
- Fail-before: first implement only measurement (`traverse` always true and counts
  `visited`, no limit); run the audit case and record that it is admitted with
  `visited >= 1,610,612,736`. Then add the check and record the pass.

## Verification (exits 0 and runs tests)

1. `rustfmt --edition 2021 crates/capture/src/raster.rs crates/capture/src/raster/budget.rs crates/capture/src/raster/tests.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f2 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car7-f2 cargo test --release -p nodetto-capture`
   - evidence: the three new tests passed; measured fail-before counter recorded; every
     existing raster test (`a_view_zoomed_onto_a_dense_bucket_is_refused_by_the_scan_budget`,
     `boundary_read_counts_and_refusal_are_bounded`, `layers_storage_cap_refuses`), mesh and
     render pins, goldens and `tiles.rs:444` deadline pass. Timing: overview rule 6.

## Done criteria

- `traverse` reserves on the shared atomic before every non-empty mesh traversal; the
  limit constant and stats exist; the command exits 0; progress log `done` with the chosen
  limit and measured `visited`/`triangles`.

## Implementation status

Source and focused regressions implemented at 768,000,000; full release gate remains
incomplete because the tile deadline failed on three aggregate runs and the isolated
comparison. See the plan-local progress log and evidence for exact outcomes.
