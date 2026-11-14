# tll-11-native-parity

- planId: tll-11-native-parity
- planPath: impl-plans/active/tll-11-native-parity.md
- wave: 3 in session 555
- dependsOn: tll-09-core-rules, tll-10-cli-lint-export. The parity block
  needs only tll-09 behavior. tll-10 is required because the
  `mise run test-cli` gate runs all of `bun test apps/cli/src`, including
  the tll-10-owned CLI tests (design "Rollout constraints", "Verification
  order").
- Design: `design-docs/specs/design-text-layout-lint.md`, sections "Native
  CLI" and "Test plan" (the `native-parity.test.ts` bullet).
- Read `impl-plans/active/tll-06-overview.md` first.
- This plan closes out the native-parity goal of
  `impl-plans/active/tll-05-native-parity.md` for the revised behavior.

## Intent and context

The native `nodetto-cli` runs the same TypeScript command bundle in Boa
(`apps/cli/native/src/engine.rs`; `Intl.Segmenter` is the native graphemes
shim at :224). The new wide-character measurement and the freeform and
flowchart page kinds reach it with no Rust change. This plan proves
byte-identical stdout, stderr and exit codes between the TS and native CLIs
for:

- a wide-character label document;
- the problem document on a freeform page;
- the problem document on a flowchart page.

The existing block "native CLI matches text-layout lint and export,
including dense pages" (`native-parity.test.ts:916-958`, the last block of
the 958-line file at 5b65f96) stays unchanged.

## Non-goals

- No change under `apps/cli/native/**`, `Cargo.toml` or `Cargo.lock`.
- No change to existing parity tests or their budgets. Append only.
- No new golden JSONL under `packages/io/src/__fixtures__`, because the
  golden loop at `native-parity.test.ts:47-69` would grow.
- Do not edit the fixture module (tll-09) or other CLI tests (tll-10).

## writePaths

- apps/cli/src/native-parity.test.ts
- impl-plans/progress/tll-11-native-parity.md
- tmp/text-layout-lint-s555/tll-11-native-parity
- target

sharedPaths: none.

## artifactRoots

- target. This is the cargo build output (release `nodetto-cli` binary) that
  `cargo build --release -p nodetto-cli` and `mise run test-cli` write. It
  is git-ignored (`.gitignore:12`) and tracked only as a digest manifest.
  This plan writes no source under it.

## File-level changes

### `apps/cli/src/native-parity.test.ts`

- Extend the existing import from `./__fixtures__/text-layout.ts` (:19-23)
  with `textLayoutWideDocument`. Builders return `string`, not objects.
- Append one block at the end of the file:
  `nativeTest("native CLI matches wide-character and freeform/flowchart text-layout lint and export", () => {...}, 120000)`.
  Imitate the existing text-layout block at :916-958.
  - Make a temp dir with `mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-wide-"))`,
    and remove it in `finally` with `rmSync(..., { recursive: true, force: true })`.
  - Write these files:
    - `wide.jsonl`: `textLayoutWideDocument()`;
    - `problem-freeform.jsonl`: `textLayoutProblemDocument("freeform")`;
    - `problem-flowchart.jsonl`: `textLayoutProblemDocument("flowchart")`.
  - For each file, run `compare(args, cwd)` for these, each with expected
    `exitCode` 0:
    - `["lint", file]`;
    - `["lint", file, "--format", "json"]`;
    - `["export", file, "--format", "svg"]`.
  - Also `compare(["lint", "problem-flowchart.jsonl", "--page", "Architecture"], cwd)`
    -> exit 0. The page name is `Architecture` for every kind.
  - Behavior-present assertions on the `compare` return value (the native
    result):
    - for `wide.jsonl` export, stderr contains
      `warning: label-overflow node-wide:` and does not contain
      `node-ascii`;
    - for `wide.jsonl` lint, stdout contains `note-overflow`;
    - for `problem-flowchart.jsonl` and `problem-freeform.jsonl` export,
      stderr contains `warning: label-overflow node-clipped:`.
  - Budget `120000`, with a comment in the style of :61-62 and :959:
    20 launches (10 compares, TS plus native), each small.

Pitfalls:

- `compare` returns the native `spawnSync` result, and stdout and stderr are
  Buffers. Call `.toString()`, as the existing block does.
- Do not use `--output` into the repository tree. Keep every file in the
  temp dir.
- The test must be skipped (not failed) when `NODETTO_CLI_TEST_BINARY` is
  unset. `nativeTest` already does this.

## Invariants

- `git diff 45cc69f -- apps/cli/src/native-parity.test.ts` only adds lines:
  one import name and the appended block. No existing line is removed or
  changed, except the import list line.
- `git diff --stat 45cc69f -- apps/cli/native Cargo.toml Cargo.lock` is
  empty.

## Verification

Logs go to `tmp/text-layout-lint-s555/tll-11-native-parity/<name>.log`. Run
each in the foreground to a terminal exit, and record the exit code and log
path. Prefix bun tests with `BUN_OPTIONS=--jsx-runtime=classic`. The release
build and `mise run test-cli` take several minutes. Wait for them to exit,
and never background them.

| Command | Must show |
| --- | --- |
| `bun test apps/cli/src/native-parity.test.ts` (no binary) | exit 0, the new test listed as skipped, 0 fail |
| `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` | exit 0. Record the sha256 of `target/release/nodetto-cli` in `artifact-sha256.txt` |
| `NODETTO_CLI_TEST_BINARY=$PWD/target/release/nodetto-cli bun test apps/cli/src/native-parity.test.ts -t "wide-character and freeform"` | exit 0, 1 pass, 0 fail, 0 skip (the new block ran) |
| `NODETTO_CLI_TEST_BINARY=$PWD/target/release/nodetto-cli bun test apps/cli/src/native-parity.test.ts` | exit 0, 0 fail, 0 skip |
| `CARGO_TERM_QUIET=true mise run test-cli` (runs all of `bun test apps/cli/src` with the release binary; tll-10 is already done) | exit 0, 0 fail; the log shows the new block passing, not skipped. A failure in a tll-10-owned test is recorded with owner tll-10, never fixed here |
| `bunx biome check apps/cli/src/native-parity.test.ts` | exit 0 |
| `bun run typecheck` (shared-input gate) | exit 0 |
| `git diff --stat 45cc69f -- apps/cli/native Cargo.toml Cargo.lock` | empty |

Before starting, confirm that `impl-plans/progress/tll-10-cli-lint-export.md`
ends with `STATUS: done`. Never edit tll-09's or tll-10's files. Record the
toolchain (`cargo --version`, `rustc --version`) in the progress log.

## Done criteria

- The appended block exists, and the existing blocks are byte-unchanged.
- The native run of the new block shows 1 pass and 0 skip. The full
  native-parity file has 0 fail and 0 skip with the binary.
  `CARGO_TERM_QUIET=true mise run test-cli` exits 0.
- The progress log `impl-plans/progress/tll-11-native-parity.md` records
  every command, its exit code and log path, the sha256 before and after
  for the test file, and the binary digest.
- The last line of the progress log is `STATUS: done`.
