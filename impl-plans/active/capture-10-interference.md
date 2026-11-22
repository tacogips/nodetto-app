# M10 capture-10-interference

- dependsOn: M8 (`render_rgb`, `Report`, the per-ray body fold)
- Design: sections 3.4, 6.6 (analysis), 10.2, 11
- writePaths: `crates/capture/src/lattice.rs` (new),
  `crates/capture/src/interference.rs` (new),
  `crates/capture/src/report.rs` (JSON of `analysis` and `pairs`),
  `crates/capture/src/lib.rs`, `crates/capture/tests/interference.rs`
  (new)
- Pre-authorised: none. The picture does not change in this milestone,
  so the committed pixel digest in `crates/capture/tests/render.rs` is
  not touched.

## Contract

```rust
// lattice.rs: the adaptive two-level lattice of design 6.6, steps 3 and 4
pub struct LatticeRequest<'a> { pub scene: &'a Scene, pub bodies: (u32, Option<u32>),   // one body, or a pair
  pub min: [f64; 3], pub max: [f64; 3], pub cell: f64, pub tolerance: f64 }
pub struct AxisSample { pub hit: bool, pub volume: f64, pub min: [f64; 3], pub max: [f64; 3],
  pub cell: f64, pub rays: u64, pub capped: bool }             // cell: the larger level-0 side
pub fn sample_axis(request: &LatticeRequest, axis: usize) -> AxisSample;
pub fn level0_rays(min: [f64; 3], max: [f64; 3], cell: f64) -> u64;   // sum over the three axes

// interference.rs
pub struct Candidate { pub a: u32, pub b: u32, pub min: [f64; 3], pub max: [f64; 3], pub weight: u64 }
/// The first `keep` candidates in body order and the number of all candidates.
pub fn candidates(scene: &Scene, boxes: &[([f64; 3], [f64; 3])], keep: usize) -> (Vec<Candidate>, u64);
/// The cell for all candidates and how many of them are checked (design 6.6 step 2).
pub fn plan(candidates: &[Candidate], total: u64, target_cell: f64, budget: u64) -> (f64, usize);
/// `refinement` is this candidate's allowance of weighted refinement rays.
pub fn analyse_pair(scene: &Scene, candidate: &Candidate, cell: f64, refinement: u64) -> (Option<PairReport>, f64); // result, cell used
```

## Behavior

