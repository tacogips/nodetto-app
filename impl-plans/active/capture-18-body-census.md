# M18 capture-18-body-census (revision 4: census units)

- Stage: wave 2. dependsOn: M10 (`tool_view`, streamed lattice, the empty
  `census.rs`).
- Design: sections 4.2 (body notes), 6.7, 8.5, 10.2, 11, 12.
- writePaths: `crates/capture/src/census.rs`, `crates/capture/src/lattice.rs`,
  `apps/cli/src/capture-help/cad.ts`,
  `impl-plans/active/capture-18-body-census.md`, `tmp/capture/m18`, `target`
- Pre-authorised: `apps/cli/src/capture-command.test.ts:454-465` runs
  unchanged (no new usage options here).

## Intent

The per-step liveness record, the suspect rule and the lattice
confirmation that turn picture-pass body states into the final states and
the first emptying step (design 6.7), as tested units. M23 records
liveness in the picture pass and calls `resolve`.

## Non-goals

No edit of `raster.rs`, `report.rs`, `lib.rs`, `interference.rs`,
`overlay.rs`, crate integration tests, `describe.ts` (M22 already prints
the notes) or `capture-cad.ts`.

## Contract

```rust
// census.rs
pub const CENSUS_LIMIT: usize = 4096;
pub struct Liveness { pub alive_after: Vec<bool> }
impl Liveness {
  pub fn new(steps: usize) -> Liveness;
  /// Material is present after every step in from..to (exclusive), for one sample.
  pub fn mark(&mut self, from: usize, to: usize);
  pub fn merge(&mut self, other: &Liveness);   // OR, band order
}
pub fn is_suspect(body: &Body, picture: &Liveness, state: BodyState) -> bool;
pub struct CensusStats { pub rays: u64, pub sampled: u32 }
pub fn resolve(scene: &Scene, bodies: &mut [BodyReport], picture: &[Liveness], cell: f64, budget_rays: u64) -> CensusStats;
// lattice.rs
pub fn sample_body_axis(request: &LatticeRequest, axis: usize, liveness: &mut Liveness, budget_left: &mut u64) -> AxisSample;
```

## Behaviour

- Suspect: state `Absent`, or a difference or intersection step `i` with
  `alive_after[i]` false. Only union steps and material in the picture ->
  never suspect.
- `resolve`: suspects in body order, at most `CENSUS_LIMIT`; for each,
  `sample_body_axis` on X, Y, Z over the body's conservative box (union
  tools, via `tool_view::tool_bounds`) with cell `max(cell, largest side /
  256)`, the same refinement rules and weighted-ray accounting as pairs;
  stop as soon as every step is alive (picture OR lattice), also inside an
  axis. When `budget_rays` is used up, remaining suspects get `Unknown`
  and `emptied_by_step` -1; suspects beyond the limit likewise.
- Result per sampled body: `emptied_by_step` = smallest step with
  `alive` false (always a difference or intersection), else -1. State:
  `Empty` when the last step is not alive; else `Outside` when it was
  `Absent`; else unchanged. Non-suspects keep state and -1.
- `sample_body_axis` is the one-body mode of `LatticeRequest` (`bodies.1
  == None`): "material" replaces "overlap"; per sample, fold the body's
  steps through `tool_view` and call `liveness.mark` for steps with
  material after them. Totality rules of M10 apply.
- Help part `cad.ts` (`CaptureHelpPart`): the body notes of design 4.2,
  that `cad.result.empty (sampled)` marks a feature the app rejects, after
  which picture and app differ, and two sentences on meshes and
  reference bodies (imported closed meshes take part like solids; open
  meshes are drawn translucent and labelled `[open mesh, not checked]`;
  PCB reference bodies are drawn at 45% over what is behind and take part
  in interference).

## Pitfalls

- Use `is_suspect` before any sampling: a sound model in a fitted view
  evaluates zero lattice rays.
- Keep results independent of thread count (body order, no shared
  mutable counters across threads).
- Do not change pair analysis behaviour in `lattice.rs`; the existing
  interference tests must pass unchanged.

## Tests (`#[cfg(test)]` in `census.rs`; scenes built in code with the
`Scene` struct and synthetic picture `Liveness`)

- Plate fully removed by a cut -> `Empty`, `emptied_by_step` 1.
- Plate, emptying cut, boss added -> state kept, `emptied_by_step` 1; a
  second emptying cut and add later -> still 1.
- Sound model with all steps alive in the picture -> `rays == 0`.
- Same model, picture liveness only for the boss -> lattice finds plate
  material, all -1.
- Intersect whose tool misses the body -> `Empty` at that step.
- `Absent` 200 mm block cut to a 1.5 mm pin -> `Outside` (loop refinement).
- Early exit: sound 200 mm absent plate -> fewer than 5,000 rays.
- Budget 1 with 3,000 absent bodies -> first ones resolved, rest `Unknown`;
  more than `CENSUS_LIMIT` suspects -> rest `Unknown`.
- `Liveness::mark` ranges and `merge` OR order-independent.

## Acceptance criteria

- `resolve` gives the states and first emptying step of design 6.7; a
  sound model costs no rays; budget and limit hold.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/census.rs crates/capture/src/lattice.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m18 cargo clippy -p nodetto-capture --all-targets -- -D warnings'`
2. `sh -c 'mkdir -p tmp/capture/m18 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m18 cargo test -p nodetto-capture --lib -- census:: lattice:: > tmp/capture/m18/unit.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m18/unit.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m18/unit.txt'`
3. `sh -c 'CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m18 cargo test -p nodetto-capture --test interference && bunx biome check apps/cli/src/capture-help/cad.ts && bun test apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts'`

## Progress

Pending (revision 4).
