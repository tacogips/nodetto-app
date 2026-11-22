# M17 capture-17-interference-overlay

- dependsOn: M20 (the CLI writes scenes with the analysis on and prints
  the pairs; `describeInterference` knows the source `view`)
- Design: sections 6.5, 6.6 (picture), 7
- writePaths: `crates/capture/src/raster.rs`, `crates/capture/src/shade.rs`,
  `crates/capture/src/interference.rs`, `crates/capture/src/lib.rs`,
  `crates/capture/tests/overlay.rs` (new),
  `crates/capture/tests/render.rs` (the digest constant only),
  `packages/core/src/capture/cad-request.ts` and its test (draw bit),
  `apps/cli/src/capture-cad.ts` and its test,
  `apps/cli/src/capture-help/interference.ts`,
  `apps/cli/src/__fixtures__/capture-plate-default.ncs1`,
  `apps/cli/src/native-parity/capture.test.ts`
- Pre-authorised: the committed pixel digest of the Plate fixture in
  `crates/capture/tests/render.rs` is replaced by the new value, because
  that scene has the draw bit set and an interfering pair and now shows
  the hatch; the commit message states the old and the new value. No
  other assertion of that file changes. `capture-plate-default.ncs1` is
  regenerated (draw bit on).

## Contract

```rust
// interference.rs
/// Pairs that marked a picture sample and are not in `pairs`: analyse each in the box of
/// its marked samples and append it with from_view = true.
pub fn add_view_pairs(scene: &Scene, pairs: &mut Vec<PairReport>, seen: &[ViewPair], cell: f64);
pub struct ViewPair { pub a: u32, pub b: u32, pub min: [f64; 3], pub max: [f64; 3] }
// shade.rs
pub fn hatch(x: u32, y: u32, body: [u8; 3], interference: [u8; 3], outline: bool) -> [u8; 3];
```

## Behavior

- Marking (when the draw bit is set): a sample is marked when two
  distinct bodies with the analysed flag, neither an open mesh, overlap
  along its ray by more than the tolerance. Only bodies that have an
  interval on the ray are compared, and of those only the eight whose
  first boundary is nearest (ties in body order), so a ray costs at most
  28 comparisons. For every marking pair the band keeps the 3D box of
  its overlap stretches (ray position plus half a sample step sideways,
  the stretch along the ray); bands are merged in band order. When the
  merged table holds more than 4,096 pairs that the analysis did not
  report, `render_rgb` fails with `Too many interfering pairs in this
  view (<n>). Use --interference-bodies or --no-interference.`
- Agreement of text and picture: after the picture pass, every marking
  pair that is not among the analysed pairs is passed to
  `add_view_pairs`: `sample_axis` on the three axes over its box (grown
  by one sample step, the cell being the smaller of the analysis cell
  and a sixteenth of the box's largest side), reported with `from_view`.
  A pair that marked a sample is therefore always in `Report.pairs`; if
  the lattice finds no overlap in that box (a sliver below every cell),
  the pair is still reported, with the volume `0.000` and the box of the
  marked stretches. Pairs are sorted by `(a, b)` at the end.
- Hatch (design 6.6), applied after shading, edges and before
  downsampling, also where another body is in front: a marked sample is
  the interference colour when `((x + y) / 8) % 2 == 0` in sample
  coordinates and the body colour otherwise; a marked sample with an
  unmarked neighbour on any of its four sides is the interference colour
  (outline). The hatch replaces the shaded colour; it is not blended.
- Without the draw bit nothing is marked and no view pair is added.
- `prepareCadCapture` writes the draw bit on when interference is
  requested.
- Help part: the picture marks every reported interference with a
  striped region that is visible through other bodies and replaces the
  shading there; `--no-interference` gives the same view without it; a
  pair that only the picture's rays found is listed with `(found in the
  picture only)`.

## Tests

- `tests/overlay.rs`:
  - Plate fixture: pixels inside the projected overlap box are one of the
    two hatch colours or their anti-aliased mixes, also where the block's
    own face is in front; the centre of the hole inside the overlap is
    not marked from `top`; with the draw bit clear the picture equals the
    M8 picture of the same scene; with the block moved 30 mm away the
    two pictures are equal;
  - the hatch does not depend on the face shade: the set of colours in
    the marked area is the same on the lit top face and on the darkest
    side face (from `front`);
  - agreement, 100 scenes from a seeded generator (two to four bodies,
    boxes and cylinders, some with pins of 0.05 to 2 mm): the set of
    pairs that marked a sample is a subset of the reported pairs, in
    every one; and for every reported pair whose box projects inside the
    picture at more than two samples, at least one sample is marked;
  - a pin of 0.05 mm (below the analysis refinement at a target cell of
    10 and wider than a sample in a close-up camera) is absent from the
    analysis, marks samples, and appears with `from_view`;
  - bounds: 40 bodies stacked on one place render with at most 28
    comparisons per sample (a counter in the test support) and every
    marked pair is in the report; 200 small bodies that pairwise overlap
    only below the analysis cell (more than 4,096 picture-only pairs)
    return the error;
  - reports and buffers are equal for 1, 2 and 5 threads.
- `tests/render.rs`: the digest constant (pre-authorised).
- `capture-cad.test.ts`: the view source is printed as `(found in the
  picture only)`; the regenerated default fixture equals the command's
  scene.
- `native-parity/capture.test.ts`: decoded pixels in the overlap region
  of `capture-plate.jsonl` differ between the default run and
  `--no-interference` and contain both hatch colours (`#335c67` and
  `#fffdf8` within the anti-aliasing mix); two runs give equal bytes;
  `--theme dark` uses `#5fb4c7` and `#1f2427`.

## Acceptance criteria

- Interference is drawn distinctly, independent of the shade underneath,
  in both themes.
- No stripe exists without a text line for its pair.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m17 && CARGO_TERM_QUIET=true cargo test --release -p nodetto-capture --test overlay --test render -- --nocapture > tmp/capture/m17/overlay.txt 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m17/overlay.txt'`
3. `sh -c 'bun run typecheck && bun run lint:ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/ai-commands.test.ts'`
4. `sh -c 'mkdir -p tmp/capture/m17; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m17/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m17/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/cad-request.test.ts'`
5. `sh -c 'CARGO_TERM_QUIET=true cargo test -p nodetto-cli && CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`

## Progress

Pending.