- `candidates`: pairs `a < b` of bodies with the analysed flag whose
  conservative boxes (the box of each body's union tools) overlap by more
  than the tolerance on all three axes, in body order; the box is the
  overlap. `weight = max(1, ceil(steps / 8))`, where `steps` counts the
  steps of the two bodies that survive the filter below. Only the first
  `keep` candidates are stored (`keep = budget / 768 + 256`); the others
  are counted, so a page of 20,000 mutually overlapping bodies does not
  allocate a table of 2e8 pairs.
- `plan`: with `n(extent, c) = clamp(ceil(extent / c), 16, 1024)` per
  lattice side, the level-0 rays of a candidate are the sum over the
  three axes of the product of its two side counts, and its work is
  that number times its weight. Start with `c = target_cell` and double
  it until the work of all candidates is within the budget (in weighted
  rays); all candidates are then checked. If the minimum work (768 times
  the weight, summed) exceeds the budget, or `total` exceeds the stored
  candidates, `c` is infinite (every side is 16) and candidates are
  checked in order while their minimum work fits.
- `sample_axis` (design 6.6 steps 3 and 4): level 0 one ray per cell
  centre along the axis; evaluate only the requested bodies, and of
  their steps only the unions and differences whose tool box meets the
  box and every intersection; within a ray, a union or difference step
  whose tool's projected box does not contain the ray is skipped; a ray
  hits when the overlap
  of the two bodies (or, for one body, its material) exceeds the
  tolerance. Refinement: a cell whose hit state differs from one of its
  four neighbours gets 8 x 8 sub-rays; a cell that meets the projected
  box of a small loop (a loop of any step tool of the requested bodies
  whose projected box is narrower than four cells in a lattice direction)
  gets `m x m` with `m = clamp(ceil(8 * max(cell_a / side_a, cell_b /
  side_b)), 8, 64)`; the larger `m` wins. Refined cells are visited in
  row order until 2,000,000 refinement rays for this candidate and axis
  or until the candidate's refinement allowance is used up; then
  `capped` is set and the remaining cells keep their centre ray. The
  allowance is fixed before the pairs run, so results do not depend on
  thread scheduling: the analysis budget again, shared out in proportion
  to each checked candidate's level-0 work (`allowance = floor(budget *
  work / total work)`, which is at least the candidate's own level-0
  work). Volume is the sum over leaf
  cells of overlap length times leaf area; the extent is the union of
  hit leaves and their overlap stretches.
- `analyse_pair`: the three axes; no result when no axis hits; else
  volume = mean of the axes that hit, box = union of their extents
  rounded to 0.001, `capped` if any axis was capped, `from_view` false.
  The cell used is the largest level-0 side of the three lattices.
- `render_rgb`: when the analyse bit is set: candidates, `plan` with the
  scene's target cell and budget, `analyse_pair` for the checked
  candidates (distributed over the render threads, results placed in
  candidate order), `Report.pairs`, and `Report.analysis` with
  `candidates`, `checked`, `cell` (the largest cell used on any checked
  candidate; the target cell when there is none), `unchecked_count` and
  the first 256 unchecked pairs. The picture is not changed here.
- Only `+ - * /`, comparisons and `sqrt`; lattice coordinates are
  computed as `min + (i + 0.5) * side / n`, never accumulated.

## Tests (`tests/interference.rs`, scenes built in code; exact volumes computed in the test from the polygons)

- Fixture pair Plate and Block: one pair, volume within 1% of 637.362,
  box within 0.25 mm of (85,45,2)..(100,60,5); Puck interferes with
  nothing; the reported cell is 0.25.
- The reviewer's case: plate 200 x 200 x 5 with an added pin of diameter
  1.5 and height 10 at the centre, cover 200 x 200 x 5 on top: one pair,
  volume within 3% of the 64-sided pin's 8.822 mm3; the same with the pin
  left standing by a ring-shaped cut; a 0.8 mm peg of the other body at
  (37.3, 211.7) on a 300 mm part (cell 0.293); each also at a target
  cell of 4 (found through loop refinement alone).
- A body made by intersecting a box with a tool that lies outside the
  candidate box has no material there: no pair (the intersection step is
  not filtered away).
- Two boxes sharing a face: no pair; overlapping by 0.0005 mm: no pair;
  by 0.01 mm: one pair within 5%; a box in a pocket that clears it by
  0.1 mm: no pair; a reference body and a body: reported; a body without
  the analysed flag: no candidate.
- Guarantee: 200 scenes from a seeded generator, each a 100 mm box and a
  100 mm right-triangle prism whose corner enters the box at a random
  place so that the overlap, seen along Z, contains an axis-aligned
  square of side 1.2 cells: every one is found. Neither body has a small
  loop, and the candidate box is far larger than the overlap, so this
  exercises the level-0 lattice alone.
- Enclosure: a shell (box with a cut cavity) created first and 40 parts
  inside it, part 37 poking 1 mm through a wall: every candidate is
  checked (`unchecked_count` 0) and exactly the pair with part 37 is
  reported.
- Budget: 2,000 mutually overlapping boxes with budget 1: the checked
  count is `floor(1e6 / 768)`, the rest are unchecked, the first 256 are
  listed and no more than `keep` candidates are stored; 40 overlapping
  200 mm boxes with budget 24 are all checked with a reported cell of 2;
  `plan` never exceeds the budget for 1,000 generated candidate sets; the
  refinement rays of any run stay within the budget (a counter in the
  test support).
- Weight: a 300 mm pair in which one body is a plate with 600 hole cuts
  inside the candidate box has weight 76, is checked with a reported
  cell above 0.25 mm that the test derives from `plan`, and still finds
  a 0.8 mm peg through loop refinement.
- A loop of 2,000,000 potential refinement rays is capped and flagged.
- Results and reports are equal for 1 and 5 threads and for two runs.
- Release only: the 200 mm pin pair at cell 0.25 analyses on one thread
  in under 500 ms (the spike measured 58 ms); the 2,000-box case and the
  600-hole pair each in under 2,000 ms; values printed to
  `tmp/capture/m10/`.

## Acceptance criteria

- The analysis finds pins and pegs far smaller than the parts, reports
  the cell that states its guarantee, and never drops a candidate without
  listing it.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m10 && CARGO_TERM_QUIET=true cargo test --release -p nodetto-capture --test interference -- --nocapture > tmp/capture/m10/interference.txt 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m10/interference.txt'`
3. `sh -c '! grep -rnE "mul_add|\.sin\(|\.cos\(|\.tan\(|powf|powi" crates/capture/src && CARGO_TERM_QUIET=true cargo test -p nodetto-capture --test interference --test render'`

## Progress

Pending.
