# M23d capture-23d-census-render-digest (session 885)

- Dispatch `capture-s885`, wave 4, dependsOn
  `capture-23c-picture-acceptance` (CAP-R5-03 proof on the same tree).
- Design wins: 6.3, 6.7, 8.5 (superseded render assertions, CAP-R5-01,
  CAP-R5-03, census acceptance additions), CAP-R4-09.
- Writes (3): this file, `crates/capture/tests/census.rs`,
  `crates/capture/tests/render.rs`. Artifact roots: `target/capture-m23d`,
  `tmp/capture/m23d`, `tmp/capture/m23` (gate 2 file).

## Intent

Finish the census coverage, replace the M8 placeholder assertions the
design names, then replace the digest, so the full crate test passes.

## Changes, in this order

1. `tests/census.rs` new cases (keep the M23b cases): emptied; refilled;
   sound plate (all `Drawn`, `emptied_by_step` -1); hidden in a housing;
   outside the view; intersect miss; end to end (`render_scene`); 1 vs 5
   threads equal. Census additions: an emptied solid in an options-0 scene
   gets its `emptied_by_step` (24 M census); an open-source body with a
   later cut at a positive budget has `emptied_by_step` -1. Ray counts
   are not observable here (asserted in M23b).
2. `tests/render.rs:390-411` (design 8.5): replace exactly the three
   assertions: reference-only sample == 45% mix of the two single-body
   renders; reference body `Drawn`; open-mesh body `Drawn` with `open`
   true; keep `candidates == 0`, empty `pairs`, the two-thread render.
3. `tests/render.rs:162-178` (CAP-R5-01): the `assert_eq!` becomes
   `[Drawn, Drawn, Drawn, Hidden, Outside, Empty]` plus
   `bodies[4].emptied_by_step == -1` and `bodies[5].emptied_by_step == 1`;
   name, three-thread render and shading assertions kept.
4. Only after M23c's CAP-R5-03 tests pass on this tree: replace the
   digest `0x29c6_4b3e_156d_0941` (`render.rs:337-339`) with the value the
   test prints. Separate commit; message states old and new value.
   Commit messages for 2 and 3 state old and new expectations.

## Pitfalls

Do not change production code to restore `Absent`. Do not touch the
cross-worker and encoded-image determinism logic beyond the constant.
Any production defect: stop and record (scope amendment). Do not edit
`tests/support/mod.rs`.

## Acceptance criteria

- Gate 1 and gate 2 exit 0; the full crate test passes, including the
  three formerly failing tests; old and new values recorded in commits.

## Verification (each exit 0, positive pass counts)

1. Gate 1: `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23d" sh -c 'cargo fmt -p nodetto-capture -- --check && cargo clippy -p nodetto-capture --all-targets -- -D warnings && cargo test -p nodetto-capture'`
2. Gate 2: `sh -c 'mkdir -p tmp/capture/m23 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23d cargo test --release -p nodetto-capture -- --nocapture > tmp/capture/m23/release.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m23/release.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m23/release.txt && ! grep -Eq " [1-9][0-9]* failed" tmp/capture/m23/release.txt'`

## Amendment 2026-11-23 (blocked-wave-scope-or-contract, round 1)

Blocker: the retained shading assertion of
`nearest_face_wins_and_hidden_is_distinct_from_absent` (`render.rs:181-185`)
samples `[90, 45, 6.5]`. That point is now inside the interference hatch
(`[51, 92, 103]`), so it no longer shows the block shade
(`[195, 194, 190]`). `support::scene` sets `analyse` and
`draw_interference` true (`tests/support/mod.rs:91-92`), and the wired
picture hatches interference behind a nearer face. That behavior is
correct: design 6.6 and CAP-R5-02 say the draw bit alone controls hatching,
and M23c's "hatch also behind the Block face" test passes. The assertion
tests nearest-face shading, an M8 property, not the overlay.

Decision (CAP-R6-06, recorded in design 8.5 and section 18). For this test
only, change the following and nothing else:

- Insert exactly one statement, `scene.draw_interference = false;`, after
  the camera assignment at `render.rs:181` and before the single-thread
  `render_rgb` at `:182`.
- Keep these unchanged: the camera line, the `block_shade` computation, the
  `assert_ne!`, the `assert_eq!` on the sampled pixel and its sample point,
  the three-thread render and the CAP-R5-01 state assertions above them.
- Do not move the sample point. Do not weaken or delete the assertion. Do
  not touch production code, `tests/support/mod.rs` or any other test.

Hatch coverage stays in `tests/overlay.rs` (M23c). The first, three-thread
render keeps the draw bit set, so the CAP-R5-01 states are still checked on
the wired scene.

Resume state: keep the already-applied census additions, the three
superseded assertions, the CAP-R5-01 assertion and the digest replacement
(`0x29c6_4b3e_156d_0941` -> `0x093f_f8ec_cdac_365b`). Read each file fresh,
record `git hash-object` before and after the new edit, then run
verification 1 and 2. Commit messages state:

- the old and new digest;
- the old and new CAP-R5-01 states;
- the three replaced assertions;
- this inserted line (CAP-R6-06).

Acceptance additions:

- `render.rs` differs from the pre-amendment tree only by that one inserted
  statement inside the test.
- `cargo test -p nodetto-capture --test render` passes all tests, including
  `nearest_face_wins_and_hidden_is_distinct_from_absent`.

## Progress

Implementation in progress; blocked on a narrow scope amendment. M23c's
CAP-R5-03 overlay suite passed on this tree (8 tests). The old digest
`0x29c6_4b3e_156d_0941` produced `0x093f_f8ec_cdac_365b`; the test
constant was updated. Census additions and the authorized render assertions
are present. Focused tests: census 5 passed; render 13 passed, 1 failed,
2 ignored. The retained shading assertion in
`nearest_face_wins_and_hidden_is_distinct_from_absent` samples interference
hatch `[51, 92, 103]`, not the block shade `[195, 194, 190]`.
Design 8.5 authorizes changing only the state assertion and emptying indices
in this test and requires the shading assertion kept. Request an amendment
authorizing the draw-interference bit to be cleared before the second render,
or another approved correction preserving the shading assertion. Do not
change production code within this plan. Full gates remain pending. Evidence,
per-edit snapshots, intentions, hashes and logs are in
`tmp/capture-s885/capture-23d-census-render-digest/`. Commit and review are
later workflow steps; commit messages must state old and new expectations and
digest.
