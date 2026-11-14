# tll-13-native-parity

- planId: tll-13-native-parity
- planPath: impl-plans/active/tll-13-native-parity.md
- progressPath: impl-plans/progress/tll-13-native-parity.md
- wave: 2 in session 556 (alone in its wave)
- dependsOn: tll-12-core-cli-lint-export. The gate `mise run test-cli`
  runs all of `bun test apps/cli/src`, including the tests that tll-12
  owns, so tll-12 must be done first. Before starting, confirm that the
  last line of `impl-plans/progress/tll-12-core-cli-lint-export.md` is
  `STATUS: done`.
- Design: `design-docs/specs/design-text-layout-lint.md`. The sections are
  "Native CLI", "Test plan" (the `native-parity.test.ts` bullet),
  "Verification commands" and "Rollout constraints".
- This plan replaces `tll-11` and closes out the native parity goal of
  `tll-05` for the revised behavior.

## Intent and context

The native `nodetto-cli` runs the same TypeScript command bundle in Boa
(`apps/cli/native/src/engine.rs`; `Intl.Segmenter` is the native graphemes
shim). The wide-character measurement and the freeform and flowchart page
kinds reach it with no Rust change. This plan proves that the TS and
native CLIs give identical stdout, stderr and exit codes for:

- a wide-character label document;
- the problem document on a freeform page;
- the problem document on a flowchart page.

The proof is `CARGO_TERM_QUIET=true mise run test-cli` with the release
binary.

The existing block "native CLI matches text-layout lint and export,
including dense pages" (`apps/cli/src/native-parity.test.ts:916-958`, the
last block of the 958-line file at base `fd2083b`) stays byte-unchanged.

## Non-goals

- No change under `apps/cli/native/**`, `Cargo.toml` or `Cargo.lock`. No
  `cargo fmt` is needed, because no Rust changes.
- No change to existing parity blocks, their budgets, or the golden loop
  at `native-parity.test.ts:47-69`. Append only.
- No new golden JSONL under `packages/io/src/__fixtures__`, because it
  would grow the golden loop.
- Do not edit the fixture module, the core rules or the other CLI tests
  (tll-12). A parity failure caused by them is recorded with owner tll-12,
  not fixed here.
- No commit, push, version bump or release. Do not touch
  `impl-plans/active/**`, `impl-plans/completed/**` or
  `impl-plans/README.md`.

## writePaths

- apps/cli/src/native-parity.test.ts
- impl-plans/progress/tll-13-native-parity.md
- tmp/text-layout-lint-s556/tll-13-native-parity
- target (artifact root: the cargo test and release build output from
  `mise run test-cli`)

sharedPaths: none. artifactRoots: `target`. It is git-ignored
(`.gitignore:12`), is tracked only as a digest manifest, and holds no
source.

## Per-worker protocol

This is the same protocol as tll-12:

- fresh read and sha256 before and after each edit;
- an intent snapshot before the first edit;
- on drift, stop and record it;
- edit only the writePaths;
- no state-changing git commands;
- format only your own file;
- run commands in the foreground and redirect them to logs under
  `tmp/text-layout-lint-s556/tll-13-native-parity/`, with no `&`, `nohup`
  or `tee`;
- `BUN_OPTIONS=--jsx-runtime=classic` for bun tests;
- `CARGO_TERM_QUIET=true` for cargo and `mise run test-cli`;
- no emojis;
- `STATUS: done` as the last line, only when every gate exited 0.

The release build and `mise run test-cli` take several minutes. Wait for
them to exit, and never background them. Record `cargo --version` and
`rustc --version` in the progress log.

## File-level changes

### `apps/cli/src/native-parity.test.ts`

- Extend the import from `./__fixtures__/text-layout.ts` (:19-23) with
  `textLayoutWideDocument`, keeping the names alphabetical as in the
  existing list. The builders return a `string`.
