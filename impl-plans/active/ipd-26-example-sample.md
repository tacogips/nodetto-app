# ipd-26-example-sample

- planId: ipd-26-example-sample
- planPath: impl-plans/active/ipd-26-example-sample.md
- progressPath: impl-plans/progress/ipd-26-example-sample.md
- dependsOn: ipd-11-frames, ipd-13-prototype-core-cli, ipd-15-kit-content, ipd-16-frames-export-compare, ipd-20-app-lint, ipd-21-html-prototype, ipd-23-parity-shapes, ipd-24-parity-flows
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, section "Help, docs and examples" (the sample), and "Accepted output changes" (regenerated `examples/design` previews).
- Evidence: `tmp/ipd-s772/ipd-26-example-sample/`.
<!-- ownership:start -->
- writePaths:
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
