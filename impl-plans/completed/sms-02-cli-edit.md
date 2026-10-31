# sms-02-cli-edit

- planId: sms-02-cli-edit
- planPath: impl-plans/active/sms-02-cli-edit.md
- progressPath: impl-plans/progress/sms-02-cli-edit.md
- wave: 1 of 2 in session 598. It runs alone in its wave.
- dependsOn: none in session 598. sms-01-editor-facade is an accepted
  dependency: it passed both independent reviews in session 589 and is
  not dispatched again.
- Session 598 role (design section 2.5, D14). This plan was implemented
  in 99df8d4 (session 589). It is now the review and repair pass. Do not
  implement it again. The "File-level changes", "Pitfalls" and "Tests to
  add" sections below describe what 99df8d4 must contain. The independent
  reviewers check against them and against design section 2.5. In
  session 598 you check the session-589 hashes, run the gates into
  `final/`, and apply any correction the reviewers send back.
- Design: `design-docs/specs/design-source-module-split.md`. Read
  "Invariants", "2. `nodetto-cli edit`" (2.1-2.5), "5. Verification"
  (commands 1, 2, 3, 4, 5, 6, 7 and 10), "Rollout constraints" ("Session
  598 dispatch"), D11, D13 and D14.
- Source state: HEAD 99df8d4. The line numbers below refer to the b52e4db
  `edit-command.ts` (`git show b52e4db:apps/cli/src/edit-command.ts`).
  The session-589 final hashes of every sms-02 file are in
  `tmp/source-module-split-s589/sms-02-cli-edit/final/hashes.txt`.
- Evidence directory: `tmp/source-module-split-s598/sms-02-cli-edit/`.
  Write only `.log` and `.txt` files there. Baselines go directly in it.
  The gate run goes in `final/` (the design's `$d`). If a gate run must be
  repeated after a repair, first `mv final` to `attempt-<n>/`, then rerun
  into a fresh `final/`. The session-589 evidence under
  `tmp/source-module-split-s589/sms-02-cli-edit/` is read-only input.
- Write paths (manifest `impl-plans/active/source-module-split-s598-dispatch.json`):
  `apps/cli/src/edit-command.ts`, `apps/cli/src/edit/`,
  `docs/development.md` (only if a review finding is about its two edit
  sentences at lines 32-33), the progress log, the evidence directory and
  `target/`. `target/` is the git-ignored build output root
  (`artifactRoots: ["target"]`).

## Intent and context

`apps/cli/src/edit-command.ts` is 1372 lines. It contains operation
parsing, the `Batch` class (about 870 lines, mostly a large `apply`
switch with private helpers), `applyBatch`, `editCommand` and
`runOperations`. This plan splits it into modules named for their
responsibility, keeping `edit-command.ts` as the entry point (at most 300
lines). It also removes three duplications without changing behavior, and
adds focused tests for the three newly extracted pure helpers. The output,
error text, exit codes and written bytes stay the same.

The only importers outside the file are:

- `apps/cli/src/commands.ts`, which uses `editCommand`;
- `apps/cli/src/draw-command.ts`, which uses `runOperations`;
- `apps/cli/src/ai-commands.test.ts`, which uses `EXIT_CONTENDED`.

None of them may change.

## Non-goals

- Do not change messages, the order of checks, the order of output lines,
  JSON key order, or the retry loop.
- Do not touch `packages/`, `commands.ts`, `draw-command.ts`, `help.ts`,
  `ids.ts`, any existing test file, or the native parity tests.
- Do not add a handler lookup table, classes per operation, new
  validation, or a JSON schema. Keep the `switch`.

## File-level changes

All new files are under `apps/cli/src/edit/`:

| File | Contents (moved from `edit-command.ts` unless noted) |
|---|---|
| `operation-input.ts` | `type Json`, `type JsonObject`, `class OperationError` (lines 93-100), `parseOperations`, `deepMerge`, `fillIds`. The readers are renamed: `text` becomes `requireText` and `number` becomes `requireNumber`, with the same messages. Export every symbol |
| `types.ts` | `Created`, `EditWarning`, `BatchResult` (lines 63-91), and a new `PageChangeCounts = Map<string, { added: number; updated: number; removed: number }>` used by `BatchResult.counts`. `ReadonlyMap` stays in `BatchResult` |
| `batch.ts` | `export class Batch`: fields `refs`, `created`, `touchedPages`, `replaced`, `readonly lastPlaced` (no longer `private`); `private elementIds`; public `element`, `page`, `targets`, `shape`, `resolveReferences`, `boundsOf`, `moveBoxTo`, `record`; `apply(operation, index): void`, the `op` switch, with each case calling one handler and the default case unchanged (lines 1040-1044) |
| `operations/pages.ts` | `addPage`, `movePage`, `renamePage`, `setPageMode`, `deletePage` (switch cases at lines 771-823); `placePage` (lines 232-273, now a function taking `batch`); `unknownMode` |
| `operations/add.ts` | `addElement` (today's `add`, lines 351-424), `addShape` (469-529), `addParticipant` (532-569), `placeRelative` (605-641), `PLACE_GAP` |
| `operations/connect.ts` | `connectElements` (today's `connect`, lines 649-766), and the `connectScreenTransition` import that is line 1 of `edit-command.ts` today |
| `operations/elements.ts` | `editListField` (`append`/`remove-item`, lines 832-883, taking `op`), `updateElement`, `moveElement`, `scaleElements`, `replaceTextIn`, `deleteElement`; local `definitionOf` |
| `operations/groups.ts` | `groupElements`, `ungroupElement` (lines 994-1033) |
| `apply-batch.ts` | `applyBatch` (lines 1050-1213); new exported pure helpers `unknownFieldKey`, `countPageChanges` and `issueLine` |
| `report.ts` | new exported pure helper `formatEditReport`, moved from the end of `runOperations` (lines 1334-1371) |
| `apply-batch.test.ts` | new focused tests |
| `report.test.ts` | new focused tests |

Pinned signatures. These are contracts within this plan; pick names only
where none are given here:

- handler: `(batch: Batch, operation: JsonObject, index: number) => void`.
  `addElement` and `connectElements` return `string` (the new id).
  `editListField` also takes `op: "append" | "remove-item"`.
- `placePage(batch: Batch, id: string, operation: JsonObject, index: number): boolean`
- `unknownFieldKey(path: string, elements: readonly Element[]): { element: Element; path: string; key: string } | undefined`.
  The regex `/^elements\[(\d+)\]\.(.+)$/` and the key
  `JSON.stringify([element.id, rest])` stay as they are today.
- `countPageChanges(before: ReadonlyMap<string, Element>, after: ReadonlyMap<string, Element>): PageChangeCounts`
- `issueLine(issue: Pick<ValidationIssue, "path" | "message">): string`,
  which returns `${path}: ${message}` when `path` is non-empty, otherwise
  `message`.
- `formatEditReport(result: BatchResult, path: string, dryRun: boolean, format: "text" | "json"): string`.
  It returns the exact string that `runOperations` passes to `ok(...)`
  today.

`apps/cli/src/edit-command.ts` keeps, in this order:

- the header comment (lines 2-8);
- the imports;
- `EDIT_OPTIONS`, `EDIT_FLAGS`, `EXIT_CONTENDED` (with its doc comment) and
  `MAX_ATTEMPTS`;
- `editCommand`, `RunOptions` and `runOperations`. `runOperations` narrows
  `format` and then returns `ok(formatEditReport(...))`;
- the re-exports `export { parseOperations, deepMerge } from "./edit/operation-input.ts";`,
  `export { applyBatch } from "./edit/apply-batch.ts";` and
  `export type { EditWarning } from "./edit/types.ts";`.

Duplications to remove, as a separate step after the move passes its
gates (design 2.3):

1. In `addElement` and `connectElements`, replace the inline ref and
   created bookkeeping (today lines 410-422 and 752-764) with
   `batch.record(operation, index, id, type, pageId)`. In `connect`, pass
   `created.type` and `from.page`. `addPage` keeps its unchecked
   `batch.refs.set(...)`.
2. `definitionOf(type)`, local to `operations/elements.ts`, replaces
   `isKnownElementType(t) ? getElementTypeDefinition(t) : undefined` in
   `editListField` and `updateElement`. Leave `addElement` as it is: it
   calls `getElementTypeDefinition` after its own check.
3. `issueLine` is used at both formatting sites in `applyBatch`. The
   `CommandError` details join with `"\n  "` after `"invalid element:\n  "`,
   and the result validation prefixes each line with two spaces. Keep both
   wrappers exactly.

`docs/development.md` (shared, edited after sms-01): append at most three
sentences to the paragraph that sms-01 added, or put them right after it.
They describe `nodetto-cli edit`: `edit-command.ts` is the entry point and
the retry loop, `edit/batch.ts` holds batch state and dispatch, and
`edit/operations/*` holds the handlers by domain. Edit nothing else.

`impl-plans/progress/sms-02-cli-edit.md` (new): the progress log.

## Patterns to imitate

- Module-level helper functions with doc comments, as in today's
  `apps/cli/src/edit-command.ts`: `fillIds` and `deepMerge`.
- Re-exports with `.ts` extensions, as in
  `packages/core/src/editor.ts:189-198` (`export type { ... } from`).
- Focused tests under `bun:test` next to their sources, for example
  `apps/cli/src/write-atomic.test.ts`.

## Pitfalls

- Handlers must import `Batch` with `import type`. `batch.ts` imports the
  handlers as values. `add.ts` and `connect.ts` may import each other only
  in one direction (`connect.ts` imports `addElement`).
- `OperationError` must be a single class. Every `instanceof` in
  `applyBatch`, `editCommand` and `runOperations` must import it from
  `edit/operation-input.ts`.
- `countPageChanges` must iterate exactly as today: first over `after` in
  insertion order (added, or updated by a `JSON.stringify` comparison),
  then over `before` (removed). The `Map` insertion order determines the
  page order in the text report and the key order of the JSON `pages`
  object.
- The JSON report key order is `written`, `operations`, `created`,
  `replaced` (only when non-empty), `pages`, `warnings`, with 2-space
  indent and a trailing newline. The text report puts warning lines after
  the replaced lines.
- `addShape` destructures `{ shape: _shape, label, ...rest }`. Keep the
  underscore name so Biome stays quiet.
- In `addElement`, the auto-placement block must still run before the ref
  check, so `record` is called at the same point as today's inline code.
- The `update` case builds `commands` with `as const` literals. Keep the
  inferred union so that `editor.apply(commands)` type-checks.
- Do not change `group`'s `members[0]?.page as string`.
- New modules have no module-level side effects other than constants. Do
  not add regex splitting of long strings, recursion, or per-operation
  closures that the old code did not have. The native Boa engine bundles
  these files.
- Never edit a test deadline, a timeout, `mise.toml` or an existing test
  file to make a gate pass. Retry only through the G1, G3 and G8 loops.
  Run them exactly as written, through `sh -c` or `bash -c`, because a
  bare `exit` in your own shell would end the session.

## Shared working directory protocol

- Before each edit, read the file fresh. Record its `shasum -a 256` before
  and after the edit in the progress log.
- On drift (the pre-hash differs from your last post-hash), stop, record
  it, and re-read.
- Before the first edit, record the intent snapshot (the module table
  above) in the progress log.

## Steps

Session 598 steps. Steps 1-5 of session 589 (move, gates in `move/`,
deduplicate, add tests, docs) are done in 99df8d4. Do not repeat them.

1. B0: check that the tree still matches the session-589 final state:
   `sh -c 'd=tmp/source-module-split-s598/sms-02-cli-edit; mkdir -p "$d" && shasum -a 256 -c tmp/source-module-split-s589/sms-02-cli-edit/final/hashes.txt > "$d/start-hashes-check.log" 2>&1'`
   exits 0 (14 `OK` lines: the 13 edit files and `docs/development.md`). If it fails, record the drift in the progress log and stop.
   Do not "restore" files.
2. Baseline: B1-B3 below.
3. Run G1-G10 into `final/`, with G8 directly after G3. Record the exit
   codes, the green attempt of each loop and the log paths.
4. Review corrections. The workflow's independent test-integrity and
   adversarial reviewers check this plan against design section 2.5. If
   they send correction instructions, apply each one inside the write
   paths, following design 2.1-2.4 and the invariants below. Record the
   pre and post hashes and the finding id per edit. Then `mv final
   attempt-<n>` and rerun G1-G10 into a fresh `final/`. If a correction
   adds tests, raise the expected counts in G1, G2 and G3 by the number of
   tests added, and record why. If there is no correction, make no source
   edit.

## Tests to add

Write exactly one `test(...)` per bullet below: 7 in
`apply-batch.test.ts` and 4 in `report.test.ts`, 11 in total. The gate
counts below depend on this number.

`apps/cli/src/edit/apply-batch.test.ts`:

- `unknownFieldKey("elements[1].semantic.extra", [a, b])` -> returns
  element `b`, path `semantic.extra` and key
  `JSON.stringify([b.id, "semantic.extra"])`.
- `unknownFieldKey("pages[0].name", [a])` -> `undefined`.
- `unknownFieldKey("elements[5].semantic.x", [a])` -> `undefined`, because
  the index is out of range.
- `countPageChanges`, one element unchanged (same object) -> no entry for
  its page.
- `countPageChanges` with an added, an updated (same id, different
  semantic) and a removed element on two pages -> counts per page, and the
  page key order follows the `after` order, then removed-only pages.
- `issueLine({ path: "elements[0].semantic", message: "bad" })` ->
  `"elements[0].semantic: bad"`.
- `issueLine({ path: "", message: "bad" })` -> `"bad"`.

`apps/cli/src/edit/report.test.ts`:

- text, applied, with one page count, a created item with ref `a`, a
  created item without ref, one replaced item and one warning -> the exact
  multi-line string, ending with `"\n"`; the first line is
  `Applied N operation(s) to <path>.`.
- text, dry run -> the first line starts with `Would apply`.
- json, with empty `replaced` -> the parsed object has no `replaced` key,
  `written` is `!dryRun`, and the string ends with `"\n"`.
- json, with a non-empty `replaced` -> the `replaced` key is present
  between `created` and `pages` (check `Object.keys` order).

Build `Element` values as typed literals (`id`, `page`, `type`, `index`,
`semantic`, `visual`), or through `new Editor().buildElement(...)` from
`@nodetto/core`.

## Verification

Every gate must exit 0. Record each one's exit code and log path in the
progress log. Below, `F` stands for
`tmp/source-module-split-s598/sms-02-cli-edit/final`; write the literal
path in every command. There is no binary-less parity command in this
plan (design D13): such a run only skips, so it tests nothing.

- B1, with up to three attempts because `bun test` has deadlines too:
  `sh -c 'd=tmp/source-module-split-s598/sms-02-cli-edit; mkdir -p "$d"; for i in 1 2 3; do BUN_OPTIONS=--jsx-runtime=classic bun test > "$d/baseline-bun-test-$i.log" 2>&1 && cp "$d/baseline-bun-test-$i.log" "$d/baseline-bun-test.log" && exit 0; done; exit 1'`.
  From `baseline-bun-test.log`, record the ` N pass`, ` N skip` and
  ` N fail` lines. The expected values are 2956 pass, 25 skip and 0 fail,
  the session-589 final count (99df8d4 already contains the 11 tests).
- B2: `wc -l apps/cli/src/edit-command.ts apps/cli/src/edit/*.ts apps/cli/src/edit/operations/*.ts > tmp/source-module-split-s598/sms-02-cli-edit/baseline-wc.txt`.
- B3: the test-cli baseline is the ` N pass` line of
  `tmp/source-module-split-s589/sms-02-cli-edit/final/test-cli.log`. The
  expected value is 183. Record it; do not run test-cli for the baseline.
- G1 (design command 1, load-tolerant):
  `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/verify-[123].log "$d/verify.log"; for i in 1 2 3; do BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify > "$d/verify-$i.log" 2>&1 && cp "$d/verify-$i.log" "$d/verify.log" && exit 0; done; exit 1' sh F`
  exits 0. `grep -E '^ *0 fail$' F/verify.log` exits 0, and the
  ` N pass` line equals B1's pass count (plus any test a review
  correction adds). With the expected B1, that is
  `grep -Ex ' *2956 pass' F/verify.log`, which exits 0. The skip count
  stays equal to B1's.
- G2: `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/edit/ > F/edit-unit.log 2>&1`
  exits 0, and `grep -Ex ' *11 pass' F/edit-unit.log` exits 0. The
  trailing slash keeps `edit-scale-text-group.test.ts` out of this run.
  These focused tests have no deadlines, so G2 is not retried.
- G3 (design commands 2 and 3, load-tolerant; native parity is verified
  only through test-cli):
  `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/test-cli-[123].log "$d/test-cli.log"; for i in 1 2 3; do CARGO_TERM_QUIET=true mise run test-cli > "$d/test-cli-$i.log" 2>&1 && cp "$d/test-cli-$i.log" "$d/test-cli.log" && exit 0; done; exit 1' sh F`
  exits 0. Then all of these exit 0:
  - `grep -E '^ *0 fail$' F/test-cli.log`
  - `test -z "$(grep -E '^ *[1-9][0-9]* skip$' F/test-cli.log)"`
  - `grep -Ex ' *183 pass' F/test-cli.log` (B3, plus any test a review
    correction adds under `apps/cli/src`)

  With the binary set and no skip line, all 17 parity blocks ran and
  passed. Inside test-cli, the `native edit handles refs, arrangement,
  snapshots and rollback` block runs the moved code in Boa.

  If all three attempts fail, the gate fails. It is never waived as load.
  Read the failing attempt logs. A failure in an edit-related test or a
  parity mismatch (as opposed to a deadline) is a regression to fix in
  this plan.
- G4:
  `find apps/cli/src/edit-command.ts apps/cli/src/edit -name '*.ts' -exec awk 'FNR == 701 { print FILENAME " exceeds 700 lines"; bad = 1 } END { exit bad }' {} +`
  exits 0.
- G5: `test "$(wc -l < apps/cli/src/edit-command.ts)" -le 300` exits 0.
- G6: `test -z "$(find apps/cli/src/edit -name '*[0-9]*')"` exits 0.
- G7: design command 7 (export surface) exits 0 and prints
  `export surface unchanged`. Copy the command verbatim from the design.
  Also, `git diff --exit-code b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- apps/cli/src/commands.ts apps/cli/src/draw-command.ts apps/cli/src/ai-commands.test.ts`
  exits 0, and `git diff --exit-code 9e6ccc7 -- mise.toml` exits 0.
- G8 (design command 10, CPU time). Run it directly after G3, with no
  source edit in between. Copy the multi-line `bash -c` command verbatim
  from design section 5, command 10. Replace only the trailing `"$d"`
  with the literal `F` path, and keep `/opt/homebrew/bin/nodetto-cli 0.8.5`
  as the last two arguments. It exits 0. Record the reference and new user
  times and their ratio from `F/cpu-time.log`. The bundled engine now
  includes the moved `edit/` modules, so this is the check that the split
  did not slow the CLI. If the reference binary is missing or not 0.8.5,
  stop and record a blocker for the orchestrator. Do not create a git
  worktree yourself.
- G9 (design command 4; static, runs no test):
  `sh -c 'test "$(cat apps/cli/src/native-parity.test.ts apps/cli/src/native-parity/*.test.ts 2>/dev/null | grep -c "^nativeTest(")" -eq 17'`
  exits 0. Run it exactly as written, inside `sh -c`. In wave 1 the topic
  glob matches nothing, and zsh would abort with "no matches found" before
  `2>/dev/null` applies. In this wave only the old file exists, so this is
  the old-file form. This plan does not touch the parity file, so the 17
  blocks are still there for sms-03 to move. The form also holds on the
  final tree, when only the topic files exist, so a later rerun of this
  gate still exits 0.
- G10 (test integrity): no test file other than the two new section 2.4
  files changed since b52e4db:
  `test -z "$(git diff --name-only b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- '*.test.ts' '*.test.tsx' | grep -Ev '^apps/cli/src/(edit/|native-parity)')"`
  exits 0. The `native-parity` exclusion covers sms-03's later move only.
  This plan never touches those files.

## Acceptance criteria

- B0 exits 0, or the drift is recorded and the plan stopped.
- Every file in the table exists. `edit-command.ts` exports exactly the
  values `parseOperations`, `deepMerge`, `applyBatch`, `editCommand`,
  `runOperations` and `EXIT_CONTENDED`, and the types `EditWarning` and
  `RunOptions`.
- G1-G10 exit 0, with logs in `final/`. G1 shows ` 2956 pass`, G2 shows
  ` 11 pass`, and G3 shows ` 183 pass`, ` 0 fail` and no skip line. If a
  review correction adds tests, each count rises by that number and the
  progress log says why. G8's `final/cpu-time.log` shows a new user time
  at most 1.15 times the reference.
- Every review correction is recorded with its finding id, the files
  edited and their pre and post hashes. With no correction,
  `git diff --stat 99df8d4 -- apps/cli/src docs` prints nothing.
- The progress log records which attempt went green for G1, G3 and G8.
- The two new test files contain every case listed above, with one
  `test(...)` per case.
- The progress log has the baseline, the gate results, the hashes, drift
  events, and the final `wc -l` for `edit-command.ts` and every file under
  `apps/cli/src/edit`.

## Progress log

`impl-plans/progress/sms-02-cli-edit.md` records the intent snapshot,
baselines, steps, gate exit codes, log paths, drift events and final line
counts. Edit only this progress log, not any other plan or progress file.
In session 598, keep the session-589 text and append a "Session 598"
section with B0-B3, G1-G10, every review correction, and the final status.