- Append exactly one block at the end of the file. Imitate the existing
  block at :916-958 (temp dir, `compare(args, cwd)`, `finally` cleanup).
  The block name must be exactly
  `native CLI matches text-layout lint on wide labels, freeform and flowchart pages`,
  because gate commands 9-12 filter on it with `-t` and grep the JUnit
  report for it.
  - Temp dir: `mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-wide-"))`,
    removed in `finally` with `rmSync(cwd, { recursive: true, force: true })`.
  - Write these files:
    - `wide.jsonl`: `textLayoutWideDocument()`;
    - `problem-freeform.jsonl`: `textLayoutProblemDocument("freeform")`;
    - `problem-flowchart.jsonl`: `textLayoutProblemDocument("flowchart")`.
  - For each of the three files, `compare` these, each with
    `exitCode` 0:
    - `["lint", file]`;
    - `["lint", file, "--format", "json"]`;
    - `["export", file, "--format", "svg"]`.
  - Also `compare(["lint", "problem-flowchart.jsonl", "--page", "Architecture"], cwd)`
    -> exit 0. The fixture page name is `Architecture` for every kind.
  - Behavior-present assertions on the returned native result (call
    `.toString()` on the Buffers):
    - the `wide.jsonl` export stderr contains
      `warning: label-overflow node-wide:` and does not contain
      `node-ascii`;
    - the `wide.jsonl` lint stdout contains `note-overflow`;
    - the `problem-freeform.jsonl` and `problem-flowchart.jsonl` export
      stderr contains `warning: label-overflow node-clipped:`.
  - Budget `120000`, with a one-line comment in the style of :957: 20
    launches (10 compares, TS plus native), all small documents.

Pitfalls:

- `compare` already asserts that stdout, stderr and exit code are equal
  between TS and native. Do not duplicate that, and do not weaken it.
- Never use `--output` into the repository tree. Keep every file in the
  temp dir.
- The block must skip (not fail) without `NODETTO_CLI_TEST_BINARY`.
  `nativeTest` (:31) already does this. Do not use `test` directly.
- Do not reorder, reformat or change existing lines. The diff against
  `fd2083b` is one changed import line plus appended lines.

## Invariants

- `git diff --exit-code fd2083b -- apps/cli/native Cargo.toml Cargo.lock`
  is empty.
- Existing parity blocks and their budgets are byte-unchanged.
- No tll-12-owned file is modified by this plan.

## Test cases (input -> expected)

- No binary: every `nativeTest` block skips. The summary has a non-zero
  ` <N> skip` line, and the exit code is 0.
- Release binary: the new block passes. Every `compare` gives identical TS
  and native stdout, stderr and exit 0.
- Wide export, native: stderr has `warning: label-overflow node-wide:` and
  no `node-ascii`.
- Freeform or flowchart export, native: stderr has
  `warning: label-overflow node-clipped:`.
- `lint problem-flowchart.jsonl --page Architecture`: exit 0, with parity.

## Verification (gate; every command must exit 0)

Bun 1.4.4 runs in quiet agent mode here. Redirected logs have no per-test
`(pass)` or `(skip)` lines, only `(fail)` blocks and summary lines
(` <N> pass`, ` <N> skip` when N > 0, ` <N> fail`). The s552 logs confirm
this, for example
`tmp/text-layout-lint-s552/tll-09-core-rules/core-all-final.log`. The
checks below therefore use only summary lines and a JUnit report (design
"Native evidence format"). Do not unset agent environment variables to
change bun's output, and never grep for per-test console lines. The JUnit
run is a separate invocation from the summary runs.

