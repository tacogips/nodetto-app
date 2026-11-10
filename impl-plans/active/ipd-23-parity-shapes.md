# ipd-23-parity-shapes

- planId: ipd-23-parity-shapes
- planPath: impl-plans/active/ipd-23-parity-shapes.md
- progressPath: impl-plans/progress/ipd-23-parity-shapes.md
- dependsOn: ipd-06-geo-strokes, ipd-07-icon-core-cli, ipd-08-cli-layout-ops, ipd-09-text-layer, ipd-11-frames, ipd-12-controls, ipd-13-prototype-core-cli, ipd-14-kit-core, ipd-15-kit-content, ipd-16-frames-export-compare, ipd-20-app-lint, ipd-21-html-prototype
  - These are all the plans that change the engine bundle, so the native binary is built from a stable tree.
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, "Global rules" (one implementation, two hosts) and "Verification" (native parity split by area). Areas: text, shapes, controls, icons, frames, layout operations.
- Evidence: `tmp/ipd-s772/ipd-23-parity-shapes/`.
<!-- ownership:start -->
- writePaths:
  - `apps/cli/src/native-parity/app-design-shapes.test.ts`
  - `impl-plans/progress/ipd-23-parity-shapes.md`
  - `tmp/ipd-s772/ipd-23-parity-shapes`
  - `target`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-23-parity-shapes`
  - `target`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Intent and context

The native `nodetto-cli` embeds the same TS bundle in Boa. Parity is proven by `apps/cli/src/native-parity/` tests. These tests run each command under `bun apps/cli/src/main.ts` and under the built binary, and assert equal exit code, stdout, stderr and written bytes (`harness.ts:15-49`).

This plan covers the shape-side features. `ipd-24` covers flows, kit, lint and export. This plan also records the engine bundle size against the `ipd-00` baseline (the user-QA Q3 gate).

## Non-goals

- No source fixes. A parity mismatch is a finding with the command, both outputs and the owning plan id. The owning plan's worker or reconciliation fixes it.
- No new harness features.

## File-level changes

New `apps/cli/src/native-parity/app-design-shapes.test.ts`. It uses `nativeTest`, `compare` and `compareFile` from `harness.ts`, with generic fixtures built in a temp directory via `edit` operations. Cases:

1. **Text layer.**
   - `draw doc text:layer --label "Inbox"`, then `export --format svg` -> `compareFile`.
   - `update` with `fontSize`/`fontWeight` on a linked note -> `compare`: same warning text and file bytes.
   - A truncated label -> SVG `compareFile`.
2. **Geo.**
   - A 1-unit divider, `strokeAlign` variants and `strokeSides` -> `export --format svg` and `--format png --scale 2` via `compareFile`.
   - The PNG bytes may differ between resvg-js and native resvg. If the existing export parity tests compare PNG bytes, do the same. Otherwise compare SVG bytes, plus PNG dimensions via `pngInfo`, and record the choice.
3. **Controls.** Underline/pill tabs with accent, a start-aligned button with icon and badge, a two-line label -> SVG `compareFile`.
4. **Icons.**
   - `shapes icon bell` -> `compare`. `shapes icon:bell` -> `compare`.
   - `draw doc icon:search` -> `compareFile`.
   - `validate` with an unknown icon -> `compare` (stderr warning).
5. **Frames.**
   - `add` with `parent` and relative coordinates; D7 auto-join into a layout frame; `inspect` with rel coords -> `compare` / `compareFile`.
   - Outside title in the page SVG -> `compareFile`.
6. **Layout operations.** `layout`, `sizing`, `align` (parent and safe-area), `distribute` with gap, `snap` grid 4 -> `compareFile`.

Bundle size (Q3):

- Run `NODETTO_ENGINE_OUT_DIR="$PWD/tmp/ipd-s772/ipd-23-parity-shapes/engine" bun apps/cli/scripts/build-engine.ts`, then `wc -c tmp/ipd-s772/ipd-23-parity-shapes/engine/diagram.js`.
- Record both exit codes, the byte count and the delta against the `ipd-00` value in the progress log.
- Pitfall: the cargo-built bundle lives in `target/**/out`. `apps/cli/native/engine/` does not exist, so do not measure it.

## Patterns to imitate

- `apps/cli/src/native-parity/export.test.ts` and `apps/cli/src/native-parity/lint-rules.test.ts`: `nativeTest`, `compare` and `compareFile` usage with temp-directory fixtures.
- `apps/cli/src/native-parity/harness.ts:compare` and `compareFile`: never re-implement the comparison.

## Pitfalls

- A test skipped because `NODETTO_CLI_TEST_BINARY` is unset is not evidence. The log must show the cases ran (0 skip).
- Build fixtures through CLI `edit` operations inside the test, not from hand-written JSONL. Use generic names.
- PNG bytes can differ between resvg-js and native resvg. Compare SVG bytes plus PNG dimensions unless an existing parity test already compares PNG bytes, and record the choice.
- Retry only deadline timeouts, up to 3 attempts. An assertion mismatch fails on the first attempt and becomes a finding for the owning plan.

## Invariants

- No source file outside this plan's writePaths changes.
- Existing parity topic files are untouched.

## Tests (input -> expected outcome)

- Each numbered case in "File-level changes" -> identical exit code, stdout, stderr and written bytes between the bun CLI and the native binary.

## Verification (evidence in `final/`)

1. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` -> exit 0 (log).
2. `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/app-design-shapes.test.ts` -> exit 0, 0 fail, 0 skip. Confirm in the log that the tests were not skipped.
3. `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts apps/cli/src/native-parity/export.test.ts apps/cli/src/mcp-stdio.test.ts` -> exit 0: deadlines are not regressed by the icon data.
   - Up to 3 attempts, only on deadline timeouts.
   - On a persistent deadline failure, record a finding citing user-QA Q3 (switch to the curated subset). That is owned by `ipd-03`; reconciliation applies it.
4. `bunx biome check apps/cli/src/native-parity/app-design-shapes.test.ts` -> exit 0.

## Done criteria

- Verification passes.
- The progress log has the bundle size delta, plus a table of each case with its result.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes.
- Edit only writePaths.
- No state-changing git commands, no emojis. Generic fixtures only.
- Evidence files must not match Bun test patterns. Run builds in the foreground with full logs.
