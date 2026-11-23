# M23 capture-23-wiring (revision 6, session 884)

> Session 885: not dispatched again. Split into M23a to M23f
> (`capture-23a-tile-admission.md` ... `capture-23f-host-cases.md`, design
> 8.5 "M23 split", CAP-R6-01 to CAP-R6-05). This file stays the shared
> reference for traps and test intent; sub-plans do not edit it.

- Dispatch `capture-s884`, wave 1, dependsOn none. Accepted and not redone:
  M1-M15, M17-M20, M22 (M10/M11/M12/M14/M15/M17/M18/M20/M22 at `e883b4b`).
- Design wins over this plan: `design-docs/specs/design-ai-capture.md`
  revision 5, sections 4.1, 4.2, 6.3, 6.5-6.7, 7, 8.5 (ownership row,
  contracts, superseded assertions, CAP-R5-01 to -04, "M23 acceptance
  additions"), 10.2 ("Picture admission and tile storage"), 12, and the
  section 18 rows CAP-R4-06 to CAP-R4-10 and CAP-R5-01 to CAP-R5-04.
  Read them before editing; this plan only names the work and the traps.
- Evidence: `tmp/capture/m23/` (gate output), progress logs under
  `tmp/capture-s884/capture-23-wiring/`. Build dir `target/capture-m23`.

## Intent

Turn the accepted units into one working feature: `nodetto-cli capture` on
a 3D CAD page draws interference as a hatch that agrees with the text,
reports body states and emptied bodies, renders meshes and reference
bodies, refuses oversized scenes before allocating, and stays
byte-deterministic for every worker count.

## State at `e43016d` (verify, do not trust)

Present: census call with the 24M budget when analysis is off;
analyse/draw bit split (`raster.rs:538-545`); `shade::reference_mix`;
`overlay::hatch` call; mesh facet seam (`mesh.rs:266-290`,
`tool_view.rs:33-55`); CLI options, printing and exit codes
(`capture-cad.ts:12-174`, `capture-command.ts:369-387`); desktop
`interference` option; both fixtures (`capture-plate-no-interference.ncs1`
equals `198a0be:apps/cli/src/__fixtures__/capture-plate-default.ncs1`).
Missing: `tiles.rs` admission, entry limit and tile-major storage; per-tile
body visit; tool classification still runs per sample (`raster.rs:124-129`);
`BodyReport.open` is set when any step's tool is open (`raster.rs:546-552`),
which contradicts the first-tool rule of CAP-R4-09; O(1) liveness spans; the boundary-scan allowance; most of the
test inventory (`tests/overlay.rs`, `census.rs`, `mesh.rs`, `scale.rs` hold
1-3 tests each). Three `render.rs` tests fail (see pre-authorized changes).

## Pre-authorized changes to existing tests (exactly these)

(a) `crates/capture/tests/render.rs:390-411`: the three assertions design
8.5 names, replaced as it says (45% mix sample, reference `Drawn`, open
mesh `Drawn` with `open` true, `candidates == 0`, empty `pairs`).
(b) `render.rs:162-178` (CAP-R5-01): states become `[Drawn, Drawn, Drawn,
Hidden, Outside, Empty]`, plus `bodies[4].emptied_by_step == -1` and
`bodies[5].emptied_by_step == 1`. The census is right; do not change code
to restore `Absent`.
(c) `render.rs:339` digest constant, only under the CAP-R5-03 rule (below).
(d) The M9 `[not in the picture]` expectation in `capture-cad.test.ts:137`
becomes the final-state note the wired report prints.
(e) `cad-request.test.ts`: fixture expectations only (already applied;
keep). Commit messages for (a)-(c) state old and new values. Nothing else
that exists is weakened.

## Non-goals

No edits to `census.rs`, `lattice.rs`, `interference.rs`, `interval.rs`,
`overlay.rs`, `prism.rs`, `scene.rs`, the TypeScript core (except (e)),
help parts, docs, `App.tsx`, `ExportDialog.tsx`, `backend.ts`,
`src-tauri`, `mise.toml`, `Cargo.toml`, `Cargo.lock`,
`tests/interference.rs`, `apps/cli/native/src/engine_tests.rs`. No new
JSON keys, no scene-byte change, no new dependency, no M16 work.

## Changes

1. `tiles.rs` (CAP-R4-08). Add
   `pub fn admit(rects: &[SampleRect], samples_x: u32, samples_y: u32, weights: &[u64]) -> Result<Admission, CaptureError>`
   with `pub struct Admission { pub work: u64, pub entries: u64 }` (adjust
   the argument list to what `build` needs, keep it allocation-light). Two
   2D difference arrays over tiles plus one prefix pass; accumulate in
   `i128`, clamp to `u64::MAX`. Refuse with `work_error(work)` above
   `WORK_LIMIT`, and above `4_194_304` entries with a message naming the
   tile list entries and the limit. Storage becomes tile-major (offsets of
   length tiles + 1; entries grouped by body, then step) with a per-tile
   body accessor. `build`, `steps`, `work` keep signatures and results; M12
   unit tests untouched.
2. `raster.rs` setup: classify each tool once (`tool_view::is_solid`) and
   each body once as open-source (first step's tool not solid, CAP-R4-09).
   Call `admit` before `TileLists::build`. Remove the per-sample scan and
   set `BodyReport.open` from the first-tool classification.
3. `raster.rs` sample: visit only the tile's bodies. Open-source body:
   first tool's surface only, translucent, later steps ignored. Solid
   body: fold every listed step; an open-mesh operand is empty (union and
   difference keep material, intersection empties). Nearest-body rule
   1e-7. Mesh hits shaded through `surface(facet)`.
4. `raster.rs` liveness (CAP-R4-10): per worker and body, the greatest
   exclusive end per starting step, O(1) per listed step; merge by
   maximum; one sweep per body into `census::Liveness` (one `mark` per
   maximal run). Open-source bodies: all-live record, state from the
   picture, before `census::resolve`.
5. `raster.rs` boundary allowance (CAP-R4-10): before each combine add
   `|accumulated| + |tool|` to a pending count; at `CHUNK = 1_048_576`
   flush into a shared `AtomicU64`; above the allowance skip the combine,
   set the stop flag, return; check the flag at each flush; flush the rest
   at band end. Fixed refusal message of design 10.2, exit 2. An internal
   entry takes `allowance` and returns executed reads and started workers;
   `render_rgb` and `render_scene` pass `16_000_000_000`.
6. `shade.rs`, `lib.rs`, `report.rs`: compositing order shade, edges,
   reference mix, hatch with outline, then downsample; only what wiring
   needs; JSON keys and order unchanged. `tool_view.rs`/`mesh.rs`: finish
   the picture constructor and facet seam only if incomplete.
7. CLI and desktop: check the present code against design 4.1, 4.2, 12
   and CAP-R4-07; fix only contradictions.

Imitate: `prism.rs:PrismView::surface_intervals`, `tiles.rs:TileLists::build`
(`tiles_for` rule), `capture-cad.test.ts` fakes,
`export-handlers.test.ts:224-300`.

## Pitfalls

Do not allocate lists before refusing; do not write liveness per sample;
do not check the scan total only at row end; do not print partial counts
in refusals; do not make an open-source body a census subject or a pair
member; do not mark a solid body `open` because a later step uses an open
mesh; do not change iteration order in a way that makes bytes depend on
worker count. Replace the digest last.

## Tests (all pre-authorized; add next to the code)

- Every case of design 8.5 "M23 acceptance additions" (mesh, census,
  `tiles.rs` units, scale, raster units with the exact 53,692,800 reads and
  the costly-row refusal for 1, 2 and 5 started workers).
- `tests/overlay.rs`: the CAP-R5-03 checks on `fixtures/plate-iso.ncs1`
  (bit-clear digest `0x29c6_4b3e_156d_0941`; changed pixels non-empty and
  inside a reported pair's projected box +2 px; both hatch colours
  present); hatch also behind the Block face; hole centre not marked from
  `top`; Block moved 30 mm gives equal pictures; 100 seeded scenes: marking
  pairs subset of reported pairs, every reported pair projecting over more
  than 2 samples marks one; 0.05 mm pin gives a `view` pair; 40 stacked
  bodies use at most 28 comparisons per sample; 200 sub-cell pairs give the
  too-many-pairs error; draw bit set with no pair equals bit clear; 1/2/5
  threads equal.
- `tests/census.rs`: emptied, refilled, sound (zero census rays), hidden in
  a housing, outside the view, intersect miss, end to end; 1 vs 5 threads.
- `tests/mesh.rs`: prism cut through a cube mesh shows background; reference
  in front gives the 45% mix and the body behind is `Drawn`; reference
  behind an opaque body is `Hidden`; sphere edges only on its outline.
- `tests/scale.rs`: buffers and reports (with `emptied_by_step`) equal an
  all-steps reference path for Plate, a 20 x 15 grid, the 600-hole plate,
  50 bodies with intersects, an emptied-and-refilled plate; release:
  600-hole plate on one thread under 1,500 ms, printed.
- `capture-cad.test.ts` / `capture-command.test.ts` (fake backend, new
  cases): interference option on a 2D page exits 2; one capped and one
  complete pair, text and JSON mark the same pair `approximate`; 25
  unchecked give `uncheckedCount` 25 with twenty listed; exit codes 1 (pair),
  1 (only unchecked), 0 (only capped), 0 (no flag); emptied, refilled,
  hidden, outside notes; `--no-interference` options 0, default options 3.
- `native-parity/capture.test.ts`: Plate prints `interference: 1 (1
  candidate pair checked, cell 0.25 mm)` and `Plate x Block` within 1% of
  590.721 for `top`, `front`, `iso`; `--fail-on-interference` exits 1 and
  writes the file; Block moved gives 0; 1.5 mm pin gives one pair;
  `--interference-bodies Plate,Puck` 0; `--interference-cell 1`; hatch
  colours `#335c67`/`#fffdf8` (dark `#5fb4c7`/`#1f2427`) and two runs equal;
  Plate/Trim/Boss `errors: 1` with `cad.result.empty (sampled)`; cube
  `cad.mesh` with a cut exits 0; a `cad.pcb` board is listed; 1,000 elements
  in 50 bodies under 10,000 ms (`tmp/capture/m23/timing.json`); stacked case
  checks 1,225 candidates; the M9 budget test passes.
- `export-handlers.test.ts`: Plate equals the default fixture; mesh-only
  page equals the `prepareCadCapture` call; `null` options 0; default 3.
- Unchanged deadlines: 20,000-intersection refusal under 1,000 ms,
  200,000 triangles under 3,000 ms, M9 budget. Timing tests: up to 3
  attempts under load, then alone; every attempt logged.

## Acceptance and verification

Acceptance: the acceptance criteria of plan `capture-23-wiring` in
`impl-plans/active/capture-s884-dispatch.json`. Verification: its four
commands, each exit 0 with a positive pass count (1: rustfmt, clippy
`-D warnings`, `cargo test -p nodetto-capture`; 2: release crate tests into
`tmp/capture/m23/release.txt`; 3: typecheck, biome, owned `bun test`; 4:
`cargo test -p nodetto-cli`, release build, native parity into
`tmp/capture/m23/native-parity.txt` with no skip).

## Progress protocol

Read each file fresh before editing; record `git hash-object` before and
after. A hash that differs from your last recorded value is drift: stop
and record it. One entry per run: date, command, exit status, full log
path, retries, hashes. No state-changing git commands.

## Progress

- Sessions 868 and 883 (summary): desktop option, fixture amendment and
  analyse/draw split applied; gate 3 passed 200 tests
  (`tmp/capture-s883/capture-23-wiring/gate-3-rerun.log`); gate 1 exited
  101 with the three `render.rs` failures (`gate-1-rerun.log`); gates 2
  and 4 not run.
- Session 884: pending.
- Session 884 implementation continuation (2026-11-23): classified tools once
  in raster setup, applied first-tool open-source behavior and recorded liveness
  spans as per-step maxima; added an open operand/source regression. Raster
  hashes: `ab34efdcebda3ced6505bae353ed8af56b05351f` ->
  `11c4dc37ef923019f0e1b565ed5253fb3ab387f6` ->
  `34480090d85bf0b39552b2ecb686d43da19f17bf`; mesh test hashes:
  `89c35fe912e3a4876a02e1cc3312b7447aced33b` ->
  `2571016b18afb89546b754c378bdde1a4097fb32`. Focused mesh regression
  passed (1 test, exit 0), log `tmp/capture-s884/capture-23-wiring/open-operands-spans-test.log`;
  rustfmt check passed, log `tmp/capture-s884/capture-23-wiring/rustfmt.log`.
  `cargo test -p nodetto-capture` exited 101 with the three known render
  assertions, log `tmp/capture-s884/capture-23-wiring/cargo-test-current.log`.
  Admission, tile-major storage, per-tile visits, boundary allowance, required
  acceptance tests, render assertion updates and all four final gates remain.
  The digest remains unchanged pending CAP-R5-03 proof. No acceptance claimed.
