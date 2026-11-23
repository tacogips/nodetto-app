# M23c capture-23c-picture-acceptance (session 885)

- Dispatch `capture-s885`, wave 3, dependsOn
  `capture-23b-tile-visit-allowance` (finished picture pass).
- Design wins: 6.5, 6.6, 8.5 (CAP-R5-03, the no-overlay regression, the
  `tests/mesh.rs` acceptance additions), CAP-R6-01. Test list source:
  `capture-23-wiring.md` "Tests" (`tests/overlay.rs`, `tests/mesh.rs`).
- Writes (4): this file, `crates/capture/tests/overlay.rs`,
  `crates/capture/tests/mesh.rs`, `crates/capture/src/shade.rs` (only to
  fix a compositing-order defect that a new test here exposes).
  Artifact roots: `target/capture-m23c`, `tmp/capture/m23c`.

## Intent

Prove the wired picture is right before the digest changes: the hatch
agrees with the reported pairs, nothing else moves, meshes and reference
bodies draw as designed.

## Tests to add (imitate `tests/overlay.rs:9`, `tests/mesh.rs:10`; helpers private in each file)

`tests/overlay.rs`:
- CAP-R5-03 (1): `fixtures/plate-iso.ncs1` with the draw bit cleared -> `support::digest` == `0x29c6_4b3e_156d_0941`.
- (2): pixels differing between bit-set and bit-clear renders -> non-empty, each inside a reported pair's projected box widened by 2 px (`support::project`).
- (3): the differing pixels include both hatch colours of the theme.
- Hatch also behind the Block face; hole centre not marked from `top`; Block moved 30 mm -> bit-set equals bit-clear.
- 100 seeded scenes -> marking pairs subset of reported pairs; every reported pair projecting over more than 2 samples marks one.
- 0.05 mm pin -> a `view` pair; 40 stacked bodies -> at most 28 comparisons per sample; 200 sub-cell pairs -> too-many-pairs error.
- Draw bit set with no interfering pair -> equals bit clear (no-overlay regression); 1, 2, 5 threads equal.
`tests/mesh.rs`:
- Prism cut through a cube mesh -> background visible through the cut.
- Reference in front -> 45% mix of the two single-body renders; body behind `Drawn`. Reference behind an opaque body -> `Hidden`.
- Sphere mesh -> edges only on its outline.
- Prism, then difference with a cube mesh missing one triangle -> equals the prism-only picture; `open` false; prism `Drawn`.
- Prism, then intersection with that open mesh -> `Empty`, `emptied_by_step` 1.
- Open mesh, then prism difference -> equals open-mesh-only picture; `open` true; `emptied_by_step` -1; no sampled error; no pair.
- Open-source mesh outside the picture -> `Outside` (its zero census rays are asserted in M23b).
- `two_hundred_thousand_triangles_fit_render_budget` unchanged (release).

## Production edits

Only `shade.rs`, only when a test above shows the compositing order
(shade, edges, reference mix, hatch with outline, downsample) is wrong,
and the fix must keep check (1). Any other needed production change:
stop, record the file and failing test in Progress (scope amendment), do
not edit. If check (1) fails, stop; `tests/render.rs` is not touched by
anyone.

## Pitfalls

Do not edit `tests/render.rs`, `tests/support/mod.rs`, `raster.rs`,
`overlay.rs`, `mesh.rs` (src) or `tests/interference.rs`. Do not snapshot
new digests here. Keep seeds fixed.

## Acceptance criteria

- Every listed case passes, CAP-R5-03 (1)-(3) included; the 200,000
  triangle deadline passes unchanged.

## Verification (each exit 0, every `cargo test` positive)

1. `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23c" sh -c 'cargo fmt -p nodetto-capture -- --check && cargo clippy -p nodetto-capture --all-targets -- -D warnings && cargo test -p nodetto-capture --lib raster:: && cargo test -p nodetto-capture --test overlay && cargo test -p nodetto-capture --test mesh && cargo test -p nodetto-capture --test interference'`
2. `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23c" sh -c 'cargo test --release -p nodetto-capture --lib raster:: && cargo test --release -p nodetto-capture --test overlay && cargo test --release -p nodetto-capture --test mesh -- --nocapture && cargo test --release -p nodetto-capture --test interference'`

## Progress

Implementation complete; formal review remains downstream. M23b is admitted by
runtime `acceptedPlanIds`. CAP-R5-03 is proven on this tree by
`plate_iso_bit_clear_retains_picture_digest` and
`plate_iso_changes_are_contained_in_reported_pair_boxes_and_use_both_hatch_colours`:
the old digest, nonempty bounded changes and both colours pass. The remaining
overlay and mesh cases are in their owned test files; no production edit was
needed. The unchanged 200,000-triangle test took 100.815 ms in release.

Evidence: `tmp/capture-s885/capture-23c-picture-acceptance/` contains fresh
before/after snapshots, git hashes and intentions for each edit. The initial
debug gate failed clippy on fixed-size chunks (`gate-debug.log`, exit 101);
the owned test was corrected. Final `gate-debug-final.log` exited 0 (36 passed,
12 existing ignored); `gate-release-final.log` exited 0 (48 passed). Both
logs include exit status. The 100 seeded scenes use two bodies each. No git
state was changed. M23d owns the digest replacement after review.
