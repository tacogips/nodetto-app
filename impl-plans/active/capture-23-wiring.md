# M23 capture-23-wiring (new in revision 4)

- Stage: wiring, after both waves. dependsOn: M17, M18, M11, M12, M14,
  M20, M22 (and through them M10, M15).
- Design: sections 4.1, 4.2, 6.5, 6.6 (Picture), 6.7, 7, 8.5 (contracts,
  superseded assertions), 10.2, 12.
- writePaths: `crates/capture/src/lib.rs`, `crates/capture/src/raster.rs`,
  `crates/capture/src/shade.rs`, `crates/capture/src/report.rs`,
  `crates/capture/src/tool_view.rs` (picture-family constructor only),
  `crates/capture/tests/render.rs`, `crates/capture/tests/support/mod.rs`
  (new helpers only), `crates/capture/tests/overlay.rs`,
  `crates/capture/tests/census.rs`, `crates/capture/tests/mesh.rs`,
  `crates/capture/tests/scale.rs` (four new),
  `apps/cli/src/capture-command.ts`, `apps/cli/src/capture-command.test.ts`,
  `apps/cli/src/capture-cad.ts`, `apps/cli/src/capture-cad.test.ts`,
  `apps/cli/src/__fixtures__/capture-plate-default.ncs1`,
  `apps/cli/src/native-parity/capture.test.ts`,
  `apps/desktop/src/shell/export-handlers.test.ts` (new cases only),
  `impl-plans/active/capture-23-wiring.md`, `tmp/capture/m23`, `target`
- Pre-authorised, exactly: (a) the pixel digest constant in
  `tests/render.rs` is replaced (the Plate fixture now has the draw bit and
  a pair); the commit message states old and new values. (b) In
  `references_meshes_and_interference_stay_out_of_the_m8_picture`
  (`tests/render.rs:390-411`) lines 407, 410, 411 are replaced as design
  8.5 requires (45% mix pixel against the two single-body renders,
  reference body `Drawn`, open-mesh body `Drawn` with `open` true;
  `candidates == 0`, empty `pairs` and the two-thread render kept). (c)
  The fixture is regenerated. (d) The M9 test in `capture-cad.test.ts`
  that expects `[not in the picture]` for an `absent` body changes to the
  final-state notes. Nothing else existing is weakened.
  `apps/cli/native/src/engine_tests.rs` is not edited and must pass.

## Intent

Make the units of both waves one working feature: the picture pass
evaluates tools through `tool_view` with tile lists, records liveness,
marks interference and hatches it, mixes reference bodies, resolves the
census; the CLI registers the options and prints the report text.

## Non-goals

No change to analysis rules, unit modules (`overlay.rs`, `census.rs`,
`mesh.rs`, `tiles.rs`, `lattice.rs`, `interference.rs`), TypeScript core,
help parts, desktop sources, docs (M16).

## Changes

1. `raster.rs` (`render_rgb`): build `ToolView`s for the camera family
   (window = picture) for prisms and meshes; compute each tool's sample
   rectangle; `TileLists::build`; refuse with `tiles::work_error` when
   `work(weights) > WORK_LIMIT` before any sample. Per sample fold only
   `steps(body, tile)`; record `Liveness::mark(j, k)` for listed step `j`
   with material up to the next listed step `k`. Visit bodies in history
   order; nearest-body rule with 1e-7 tolerance; open meshes via
   `first_hit`, never solid. With the draw bit: `overlapping_pairs` over
   analysed, non-open bodies with material; `stretch_box`; per-band
   `MarkTable`, merged in band order. After the analysis:
   `picture_only` (error propagates) then `add_view_pairs` with the target
   cell. Then `census::resolve` with target cell and budget. Set
   `BodyReport.open` from `tool_view::is_solid`. Body state per design 6.7
   (reference bodies and open meshes in front do not hide a solid).
2. `shade.rs`: `reference_mix(behind, shade, opacity)` = per channel
   `behind + (shade - behind) * opacity / 255`, rounded deterministically;
   compositing order: shade, edges, reference mix, hatch (with outline:
   a marked sample with an unmarked 4-neighbour), then downsample.
3. `lib.rs`, `report.rs`: only what the wiring needs; JSON keys unchanged.
4. `capture-command.ts`: accept `CAPTURE_INTERFERENCE_VALUE_OPTIONS` and
   `CAPTURE_INTERFERENCE_FLAGS` for CAD pages only (option of the other
   family -> exit 2 as today).
5. `capture-cad.ts`: `parseInterferenceOptions`; request with
   `interference` and `decodeMesh: decodeCaptureMesh` (`@nodetto/io/nmesh`);
   print `describeBodies().line`, `errors:` = model errors + sampled
   entries (indented, sampled after model ones), then
   `describeInterference().lines`; `--json` adds `bodies` with `state`,
   `emptiedByStep`, `open`, sampled errors with `"sampled": true`, and
   `interference` = `describeInterference().json`; exit code
   `interferenceExitCode`; backend errors (work limit, too many pairs) exit 2.

