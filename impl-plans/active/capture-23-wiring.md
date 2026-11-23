# M23 capture-23-wiring (revision 5, session 883)

- Stage: wave 1 of dispatch `capture-s883`. Accepted dependencies: M10, M20,
  M22, M17, M18, M11, M12, M14, M15 (landed at `e883b4b`, not redone).
- Design (read first; the design wins over this plan):
  `design-docs/specs/design-ai-capture.md` sections 4.1, 4.2, 6.5, 6.6,
  6.7 (open-mesh rules, census budget), 7, 8.5 (ownership row, contracts,
  superseded assertions, "M23 acceptance additions"), 10.2 ("Picture
  admission and tile storage"), 12, and section 18 rows CAP-R4-06 to
  CAP-R4-10.
- Partial work from `e883b4b` is present: picture tile accounting,
  liveness and census calls, the mesh facet seam (CAP-R4-06), first
  overlay and reference code, CLI wiring and first tests. Before
  each edit, read the file fresh and compare it with the design. Keep
  what is correct, fix what contradicts the design, and add what is
  missing.
- Pre-authorized changes, exactly: (a) the pixel digest constant in
  `crates/capture/tests/render.rs` is replaced, and the commit message
  states the old and new values; (b) the three assertions of
  `references_meshes_and_interference_stay_out_of_the_m8_picture` are
  replaced as design 8.5 says; (c) `capture-plate-default.ncs1` is
  regenerated; (d) the M9 `[not in the picture]` expectation in
  `capture-cad.test.ts` becomes the final-state note. Nothing else that
  exists is weakened. `apps/cli/native/src/engine_tests.rs` is not edited
  and must pass.

## Intent

Turn the accepted units into one working feature. The picture pass must
evaluate tools through `tool_view`, admit or refuse the scene before any
allocation, record liveness and run the census, mark and hatch
interference so that it agrees with the text, and mix reference bodies at
45%. The CLI must register the interference options and print the report.
The desktop handler must accept `interference: null`.

## Non-goals

No edits to `census.rs`, `lattice.rs`, `interference.rs`, `interval.rs`,
`overlay.rs`, `prism.rs`, the TypeScript core, help parts, docs,
`App.tsx`, `ExportDialog.tsx`, `backend.ts`, `src-tauri`, `mise.toml`,
`Cargo.toml` or `Cargo.lock`. No new JSON keys and no scene-byte change.
No new dependency. M16 work (docs, measured table, progress table) is out
of scope.

## Changes (file, symbol, decision)

1. `crates/capture/src/tiles.rs` (CAP-R4-08). Add an admission function
   that runs before any list allocation, for example
   `pub fn admit(scene, rects, samples_x, samples_y, weights) -> Result<Admission, CaptureError>`
   with `Admission { work: u64, entries: u64 }`. It uses two 2D
   difference arrays plus one prefix-sum pass, accumulates in `i128`, and
   clamps `work` to `u64::MAX`. `work` must equal `TileLists::work` on the
   built lists. Refuse with `work_error(work)` when work > `WORK_LIMIT`.
   Refuse when entries > `4_194_304`, with the same message family naming
   the tile list entries and the limit. Change `TileLists` storage to
   tile-major (one offsets array of `tiles + 1`, entries grouped per tile
   by body, then step), and add a per-tile body accessor. `build`, `steps`
   and `work` keep their signatures and results. Do not edit the M12 unit
   tests; add new ones only.
2. `raster.rs`, picture setup. Classify each tool once (`is_solid`), and
   each body once as open-source (first step's tool not solid) (CAP-R4-09,
   6.7). Call admission, then `TileLists::build`. Never call
   `tool_view::is_solid` or `mesh::is_closed` inside `sample`; replace the
   per-sample `any` scan at `raster.rs:124-129` and the one at `:542-548`.
3. `raster.rs`, sample. Visit only the bodies listed for the tile, and
   clear and collect only those. An open-source body draws only its first
   tool's surface (`first_surface_hit`) as translucent and ignores later
   steps. A solid body folds every listed step. An open-mesh operand gives
   empty intervals, so union and difference keep the material and
   intersection empties it. Use the nearest-body rule (1e-7) and
   reference bodies in the translucent slot. Mesh hits are shaded through
   `surface(facet)`, as the prism path does.
4. `raster.rs`, liveness (CAP-R4-10). Each worker keeps, per body, the
   greatest exclusive end for each starting step, updated in O(1) for each
   listed step with material. Merge workers by maximum, then sweep once
   per body into `census::Liveness` (one `mark` per maximal run).
   Open-source bodies get an all-live record and state `drawn` / `hidden`
   / `outside` before `census::resolve`.
5. `raster.rs`, boundary scans (CAP-R4-10). Before each combine, add
   `c = |accumulated| + |tool|` to the worker's pending count. When pending
   >= `CHUNK = 1_048_576`, add it to a shared `AtomicU64` before running
   the combine. If the total > allowance, skip the combine, set the stop
   flag and return. Read the stop flag at each flush, and flush the rest
   at the end of each band. Refuse with exit 2 and the exact message of
   design 10.2. An internal entry takes `allowance` and returns the
   executed reads and the number of workers started (used by tests);
   `render_rgb` and `render_scene` pass `16_000_000_000`.
6. `raster.rs`, after sampling. If `draw_interference`, run
   `marks.picture_only(&pairs)?` and then `add_view_pairs` with the target
   cell. Call `census::resolve` with budget
   `budget_million_rays * 1_000_000` when `scene.analyse`, else
   `24_000_000` (CAP-R4-09). `BodyReport.open` comes from the first-tool
   classification.
7. `shade.rs`. Add `reference_mix(behind, shade, opacity)` per channel,
   rounded deterministically. Compositing order: shade, edges, reference
   mix, hatch (with outline), then downsample. `lib.rs` and `report.rs`:
   only what the wiring needs; JSON keys and order unchanged.
8. `tool_view.rs` (picture constructor and facet dispatch only) and
   `mesh.rs` (CAP-R4-06 seam only): finish them if incomplete. Do not
   touch `intervals`, `first_hit`, `is_closed`, `mesh_bounds` or the M11
   tests.
9. `apps/cli/src/capture-command.ts`: accept
   `CAPTURE_INTERFERENCE_VALUE_OPTIONS` and `CAPTURE_INTERFERENCE_FLAGS`
   for CAD pages only; an option of the other page family exits 2.
   `capture-cad.ts`: call `parseInterferenceOptions`; send `interference`
   and `decodeMesh: decodeCaptureMesh` (from `@nodetto/io/nmesh`); print
   `describeBodies().line`, then `errors:` (model errors first, then
   sampled errors), then `describeInterference().lines`; with `--json`, add
   `bodies`, the sampled errors and `interference`; exit with
   `interferenceExitCode`; backend refusals exit 2.
10. `apps/desktop/src/shell/export-handlers.ts` (CAP-R4-07): the options
    of `captureCadImage` gain `interference?: CadCaptureInterference |
    null`. An absent key means `DEFAULT_CAD_INTERFERENCE`; `null` is passed
    through. No other desktop file changes.

Follow these patterns: `prism.rs:PrismView::surface_intervals` and
`surface`; `tiles.rs:TileLists::build` (`tiles_for` rectangle rule,
intersection covers every tile); `capture-cad.test.ts` fakes;
`export-handlers.test.ts:224-300`.

## Tests (add next to the code; all pre-authorized)

Design 8.5 moves the render-level and native tests of M17, M18, M11 and
M12 to this plan. Some of them already exist; extend those files to cover
every case below.
- `tests/overlay.rs`:
  - Plate fixture: overlap pixels are hatch colours or mixes of them,
    also behind the Block face.
  - The hole centre inside the overlap is not marked from `top`.
  - With the draw bit clear, the picture equals the bit-clear picture.
  - Block moved 30 mm: the two pictures are equal.
  - The lit top and the dark side use the same colour set.
  - 100 seeded scenes: the marking pairs are a subset of the reported
    pairs, and every reported pair that projects over more than 2 samples
    marks at least one sample.
  - A 0.05 mm pin gives a `from_view` pair.
  - 40 stacked bodies use <= 28 comparisons per sample.
  - 200 sub-cell pairs give the too-many-pairs error.
  - 1, 2 and 5 threads give equal output.
  - No-overlay regression (design 8.5): draw bit set and no pair gives the
    same picture as the bit clear.
- `tests/census.rs`: the M18 cases end to end through `render_rgb`
  (emptied, refilled, sound model with zero census rays, hidden inside a
  housing, outside the view, intersect miss), and 1 vs 5 threads equal.
- `tests/mesh.rs`:
  - A prism cut through a cube mesh shows the background.
  - An open mesh is drawn mixed and not reported.
  - A reference body in front gives the 45% mix, and the body behind it is
    `Drawn`; a reference behind an opaque body is `Hidden`.
  - The stepped-mesh edge rule holds, and a sphere has edges only on its
    outline (real triangle normals).
  - Release: 200,000 triangles at 1024 x 768 render in under 3,000 ms.
- `tests/scale.rs`:
  - Buffers and reports (including `emptied_by_step`) equal a test-support
    all-steps reference path for: Plate, a 20 x 15 plate grid, a 600-hole
    plate, 50 bodies with intersects, and an emptied-and-refilled plate.
  - The zig-zag and 20,000-tool scenes are refused in under 1,000 ms.
  - Release: the 600-hole plate renders on one thread in under 1,500 ms,
    and the time is printed.
- `mesh.rs` unit tests (CAP-R4-06; add only if missing):
  - Cube, ray along +z through (0.5, 0.5): `surface_intervals` gives the
    same `s` values and tool as `intervals`; through `surface`, the faces
    give face id 0 and unit normals (0,0,+-1) (length within 1e-12 of 1).
  - The same ray through `intervals` gives face id 0 for every face.
  - An open cube (one triangle missing): `surface_intervals` is empty;
    `first_surface_hit` has the same `s` as `first_hit`.
  - `surface(u32::MAX)` and `surface(len)` give `None`.
  - When the first triangle has an invalid index, facet 0 is the first
    valid triangle.
- `capture-cad.test.ts` (fake backend):
  - Option validation and exclusions.
  - Text and JSON with one capped and one complete pair mark the same pair
    `approximate`.
  - 25 unchecked candidates give `uncheckedCount` 25 with twenty listed.
  - Exit codes: 1 with a pair, 1 with only unchecked candidates, 0 with
    only capped pairs, 0 without the flag.
  - The emptied, refilled, hidden and outside notes.
  - The regenerated fixture equals the `prepareCadCapture` call of the
    sharedPathNotes, and a mesh-only page gives the same bytes as that call.
  - `--no-interference` writes options 0; the default writes options 3.
- `native-parity/capture.test.ts`:
  - `capture-plate.jsonl` prints `interference: 1 (1 candidate pair
    checked, cell 0.25 mm)` and a `Plate x Block` volume within 1% of
    590.721, with equal lines for `top`, `front` and `iso`.
  - `--fail-on-interference` exits 1 and the file is written.
  - Block moved gives `interference: 0`, and the 1.5 mm pin gives one pair.
  - `--interference-bodies Plate,Puck` gives 0; `--interference-cell 1`
    gives `cell 1 mm`; `--no-interference` gives `not checked`.
  - Overlap pixels differ from the `--no-interference` picture and contain
    `#335c67`/`#fffdf8` (dark `#5fb4c7`/`#1f2427`); two runs give equal
    bytes.
  - Plate/Trim/Boss gives `errors: 1` with `cad.result.empty (sampled)`.
  - A cube `cad.mesh` with a cut exits 0 with one deterministic body.
  - A `cad.pcb` board is listed.
  - 1,000 elements in 50 bodies take under 10,000 ms over three runs
    (`tmp/capture/m23/timing.json`).
  - The stacked case checks 1,225 candidates.
  - The M9 budget test still passes.
- Add every case of design 8.5 "M23 acceptance additions". This includes
  the open-mesh positions, admission equality with 20,000 one-tile bodies,
  the entry-limit refusal, the off-tile liveness suffix, the span-record
  equality, the exact operation count (S counts repeated band rows:
  53,692,800 reads for 64 x 320 with 50 unions), and the costly-row
  refusal (1, 2 and 5 started workers, executed reads <= allowance +
  workers x CHUNK).
- `export-handlers.test.ts`, new cases only: the Plate scene equals the
  committed fixture; a mesh-only page equals the same `prepareCadCapture`
  call; `interference: null` writes options 0; the default writes 3.
- Keep unchanged: the 20,000-intersection refusal (under 1,000 ms), the
  200,000-triangle gate (under 3,000 ms), the determinism tests in
  `render.rs` and the M9 budget test.

## Pitfalls

- Do not:
  - refuse a scene after allocating its lists;
  - write a liveness span on every sample;
  - check the scan total only at row end;
  - print a partial count in a refusal message;
  - make a visible open mesh a census subject;
  - mark a solid body `open` because a later step uses an open mesh.
- Timing tests may be tried up to 3 times under load, then run alone, with
  every attempt logged. No deadline is relaxed.

## Acceptance criteria

- Picture, report, census and interference all use the same first-tool
  classification. Admission and the scan allowance follow design 10.2.
  Bytes are equal for 1, 2 and 5 threads.
- The CLI options, text, JSON and exit codes match 4.1, 4.2 and 12. The
  desktop handler supports `interference: null`.
- All four verification commands exit 0 with positive pass counts. Native
  parity is not skipped. `engine_tests.rs` is unedited.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/raster.rs crates/capture/src/shade.rs crates/capture/src/lib.rs crates/capture/src/report.rs crates/capture/src/tool_view.rs crates/capture/src/mesh.rs crates/capture/src/tiles.rs crates/capture/tests/*.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23 cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m23 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23 cargo test --release -p nodetto-capture --lib --test overlay --test census --test mesh --test scale --test render -- --nocapture > tmp/capture/m23/release.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m23/release.txt; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" tmp/capture/m23/release.txt && ! grep -Eq "[1-9][0-9]* failed" tmp/capture/m23/release.txt'`
3. `sh -c 'bun run typecheck && bunx biome check apps/cli/src/capture-command.ts apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.ts apps/cli/src/capture-cad.test.ts apps/cli/src/native-parity/capture.test.ts apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/desktop/src/shell/export-handlers.test.ts'`
4. `sh -c 'mkdir -p tmp/capture/m23 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23" cargo test -p nodetto-cli && CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23" cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/capture-m23/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts > tmp/capture/m23/native-parity.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m23/native-parity.txt; test $s -eq 0 && grep -Eq "[1-9][0-9]* pass" tmp/capture/m23/native-parity.txt && ! grep -Eq "[1-9][0-9]* skip" tmp/capture/m23/native-parity.txt'`

## Progress

Session 868 left a partial implementation, blocked on two scope gaps
that CAP-R4-07 now resolves. Workers append one entry per run with: date,
command, exit status, log path, and the `git hash-object` of each owned
file before and after, plus any drift.
