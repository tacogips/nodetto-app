# car2-c1-sweep: axis-sweep interference candidate discovery (R2-6)

- planId: car2-c1-sweep
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-6 and
  section 19.1 F13.
- Progress log: `impl-plans/progress/car2-c1-sweep.md`

## Intent

Today `collect_candidates` (`crates/capture/src/interference.rs:34-84`)
compares every pair of analysed boxes. Replace that with a single-axis
sweep. The output must stay identical: the same totals, kept candidates in
`(a, b)` body order, weights, checked prefixes and unchecked lists.

## Non-goals

- Do not change the eligibility filter (`interference.rs:40-55`, including
  `is_solid`). Plan c2 changes it.
- Do not change `plan`, `Candidate`, `analyse_scene` or any lattice code.
- Do not edit `mesh.rs`, `tool_view.rs`, `raster.rs`, `lattice.rs` or
  `census.rs`.

## Changes (`crates/capture/src/interference.rs`)

1. After the existing `analysed` vector is built:
   - Axis choice. For each axis `k`, count the pairs that overlap under the
     relaxed test `a.max[k] >= b.min[k] && b.max[k] >= a.min[k]`, in
     O(n log n). Sort the starts and the ends, and use binary search. Pick
     the axis with the smallest count; ties go to X, then Y, then Z.
   - Sweep. Sort the indices into `analysed` by `min[k]`, with ties broken
     by body index. Keep an active list. For each box, drop the active
     entries whose `max[k] < box.min[k]`, then compare the box with every
     remaining active entry.
   - Each compared pair `(a, b)`, ordered so that `a < b` in body index,
     gets the existing exact three-axis tolerance test (`:60-64`). If it
     passes, `total += 1` and the pair is offered to a
     `BinaryHeap<(u32, u32)>` max-heap capped at `keep`.
2. After the sweep, sort the heap contents ascending. Then, for each kept
   pair, compute `min`, `max`, `steps` and `weight` exactly as the current
   code does (`:60-79`), and push the `Candidate`.
3. Add a doc-hidden test entry:

       #[doc(hidden)] pub fn candidate_comparisons(scene: &Scene, boxes: &[Bounds], keep: usize) -> (Vec<Candidate>, u64, u64)

   It returns `(candidates, total, compared_pairs)`. Production
   `collect_candidates` shares the implementation, and the comparison
   count is computed without measurable cost.

## Pitfalls

- With `keep == 0`, nothing is stored, but `total` must still be exact.
- The relaxed axis test must be a superset of the exact test on that axis.
  Never drop a pair that the exact test would accept, including pairs at
  the tolerance boundary.
- The order is body-pair order `(a, b)` with `a < b`, not sweep order.
- Do not compute steps for pairs that are not kept.

## Tests (`crates/capture/tests/interference.rs`)

- Keep the pre-fix all-pairs loop inside the test as
  `exhaustive_candidates`, a verbatim copy.
- Separated X row: n = 500 and n = 1,000 unit boxes spaced 2 mm along X
  give `compared_pairs <= n` and `total == 0`. Fails before: the count is
  n(n-1)/2.
- Separated Y row: the same, along Y.
- Sparse grid: k x k and then 2k x k boxes (k = 20), spaced 2 mm, give
  `compared(2n) <= 3 * compared(n)`. Fails before: about 4x.
- Equality with `exhaustive_candidates` for `keep` in {0, 1, 3, all} on:
  - a small dense cluster (12 overlapping boxes);
  - a mixed layout;
  - tolerance-boundary pairs, with overlaps exactly at, just below and
    just above `scene.tolerance` on each axis.

  Equality covers the vector of `(a, b, min, max, weight)` and `total`.
- `analyse_scene` checked prefix and unchecked list: the existing tests
  (including the 2,000-body test at `:457-476`) pass unedited.

## Verification

- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c1-sweep cargo test -p nodetto-capture`
  must exit 0. This includes `tests/interference.rs`, `boundary_fold.rs`
  and `census.rs`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-c1-sweep cargo clippy -p nodetto-capture --all-targets`
  must show no new warnings in `interference.rs`.
- `rustfmt --edition 2021 crates/capture/src/interference.rs crates/capture/tests/interference.rs`

## Done when

- The tests pass, and only `collect_candidates`, its helpers and the new
  test entry changed in `interference.rs`.
- The progress log reads `done`.