| # | Command | Must show |
| --- | --- | --- |
| 1 | `mkdir -p tmp/text-layout-lint-s556/tll-13-native-parity` | exit 0 |
| 2 | `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/native-parity.test.ts > tmp/text-layout-lint-s556/tll-13-native-parity/parity-skip.log 2>&1` | exit 0; no binary, so every `nativeTest` block skips |
| 3 | `grep -E '^ *[1-9][0-9]* skip$' tmp/text-layout-lint-s556/tll-13-native-parity/parity-skip.log` | exit 0: the skip summary is detected when blocks skip (baseline for command 7) |
| 4 | `CARGO_TERM_QUIET=true mise run test-cli > tmp/text-layout-lint-s556/tll-13-native-parity/test-cli.log 2>&1` | exit 0. Runs cargo tests, the release build and all of `bun test apps/cli/src` with the binary set |
| 5 | `grep -E ' 0 fail$' tmp/text-layout-lint-s556/tll-13-native-parity/test-cli.log` | exit 0: the bun summary shows 0 failures |
| 6 | `BUN_OPTIONS=--jsx-runtime=classic NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity.test.ts > tmp/text-layout-lint-s556/tll-13-native-parity/parity-native.log 2>&1` | exit 0 |
| 7 | `test -z "$(grep -E '^ *[1-9][0-9]* skip$' tmp/text-layout-lint-s556/tll-13-native-parity/parity-native.log)"` | exit 0: no native parity block skipped with the binary |
| 8 | `grep -E '^ *[1-9][0-9]* pass$' tmp/text-layout-lint-s556/tll-13-native-parity/parity-native.log` | exit 0: a non-zero number of tests ran and passed |
| 9 | `BUN_OPTIONS=--jsx-runtime=classic NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity.test.ts -t 'native CLI matches text-layout lint on wide labels' > tmp/text-layout-lint-s556/tll-13-native-parity/parity-new.log 2>&1` | exit 0 |
| 10 | `grep -Ex ' *1 pass' tmp/text-layout-lint-s556/tll-13-native-parity/parity-new.log` | exit 0: exactly the new block ran and passed |
| 11 | `BUN_OPTIONS=--jsx-runtime=classic NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity.test.ts -t 'native CLI matches text-layout lint on wide labels' --reporter=junit --reporter-outfile=tmp/text-layout-lint-s556/tll-13-native-parity/parity-new.xml > tmp/text-layout-lint-s556/tll-13-native-parity/parity-new-junit.log 2>&1` | exit 0; writes the JUnit report |
| 12 | `grep -F 'name="native CLI matches text-layout lint on wide labels, freeform and flowchart pages"' tmp/text-layout-lint-s556/tll-13-native-parity/parity-new.xml` | exit 0: the JUnit report has the passing testcase |
| 13 | `shasum -a 256 target/release/nodetto-cli > tmp/text-layout-lint-s556/tll-13-native-parity/artifact-sha256.txt` | exit 0. The digest is recorded in the progress log |
| 14 | `bunx biome check apps/cli/src/native-parity.test.ts > tmp/text-layout-lint-s556/tll-13-native-parity/biome.log 2>&1` | exit 0 |
| 15 | `mise run lint-ts > tmp/text-layout-lint-s556/tll-13-native-parity/lint-ts.log 2>&1` | exit 0 (biome plus typecheck) |
| 16 | `git diff --exit-code fd2083b -- apps/cli/native Cargo.toml Cargo.lock > tmp/text-layout-lint-s556/tll-13-native-parity/native-boundary.log 2>&1` | exit 0, empty log |

If command 4 fails in a tll-12-owned test, record it with owner tll-12 and
do not edit that file. If command 12 fails although command 10 passed,
copy the first 40 lines of `parity-new.xml` into the progress log and
record a blocker. Do not drop or weaken the check. A release build or
toolchain failure blocks this plan, and the gate is not weakened.

## Done criteria

- The appended block exists with the exact name. The existing blocks are
  byte-unchanged.
- Gate commands 1-16 exited 0. Their exit codes and log paths, the sha256
  before and after for the test file, the binary digest and the toolchain
  versions are recorded in `impl-plans/progress/tll-13-native-parity.md`.
- The last line of the progress log is `STATUS: done`.
