# car3-g1d-reference-layers

- planId: car3-g1d-reference-layers; planPath: impl-plans/active/car3-g1d-reference-layers.md
- progressPath: impl-plans/progress/car3-g1d-reference-layers.md
- wave: 2; dependsOn: car3-g1b-reference-witness (same file `reference.rs`)
- Finding: function-capture-translucent-layer-visibility (R3-2, high), contract C3.
- Design: `design-ai-capture.md` 21.1 R3-2 ("Layers", "Order", "Colour", "Edge per
  layer", "Visibility", "Both rasterizers"), 21.5 C3.
- writePaths: `crates/capture/src/raster/reference.rs`,
  `tmp/car3-r3b/car3-g1d-reference-layers`,
  `impl-plans/progress/car3-g1d-reference-layers.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

The reference keeps one translucent hit per sample (`reference.rs:34,53-55,87-94`). An
open sheet in front of a PCB reference therefore hides the board in the pixels and in
the drawn report. After this plan, the reference composites every translucent layer in
front of the nearest opaque hit. It has no arena, no cap and no budget: it is the
simple oracle for car3-g1e.

## Changes (`reference.rs` only)

- Add a private `#[derive(Clone, Default)] struct ReferenceSample { solid: Option<Hit>, layers: Vec<Hit>, marked: bool }`.
  The reference must stop using `raster.rs`'s `Sample`, because car3-g1e replaces
  `Sample::translucent`. Use `Vec<ReferenceSample>` as the sample buffer. Rotate with
  `rotate_left(samples_wide * factor)` in place of `copy_within`.
- `reference_sample`:
  - Candidates are the open-mesh `first_surface_hit` (in rect) and the first boundary
    of each reference body. Each body gives at most one.
  - `solid` is as today.
  - Keep a candidate when `make_hit` succeeds and
    `solid.is_none_or(|s| hit.depth < s.depth - MERGE_EPS)`.
  - Sort by `(depth.total_cmp, body)`.
  - Mark every kept layer `visibility[body].1 = true`.
- Colour in `reference_bands`:
  - Start with today's opaque colour (edge, lit body or background).
  - Then, for each layer from farthest to nearest:
    `colour = shade::reference_mix(colour, layer_colour, scene.reference_opacity)`,
    where `layer_colour` is `palette.edge` when the layer is an edge, otherwise
    `shade::lit_colour(palette.body, layer.normal, light)`.
  - Apply the hatch last, as today.
- Edge per layer: for the right neighbour (`x + 1 < samples_wide`) and the lower
  neighbour (`sample_y + dy + 1 < samples_high`), find the neighbour layer with the same
  `body` (linear search; `None` if absent), then call
  `shade::is_edge(Some(layer), found, right|down, forward)`.
- `fixtures` (C3) gain:
  - `pub(in crate::raster) fn sheets_over_board(sheets: &[f64], board: bool) -> Scene`
    - Top view, 96 x 96, supersample 1, 0.25 mm/px, `centre [5, 5, 0]`,
      `analyse false`, `draw_interference false`.
    - Board (if `board`, body 0): box 10 x 10 mm, z 0..1, `Body { reference: true, analysed: false }`.
    - One open two-triangle `Mesh` per entry z: positions
      `[-1,-1,z, 11,-1,z, 11,11,z, -1,11,z]`, triangles `[0,1,2, 0,2,3]`,
      `Body { reference: false, analysed: false }`.
  - `pub(in crate::raster) fn opaque_over_board(board: bool) -> Scene`: the same frame
    with a sheet at z 3, an opaque box over x and y -0.5..10.5 at z 1.5..2.5
    (`reference: false`), and the board if `board`.

## Pitfalls

- With at most one layer per sample, the result must equal today's colour and edge
  rule (design 21.1). Do not change opaque shading or the hatch order.
- No truncation: every qualifying layer is composited.
- A body with both an open-mesh hit and an interval cannot happen (open bodies
  `continue`). Still keep one candidate per body.
- Do not edit `raster.rs` or `raster/tests.rs`. They belong to car3-g1c, which runs
  in parallel. Every new fixture must be used by a test here (clippy `dead_code`).

## Tests (new `mod layer_tests` in `reference.rs`, reference-only `render_reference`)

Pixel indices for the 96 x 96 frame: interior `(48, 48)` (x 5.125, y 5.125); board
outline (last board column) `(67, 48)`. Verify them with
`x = (j + 0.5 - 48) * 0.25 + 5`.
- `sheets_over_board(&[3.0], true)` against `(&[3.0], false)`:
  - the interior pixel differs;
  - the outline pixel differs from the interior pixel and from the sheet-alone pixel;
  - both bodies are `BodyState::Drawn`.
- `sheets_over_board(&[3.0, 4.0, 5.0, 6.0], true)` against the four sheets alone ->
  same assertions, and all five bodies are `Drawn`.
- `opaque_over_board(true)` -> the board state is `Hidden`, and the whole RGB equals
  `opaque_over_board(false)` (a control that also passes before the edit).
- Fail-before: write the tests first and run them on the unmodified layer code (after
  g1b). The two sheet cases must fail: equal interior pixels and a board that is not
  `Drawn`. Record the output.

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1d-reference-layers cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1d-reference-layers cargo test --release -p nodetto-capture`
   -> the layer tests, the g1b witness tests and all existing production-versus-
   reference comparisons pass. Their scenes have at most one translucent layer.

## Done criteria

- The reference composites all layers and uses its own sample type. The fixtures exist
  and are used.
- Fail-before is recorded and all tests pass. Progress log `done`, with hashes,
  commands, exit codes and log paths.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- The no-stray-test condition is now the plan-delta scan, which is the last manifest
  `verification` entry and overview rule 9. It must exit 0 and leave
  `tmp/car3-r3b/car3-g1d-reference-layers/stray-delta.txt` empty. Create the
  evidence directory first.
- The 753 inventoried `tmp/car1-r1/*` copies are not this plan's. Do not write them,
  and do not report them as a blocker.
