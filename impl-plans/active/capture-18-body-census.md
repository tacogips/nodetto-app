# M18 capture-18-body-census

- dependsOn: M17 (the finished picture pass and the order in which
  `render_rgb` assembles the `Report`, which this milestone extends); uses
  `sample_axis` of M10 and the text module of M20
- Design: sections 4.2, 6.3 (reply), 6.7, 10.2, 12
- writePaths: `crates/capture/src/census.rs` (new),
  `crates/capture/src/lattice.rs` (per-step liveness and early exit in the
  one-body mode), `crates/capture/src/raster.rs` (per-step liveness in the
  picture pass), `crates/capture/src/report.rs`,
  `crates/capture/src/lib.rs`, `crates/capture/tests/census.rs` (new),
  `packages/core/src/capture/describe.ts` and its test,
  `apps/cli/src/capture-cad.ts` and its test,
  `apps/cli/src/capture-help/cad.ts`,
  `apps/cli/src/native-parity/capture.test.ts`
- Pre-authorised: the M9 test that expects the note `[not in the
  picture]` for an `absent` body is changed to the notes of this
  milestone. No picture changes, so no digest changes.

## Contract

```rust
// census.rs
pub const CENSUS_LIMIT: usize = 4096;
/// Per body: was there material after each step on any picture ray (from the picture pass).
pub struct Liveness { pub alive_after: Vec<bool> }
/// Completes states and `emptied_by_step` for suspect bodies (design 6.7).
pub fn resolve(scene: &Scene, bodies: &mut [BodyReport], picture: &[Liveness], cell: f64, budget_rays: u64);
// lattice.rs: the one-body mode fills a Liveness and may stop early
pub fn sample_body_axis(request: &LatticeRequest, axis: usize, liveness: &mut Liveness) -> AxisSample;
```

```ts
// describe.ts
export function describeBodies(report: SolidReport, model: CadCaptureModel):
  { readonly line: string; readonly errors: readonly { id: string; code: string; text: string }[] };
```

## Behavior

- Picture pass (`raster.rs`): while a sample folds a body's steps it
  sets `alive_after[i]` when the interval list is non-empty after step
  `i`; a step that is skipped because its tool does not cover the sample
  leaves the list as it was and gets the same flag. Flags are kept per
  band and combined with OR in band order.
- Suspects (design 6.7): a body is suspect when it is `Absent`, or when
  some difference or intersection step `i` has `alive_after[i]` false in
  the picture. A body with only union steps and material in the picture
  is never suspect.
- `resolve`: suspect bodies in body order, at most `CENSUS_LIMIT`. For
  each: `sample_body_axis` on the three axes over the body's
  conservative box, with the cell `max(target cell, largest box side /
  256)`, boundary and small-loop refinement as for pairs, and the same
  per-ray step filter. Sampling of a body stops as soon as every step is
  alive (picture or lattice), also in the middle of an axis. The cost is
  counted in weighted rays as in M10 against `budget_rays`; when the
  budget is used up, the remaining suspect bodies get the state
  `Unknown` and `emptied_by_step` -1.
- Result per sampled body: `alive = picture OR lattice`.
  `emptied_by_step` is the smallest step index `i` with `alive[i]` false,
  or -1; it is always a difference or intersection step. State: `Empty`
  when the last step is not alive; else `Outside` when the body was
  `Absent`; else its picture state (`Drawn` or `Hidden`). A body that is
  not suspect keeps its picture state and -1.
- `render_rgb` calls `resolve` after the picture and marking passes with
  the scene's target cell and budget; bodies may be distributed over the
  render threads with results in body order.
- `describeBodies`: the `bodies:` line of design 4.2 with the notes
  `[hidden behind other bodies]`, `[outside the picture]`, `[no
  material]`, `[not sampled]` (for `unknown`), `[differs from the app,
  see errors]` (material at the end and `emptiedByStep` not -1) and, from
  M11, `[open mesh, not checked]`. For every body with `emptiedByStep`
  not -1 one error entry: id = the feature of that step, code
  `cad.result.empty`, text `(sampled): leaves no material in "<body>";
  the app rejects this feature and keeps the body, this picture applies
  it`.
- CLI: `errors:` counts the model's errors plus these entries and prints
  them after the status lines in the same indented form; `--json` adds
  them to `errors` with `"sampled": true` and gives every body its
  `state` and `emptiedByStep`.
- Help part `cad.ts`: the notes, and that `cad.result.empty (sampled)`
  marks a feature the app would reject, after which the picture and the
  app differ.

## Tests

- `tests/census.rs` (scenes built in code):
  - a plate fully removed by a cut through its whole outline: `Empty`
    with `emptied_by_step` 1;
  - the reviewer's case: Plate, a cut that removes all of it, then a
    boss added on the same body: the body is `Drawn` (the boss), and
    `emptied_by_step` is 1; with a second emptying cut and another add
    later, still 1 (only the first is reported);
  - a sound model, plate with 60 holes and a boss added later, in the
    fitted `iso` view: no suspect body, `resolve` evaluates no ray
    (counter in the test support), every `emptied_by_step` is -1;
  - the same sound model in a close-up that shows only the boss: the
    plate's steps are suspect, the lattice finds material after each,
    no error;
  - an intersect whose tool misses the body: `Empty` at that step;
  - a body enclosed by a housing: `Hidden`, -1; a body outside the
    picture: `Outside`, -1; a 200 mm block cut down to a 1.5 mm pin,
    outside the picture: `Outside` (found through loop refinement);
  - early exit: a sound 200 mm plate out of frame is resolved with fewer
    than 5,000 rays; budget: with a budget of 1 and 3,000 absent bodies
    the first ones are resolved and the rest are `Unknown`, in under
    2,000 ms (release only); more than `CENSUS_LIMIT` suspects: the rest
    are `Unknown`;
  - equal reports for 1 and 5 threads.
- `describe.test.ts`: each note; the error entry names the right feature
  for a body that ends empty and for one that is refilled; a model error
  and a sampled error are both counted.
- `capture-cad.test.ts`: text and JSON for an emptied body, for an
  emptied and refilled body (`errors: 1`, the line, the note `[differs
  from the app, see errors]`), for a hidden one (`errors: 0`) and for one
  outside the picture with `frame: cropped`.
- `native-parity/capture.test.ts`: a document built in the test with
  Plate, Trim (a cut over the whole plate) and Boss (add) prints `errors:
  1` and a line with `cad.result.empty (sampled)` and the short id of
  Trim; `capture-plate.jsonl` (holes, pocket, boss) prints `errors: 0`;
  a document where a cut removes the whole plate prints `[no material]`;
  a board inside a closed housing is `[hidden behind other bodies]` with
  `errors: 0`.

## Acceptance criteria

- A feature that the app rejects for emptying a body is always named in
  the text, whether or not later features add material; a sound model
  costs no extra sampling.
- Hidden and out-of-frame bodies are told apart from emptied ones.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m18 && CARGO_TERM_QUIET=true cargo test --release -p nodetto-capture --test census --test render -- --nocapture > tmp/capture/m18/census.txt 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m18/census.txt'`
3. `sh -c 'bun run typecheck && bun run lint:ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/ai-commands.test.ts'`
4. `sh -c 'mkdir -p tmp/capture/m18; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m18/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m18/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/describe.test.ts'`
5. `sh -c 'CARGO_TERM_QUIET=true cargo test -p nodetto-cli && CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`

## Progress

Pending.
