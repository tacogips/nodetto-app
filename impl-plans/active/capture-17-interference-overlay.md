# M17 capture-17-interference-overlay (revision 4: overlay units)

- Stage: wave 2. dependsOn: M10 (shared `tool_view`, total lattice
  functions, `analyse_pair`, the empty `overlay.rs` module).
- Design: sections 6.5 (theme), 6.6 (Picture and hatch), 7, 8.5.
- writePaths: `crates/capture/src/overlay.rs`,
  `crates/capture/src/interference.rs`,
  `impl-plans/active/capture-17-interference-overlay.md`, `tmp/capture/m17`, `target`
- Pre-authorised: none. No pixel digest changes (the picture pass is not
  touched; M23 wires these units).

## Intent

Everything the picture needs for interference marking, as tested units:
which pairs mark a sample, the box of their marked stretches, the 4,096
picture-only limit, the hatch colour, and analysing picture-only pairs so
that no stripe exists without a text line.

## Non-goals

No edit of `raster.rs`, `shade.rs`, `lib.rs`, `report.rs`, `lattice.rs`,
tests under `crates/capture/tests/`, or any TypeScript. No render-level
tests (M23 owns `tests/overlay.rs`).

## Contract (all `pub`, so no dead-code warnings before M23)

```rust
// overlay.rs
pub const NEAREST_BODIES: usize = 8;
pub const VIEW_PAIR_LIMIT: usize = 4096;
pub struct SampleBody<'a> { pub body: u32, pub intervals: &'a [Boundary] }
/// Pairs (a < b) among the eight bodies whose first boundary is nearest (ties by body index)
/// that overlap by more than `tolerance`; pushes (a, b, s_start, s_end); adds comparisons made.
pub fn overlapping_pairs(bodies: &[SampleBody], tolerance: f64, comparisons: &mut u64, out: &mut Vec<(u32, u32, f64, f64)>);
/// World box of a marked stretch: ray origin plus/minus half a sample step along right and up.
pub fn stretch_box(ray: &Ray, forward: [f64; 3], right: [f64; 3], up: [f64; 3], half_step: f64, s0: f64, s1: f64) -> ([f64; 3], [f64; 3]);
#[derive(Default)] pub struct MarkTable { /* per pair: union box; deterministic order */ }
impl MarkTable {
  pub fn record(&mut self, a: u32, b: u32, min: [f64; 3], max: [f64; 3]);
  pub fn merge(&mut self, later_band: MarkTable);           // band order
  pub fn picture_only(&self, reported: &[PairReport]) -> Result<Vec<ViewPair>, CaptureError>;
}
pub fn hatch(x: u32, y: u32, body: [u8; 3], interference: [u8; 3], outline: bool) -> [u8; 3];
// interference.rs
pub struct ViewPair { pub a: u32, pub b: u32, pub min: [f64; 3], pub max: [f64; 3] }
pub fn add_view_pairs(scene: &Scene, pairs: &mut Vec<PairReport>, seen: &[ViewPair], cell: f64);
```

## Behaviour

- `overlapping_pairs`: callers pass only bodies with the analysed flag,
  not open meshes, with a non-empty interval list. Keep the eight with the
  nearest first boundary; compare each pair with `interval::overlap`
  (`crates/capture/src/interval.rs:52`), at most 28 comparisons.
- `MarkTable` keys are `(a, b)`; use a `BTreeMap` or a sorted `Vec` so the
  order is deterministic; `merge` unions boxes.
- `picture_only`: pairs not in `reported` (by `(a, b)`), sorted by `(a, b)`;
  more than `VIEW_PAIR_LIMIT` -> `Err(CaptureError("Too many interfering
  pairs in this view (<n>). Use --interference-bodies or
  --no-interference."))`.
- `add_view_pairs`: for each `ViewPair`, grow its box by `cell` on every
  side, use the cell `min(cell, largest box side / 16)` and the three-axis
  lattice of `analyse_pair` on that box; append a `PairReport` with
  `from_view: true`; if the lattice finds nothing, append it anyway with
  volume 0 and the marked box. Sort `pairs` by `(a, b)` at the end.
- `hatch`: interference colour when `outline` or `((x + y) / 8) % 2 == 0`,
  else the body colour; never blended.

## Pitfalls

- No floating accumulation that depends on band count; boxes use min/max.
- `add_view_pairs` must not reorder or alter existing analysis pairs.
- Do not touch the shading path; the hatch replaces colour only in M23.

## Tests (`#[cfg(test)] mod tests` inside `overlay.rs` and `interference.rs`)

- Two bodies overlapping 1 mm on a ray -> one pair with that stretch;
  touching (gap 0) -> none; overlap 0.0005 with tolerance 0.001 -> none.
- Ten stacked bodies -> comparisons <= 28 and only pairs among the
  nearest eight.
- `MarkTable`: records from two bands merged in either split give the same
  boxes; `picture_only` excludes reported pairs; 4,097 picture-only pairs ->
  the exact error text.
- `hatch`: (0,0) interference colour; (8,0) body colour; outline forces the
  interference colour; light `#335c67`/`#fffdf8` and dark `#5fb4c7`/`#1f2427`.
- `add_view_pairs`: Plate-and-pin scene with a 0.05 mm pin whose
  `ViewPair` box covers it -> pair appended with `from_view` and volume > 0;
  a box over empty space -> pair appended with volume 0; result sorted.

## Acceptance criteria

- All contract items exist with the behaviour above; unit tests pass; no
  file outside writePaths changed.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/overlay.rs crates/capture/src/interference.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m17 cargo clippy -p nodetto-capture --all-targets -- -D warnings'`
2. `sh -c 'mkdir -p tmp/capture/m17 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m17 cargo test -p nodetto-capture --lib -- overlay:: interference:: > tmp/capture/m17/unit.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m17/unit.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m17/unit.txt'`
3. `sh -c 'CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m17 cargo test -p nodetto-capture --test interference --test render'` (unchanged tests still pass)

## Progress

Implemented overlay units and view-pair sampling, including the 0.05 mm pin, stretch-box, deterministic merge, exclusion and limit regressions. Final shared-tree gates pass: rustfmt and clippy, 8 unit tests, and 31 integration tests (7 release-only tests ignored). Formal review and M23 picture wiring remain downstream.
