# car1-i-pairs-classification: sweep candidate discovery and one tool classification per render (F13, F16)

- planId: car1-i-pairs-classification. Wave 2. dependsOn:
  car1-g-boundary-fold, car1-h-overlay-alloc (shared `interference.rs`,
  `lattice.rs`, `raster.rs`). Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F13 and F16, 6.6
  step 1 and 6.7.
- Progress log: `impl-plans/progress/car1-i-pairs-classification.md`.

## Intent

- F13: interference candidates come from an axis-selected sweep, not from
  testing every pair, with output identical to exhaustive enumeration.
- F16: tools are classified (solid or not) once per render, and the
  picture and candidate selection share the result.

## Non-goals

- Do not edit `census.rs`, `scene.rs`, `tool_view.rs`, `nmesh.rs` or
  `overlay.rs`.
- `lattice::sample_body_axis` (the census path) keeps its own per-call
  `is_solid` filter: `census.rs` is out of scope. Record this as a known
  residual; the design's shared classification covers the picture and
  candidates.

## Changes

1. `crates/capture/src/interference.rs`:
   - `collect_candidates` takes `solid: &[bool]`, one entry per tool,
     instead of calling `tool_view::is_solid`.
   - Public `candidates(scene, boxes, keep)` and `analyse_pair` compute
     `solid` themselves (standalone path).
   - `analyse_scene` and `add_view_pairs` take `solid: &[bool]` from the
     caller.
   - Sweep algorithm:
     1. Filter the analysed, valid, solid-source boxes.
     2. For each axis, sort by min and count overlapping pairs in
        O(n log n); choose the axis with the fewest (ties go to X, then
        Y).
     3. Sweep that axis with an active list. Apply the exact three-axis
        `max - min <= tolerance` test to every examined pair.
     4. Push each passing `(a, b)` with `a < b` (history indices) into a
        bounded selection of the `keep` smallest pairs (a max-heap),
        counting `total`.
     5. Compute `steps` (active steps) only for the kept pairs.
     6. Return the kept pairs sorted by `(a, b)`.
   - Add a test-visible comparison counter
     (`#[doc(hidden)] pub fn candidates_with_stats`).
2. `crates/capture/src/raster.rs` (setup near `:477-534` and the analysis
   calls near `:682`):
   - Compute `solid_tools` once.
   - Pass it to `interference::analyse_scene` and `add_view_pairs`.
   - Leave the overlay hunk (plan h) alone.
3. `crates/capture/src/mesh.rs`: add a thread-local closure-check counter
   incremented by `is_closed`, read through
   `#[doc(hidden)] pub fn closure_checks() -> u64`. No behaviour change.
4. `crates/capture/src/lattice.rs`: only if a signature must carry
   `solid` into pair sampling. Otherwise leave it untouched; it must not
   reclassify in the pair path.

## Pitfalls

- The output order and `total` must equal the old nested loop exactly,
  including the `keep` prefix used for checked and unchecked reporting.
- The tolerance test is strict (`<=` skips).
- Bodies with invalid bounds or a non-solid first tool are excluded
  before the sweep, as today.

## Tests

- `crates/capture/tests/interference.rs`:
  - Disjoint assemblies of 1,000, 2,000 and 4,000 bodies, each along X,
    along Y and in a 2D grid. Comparisons stay below `n*n/16` and grow
    by at most 2.5x per doubling. Before the fix there are `n(n-1)/2`.
  - Small mixed and dense assemblies (including coincident and touching
    boxes, and `keep` smaller than total): ordered candidates, the checked
    prefix and `total` equal an exhaustive reference helper.
  - The 2,000-body `candidate_table_bounds_and_unchecked_order` keeps its
    assertions.
- `crates/capture/tests/mesh.rs`:
  - Two overlapping analysed bodies. Case 1: a solid prism source, then a
    open-mesh union operand. Case 2: an open-mesh source, then a solid
    operand. The candidate counts and report states follow section 6.7.
  - An analysed render with one thread and one mesh tool (no census
    subject) leaves `closure_checks()` increased by exactly the number of
    mesh tools. Before the fix it is twice that.
- The existing mesh, census and overlay tests and image digests pass.

## Verification

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-i cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-i cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-i cargo test -p nodetto-capture`
   must exit 0.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-i cargo test -p nodetto-capture --release --test interference --test mesh`
   must exit 0. Timing tests may be retried up to three times.

## Done when

- Comparison counts are subquadratic.
- The output equals exhaustive enumeration.
- There is one closure check per mesh tool per render.
- All digests are unchanged.
