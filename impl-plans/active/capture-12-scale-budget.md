# M12 capture-12-scale-budget

- dependsOn: M11 (all tool kinds, the marking pass and the occupancy
  figures of `PrismView` and `MeshView` that the lists and the estimate
  must cover)
- Design: sections 10.1 (606-tool row), 10.2 (work limit), 11, 12
- writePaths: `crates/capture/src/tiles.rs` (new),
  `crates/capture/src/raster.rs`, `crates/capture/src/lib.rs`,
  `crates/capture/tests/scale.rs` (new),
  `apps/cli/src/native-parity/capture.test.ts`
- Pre-authorised: none. The pixel digest committed in
  `crates/capture/tests/render.rs` must not change: this milestone is an
  optimisation with equal output.

## Contract

```rust
// tiles.rs
pub const TILE: u32 = 32;                         // samples per tile side
pub struct TileLists { /* per body and tile: indices of the steps to evaluate, in step order */ }
impl TileLists {
  pub fn build(scene: &Scene, rects: &[SampleRect]) -> TileLists;   // one rect per tool
  pub fn steps(&self, body: u32, tile_x: u32, tile_y: u32) -> &[u32];
  /// Sum over tiles of samples in the tile times the summed weights of its listed steps.
  pub fn work(&self, weights: &[u64]) -> u64;                       // one weight per tool
}
pub const WORK_LIMIT: u64 = 4_000_000_000;
```

## Behavior

- A tool's sample rectangle is the bounding rectangle of its projected
  vertices, grown by one sample. A step is listed in every tile its
  tool's rectangle touches. An intersection step is listed in every tile
  of the picture, because a ray outside its tool empties the body. A body
  whose union steps touch no tile has an empty list there, and its later
  steps are not evaluated for that tile.
- The sample loop of `raster.rs` iterates `steps(body, tile)` instead of
  all steps. The result is the same boundary list as before for every
  sample (a skipped step had an empty tool interval and was a union or a
  difference). Body flags and the marking pass are unchanged in meaning:
  a sample compares two bodies only when both have material on its ray.
  Per-step liveness (M18) keeps its meaning without visiting unlisted
  steps: a step that is not listed leaves the interval list as it was,
  so material after listed step `j` holds up to the next listed step
  `k`; each sample records `reach[j] = max(reach[j], k)` and one pass
  over the steps at the end turns the ranges into `alive_after`.
- Storage: one `Vec<u32>` of step indices and one offset table per body;
  built once per picture on the calling thread; read-only afterwards.
- Work limit (design 10.2): a tool's weight is its view's average
  occupancy rounded up (entries per non-empty edge bucket or mesh cell,
  at least 1). `render_rgb` fails with `The scene is too heavy for this
  picture size (work <n>, limit 4000000000). Use a smaller --size.` when
  `work()` exceeds `WORK_LIMIT`, before any sample is evaluated. The CLI
  prints it with exit 2.

## Tests

- `tests/scale.rs`:
  - equality: for the Plate fixture and for three generated scenes (a
    grid of 20 x 15 plates each with 4 holes; one plate with 600 holes;
    50 bodies with intersect steps; a plate emptied by a cut and
    refilled by an add), the buffer and the report, including every
    `emptied_by_step`, with tile lists equal those of a reference path
    that evaluates all steps (kept in the test support module, not in
    the library);
  - the committed digest in `tests/render.rs` is unchanged (that test
    runs in the same command);
  - occupancy: a tool whose single loop has 20,000 long zig-zag edges at
    2048 x 2048 gives a weight far above 1 and an estimate above the
    limit, and the render is refused in under 1,000 ms; 20,000
    overlapping one-edge-bucket tools at 2048 x 2048 are refused as well;
  - `work()` of the fixture is printed for the record;
  - release only: the 600-hole plate renders on one thread in under
    1,500 ms (the spike needed 2,177 ms without lists), printed to
    `tmp/capture/m12/scale.txt`.
- `native-parity/capture.test.ts` (native binary):
  - a generated CAD document of 1,000 elements in 50 bodies placed on a
    grid (built in the test with the core test helpers; the bodies do not
    overlap) captures in under 10,000 ms wall time; measured three times,
    values in `tmp/capture/m12/timing.json`;
  - the same document with the bodies stacked on one place (1,225
    candidate pairs) captures in under 10,000 ms, prints that all 1,225
    candidate pairs were checked and the cell that was used, and lists
    the interfering pairs;
  - the M9 budget test of the reference page still passes (same file).

## Acceptance criteria

- Render cost follows the tools that cover a region, not the feature
  count of the page.
- No scene can make the renderer run unbounded or allocate unbounded
  tables: the work limit, which counts edge and triangle occupancy,
  answers before rendering.
- The budgets of design section 10.2 hold with recorded measurements.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m12 && CARGO_TERM_QUIET=true cargo test --release -p nodetto-capture --test scale --test render -- --nocapture > tmp/capture/m12/scale.txt 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m12/scale.txt'`
3. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`

## Progress

Pending.
