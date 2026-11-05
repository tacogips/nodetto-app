# clm-09b-cli-tests

- planId: clm-09b-cli-tests
- planPath: impl-plans/active/clm-09b-cli-tests.md
- progressPath: impl-plans/progress/clm-09b-cli-tests.md
- Manifest: `impl-plans/active/clm-s740-dispatch.json`. Workflow mode: `issue-resolution`.
- wave: 1; dependsOn: none. Evidence: `tmp/clm-s740/clm-09b-cli-tests/`.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections B1, B2, C3, D, "A3 metrics", E1, E2.1, F2, F3,
  "Verification" and "Continuation 5 verification".

## Intent and context

Registration is committed at HEAD 235b8c8 (`apps/cli/src/commands.ts:runCli`, `arrangeLayeredOrRoute`, `lintDiagramPages`,
`extractQuiet`), but nothing tests it through `runCli`, and no end-to-end test runs git with the merge driver. This plan
adds both tests and fixes wiring gaps they expose.

## Non-goals

- No feature logic. A defect in a feature module (`packages/core/src/*`, `edit/selectors.ts`, `edit/carry-members.ts`,
  `merge` model) is a finding for its owning plan in the progress log. Do not fix it here.
- No help or docs edits (clm-09a), no native parity files or `native-engine.ts` (clm-09c), and no `apps/cli/src/mcp.ts`.
- No test pins the Q11 reproduction either way, and no depth-one output changes.
- No change to the defaults of `tidy`, `overlaps`, `edit --arrange` or frame carry.

## File-level changes

### `apps/cli/src/cli-wiring.test.ts` (new)

Runs through `runCli(args, io, "t")` from `apps/cli/src/commands.ts` with an in-memory `CommandIo`. Imitate `memoryIo` in
`apps/cli/src/ai-commands.test.ts`, as a local helper. Build documents inline. Imitate `doc()` in
`apps/cli/src/merge-command.test.ts` with `serializeDocument`, and the BPMN builders in
`packages/core/src/arrange-layered-bpmn.test.ts`. Do not import any `apps/cli/src/__fixtures__/bpmn-layered.ts`.

### `apps/cli/src/merge-git.test.ts` (new)

Uses `test`, not `nativeTest`, so it runs without a binary, and it uses the binary when set. Details are under "Tests".

### Wiring gaps

The allowed paths are the rest of `writePaths`. Only make the smallest wiring fix a new test proves necessary. Record each
touched file. Existing test files change only for an assertion that wiring intentionally changed.

## Pitfalls

- `validate` has no `--format` option (`commands.ts:validateCommand`). The older plan text "--format json keeps every
  warning" on validate is wrong. Assert uncollapsed JSON through `edit --format json` instead. If that report has no
  warnings array, record it and assert only that JSON output is not collapsed where warnings exist.
- `--quiet` must not hide match lines or conflict lines. `--strict --quiet` must still exit 3.
- `planLayeredBpmn` has three command lists. `--check` must count all three.
- Expect the clm-12 parent rule: a unit directly under a non-leaf lane, or directly under a pool with lanes, ends parented
  to the first leaf lane. Expect the D2 inset on nested lanes.
- Git isolation in `merge-git.test.ts`: set `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1` and `HOME` to the temp
  directory for every git call; set `commit.gpgsign=false` locally; use `git init -b main`. Quote both paths in the driver
  value, because temp paths can contain spaces. `main.ts` must be absolute.
- A missing git fails the test: do not guard with `test.skip` or `which`. `Bun.spawnSync` throwing is an acceptable failure.
- The driver's stderr reaches the `git merge` process, so assert `conflict:` on stdout plus stderr combined.
- The conflict result has no conflict markers, because the driver writes canonical ours.
- Do not make `merge-git.test.ts` depend on `tmp/` or on the checkout's git state. Remove temp directories in `finally`.
- Per edit: fresh read, `git hash-object` before and after in the progress log, and a one-line intent. No state-changing
  git commands in this repository, no broad formatter, no lockfile changes.

