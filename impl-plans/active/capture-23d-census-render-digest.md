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

## Progress

Pending. Hashes before and after, logs under `tmp/capture/m23d/`, drift
stops the run; timing tests up to 3 attempts, then alone.
