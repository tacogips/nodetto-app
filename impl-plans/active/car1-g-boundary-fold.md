# car1-g-boundary-fold: bounded boundary reads in lattice folds (F5)

- planId: car1-g-boundary-fold. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F5 and 6.6 step 1.
- Progress log: `impl-plans/progress/car1-g-boundary-fold.md`.

## Intent

Every lattice fold charges the length of its accumulated boundary list
before each `combine`, against a deterministic per-request allowance.
Exhaustion is reported as incomplete analysis:
- a capped pair;
- a capped view fallback;
- an `unknown` census body.

Admitted results are unchanged.

## Non-goals

- Do not edit `census.rs`, `raster.rs`, `overlay.rs` or `mesh.rs`.
- Do not change candidate discovery; that is plan i.
- Do not change refinement allowances or the picture-boundary allowance.

## Changes

1. `crates/capture/src/lattice.rs`:
   - Add `const BOUNDARY_READS_PER_WEIGHTED_RAY: u64 = 64;` and a slack of
     16 rays.
   - Per lattice request, keep `reads` and `rays`, where `rays` counts the
     rays cast so far including the current one.
   - `w = max(1, ceil(s / 8))`:
     - for a pair request, `s` = the active steps that `sample_axes`
       collects for both bodies;
     - for a census request, `s` = the body's step count.
   - Before each `combine`, in the pair cast (around `:221`) and in
     `sample_body_axis` (around `:620`), take `charge = current.len()`.
     If `reads + charge > 64 * w * (rays + 16)`:
     - skip the combine;
     - count the ray as a miss;
     - cast no further ray in this request;
     - set `AxisSample.capped = true` and a new field
       `AxisSample.boundary_exhausted = true`.
   - Otherwise add `charge` to `reads`.
   - In `sample_body_axis`, on exhaustion also set `*budget_left = 0`.
     The existing `census::resolve` then marks the body `unknown` and
     spends its allotment.
   - Add an internal stats readback for tests: total `reads` per request,
     exposed through an existing `#[cfg(test)]` field or a `#[doc(hidden)]`
     accessor.
2. `crates/capture/src/interference.rs`:
   - `PairSample` gains `boundary_exhausted: bool`, the OR over axes.
   - A report built from a sample with `boundary_exhausted` is `capped`.
   - In `add_view_pairs`, the fallback report uses
     `capped: index >= VIEW_PAIR_SAMPLES || sample.boundary_exhausted`.
     Keep the sample instead of discarding all but `.report`.
   - Expose the summed reads through the existing test-only `rays` style
     field.

## Pitfalls

- The charge is `|accumulated|` only. Do not charge the tool's own
  intervals.
- Do not use the candidate `weight` for `w` (it is 1 for view pairs).
- The decision must depend only on the request's own cast order, which is
  fixed: axis, then row, then cell. No shared atomics.
- Admitted cases must not change. Refinement `capped` and view-fallback
  output stay identical when `boundary_exhausted` is false.

## Tests (new `crates/capture/tests/boundary_fold.rs`, plus in-crate tests)

- 1,000 separated internal cuts over a 20 x 20 mm footprint, a second
  overlapping body and a side-view camera: reads stay at most
  `64 * w * (rays + 16)` per request, the pair is capped, and the report
  is approximate. Before the fix, reads exceed the bound by orders of
  magnitude; record the pre-fix count.
- The same bodies forced into the view-pair path with no hit before
  exhaustion: the fallback is `capped`.
- Two suspect census bodies that both exhaust: both `unknown`.
- Admitted: the plate fixture, the 600-hole pair, the 200-body shared-loop
  case and the existing view-pair test give identical reports and image
  bytes at 1 and 8 threads, and equal the existing digests.
- The pre-fix run records the maximum reads/allowance ratio over the
  existing `crates/capture/tests/{interference,census,render}.rs`. It must
  be below 1; otherwise stop and report.

## Verification

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-g cargo fmt -p nodetto-capture -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-g cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-g cargo test -p nodetto-capture`
   must exit 0.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-g cargo test -p nodetto-capture --release --test boundary_fold --test interference --test census`
   must exit 0. Release-only timing tests may be retried up to three
   times.

## Done when

- Reads are bounded and counted.
- Every capped exit is reported as defined.
- Admitted digests and thread parity are unchanged.
