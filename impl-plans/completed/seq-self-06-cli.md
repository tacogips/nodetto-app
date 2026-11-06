# seq-self-06-cli

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 3; dependsOn: `seq-self-02-export`,
`seq-self-03-shape-bounds`, `seq-self-04-authoring`. Design: `design-docs/specs/design-sequence-self-messages.md` sections 7 to 10.
Evidence: `tmp/seq-self-s750/seq-self-06-cli/`. Progress: `impl-plans/progress/seq-self-06-cli.md`.

## Intent and context

Prove the whole feature through both CLIs: `edit` connect for every message kind, export in SVG, PNG and PDF, native parity, label
containment with real fonts, and CPU time against the pre-change binary. `connect.ts` needs no change because it calls `connectSmart`.
Also add the `types sequence.message` note.

Baseline from plan 01: `target/seq-self-baseline/nodetto-cli`.

## Non-goals

- No edit to `help.ts`, `docs/cli.md`, `README.md`, `commands.ts` or `packages/core/src/index.ts` (plan 07 owns them).
- No edit to `connect.ts`, `add.ts` or `apps/cli/native`. If a test seems to need one, stop and report it.
- No `reply` alias (user-QA Q1 default). Never relax a deadline. No binary-less native parity command.

## File-level changes

1. `apps/cli/src/types-command.ts`: for `sequence.message` only, append a text note line and an additive JSON `notes: string[]` key. The note
   says that equal `from` and `to` draw a self-call loop and that `connect` from a participant to itself creates one on the next row. All other
   types keep byte-identical output: spread the key conditionally, and add no blank line for them.
2. `apps/cli/src/native-parity/harness.ts`: move `decodeRgbaPng` here from `native-parity/export.test.ts` and export it. Update `export.test.ts`
   to import it, and remove its now-unused `inflateSync` import. Make no other change to that test.
3. `apps/cli/src/__fixtures__/sequence-self-timing.ts` (new): export `sequenceSelfTimingDocument(): string`, built with `Editor` and
   `serializeDocument` like `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`: 5 participants and 200 messages, every tenth a self-message
   (20 total), with neutral names. Create messages with `createElement` and no `visual.y`, so the omitted-geometry path in `sequenceOrderY` is what gets timed. Under `import.meta.main`, write it to the path in `process.argv[2]`.

## Pitfalls

- Create documents inside a temp dir and remove them in `finally`, as `export.test.ts` does.
- PNG checks use two different rules. Do not merge them, and do not test alpha, because the PNG background is opaque.
  - Edge rule, for the outermost right columns only: a pixel differing from the pixel at (0,0) fails. The label backdrop and halo (`theme.surface` #fffdf8) on the default #ffffff raster background count as ink here, so a clipped halo also fails.
  - Glyph rule, for the existence guard only: a pixel with at least one RGB channel at or below 0xC0. Label text is `theme.muted` #596366, while the backdrop, halo and background are near white, so the guard cannot pass without drawn text. This is a colour rule and does not depend on the font.
- Map page to pixel with `pixelWidth / viewBoxWidth` from the same document's SVG export. Do not assume a scale.
- Do not assert text widths or set any platform font expectation: `fontFamily` Arial may fall back on Linux, and that is the point.
- `edit` overwrites its document. Timing runs use `export`, which does not.
- The kind is `return`. Test it, and do not test `reply`.

## Tests

`apps/cli/src/sequence-self-commands.test.ts` (new, Bun, spawning `main.ts`; imitate `ai-features.test.ts:290` for `edit` and
`export-command.test.ts:89` for raster):

- `{"op":"connect","from":"@a","to":"@a","label":"check","semantic":{"kind":K}}` for K in `sync`, `async`, `return` -> exit 0; saved message has
  from equal to to, that kind and that label; `validate` exits 0.
- `connect` with `"shape":"sequence.message"` from `@a` to `@a` -> exit 0, a self-message.
- `connect` from a `uml.class` to itself -> exits non-zero with the existing "Cannot connect" message unchanged.
- Self-connect then connect `@a` to `@b` -> second message's `y` is the first's + 32 + 52.
- SVG export -> polyline with the four loop points, `marker-end`, and `text-anchor="start"`.
- `return` -> `stroke-dasharray="6 4"`.
- PNG and PDF export -> exit 0 and correct magic bytes.
- A document with `add` of an equal-ends message -> exports a loop. This is the requested change for existing documents; state that in the test name.
- `types sequence.message` -> text contains the note; `--format json` has `notes`.
- `types erd.table` -> no note and no `notes` key.

`apps/cli/src/native-parity/sequence-self.test.ts` (new; `nativeTest`, `compare`, `compareFile` from `harness.ts`):

- The same three-kind `edit` batch -> document bytes equal between Bun and native.
- SVG export of that document -> byte parity.
- Both golden documents -> native stdout equals `apps/cli/src/__fixtures__/sequence-golden/*.expected.svg` bytes.
- PNG with `decodeRgbaPng` -> ink on the loop's right leg at (cx+40, y+16), which is the #1d2a2e stroke.
- PNG containment on the rightmost lifeline, no `--background`, for 26 `W` with `fontSize` 11 and `fontFamily` Arial, and for 6 `W` with `letterSpacing` 20 -> a pixel
  meeting the glyph rule exists in the loop's vertical band right of `labelStartX`, and the two outermost right pixel columns hold no pixel differing from the pixel at (0,0).
- Give each native raster test an explicit 30000 ms timeout, following the existing native PNG tests in `native-parity/export.test.ts`.
- PDF -> exit 0 and `%PDF` magic.

## Timing

Before the first timing run, recompute `shasum -a 256 target/seq-self-baseline/nodetto-cli` and compare it with the digest in `impl-plans/progress/seq-self-01-contract.md`.
On a mismatch, stop and report it as a finding: the binary is no longer the pre-change build, so do not time it and do not rebuild it.

Generate the document under the evidence directory with `bun apps/cli/src/__fixtures__/sequence-self-timing.ts <path>`. Run
`/usr/bin/time -p <binary> export <path> --format svg --output <evidence>/out.svg` three times each for
`target/seq-self-baseline/nodetto-cli` and `target/release/nodetto-cli`. Record all `user` and `sys` values and the median ratio in the progress log. A median
user-time ratio above 1.25 is a finding: record it and stop before relaxing anything.

## Verification

Each command must exit 0. Retry a native deadline timeout up to 3 attempts, logging each one; any other failure is a failure.

- `bun test apps/cli/src/sequence-self-commands.test.ts apps/cli/src/sequence-self-golden.test.ts`
- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`
- `sh -c 'NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/sequence-self.test.ts apps/cli/src/native-parity/export.test.ts'`: tests run, not skipped.
- `bun run typecheck`
- `bunx biome check apps/cli/src/types-command.ts apps/cli/src/native-parity/harness.ts apps/cli/src/native-parity/export.test.ts apps/cli/src/native-parity/sequence-self.test.ts apps/cli/src/sequence-self-commands.test.ts apps/cli/src/__fixtures__/sequence-self-timing.ts`

## Acceptance criteria

- All test cases exist and pass under the release binary.
- The baseline digest matches plan 01's recorded value before timing, and that check is recorded.
- Timing values and the ratio are recorded, with the ratio at or below 1.25.
- `git diff --quiet HEAD -- apps/cli/src/edit/operations/connect.ts apps/cli/native` exits 0.

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. Fixtures use neutral text only. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory. Cargo commands use `CARGO_TERM_QUIET=true`.
