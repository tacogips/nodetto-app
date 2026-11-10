# ipd-26-example-sample

- planId: ipd-26-example-sample
- planPath: impl-plans/active/ipd-26-example-sample.md
- progressPath: impl-plans/progress/ipd-26-example-sample.md
- dependsOn: ipd-11-frames, ipd-13-prototype-core-cli, ipd-15-kit-content, ipd-16-frames-export-compare, ipd-20-app-lint, ipd-21-html-prototype, ipd-23-parity-shapes, ipd-24-parity-flows
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, section "Help, docs and examples" (the sample), and "Accepted output changes" (regenerated `examples/design` previews).
- Evidence: `tmp/ipd-s772/ipd-26-example-sample/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/kits/ios/bars.ts`
  - `packages/core/src/kits/ios/content.ts`
  - `packages/core/src/kits/ios/style.ts`
  - `packages/core/src/kits/ios/insert.ts`
  - `packages/core/src/kits/ios/props.ts`
  - `packages/core/src/kits/ios/types.ts`
  - `packages/core/src/kits/ios/kit-core.test.ts`
  - `packages/core/src/kits/ios/kit-content.test.ts`
  - `examples/design`
  - `apps/cli/scripts/generate-iphone-kit-example.ts`
  - `apps/cli/src/iphone-kit-example.test.ts`
  - `apps/cli/src/native-parity/iphone-kit-example.test.ts`
  - `impl-plans/progress/ipd-26-example-sample.md`
  - `tmp/ipd-s772/ipd-26-example-sample`
  - `target`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-26-example-sample`
  - `target`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Intent and context

The acceptance criteria require a generic iPhone sample under `examples/` that exercises the kit and prototype flows, and is built only with CLI operations.

Outside titles (`ipd-11`) and link omission (`ipd-13`) change the existing design example previews. This plan also regenerates them.

## Non-goals

- No source changes, other than the generator script and the test listed.
- Nothing derived from any private reference material. The sample is a fictional "garden journal" app.

## File-level changes

New `examples/design/iphone-kit/build.ops.json`: one JSON array of edit operations, applied to an empty document. It builds:

- one page "App" in app mode;
- four `frame:iphone` screens, named "Plants", "Plant detail", "Settings" and "Add entry" (the last a `bottom-sheet` screen kind), laid out in one row 80 apart;
- on each screen: `ios:status-bar`, `ios:home-indicator` and, except on the sheet, `ios:tab-bar` with items "Plants" / leaf, "Calendar" / calendar, "Settings" / settings, with `active` per screen and `prototypeFixed` and `layerName` "Tab bar";
- Plants: `ios:nav-bar` with a large title, `ios:search-field`, a vertical list frame with `layout` and five `ios:list-row` (leading icon, title, subtitle, chevron), and an `ios:fab` (plus);
- Plant detail: a nav bar with back, `ios:segmented` (Care / Notes / Photos), `ios:chip` items, and an `ios:card` with `accentSide` left;
- Settings: `ios:section-header` and rows with the `switch` accessory;
- Add entry: `ios:text-field` and `ios:composer`.

Prototype links:

- tab bar items -> the corresponding screens;
- row 1 -> detail;
- detail back (`prototype:back`);
- fab -> Add entry (`open-overlay`, bottom-center, slide-up);
- the composer send -> `close-overlay`.

Flow start on Plants, named "Main".

`examples/design/iphone-kit/design.jsonl`: the result of applying `build.ops.json` to an empty document with the CLI.

`examples/design/iphone-kit/screens/`: `export --frames --format png --scale 2` output.

`examples/design/iphone-kit/storyboard.png`: `export --prototype --format png --scale 1`.

`examples/design/iphone-kit/prototype.html`: `export --format prototype`.

`examples/design/iphone-kit/README.md`: what it shows, how to rebuild, how to open it.

New `apps/cli/scripts/generate-iphone-kit-example.ts`:

- Runs the steps above through `runCliAsync` against a fresh empty document.
- Overwrites the outputs deterministically.
- Imitate `apps/cli/scripts/generate-design-examples.ts`.

`examples/design/README.md`: add the row for the new sample and the rebuild command.

Regenerate the existing previews with `bun apps/cli/scripts/generate-design-examples.ts`. That rewrites `examples/design/iphone-planner/*` and `examples/design/web-workspace/*`. Review the diffs: the only expected visual changes are outside titles and omitted links. Record anything else as a finding.

New `apps/cli/src/iphone-kit-example.test.ts`:

- Applying `build.ops.json` to an empty document yields bytes equal to `examples/design/iphone-kit/design.jsonl`.
- `validate` -> exit 0.
- `lint` -> zero findings with an `app-` rule id, and zero findings overall.
- `inspect --flows` -> one flow "Main" with 4 screens.

New `apps/cli/src/native-parity/iphone-kit-example.test.ts`: the native binary applying `build.ops.json` writes identical bytes (`compareFile`).

## Patterns to imitate

- `apps/cli/scripts/generate-design-examples.ts`: deterministic example generation and output layout.
- `apps/cli/src/native-parity/drawing.test.ts:111,192`: applying an ops file through both CLIs.

## Invariants

- Only generic, fictional content. Nothing derived from private reference material.
- `build.ops.json` is the only authored source of the sample document.
- Regenerating twice produces byte-identical outputs.

## Tests (input -> expected outcome)

- `build.ops.json` applied to an empty document -> bytes equal `design.jsonl`.
- `validate` -> exit 0. `lint` -> 0 findings.
- `inspect --flows` -> one flow "Main" with 4 screens.
- Native binary applying `build.ops.json` -> identical bytes.

## Pitfalls

- Each id in `design.jsonl` must be deterministic. Use `ref` names and the CLI's id assignment; if ids are random per run, give explicit ids in the operations.
- The document must lint clean: integer coordinates, touch targets, no overlaps.
- Large PNGs: keep the screens at scale 2 (4 PNGs). The total `examples/design/iphone-kit` size should stay under 5 MB.

## Verification (evidence in `final/`)

1. `bun apps/cli/scripts/generate-iphone-kit-example.ts` -> exit 0. A second run leaves `shasum -a 256` of every output file unchanged.
2. `bun test apps/cli/src/iphone-kit-example.test.ts packages/core/src/templates/design-templates.test.ts` -> exit 0, 0 fail.
3. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/iphone-kit-example.test.ts` -> exit 0, 0 skip.
4. `bun apps/cli/scripts/generate-design-examples.ts` -> exit 0. Record `git diff --stat examples/design` in the log.
5. Visual evidence: inspect every PNG in `examples/design/iphone-kit/screens/`, `storyboard.png` and the regenerated previews, and record the notes. Open `prototype.html` in a browser if one is available; otherwise record the deferral.
6. `bunx biome check apps/cli/scripts/generate-iphone-kit-example.ts apps/cli/src/iphone-kit-example.test.ts apps/cli/src/native-parity/iphone-kit-example.test.ts` -> exit 0.

## Done criteria

Verification passes, and `du -sk examples/design/iphone-kit` < 5120.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes.
- Generic content only. No emojis.
- No state-changing git commands. Evidence files must not match Bun test patterns.

## Amendment 2026-11-10 (operator round 16, binding; keep this section verbatim)

Determinism contract. Documents built through `nodetto-cli edit` operations contain values generated at random: element and component ids (including the ids kit insertion mints internally) and fractional ordering keys such as element `index` and page `order`. Repeated-run and Bun-versus-native determinism checks therefore use the round-15 generated-value comparison from `ipd-24-parity-flows`, never raw byte equality:

- ids are replaced by ordinal placeholders, never numbered by their position in the file;
- generated ordering keys are compared by relative order within their collection;
- every other field and every pre-existing value is compared exactly.

The committed example document is generated once and committed. Its regression test validates it, lints it with zero findings and renders it, but does not regenerate it byte for byte. Do not change engine id generation. Keep the work already in the working tree and continue from it.

## Amendment 2026-11-10 (operator round 17, binding; keep this section verbatim)

Kit quality fix. This plan owns the iOS kit sources and tests listed in writePaths.

- (a) Round every computed kit child position and size to whole points, so no default kit instance or child is off the 1-point grid.
- (b) Size every default kit text box to fit its default text at its font, so no default kit instance reports `note-overflow`.
- (c) Afterwards, every default kit component inserted with its defaults into a 390x844 iPhone frame lints with zero findings. Add one regression test that inserts each kit component and asserts zero app-design lint findings. Do not change the lint rules. Update existing kit test expectations only where (a) or (b) changes a number.
- (d) The sample's prototype links target the specific child control (tab item, back button, send button) inside the kit instance, not the whole instance, and no link label overlaps another control.
- (e) Do not regenerate template HTML/CSS or other existing outputs beyond the design doc's accepted output changes; revert any regeneration that was not required.

The round-16 determinism contract still applies. Keep the ipd-26 work already in the working tree and continue from it.

## Amendment 2026-11-10 (step4 s802, verification scope for round 17)

Round 17 gave this plan the iOS kit sources, but the Verification list did not gate them. These gates are added, and the manifest carries the same command strings. Ownership, plan ID and dependsOn are unchanged.

7. `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/app-design-lint` -> exit 0, 0 fail. The round-17 (c) regression test lives in `packages/core/src/kits/ios/kit-content.test.ts`. For every kit shape ID it inserts the default component into a 390x844 iPhone frame and expects 0 app-design lint findings. It imports the existing lint entry point and does not change any rule.
8. `sh -c 'L=tmp/ipd-s772/ipd-26-example-sample/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-26-example-sample/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/core/src/kits/ios/[^(]*|apps/cli/scripts/generate-iphone-kit-example\.ts|apps/cli/src/iphone-kit-example\.test\.ts|apps/cli/src/native-parity/iphone-kit-example\.test\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. The exit codes mean the same as in ipd-20. Exit 0 is also accepted when tsc fails only in files this plan does not own; record those as `owned_elsewhere`. Exit 1 lists the errors in owned files, which you must fix. Exit 2 means tsc failed without printing diagnostics, which is a gate failure.
9. `bunx biome check packages/core/src/kits/ios/bars.ts packages/core/src/kits/ios/content.ts packages/core/src/kits/ios/style.ts packages/core/src/kits/ios/insert.ts packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/types.ts packages/core/src/kits/ios/kit-core.test.ts packages/core/src/kits/ios/kit-content.test.ts` -> exit 0.

Clarification: the round-16 determinism contract replaces the second-run `shasum` sentence in Verification item 1. A second generator run is compared with the round-15 generated-value normalization, not by bytes. Pitfall: rounding kit geometry (round 17 (a)) changes the default sizes of kit children. Re-run `bun apps/cli/scripts/generate-iphone-kit-example.ts` only after gates 7 and 8 pass. The committed sample must reflect the fixed kit and lint with zero findings.