## Tests (input -> expected)

`cli-wiring.test.ts`:

- `merge` with clean, conflicting and invalid inputs -> exits 0, 1, 2; `--output` equal to the ours path keeps ours.
- `merge --quiet` on a conflict -> `conflict:` line still present.
- `arrange --mode layered` and `--mode route` on a state page with frames -> exit 0; `--check` after `--write` -> exit 0.
- `arrange --mode tidy --reset-manual`, `--mode overlaps --ids x`, `--mode route --frames x`, `--mode layered --ids x` ->
  each exits 2. `arrange --mode tidy` output equals the output without `--mode`.
- `arrange --mode layered` on a BPMN page -> exit 0, lanes stacked inside their pool, `--check` exit 0 after `--write`.
  With `--frames x` or `--direction TB` -> exit 2.
- `arrange --mode layered` with `D = 3` and a width-20 unit -> the unit keeps its leaf parent, and `--check` exits 0 after
  `--write`.
- E2.1 refusal: the input of the test "nested lane restack refuses to tear subprocess contents" in
  `packages/core/src/arrange-layered-bpmn.test.ts`, with `--write` -> exit 2, stderr contains `cannot keep the contents of
  sub-process`, and the file is unchanged.
- `arrange --mode layered` on an ERD page with frames -> exit 0. On sequence, breadboard and pcb pages, for both modes ->
  exit 2, with the supported kinds named.
- `lint` on an ERD-only document with overlapping tables -> a `node-overlap` row, not the no-pages message. An ERD document
  with no finding -> clean output.
- `lint --metrics` on a state or BPMN page -> `metrics <page>: <n> edge crossing(s), <m> edge-label overlap(s)`; JSON adds
  `metrics` per page and `summary` totals; the exit code matches the run without the flag. Without the flag, the JSON
  has no `metrics`.
- `lint --fix` on `textLayoutProblemDocument()` (`apps/cli/src/__fixtures__/text-layout.ts`) -> a `fixed ` line, file
  updated, second run makes no change; JSON has `fixes`; `.bpmn` input -> exit 2.
- `validate --quiet` with warnings -> no warning lines, summary kept. `validate --strict --quiet` -> exit 3 and the summary
  line. `--quiet` after `--` stays positional.
- A document with 42 identical unknown-field warnings -> one line ending `(and 41 more like this)`, and `--strict` still
  exits 3.
- `edit` with `where` and a wrong `expect` -> exit 2 and file unchanged. Text report has `operation <i> (delete): matched 1
  element(s)`; JSON has `matches`; `--quiet` keeps the match line.
- `edit` update with `carryMembers:false` on a pool -> members keep positions, with a lane still inside the pool.

`merge-git.test.ts`:

- Setup: temp directory, local user config, `.gitattributes` with `*.jsonl merge=nodetto`, `merge.nodetto.name`, and
  `merge.nodetto.driver` set to `"<process.execPath>" "<abs main.ts>" merge %O %A %B --output %A`, or `"<binary>" merge
  %O %A %B --output %A` when `NODETTO_CLI_TEST_BINARY` is set. Base document on `main`, then two branches.
- Disjoint field edits -> `git merge` exits 0, both edits are in the file, and the file equals its canonical form.
- Same field edited differently -> `git merge` exits non-zero, file keeps ours canonically, output contains `conflict:`,
  and the file has no `<<<<<<<`.

## Invariants

- Without new flags, command output is unchanged.
- Existing deadlines and depth-one expected files are unchanged.

## Verification

Each command must exit 0. See the manifest for the exact list. It runs the new tests and the focused CLI suites,
typecheck, Biome on the two new files, and a grep that the git test does not skip.

## Done criteria

- All manifest verification commands exit 0.
- `impl-plans/progress/clm-09b-cli-tests.md` records each edit's hashes, each touched pre-authorized file, each command's
  exit status, and findings for owning plans.
