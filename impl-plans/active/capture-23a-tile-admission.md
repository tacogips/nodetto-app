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

### 2026-11-23 implementation progress (incomplete)

- Pre-edit scene: 11 passed, exit 0; debug scale: 0 passed, 2 ignored, exit 0. Logs: `tmp/capture-s885/capture-23a-tile-admission/pre-scene.log`, `pre-scale.log`.
- Implemented admission and tile-major groups, seeded equivalence and sparse-body tests, and entry-limit scale test. Reference renderer and five comparison tests remain outstanding.
- Debug and release aggregate commands exited 0 but each raster filter ran zero tests; neither satisfies the positive-count gate. Logs: `tmp/capture-s885/capture-23a-tile-admission/gate-debug.log`, `gate-release.log`. Release tiles: 6 passed; release scale: 3 passed. Work refusal 0.690 ms, entry refusal 0.734 ms, 600-hole plate 5.61 ms.
- Before hashes: plan `a0bb96d5345c78bb8b5bf4bad77ed2e2ee85c82d`; tiles `db968aec25ee58904faff25f1a2cfc502e5703ae`; raster `34480090d85bf0b39552b2ecb686d43da19f17bf`; scale `2387c6e71ed58e3b2e455cf362e281d361ccb26c`.
- Current `crates/capture/src/tiles.rs`: `e9a48fc0a2dd950ccdd1ad75d18d861ee8a84358`.
- Current `crates/capture/src/raster.rs`: `ec4526a0b1933871c48455184264215e4b218289`.
- Current `crates/capture/tests/scale.rs`: `0885b22815f52afc8de4c826c2a53b8ff709f1c5`.
- Per-edit snapshots, intent and hashes are in `tmp/capture-s885/capture-23a-tile-admission/`. No drift observed. Formal review and commit remain downstream.

### 2026-11-23 continuation: implementation complete, review pending

- Added private independent all-steps reference rendering and all five full comparisons, plus reduced Plate and emptied/refilled debug comparisons, for requested thread counts 1, 2 and 5. Liveness is marked per sample; the reference never builds or selects tile lists.
- Tool IDs are stored only for tile entries; added off-frame storage and M12-case admission equivalence regressions. Existing M12 tests and deadlines remain unchanged.
- Debug aggregate exit 0: format and clippy passed, tiles 5 passed and raster 2 passed. Release aggregate exit 0: tiles 8 passed, raster 7 passed, scale 3 passed. Complete logs: `tmp/capture-s885/capture-23a-tile-admission/gate-debug-cont-1.log`, `tmp/capture-s885/capture-23a-tile-admission/gate-release-cont-1.log`. The earlier zero-raster-count logs remain diagnostic only.
- Release timings: work refusal 1.44 ms, entry refusal 1.78 ms, 600-hole plate 9.46 ms. Sparse 20,000-body and existing 20,000-tool timing assertions passed.
- `git diff --check` exit 0: `tmp/capture-s885/capture-23a-tile-admission/diff-check-cont.log`. Per-edit intent, fresh snapshots and before/after hashes are in the same evidence directory.
- Final `crates/capture/src/tiles.rs`: `d717a11147e50fc0578204aa37edd52bd63bc97f`.
- Final `crates/capture/src/raster.rs`: `7ab3ea0d8079426386ffbf386bde5c37a0b1918e`.
- Final `crates/capture/tests/scale.rs`: `0885b22815f52afc8de4c826c2a53b8ff709f1c5`.
- Implementation acceptance criteria are satisfied pending independent integrity, adversarial and integration review; M23b receives the raster hash above. Commit and final acceptance belong to downstream workflow steps.
