# car4-f1d-hidden-census

- planId: car4-f1d-hidden-census; wave 2; dependsOn: car4-f1a-capture-scene,
  car4-f1b-ncs1-hidden-reader, car4-f1c-capture-report
- planPath: impl-plans/active/car4-f1d-hidden-census.md
- progressPath: impl-plans/progress/car4-f1d-hidden-census.md
- Finding: function-capture-hidden-target-empty-cut (R4-1, high), census, JSON and end
  to end.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-1 (Hidden census, Report
  JSON), 22.3, 22.5.
- writePaths: `crates/capture/src/census.rs`, `crates/capture/src/lattice.rs`,
  `crates/capture/src/report.rs`, `crates/capture/src/lib.rs`,
  `crates/capture/tests/census.rs`, `apps/cli/src/native-parity/capture.test.ts`,
  `tmp/car4-r4/car4-f1d-hidden-census`, `impl-plans/progress/car4-f1d-hidden-census.md`,
  `tmp/capture/m09/timing.json`, `tmp/capture/m23/timing.json`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

After f1b, `Scene::hidden` holds the Boolean histories of hidden targets of shared cuts.
Sample them after rendering and report, per visible body, the step of a shared cut that
empties a hidden target. `raster.rs` (protected) calls `census::resolve_with` and builds
`BodyReport`/`Report`, so neither function signature nor those structs may change.
Every host reaches the JSON through `lib.rs::render_parsed` (`engine.rs:193`; the
desktop via `render_scene`).

Non-goals: no edit of `raster.rs`, `raster/**`, `prism.rs`, `cast.rs`, `scene.rs`,
`BodyReport`, `Report` fields, `resolve_with` behavior, interference.

## Changes

- `lattice.rs` `sample_body_axis_with` (`:658`): resolve the body as
  `scene.bodies.get(i)` or else `scene.hidden.get(i - scene.bodies.len())`. Nothing else.
- `census.rs`:
  - Factor the per-body sampling block of `resolve_with` (`:91-146`) into a private
    helper so `resolve_with` output (states, `emptied_by_step`, stats) is bit-identical.
  - `pub fn resolve_hidden(scene: &Scene, reports: &[BodyReport], cell: f64,
    budget_rays: u64, solid: &[bool]) -> Vec<Option<i32>>` (length = `scene.bodies`):
    1. hidden bodies in order, at most `CENSUS_LIMIT`, skipping those whose first tool
       is not solid (`solid[first tool]`);
    2. each sampled as a picture-absent body with lattice index `bodies.len() + h`, own
       allowance `budget_rays` shared across hidden bodies, same weight rule;
    3. an incomplete result makes no claim; else take the first step `j` with no
       material after it; if step `j` is Difference or Intersection with tool `t`, for
       every visible body `b` with `!reports[b].open` and a first step `k` having the
       same tool and op, candidate `k` if `reports[b].emptied_by_step == -1 ||
       reports[b].emptied_by_step > k`; keep the minimum per body.
- `report.rs`: `pub fn to_json_with_hidden(&self, hidden: &[Option<i32>]) -> String`;
  inside a body object append `,"hiddenEmptiedByStep":{k}` after `"open"` only for
  `Some(k)`. `to_json()` delegates with `&[]` and keeps its exact output.
- `lib.rs` `render_parsed`: after `render_rgb`, if `!scene.hidden.is_empty()`, compute
  `tool_view::classify(scene)` once and call `resolve_hidden` with budget
  `if scene.analyse { u64::from(scene.budget_million_rays) * 1_000_000 } else {
  24_000_000 }` (same rule as `raster.rs:676-680`) and `scene.target_cell`; serialize
  with `to_json_with_hidden`. Empty `hidden` -> today's path exactly.

## Pitfalls

- Raster tests compare `render_reference` and `render_rgb` reports; they must stay
  untouched and passing, so the refactor of `resolve_with` must not change results.
- Do not count hidden bodies in `CensusStats` returned by `resolve_with`.
- A thread count must not change the result (sampling is deterministic).

## Tests

- `crates/capture/tests/census.rs` (imitate `options_zero_still_censuses_emptied_solid`
  with `support::{scene, box_prism, body}`; set `analyse = false`,
  `draw_interference = false`): tools wide 20x10x4, hidden 2x2x4, trim strip covering
  hidden; bodies `[wide: union 0, difference 2]`, hidden `[union 1, difference 2]`.
  `render_parsed(&s, ImageFormat::Png, 1)` JSON contains `"hiddenEmptiedByStep":1`;
  control with `hidden` empty contains no `hiddenEmptiedByStep` and equals the old
  `to_json` output; threads 1 and 5 give equal JSON; budget 0 path (call
  `resolve_hidden` directly with `budget_rays = 1`) -> all `None`.
- `report.rs` unit test: `to_json_with_hidden(&[None])` equals `to_json()`;
  `Some(3)` inserts the key after `"open":...`.
- `apps/cli/src/native-parity/capture.test.ts` (imitate `runCad`, but the two-target run
  is not required to have empty stderr checks beyond exit 0): document with the f1a
  fixture (`wide`, hidden `hidden`, `trim`), `--no-interference`; two-target run:
  exit 0, stdout has `errors: 1` and a line containing
  `cad.result.empty (sampled): leaves no material in a hidden target body` and
  `"wide"`; control (`targets: ["wide"]`): `errors: 0`; both list only `wide` in
  `bodies:`.

## Verification (each exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1d-hidden-census cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1d-hidden-census cargo test --release -p nodetto-capture`
   -> new census tests pass; raster reference comparisons unchanged.
2. `bunx biome check --diagnostic-level=warn apps/cli/src/native-parity/capture.test.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f1d-hidden-census cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car4-f1d-hidden-census/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   -> full native capture suite passes, including the new end-to-end case.

## Done criteria

- Two-target capture names `trim` against `wide` with interference off; control clean;
  scenes without hidden targets give unchanged JSON; progress log `done`.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- Blocker: the plan's own native gate
  (`bun test apps/cli/src/native-parity/capture.test.ts`) writes timing evidence through
  existing, unchanged code at `apps/cli/src/native-parity/capture.test.ts:178`,
  `:315-319` and `:745-750`, namely `tmp/capture/m09/timing.json` and
  `tmp/capture/m23/timing.json`. These paths were outside this plan's writePaths.
- Decision: authorize exactly these two generated files in this plan's writePaths
  (no glob, no broader directory). The worker may let the suite create the parent
  directories `tmp/capture/m09` and `tmp/capture/m23` and overwrite these two files.
  Do not edit the test to redirect them and do not delete them afterwards; they are
  existing measurement outputs of an existing suite. They are `.json`, not `*.test.ts`.
- No other plan writes these paths, so no ownership conflict exists; f1d is the only
  pending plan.
- Resume state: a partial, unverified implementation from the blocked attempt is
  already in the working tree (`crates/capture/src/census.rs`, `lattice.rs`,
  `report.rs`, `lib.rs`). Read each file fresh, record its sha256 as the pre-edit hash,
  review the partial change against "Changes" above, then finish it: add the
  `crates/capture/tests/census.rs` and `report.rs` unit tests, the native end-to-end
  case in `apps/cli/src/native-parity/capture.test.ts`, rustfmt, the progress log, and
  run both verification gates unchanged.
- No design change: contracts, gates and acceptance criteria are unchanged.

## Implementation status 2026-11-25

- Implemented the hidden census, report serialization and focused regressions.
- Both plan verification gates passed; see `impl-plans/progress/car4-f1d-hidden-census.md`.
- Formal review and integration-wide verification remain downstream.
