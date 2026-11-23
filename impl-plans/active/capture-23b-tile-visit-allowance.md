# M23b capture-23b-tile-visit-allowance (session 885)

- Dispatch `capture-s885`, wave 2, dependsOn `capture-23a-tile-admission`
  (tile-major layout, `TileLists::bodies`, the reference path, `raster.rs`
  handover).
- Design wins: 10.2 ("A sample visits only the bodies listed", "Liveness
  spans", "Picture boundary scans"), 8.5 acceptance additions (`raster.rs`
  unit tests, off-tile liveness suffix, CAP-R4-10 census), CAP-R4-10,
  CAP-R6-04, CAP-R6-05.
- Writes (4): this file, `crates/capture/src/raster.rs`,
  `crates/capture/tests/scale.rs`, `crates/capture/tests/census.rs`.
  Artifact roots: `target/capture-m23b`, `tmp/capture/m23b`.
- Start hash of `raster.rs`: the final hash in M23a's Progress.

## Intent

Make per-sample cost follow the listed entries and bound the quadratic
boundary scans, deterministically for every worker count.

## Changes (`raster.rs` only for production)

1. Per-tile visit (design 10.2: clearing, folding and overlay collection
   grow with listed entries, never with the body count): in
   `Raster::sample` replace the loop over all `scene.bodies` (current
   `raster.rs:117-170`) with `self.tiles.bodies(tile[0], tile[1])`, and
   record the visited body indices in a reused scratch `Vec<u32>` in
   `RayScratch`, ascending body order (the order `bodies` yields). The
   per-sample clearing of `body_intervals` and the overlay collection
   under `draw_interference` (today
   `scratch.body_intervals.iter().enumerate().filter(..)`) iterate only
   that list, never all of `body_intervals` or `scene.bodies`.
   `body_intervals` may stay sized to the body count (allocated once).
   Open-source bodies: the first tool is listed only if its rect covers
   the tile; behaviour unchanged (surface, translucent).
2. Liveness: keep the per-step maximum record (`live[start] = max(end)`),
   O(1) per listed step; the post-join sweep (`raster.rs:527-543`) stays
   one pass per body. Confirm no per-sample loop over a span.
3. Scan allowance: `const CHUNK: u64 = 1_048_576;`
   `const SCAN_ALLOWANCE: u64 = 16_000_000_000;`. Before each `combine`
   in the fold add `c = current.len() + tool.len()` to a worker-local
   pending count; when pending reaches `CHUNK`, add it to a shared
   `AtomicU64` and reset, before that combine runs; if the total exceeds
   the allowance, skip the combine, set a shared stop flag, return. Read
   the flag at every flush; flush the remainder at band end. Refusal:
   exit-2 `CaptureError` with exactly `The scene is too heavy for this picture size (picture boundary scans over 16000000000). Use a smaller --size.`
   (a test allowance prints its own value).
4. Internal entry (crate-private), exact contract:
   `fn render_with(scene: &Scene, threads: usize, allowance: u64) -> (Result<(Vec<u8>, Report), CaptureError>, RenderStats)`
   with `struct RenderStats { reads: u64, workers: usize, liveness: Vec<census::Liveness>, census: census::CensusStats }`.
   Stats are returned on both outcomes: on success all four fields are
   filled (`census` is the value `census::resolve` already returns); on a
   refusal or any error, `reads` and `workers` hold the executed reads and
   started workers (0 and 0 if refused before workers start), `liveness`
   is empty and `census` is `CensusStats::default()` (it derives
   `Default`, `census.rs:43`; no `census.rs` edit). `render_rgb` calls
   `render_with(scene, threads, SCAN_ALLOWANCE)`, returns the `Result`
   and drops the stats; `render_scene` is unchanged (it calls
   `render_rgb`). Nothing is added to `Report`, `lib.rs`, the public API
   or the scene format. The stats fields are read only by
   tests, so put `#[cfg_attr(not(test), allow(dead_code))]` on
   `RenderStats`; otherwise clippy `-D warnings` fails the gate.

## Tests

`raster.rs` private tests (imitate the M23a test module):
- Seeded random span sets -> merged maxima materialized equal `Liveness` built by `mark` per span.
- N disjoint-depth unions covering every sample -> reads == S*N*(N-1) + S*2N, S = width*(height + bands - 1) at supersample 1, for 1, 2, 5 threads.
- 2,000 disjoint unions, 64 x 320, allowance 10,000,000 -> refused with the fixed message for 1, 2, 5 threads; `workers` == 1, 2, 5; `reads <= allowance + workers*CHUNK` (<= 15,242,880 for 5).
- 50 disjoint unions, same layout, allowance 100,000,000 -> equal buffers and reports, reads == 53,692,800 for 1, 2, 5.
- CAP-R6-05: 64 x 64 history (one visible prism, then off-view differences; 2,000 steps in debug, 20,000 release) and its intersection-ending variant -> `stats.liveness` equal for 1, 2, 5 threads and equal to the third value of M23a's `render_reference_full(scene)` (the five comparisons keep calling `render_reference`, unedited).
- Zero census rays, observable only here (`stats.census.rays == 0`): the off-view history above, a sound Plate, an open-source mesh outside the picture.
- The five M23a reference comparisons rerun unedited.
`tests/scale.rs`: off-tile liveness suffix, 1024 x 768 x 2, one covering
prism then 200,000 differences reusing an off-view prism -> `drawn`,
`emptied_by_step` -1, under 5,000 ms printed (release only).
`tests/census.rs`: the 64 x 64 history with 20,000 off-view differences
-> equal RGB and reports for 1, 2, 5 threads; the intersection variant
reports that last step in `emptied_by_step`. Helpers stay private in the
file.

## Pitfalls

No check only at row end. No partial counts in refusal text. Keep the
visited-body list in ascending body index order, as today, so overlay
pairs and bytes do not change (the M23a reference comparisons and the
M23c overlay tests guard this). Do not edit M23a's comparison tests or
the reference functions' signatures. Do not
count reads that never run; charge before the call. Do not change
`interval.rs::combine`, `census.rs`, `tiles.rs` or `tests/support/mod.rs`.
Liveness must stay in the existing `Liveness` shape.

## Acceptance criteria

- Per-tile visit, allowance, internal entry and every listed test pass;
  the fixed message is exact; reports and bytes equal for 1, 2, 5 workers.

## Verification (each exit 0, every `cargo test` positive)

1. `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23b" sh -c 'cargo fmt -p nodetto-capture -- --check && cargo clippy -p nodetto-capture --all-targets -- -D warnings && cargo test -p nodetto-capture --lib raster:: && cargo test -p nodetto-capture --test census && cargo test -p nodetto-capture --test mesh && cargo test -p nodetto-capture --test overlay && cargo test -p nodetto-capture --test interference'`
2. `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23b" sh -c 'cargo test --release -p nodetto-capture --lib raster:: && cargo test --release -p nodetto-capture --test scale -- --nocapture && cargo test --release -p nodetto-capture --test census && cargo test --release -p nodetto-capture --test mesh'`

## Progress

Pending. Same protocol as M23a (hashes before and after, logs under
`tmp/capture/m23b/`, drift stops the run). Timing tests: up to 3
attempts, then alone. Record the final `raster.rs` hash.
