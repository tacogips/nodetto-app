# M12 capture-12-scale-budget (revision 4: tile list units)

- Stage: wave 2. dependsOn: M10 (`tool_view` with `average_occupancy`,
  empty `tiles.rs`).
- Design: sections 10.1 (606-tool row), 10.2 (work limit), 11, 12, 8.5.
- writePaths: `crates/capture/src/tiles.rs`,
  `impl-plans/active/capture-12-scale-budget.md`, `tmp/capture/m12`, `target`
- Pre-authorised: none.

## Intent

Per-tile step lists so a picture ray visits only steps whose tools cover
its tile, and the work estimate that refuses pathological scenes before
rendering. M23 uses both in the picture pass and runs the render-level and
native budget tests.

## Non-goals

No edit of `raster.rs`, `lib.rs`, `tool_view.rs`, tests under
`crates/capture/tests/`, the CLI or any TypeScript. No render here.

## Contract

```rust
// tiles.rs
pub const TILE: u32 = 32;                         // samples per tile side
pub const WORK_LIMIT: u64 = 4_000_000_000;
#[derive(Clone, Copy)] pub struct SampleRect { pub x0: u32, pub y0: u32, pub x1: u32, pub y1: u32 } // inclusive-exclusive
pub struct TileLists { /* per body: offsets and step indices, in step order */ }
impl TileLists {
  /// `rects[tool]` is None when the tool projects outside the picture.
  pub fn build(scene: &Scene, rects: &[Option<SampleRect>], samples_x: u32, samples_y: u32) -> TileLists;
  pub fn steps(&self, body: u32, tile_x: u32, tile_y: u32) -> &[u32];
  /// Sum over tiles of samples in the tile times the summed weights of its listed steps.
  pub fn work(&self, weights: &[u64]) -> u64;   // one weight per tool, saturating
}
pub fn tool_weight(average_occupancy: f64) -> u64;   // ceil, at least 1
pub fn work_error(work: u64) -> CaptureError;        // the message below
```

## Behaviour

- A tool's rectangle (computed by M23 from projected vertices, grown by
  one sample) lists the step in every tile it touches. An intersection
  step is listed in every tile of the picture. A body whose union steps
  touch no tile has an empty list there.
- Storage: one `Vec<u32>` of step indices and one offset table per body,
  built once per picture; read-only afterwards; listings bounded by
  `steps * tiles`.
- `work_error`: `The scene is too heavy for this picture size (work <n>,
  limit 4000000000). Use a smaller --size.`
- Saturating arithmetic everywhere; no overflow panic.

## Pitfalls

- Partial edge tiles: count their real sample count, not `TILE * TILE`.
- Keep step order inside each list (the fold depends on it).
- A difference step outside its tool's rectangle may be skipped (its tool
  interval is empty); an intersection step never.

## Tests (`#[cfg(test)]` in `tiles.rs`, scenes built in code)

- Two box tools in opposite corners of a 128 x 96 sample picture -> each
  listed only in its tiles; a union body absent from a tile -> empty list.
- Intersection step -> listed in every tile.
- Step order preserved for a body with union, difference, union.
- `work`: hand-computed value for a 3 x 2 tile picture with weights 1 and 5,
  including partial edge tiles.
- 20,000 overlapping one-bucket tools on a 2048 x 2048 sample picture ->
  `work > WORK_LIMIT`; `work_error` text exact; build time under 1,000 ms
  (release only, printed).
- `tool_weight(0.2) == 1`, `tool_weight(3.1) == 4`; saturation at `u64::MAX`.
- A `PrismView` of a loop with 20,000 long zig-zag edges at 2048 x 2048 has
  `tool_weight` far above 1 and its single-tool `work` exceeds the limit.

## Acceptance criteria

- Lists and work estimate match the contract; estimate refuses the two
  pathological scenes; unit tests pass.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/tiles.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m12 cargo clippy -p nodetto-capture --all-targets -- -D warnings'`
2. `sh -c 'mkdir -p tmp/capture/m12 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m12 cargo test -p nodetto-capture --lib -- tiles:: > tmp/capture/m12/unit.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m12/unit.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m12/unit.txt'`
3. `sh -c 'CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m12 cargo test --release -p nodetto-capture --lib -- tiles:: --include-ignored --nocapture > tmp/capture/m12/release.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m12/release.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m12/release.txt'`

## Progress

Pending (revision 4).
