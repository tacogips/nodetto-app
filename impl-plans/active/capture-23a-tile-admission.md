# M23a capture-23a-tile-admission (session 885)

- Dispatch `capture-s885`, wave 1, dependsOn none. Parallel sibling:
  M23f (disjoint files). Part of M23 (design 8.5 "M23 split", CAP-R6-01).
- Design wins: `design-docs/specs/design-ai-capture.md` 10.2 ("Picture
  admission and tile storage"), 8.5 acceptance additions (`tiles.rs` units,
  `tests/scale.rs`), CAP-R4-08, CAP-R6-02, CAP-R6-04. Traps and test
  intent: `impl-plans/active/capture-23-wiring.md` (read-only reference).
- Writes (4): this file, `crates/capture/src/tiles.rs`,
  `crates/capture/src/raster.rs`, `crates/capture/tests/scale.rs`.
  Artifact roots: `target/capture-m23a`, `tmp/capture/m23a` (logs).
- Start hash of `raster.rs`: `34480090d85bf0b39552b2ecb686d43da19f17bf`.

## Intent

Refuse oversized scenes before any tile list is allocated, store tile
lists tile-major, and add an all-steps reference renderer so this and
later plans can prove the tiled picture equals the unoptimised one.

## Pre-edit evidence (not a gate)

Before any edit: `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23a cargo test -p nodetto-capture --test scene > tmp/capture/m23a/pre-scene.log 2>&1`
(expect 11 passed). A failure is a pre-existing blocker: record it, stop.
Debug `--test scale` reports 0 passed, 2 ignored (release-only): record
as an observation only. Do not count a pre-edit release scale run.

## Changes

1. `tiles.rs` (imitate `TileLists::build`, its `tiles_for` closure):
   - `pub const ENTRY_LIMIT: u64 = 4_194_304;`
   - `pub struct Admission { pub work: u64, pub entries: u64 }`
   - `pub fn admit(scene: &Scene, rects: &[Option<SampleRect>], samples_x: u32, samples_y: u32, weights: &[u64]) -> Result<Admission, CaptureError>`:
     two 2D difference arrays over tiles (weight sum, entry count), one
     pass over all steps of all bodies using the same tile rule as
     `tiles_for` (intersection covers every tile; empty rect adds
     nothing), one prefix pass; accumulate in `i128`, clamp to `u64::MAX`.
     Refuse with `work_error(work)` when `work > WORK_LIMIT`; otherwise
     refuse when `entries > ENTRY_LIMIT` with a message of the same form
     naming "tile list entries" and the limit 4194304 and "--size". No
     per-body or per-entry allocation inside `admit`.
   - Tile-major storage: replace `BodyTiles` with one `offsets` array of
     `tiles + 1` and entries grouped per tile by body (history order),
     then step order; keep each entry's body, step index and tool. Add
     `pub fn bodies(&self, tile_x: u32, tile_y: u32) -> impl Iterator<Item = (u32, &[u32])>`
     (body index and its listed step indices in that tile). `steps`,
     `build`, `work` keep signatures and results; `steps` searches the
     tile group. Existing M12 unit tests stay unedited.
2. `raster.rs`:
   - In `render_rgb`, call `tiles::admit(scene, &rects, samples_wide, samples_high, &weights)?`
     before `TileLists::build`; weights must be computed from `tools`
     before the build (move that code up, unchanged). Keep the existing
     `work` check after build (it can no longer fail but costs nothing).
     No other production change in this plan.
   - CAP-R6-04 reference path, two `#[cfg(test)]` private functions
     (fixed contract, M23b relies on it):
     `fn render_reference_full(scene: &Scene) -> (Vec<u8>, Report, Vec<census::Liveness>)`
     (the third value is the per-body liveness record passed to
     `census::resolve`) and the thin wrapper
     `fn render_reference(scene: &Scene) -> (Vec<u8>, Report)` returning
     its first two values; the five comparisons call only the wrapper.
     `render_reference_full` runs
     the existing stages single-threaded but folds every body and every
     history step on every sample (no tile selection) and marks liveness
     per sample with `census::Liveness::mark`. Shading, edges, reference
     mix, overlay marks and hatch use the same functions as `bands`; the
     post-picture stages (`census::resolve`, `interference::analyse_scene`,
     `add_view_pairs`) are called exactly as in `render_rgb`. Not `pub`,
     not in `lib.rs`.
   - New `#[cfg(test)] mod tests` with five comparisons, each asserting
     equal RGB and equal `Report` (every `emptied_by_step`) between
     `render_rgb(scene, t)` for t in 1, 2, 5 and `render_reference`.
     Scenes built in the module (no `tests/support` access):
     Plate (`include_bytes!("../tests/fixtures/plate-iso.ncs1")` through
     the existing scene reader), 600-hole plate, 20 x 15 grid, 50 bodies
     with intersects, emptied-and-refilled plate. Plate and the emptied
     plate also run at reduced size without `ignore`; all five at full
     size carry `#[cfg_attr(debug_assertions, ignore = "release only")]`.
3. `tests/scale.rs`: add the entry-limit refusal (65 x 2048, supersample
   1, 70,000 steps covering only the one-sample edge column, about 4.48 M
   entries and 143 M work): error names the tile list entries limit, in
   under 1,000 ms, release only. Existing two tests unedited.

## Tests (input -> expected)

- Seeded random rects and the M12 scenes -> `admit().work == build().work()`, `admit().entries ==` built entry count.
- 20,000 bodies, one union over one full tile, 6,144 x 6,144 samples -> work 20,480,000, entries 20,000, build under 1,000 ms (release).
- 20,000 intersection steps at 2048 x 2048 x 3 -> refused by `admit` (existing test, under 1,000 ms).
- The five reference comparisons -> equal bytes and reports for 1, 2, 5 threads.

## Pitfalls

Do not allocate lists before `admit` succeeds. Do not change the scene
bytes, JSON keys, or `combine`. Do not edit `census.rs`, `lattice.rs`,
`interference.rs`, `tests/support/mod.rs` or any other test file. Do not
make the reference path public. Iteration order must not depend on
thread count.

## Acceptance criteria

- `admit` exists with the signature above, refuses before allocation, and
  matches `work()` exactly; storage is tile-major with `bodies()`.
- The five reference comparisons and the entry-limit refusal pass; the
  M12 tests and both existing scale tests pass unedited.

## Verification (each exit 0, every `cargo test` with a positive pass count)

1. `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23a" sh -c 'cargo fmt -p nodetto-capture -- --check && cargo clippy -p nodetto-capture --all-targets -- -D warnings && cargo test -p nodetto-capture --lib tiles:: && cargo test -p nodetto-capture --lib raster::'`
2. `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23a" sh -c 'cargo test --release -p nodetto-capture --lib tiles:: && cargo test --release -p nodetto-capture --lib raster:: && cargo test --release -p nodetto-capture --test scale -- --nocapture'`

## Progress

Pending. One entry per run: date, command, exit status, complete log
path under `tmp/capture/m23a/`, retries, `git hash-object` of each owned
file before and after. A hash that differs from the last recorded value
is drift: stop and record it. Record the final `raster.rs` hash for M23b.
