# car6-f3-request-scan-budget

- planId: car6-f3-request-scan-budget; wave 1; dependsOn: none
- planPath: impl-plans/active/car6-f3-request-scan-budget.md
- progressPath: impl-plans/progress/car6-f3-request-scan-budget.md
- Finding: performance-interference-mesh-triangle-scans (R6-3, high, recurrence).
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-3, 24.2 timing rule, 24.3, 24.5.
- writePaths: `crates/capture/src/lattice.rs`, `crates/capture/src/interference.rs`,
  `crates/capture/src/census.rs`, `crates/capture/src/tool_view.rs`,
  `crates/capture/tests/interference.rs`, `impl-plans/active/car6-f3-request-scan-budget.md`,
  `impl-plans/progress/car6-f3-request-scan-budget.md`,
  `tmp/car6-r6/car6-f3-request-scan-budget`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`. Cargo target: `target/car6-f3`.

Follow the worker rules in `impl-plans/active/car6-00-overview.md`.

## Intent and context

The round 5 allowance (`lattice.rs:32-44`, `SCAN_ENTRIES_PER_WEIGHTED_RAY`) grows 1,024
entries per weighted ray, so pairs below 1,024 entries per ray never run out (>= 2.0e9
triangle visits in one capture). Add a request-wide absolute ceiling on mesh
triangle-bin entries, split into fixed phase allowances, beside the per-ray allowance.

Non-goals: no change to `mesh.rs`, `prism.rs`, `raster*`, `lib.rs`, `report.rs`, report
JSON, goldens; no coarse-coverage or witness work (car6-f2a); prism edge visits are NOT
charged against the new ceiling.

## Changes

`tool_view.rs`:
- `pub(crate) fn triangle_cost(&self, ray: &Ray) -> usize`: `Self::Mesh(v) => v.scan_cost(ray)`,
  `Self::Prism(_) => 0` (imitate `scan_cost`, `:67-72`).
- `#[cfg(test)]` thread-local `TRIANGLE_VISITS` with `pub(crate) fn reset_triangle_visits()`
  and `pub(crate) fn triangle_visits() -> u64`; `intervals` adds `triangle_cost(ray)` under
  `cfg(test)` next to the round 5 `SCAN_VISITS` line.

`lattice.rs`:
- `pub(crate) const REQUEST_TRIANGLE_ENTRIES_PER_BUDGET_RAY: u64 = 32;` and a helper
  `pub(crate) fn request_triangles(budget_rays: u64) -> u64` (saturating `32 * B`).
- `BoundaryBudget` gains `triangles: u64`, `triangle_limit: u64` (`new` sets `u64::MAX`).
  `charge_scan(&mut self, count: usize, triangles: usize) -> bool`: fail (set `exhausted`,
  return false) if the combined total exceeds today's per-ray allowance OR the triangle
  total exceeds `triangle_limit`; else add both.
- Both casts (`AxisFold::cast` `:273`, census closure `:753`) pass
  `view.scan_cost(&ray), view.triangle_cost(&ray)`.
- `sample_axes(.., triangle_limit: u64)` sets it on its one budget; `sample_pair` gains the
  same parameter. `sample_axis` passes `u64::MAX`.
- `sample_body_axis_with(.., triangles_left: &mut u64, solid)`: budget limit
  `*triangles_left`; on return subtract the budget's `triangles`. `sample_body_axis`
  passes a local `u64::MAX`. Update the round 5 `scan_tests` calls to pass `u64::MAX`.

`interference.rs`:
- `analyse_scene_with`: compute `shares: Vec<u64>` for `candidates[..checked]` BEFORE the
  serial path and `thread::scope` (`:333-365`): `allocate(request_triangles(budget) / 2,
  pair.work(cell), work)`. `cast_pairs` reads the share by index (pass index or zip a
  slice chunk with the same `chunks`), never computes it in a worker.
- `sample(..)` gains `triangle_limit: u64`; `PairSample` gains `triangles: u64`.
  `analyse_pair` passes `u64::MAX`.
