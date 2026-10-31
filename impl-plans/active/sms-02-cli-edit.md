# sms-02-cli-edit

- planId: sms-02-cli-edit
- planPath: impl-plans/active/sms-02-cli-edit.md
- progressPath: impl-plans/progress/sms-02-cli-edit.md
- wave: 2 of 3 in session 579. It runs alone in its wave.
- dependsOn: sms-01-editor-facade. The two plans touch no common source
  file. The dependency exists because this plan's gates load
  `packages/core` and build the release binary, so they need sms-01
  finished. Both plans also edit `docs/development.md`, one after the
  other.
- Design: `design-docs/specs/design-source-module-split.md`. Read
  "Invariants", "2. `nodetto-cli edit`" (2.1-2.4), "4. Documentation",
  "5. Verification" (commands 1, 2, 5, 6 and 7) and "Rollout constraints".
- Evidence directory: `tmp/source-module-split-s579/sms-02-cli-edit/`.
  Write only `.log` and `.txt` files there.
- Write paths (manifest `impl-plans/active/source-module-split-s579-dispatch.json`):
  `apps/cli/src/edit-command.ts`, `apps/cli/src/edit/`,
  `docs/development.md`, the progress log, the evidence directory and
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

## Shared working directory protocol

- Before each edit, read the file fresh. Record its `shasum -a 256` before
  and after the edit in the progress log.
- On drift (the pre-hash differs from your last post-hash), stop, record
  it, and re-read.
- Before the first edit, record the intent snapshot (the module table
  above) in the progress log.

## Steps

1. Baseline, on the tree before any edit (sms-01 is already applied):
   B1 and B2 below.
2. Move the code into the modules; `this.` becomes `batch.` in the
   handlers. Build the re-exports. Pass G1-G7.
3. Deduplicate (items 1-3). Add `apply-batch.test.ts` and `report.test.ts`.
   Pass G1-G7 again.
4. Edit `docs/development.md`, then run G1.

## Tests to add

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
progress log.

- B1:
  `BUN_OPTIONS=--jsx-runtime=classic bun test > tmp/source-module-split-s579/sms-02-cli-edit/baseline-bun-test.log 2>&1`.
  Record the ` N pass`, ` N skip` and ` N fail` lines.
- B2: `wc -l apps/cli/src/edit-command.ts > tmp/source-module-split-s579/sms-02-cli-edit/baseline-wc.txt`.
- G1:
  `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify > tmp/source-module-split-s579/sms-02-cli-edit/verify.log 2>&1`
  exits 0. The log has ` 0 fail`, and its pass count is at least B1's pass
  count plus the number of new tests.
- G2: `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/edit/ > tmp/source-module-split-s579/sms-02-cli-edit/edit-unit.log 2>&1`
  exits 0, and `grep -E '^ *[1-9][0-9]* pass$' tmp/source-module-split-s579/sms-02-cli-edit/edit-unit.log`
  exits 0. The trailing slash keeps `edit-scale-text-group.test.ts` out of
  this run. Record the pass count; it must equal the number of new test
  cases.
- G3:
  `CARGO_TERM_QUIET=true mise run test-cli > tmp/source-module-split-s579/sms-02-cli-edit/test-cli.log 2>&1`
  exits 0, with ` 0 fail`. Then
  `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity > tmp/source-module-split-s579/sms-02-cli-edit/native-parity.log 2>&1`
  exits 0, and `grep -Ex ' *17 pass' tmp/source-module-split-s579/sms-02-cli-edit/native-parity.log`
  exits 0. The `native edit handles refs, arrangement, snapshots and
  rollback` block runs the moved code in Boa.
- G4:
  `find apps/cli/src/edit-command.ts apps/cli/src/edit -name '*.ts' -exec awk 'FNR == 701 { print FILENAME " exceeds 700 lines"; bad = 1 } END { exit bad }' {} +`
  exits 0.
- G5: `test "$(wc -l < apps/cli/src/edit-command.ts)" -le 300` exits 0.
- G6: `test -z "$(find apps/cli/src/edit -name '*[0-9]*')"` exits 0.
- G7: design command 7 (export surface) exits 0 and prints
  `export surface unchanged`. Copy the command verbatim from the design.
  Also, `git diff --exit-code b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- apps/cli/src/commands.ts apps/cli/src/draw-command.ts apps/cli/src/ai-commands.test.ts`
  exits 0.

## Acceptance criteria

- Every file in the table exists. `edit-command.ts` exports exactly the
  values `parseOperations`, `deepMerge`, `applyBatch`, `editCommand`,
  `runOperations` and `EXIT_CONTENDED`, and the types `EditWarning` and
  `RunOptions`.
- G1-G7 exit 0, with logs in the evidence directory.
- The two new test files contain every case listed above.
- The progress log has the baseline, the gate results, the hashes, drift
  events, and the final `wc -l` for `edit-command.ts` and every file under
  `apps/cli/src/edit`.

## Progress log

`impl-plans/progress/sms-02-cli-edit.md` records the intent snapshot,
baselines, steps, gate exit codes, log paths, drift events and final line
counts. Edit only this progress log, not any other plan or progress file.
