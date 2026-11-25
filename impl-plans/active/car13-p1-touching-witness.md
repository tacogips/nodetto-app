# car13-p1-touching-witness

- planId: car13-p1-touching-witness; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car13-p1-touching-witness.md
- Finding: `function-capture-mesh-prism-touching-face` (high).
- Design: `design-docs/specs/design-ai-capture.md` 30.1 R13-1.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p1-touching-witness/`.

## Intent and context

The finding's fixture is a tall extrusion (Z 0..156.75) seated flush on a
closed STL box (Z -35.25..0, both X -1..1, Y 0..8). In the default-fit
front and back views it gets a picture-only interference pair. The two
bodies share zero volume, but the prism cap band (`prism.rs:211-240`) and
the mesh edge band (`mesh.rs:309-344`) both admit the joint ray. The
picture witness at `raster.rs:299-318` then records the pair, the sample is
hatched, and `interference.rs:585-597` reports the pair.

Fix: drop a picture witness pair whose conservative body boxes share no
positive extent on some world axis. Apply this in the production raster and
in the reference renderer.

Non-goals:
- No change to `prism.rs`, `mesh.rs`, shading, volume intervals, the
  lattice analysis or its candidate test (`interference.rs:131`), witness
  budgets for kept pairs, report types, CLI, Tauri or MCP.
- No tolerance margin. The threshold is exactly `> 0.0`.

## Changes

1. `crates/capture/src/lattice.rs`. Next to `empty_bounds`, `valid_bounds`
   and `extend` (`lattice.rs:114-127`), add:
   - `pub(crate) fn body_boxes(scene: &Scene, tools: &[Bounds]) -> Vec<Bounds>`.
     Move the body-box code of `interference.rs:325-339` here unchanged:
     the union of the bounds of the tools of `Op::Union` steps that pass
     `valid_bounds`, starting from `empty_bounds()`.
   - `pub(crate) fn shares_extent(a: Bounds, b: Bounds) -> bool`. True only
     when, for all three axes, `a.1[k].min(b.1[k]) - a.0[k].max(b.0[k]) > 0.0`.
2. `crates/capture/src/interference.rs`. Replace the inline box code at
   `:325-339` with `lattice::body_boxes(scene, &tools)`. This is a move only;
   behaviour is unchanged.
3. `crates/capture/src/raster.rs`:
   - Add a field `body_boxes: Vec<Bounds>` next to `solid_tools`
     (`raster.rs:141`). Fill it once where the raster is constructed
     (`:718`), using `lattice::scene_tool_bounds(scene)` and `body_boxes`.
   - In the sample loop, after `overlay::overlapping_pairs_iter` fills
     `scratch.overlaps` (`:301-306`), skip every `(a, b, s0, s1)` whose
     boxes fail `shares_extent`. Use `retain` or a `continue` before
     `marks.record` and before `marked = true`.
   - Indices `a` and `b` are body indices. Use `.get()`, and treat a missing
     box as not sharing extent.
4. `crates/capture/src/raster/reference.rs`:
   - Apply the same filter at the witness loop (`:124-140`), with boxes
     computed once per reference render.
   - Add fixture `pub(in crate::raster) fn tall_mesh_under_prism(back: bool, overlap: f64) -> Scene`
     next to `mesh_under_prism` (`:582`). Details below.
   - In `witness_tests`, add a test that calls `touching(...)` for both tall
     views.
5. `crates/capture/src/raster/tests.rs`: the tests listed below.

Fixture `tall_mesh_under_prism`. Imitate `mesh_under_prism` and
`stacked_caps`:
- Tool 0: `Tool::Mesh` box with 8 vertices at X -1..1, Y 0..8,
  Z -35.25..0 and the 12 outward triangles in the same order as
  `mesh_under_prism`.
- Tool 1: `box_tool([-1.0, 0.0, -overlap], 2.0, 8.0, 156.75 + overlap, false)`.
- `bodies()` and `blank()` as in `stacked_caps`; width and height 64,
  supersample 2.
- Camera: the default-fit camera from the TS path, obtained once by a probe.
  - Write `tmp/car13-r13/car13-p1-touching-witness/camera-probe.ts` (not a
    test file).
  - The probe builds the document with `writeBinaryStl` and
    `stlToInlineMesh` (pattern: `apps/cli/src/native-parity/capture.test.ts:858-900`)
    plus the extrusion.
  - It calls `prepareCadCapture` for `view: "front"` and `view: "back"` at
    64 x 64 and prints the camera.
  - Copy the f64 values as literals (`{:?}` precision) with a comment naming
    the probe log.
  - If `back` is set, use the back camera; otherwise use the front camera.

Pitfalls:
- Do not compare boxes with `scene.tolerance`. A 0.0005 mm penetration must
  keep its witness.
- Do not filter `scratch.candidates` or analysis pairs; only the picture
  witness overlap list.
- The reference and production renderers must apply the identical rule, or
  `compare_every_thread_count` fails.
- `body_boxes` must stay exactly the candidate-box definition. Do not add
  difference or intersection tools.

## Tests

- `production_touching_tall_mesh`: `production_touching(tall_mesh_under_prism(false, 0.0))`
  and the same with `true`.
  - Expect zero pairs, zero candidates, identical RGB at every thread
    count, and RGB equal to the `draw_interference = false` render.
  - At least one view must fail before the fix. If neither fails, the camera
    is wrong: fix the camera, not the assertion.
- `production_tall_mesh_penetration`: for both views,
  `compare_every_thread_count(&tall_mesh_under_prism(back, 0.01))` gives
  exactly one pair with `a == 0` and `b == 1`. Add no RGB inequality
  assertion; this test is a guard.
- `shares_extent` cases:
  - boxes touching on X, then on Y, then on Z -> false;
  - a 0.01 mm overlap on all axes -> true;
  - one box `empty_bounds()` -> false.
- Reference `witness_tests`: `touching` on both tall views -> passes.
- All existing tests pass unedited, including `production_touching_*`,
  `production_overlap_witness`, `stacked_caps_witness_charge_is_the_delta`,
  the goldens and the determinism tests. If an exact census or charge count
  moves, stop and report both values. Never edit the bound.

## Verification (each exits 0)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p1 cargo test -p nodetto-capture -- --skip welded_edge_contact_is_closed`
   - libtest `--skip` filters that one test name in every test binary.
     This command therefore runs the lib tests, the `tests/render.rs`
     goldens, `tests/interference.rs`, `overlay*.rs`, `census.rs` and the
     other integration tests. It excludes only the failing test owned by
     car13-p4b.
   - The log must list the new tests and tests from `interference.rs`,
     `overlay.rs` and `render.rs` as passed, and must show
     `welded_edge_contact_is_closed` filtered out.
   - Do not use `--lib` here. p1 changes code covered by the crate's
     integration tests.

## Done criteria

- Commands 1-3 exit 0.
- The fail-before log and the camera probe log are saved.
- `git diff --name-only` stays inside writePaths.
- The progress log reads `done`.

## Implementation status

Source and regression tests implemented. The current crate-wide format,
clippy and test gates pass. See the plan-local progress log and evidence.
Formal review and integration remain downstream.