- `add_view_pairs_with`: sequential counter `left = request_triangles(B) / 8` with
  `B = budget_million_rays * 1e6` (24,000,000 when not analysed); each sample gets
  `left` and `left -= sample.triangles`; samples run even when `left == 0`.

`census.rs`:
- `resolve_with`: `triangles_left = request_triangles(budget_rays) / 4`;
  `resolve_hidden`: `/ 8`. Thread one `&mut u64` through `sample_body` into every
  `sample_body_axis_with` call of that phase. Never reset per body. Exhaustion paths are
  unchanged (visible `unknown`, hidden no attribution).

Pitfalls: keep charging immediately before `intervals`; never charge prisms against
`triangle_limit`; shares must not depend on thread count or chunking; no new exhaustion
path (reuse `exhausted`).

## Tests (write first; record failures; pin prism control before any production edit)

`lattice.rs` `scan_tests` (test thread, `B = 1,000,000`, `R = request_triangles(B)`):
- Step 1, prism-only control (pin first on the unmodified tree): two coincident prism
  bodies, 32 disjoint 2 mm-wide rectangular loops on a 4 mm X pitch, 128 mm Y/Z spans,
  `target_cell = 0.25`; `analyse_scene_with(&scene, 1, &solid)` -> record pair `min`,
  `max`, `capped` literals and `scan_visits()`. After: same literals, `scan_visits() >
  64 * B / 2`, `triangle_visits() == 0`.
- Four phases on one scene, triangle counter read after each:
  1. visible census `resolve_with` (all liveness false): finisher `E` (union plate stack +
     difference by coincident stack, small lattice; settles `empty`,
     `emptied_by_step == 1`) then never-settling `N` (same shape, large lattice, needs
     > `64 * B / 4` alone). Measure `e` with `E` as the only suspect; assert
     `A/4 <= e <= A/2` (`A = R/4`) and `E` uses < half the ray budget. Combined: total
     <= A, total > e, `E` empty/1, `N` unknown/-1.
  2. `analyse_scene_with(&scene, 1, &solid)` over four coincident meshes (< 512 triangles
     each) -> <= R/2, >= 1 capped pair, every capped pair a capped report or in
     `capped_without_hit`.
  3. `add_view_pairs_with` with >= 2 `ViewPair`s, each needing > `64 * B / 8` -> <= R/8;
     every added record `from_view && capped`.
  4. hidden `resolve_hidden`: finisher `HE` (tool `t1` matching visible `V1`) then
     never-settling `HN` (tool `t2` matching `V2`); `e` window as above with `A = R/8` ->
     total <= A and > e; `V1` attributed, `V2` `None`.
  Sum of the four <= R. Each fails before the change.
- `tests/interference.rs`: four-body scene via `render_parsed` at 1 and 5 threads ->
  identical report JSON and image bytes; `cappedCount >= 1`.
- Unchanged: `admitted_cube_mesh_pin`, `dense_and_admitted_pairs_are_deterministic`,
  round 5 `scan_tests`, goldens.

Value rule: implement 32; if an existing pin, golden or assertion changes, set 64 once and
rerun; if still changed, stop `blocked`. Record the chosen value and counts.

## Verification (each exits 0 and runs tests)

1. `rustfmt --edition 2021 crates/capture/src/lattice.rs crates/capture/src/interference.rs crates/capture/src/census.rs crates/capture/src/tool_view.rs crates/capture/tests/interference.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car6-f3 cargo test --release -p nodetto-capture`
   - evidence: prism pin recorded before; new tests fail before and pass after; full crate
     suite green. Timing failures follow overview rule 6 with
     `CARGO_TARGET_DIR=target/car6-f3`.

## Done criteria

- Ceiling, shares, phase counters and census threading in place; all listed tests pass;
  constant value and counts recorded; progress log `done`.

## Implementation status

Implementation complete with a verification sequencing gap: the visible, hidden and view
regressions were not executed before production edits; post-change mutation controls
show each ceiling independently. R = 32 x B and all four allowances are implemented; the prism pin,
four-phase measurements, deterministic render, clippy and 197-test release gate passed.
See `impl-plans/progress/car6-f3-request-scan-budget.md` for measurements,
source identities, negative controls and complete logs. Formal reviews remain downstream.