## Tests

- `tests/overlay.rs`: Plate fixture overlap pixels are hatch colours or
  their mixes, also behind the Block face; hole centre in the overlap not
  marked from `top`; draw bit clear equals the bit-clear picture; Block
  moved 30 mm -> equal pictures; same colour set on lit top and dark side;
  100 seeded scenes: marking pairs subset of reported, and every reported
  pair projecting over > 2 samples marks one; 0.05 mm pin -> `from_view`;
  40 stacked bodies <= 28 comparisons per sample; 200 sub-cell pairs ->
  too-many error; 1, 2, 5 threads equal; no-overlay regression (draw bit,
  no pair -> equals bit clear).
- `tests/census.rs`: the M18 cases end to end through `render_rgb`
  (emptied, refilled, sound model zero census rays, hidden in housing,
  outside, intersect miss), 1 vs 5 threads equal.
- `tests/mesh.rs`: prism cut through cube mesh shows background; open
  mesh drawn mixed, not reported; reference in front -> 45% mix and body
  behind `Drawn`, behind opaque -> `Hidden`; stepped mesh edge rule; sphere
  edges only on outline; release: 200,000 triangles at 1024 x 768 < 3,000 ms.
- `tests/scale.rs`: buffers and reports (with `emptied_by_step`) equal to a
  test-support all-steps reference path for Plate, 20 x 15 plate grid,
  600-hole plate, 50 bodies with intersects, emptied-and-refilled plate;
  zig-zag and 20,000-tool scenes refused < 1,000 ms; release: 600-hole
  plate < 1,500 ms one thread, printed.
- `capture-cad.test.ts` (fake backend): option validation and exclusions;
  text and JSON with a capped and a complete pair (same pair approximate in
  both), 25 unchecked (`uncheckedCount` 25, twenty listed); exit 1 with a
  pair, 1 with only unchecked, 0 with only capped, 0 without the flag;
  emptied, refilled, hidden, outside notes; regenerated fixture equals
  `prepareCadCapture(Plate, iso, 1024x768, light, DEFAULT_CAD_INTERFERENCE,
  decodeCaptureMesh)`; a mesh-only page gives the same bytes as that call;
  `--no-interference` writes options 0, default options 3.
- `export-handlers.test.ts` new cases: desktop Plate scene equals the
  committed fixture; mesh-only page scene equals the same
  `prepareCadCapture` call; `interference: null` writes options 0.
- `native-parity/capture.test.ts`: `capture-plate.jsonl` prints
  `interference: 1 (1 candidate pair checked, cell 0.25 mm)` and a `Plate x
  Block` volume within 1% of 590.721; equal interference lines for `top`,
  `front`, `iso`; `--fail-on-interference` exits 1 with the file written;
  Block moved -> `interference: 0`; 1.5 mm pin document -> one pair;
  `--interference-bodies Plate,Puck` -> 0; `--interference-cell 1` ->
  `cell 1 mm`; `--no-interference` -> `not checked`; overlap pixels differ
  from `--no-interference` and contain `#335c67`/`#fffdf8` (dark
  `#5fb4c7`/`#1f2427`); two runs equal bytes; Plate/Trim/Boss -> `errors: 1`
  with `cad.result.empty (sampled)`; cube `cad.mesh` with a cut -> exit 0,
  one body, deterministic; `cad.pcb` board listed; 1,000 elements in 50
  bodies < 10,000 ms (three runs, `tmp/capture/m23/timing.json`); stacked
  -> 1,225 candidates checked; M9 budget test still passes.

## Verification (each must exit 0)

1. `sh -c 'rustfmt --edition 2021 --check crates/capture/src/raster.rs crates/capture/src/shade.rs crates/capture/src/lib.rs crates/capture/src/report.rs crates/capture/src/tool_view.rs crates/capture/tests/*.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23 cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23 cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m23 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m23 cargo test --release -p nodetto-capture --test overlay --test census --test mesh --test scale --test render -- --nocapture > tmp/capture/m23/release.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m23/release.txt; test $s -eq 0 && ! grep -Eq "[1-9][0-9]* failed" tmp/capture/m23/release.txt'`
3. `sh -c 'bun run typecheck && bunx biome check apps/cli/src/capture-command.ts apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.ts apps/cli/src/capture-cad.test.ts apps/cli/src/native-parity/capture.test.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/desktop/src/shell/export-handlers.test.ts'`
4. `sh -c 'CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23" cargo test -p nodetto-cli && CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23" cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/capture-m23/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts > tmp/capture/m23/native-parity.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m23/native-parity.txt; test $s -eq 0 && grep -Eq "[1-9][0-9]* pass" tmp/capture/m23/native-parity.txt && ! grep -Eq "[1-9][0-9]* skip" tmp/capture/m23/native-parity.txt'`

## Progress

Pending.
