# clm-04-edit-usability

- planId: clm-04-edit-usability
- planPath: impl-plans/active/clm-04-edit-usability.md
- progressPath: impl-plans/progress/clm-04-edit-usability.md
- wave: 2
- dependsOn: clm-01-merge. clm-01 owns `commands.ts`, `help.ts`,
  `docs/cli.md` and `README.md` in wave 1; this plan takes them over in
  wave 2.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections C1,
  C2, C3 and A6, the C and A6 rows of "Verification", and owner question Q5
  (`add` with `type` applies `label`).
- writePaths:
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/operation-fields.ts` (new)
  - `apps/cli/src/edit/operation-fields.test.ts` (new)
  - `apps/cli/src/edit/label-field.ts` (new)
  - `apps/cli/src/edit/label-field.test.ts` (new)
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/edit/operations/add.ts`
  - `apps/cli/src/edit/operations/connect.ts`
  - `apps/cli/src/edit/report.ts`
  - `apps/cli/src/edit/report.test.ts`
  - `apps/cli/src/edit-frame-carry.test.ts` (new)
  - `apps/cli/src/warnings.ts` (new)
  - `apps/cli/src/warnings.test.ts` (new)
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/cli.ts`
  - `apps/cli/src/native-engine.ts`
  - `apps/cli/src/export-command.ts`
  - `apps/cli/src/help.ts`
  - `apps/cli/src/native-parity/edit-usability.test.ts` (new)
  - `apps/cli/src/ai-commands.test.ts`
  - `apps/cli/src/ai-features.test.ts`
  - `apps/cli/src/commands.test.ts`
  - `apps/cli/src/mcp.test.ts`
  - `apps/cli/src/mcp-stdio.test.ts`
  - `apps/cli/src/pages-command.test.ts`
  - `apps/cli/src/shape-lateral.test.ts`
  - `apps/cli/src/shapes-command.test.ts`
  - `apps/cli/src/edit-scale-text-group.test.ts`
  - `apps/cli/src/export-command.test.ts`
  - `apps/cli/src/text-layout-export.test.ts`
  - `apps/cli/src/native-parity/documents.test.ts`
  - `apps/cli/src/native-parity/drawing.test.ts`
  - `docs/cli.md`
  - `README.md`
  - `impl-plans/progress/clm-04-edit-usability.md`
  - `tmp/clm-s725/clm-04-edit-usability`
  - `target`
- artifactRoots: `target`
- sharedPathNotes:
  - The existing test files listed above may change only where an
    operation passes a top-level field that C2 now rejects, or where a help
    or warning assertion must reflect C1, C3 or A6. Record every such change
    in the progress log, with the operation and the reason.

## Intent and context

Edit operations should be easier to use, warning output should be quieter,
and frame moves need an opt-out:

- `update` accepts `label`.
- Unknown operation fields fail and suggest valid names.
- Repeated warnings collapse into one line.
- A global `--quiet` flag drops warnings.
- `carryMembers:false` moves a frame without its members.

Relevant existing code:

- Label resolution: `edit/operations/add.ts:addShape`, lines 124-150, uses
  `editableField`/`setText` and falls back to `name`, `label`, `text`.
  `edit/operations/connect.ts`, about lines 108-116, writes `trigger` for
  `state.transition`, `name` for `bpmn.*`, and `label` otherwise.
- Dispatch: `edit/batch.ts:Batch.apply`.
- Warnings:
  - `commands.ts:loadDocument` and `formatIssue` (`warning: <path>: <msg> (semantic.unknownField)`);
  - `edit/report.ts` (`  warning operation <i> (<op>): ...`);
  - `export-command.ts` lint warnings (`warning: <rule-id> <element-id>: <message>`).
- Entry points: `commands.ts:runCli`, `cli.ts:runCliAsync`, and
  `native-engine.ts` (`nodettoRun`, which handles export and open itself).

## Non-goals

- Do not change the inner `semantic.unknownField` handling: those stay
  warnings.
- No change to connect's precedence. Its `semantic` still overrides `label`.
- No `carryMembers` on `move`.
- JSON outputs are never collapsed or filtered.
- Do not touch `apps/cli/src/edit/apply-batch.ts` (clm-02 owns it), and do
  not touch core or Rust.

## File-level changes

1. `edit/label-field.ts`
   - Export `applyLabel(batch: Batch, elementId: string, label: Json, index: number): void`
     and `labelFieldOf(batch, element): string | undefined`.
   - Resolution order, from design C1:
     1. Connector types (definition category `edge`): the field connect
        writes.
     2. `editor.editableField(id)`, then `editor.setText`.
     3. The first string semantic field among `name`, `label`, `text`.
     4. Otherwise throw
        `OperationError(index, "<type> has no text label; set its fields with \"semantic\".")`.
   - A non-string `label` throws `"label" must be a string`.
   - `add.ts:addShape` and `connect.ts` use the helper, with the same
     behavior as today.
   - `add.ts:addElement` (with `type`) now applies `label` after creation
     (Q5).
2. `edit/operations/elements.ts:updateElement`
   - Accept `label`, applied after the semantic and visual commands.
   - The error message becomes `update needs semantic, visual or label`.
   - `carryMembers`:
     - `undefined` keeps today's behavior.
     - A non-boolean throws `"carryMembers" must be true or false`.
     - `false` on a non-frame throws `carryMembers applies only to frames`.
     - `false` on a frame: collect the frame's transitive descendants with
       `frameParents(store, page, context)` (exported from `@nodetto/core`)
       before applying, then call `batch.editor.apply(commands, { placed })`.
       This imitates `scaleElements`, which passes `placed`.
3. `edit/operation-fields.ts`
   - Export `OPERATION_FIELDS: Readonly<Record<string, readonly string[]>>`,
     the table from design C2, and
     `checkOperationFields(operation: JsonObject, index: number): void`.
   - First audit every handler in `edit/operations/*.ts` and `edit/batch.ts`
     for the `operation["..."]` reads. Correct the table, and record any
     difference in the progress log.
   - Error message:
     `unknown field "<f>". Did you mean "<s>"? Valid fields: <list>.`
     Use `OperationError`; `runOperations` prefixes `Operation <i> (<op>): `.
     Several unknown fields are each named in one message.
   - Suggestion: the closest valid field by case-insensitive Levenshtein
     distance of at most 2, or a prefix relation in either direction. Ties
     go to table order. Omit the "Did you mean" part when nothing
     qualifies.
   - `regex` or `ignoreCase` that is not a boolean in `replace-text` throws
     `"regex" must be true or false (true reads "find" as a regular expression)`,
     or the same for `ignoreCase`.
   - `Batch.apply` calls `checkOperationFields` after recognizing `op` and
     before dispatch. An unknown `op` keeps the existing message.
4. `warnings.ts`
   - `collapseIssueWarnings(issues, elements)` groups by code, element type,
     and the path after `elements[i].`. It is used by `loadDocument`.
   - `collapseEditWarnings(warnings)` groups by code, type and path. It is
     used by `report.ts` text output.
   - `collapseLines(lines)` groups by exact text. It is used for export
     lint warnings, by rule id and element type, and for other `warning:`
     text.
   - A group of n >= 2 prints its first line, then ` (and <n-1> more like this)`.
     Groups keep the order of their first line.
   - `extractGlobalFlags(args): { args: string[]; quiet: boolean }` removes
     every `--quiet` before the first `--`.
   - `applyQuiet(command, result): CommandResult` drops stderr lines that
     start with `warning: `. For `edit` and `draw` it also drops stdout
     lines that start with `  warning operation `. Exit codes never change.
5. `commands.ts`
   - `loadDocument` collapses its warning lines. `warningCount` keeps the
     real count, so `--strict` is unchanged.
   - `runCli` calls `extractGlobalFlags` first and `applyQuiet` last.
6. `cli.ts:runCliAsync` and `native-engine.ts:nodettoRun` use the same
   extraction and `applyQuiet` around the export and open paths. Pass the
   cleaned args to `runCli`, then apply quiet once. Do not double-strip;
   stripping is idempotent anyway.
7. `export-command.ts`: collapse the text-layout `warning:` lines by rule id
   and element type.
8. `edit/report.ts`: the text report collapses warnings. JSON keeps the full
   list.
9. `help.ts`:
   - OVERVIEW: "Global option: --quiet suppresses warnings."
   - `edit`: `label` on update with the mapping table (C1); the
     `carryMembers` default and opt-out text (A6, including members placed
     earlier in the batch); unknown fields are rejected with a list of valid
     fields.
   - `validate` and `export`: mention `--quiet` and collapsing.
10. `docs/cli.md` and `README.md`: the same user-facing content.

## Pitfalls

- `--quiet` must not be passed to the command parsers. They reject unknown
  options (`parseArgs` returns `Unknown option`).
- `--quiet` must not hide `error:` lines, `conflict:` lines from merge, the
  `--strict` summary lines or lint findings.
- The C2 check happens before any editor command, so an invalid batch still
  writes nothing.
- Under the new label rule, `draw --label` on a shape keeps its output
  byte-identical. Check this with the existing draw tests.
- The audit of existing tests may find fixtures that pass extra fields. Fix
  the fixture, never the rule. If a non-test production caller (for example
  `draw-command.ts`) passes an extra field, the table is wrong: fix the
  table and record it.
- `frameParents` needs a shape context: `batch.editor.createShapeContext(1)`
  after `setCurrentPage(element.page)`, the way `Batch.boundsOf` does.

## Tests (input -> expected)

- `label-field.test.ts`:
  - For every type in the IR type catalogue (`isKnownElementType` list), add
    a default element and `update` it with `label:"Widget"`. The mapped field
    equals `"Widget"`, or the update fails with `has no text label`.
  - The table is asserted for `text.note`->`text`, `frame`->`name`,
    `node.generic`->`label`, `state.node`->`name`, `erd.table`->`tableName`,
    `state.transition`->`trigger` and `edge.generic`->`label`.
  - Label applied after semantic: label wins.
  - `add` with `type` and `label` sets the field.
- `operation-fields.test.ts`:
  - For each op in the table, an extra field `bogus` gives exit 2 with
    `unknown field "bogus"` and the valid list.
  - `replace-text` with `replacement` suggests `replace`.
  - `regex:"a."` gives the boolean message.
  - Audit: a static scan of `operations/*.ts` and `batch.ts` for
    `operation["x"]` reads finds every read in the table for its op.
- `edit-frame-carry.test.ts`:
  - A batch that moves a member, then updates the frame `x` by +100 -> the
    member is shifted by 100 (default).
  - The same batch with `carryMembers:false` -> the member keeps the
    position the first op set.
  - `carryMembers` on a non-frame -> exit 2. `carryMembers:"no"` -> exit 2.
- `warnings.test.ts`:
  - 42 unknownField warnings on `node.generic` `semantic.foo` -> one line
    ending `(and 41 more like this)`.
  - Different paths stay separate.
  - `--quiet` on `validate` drops the warning lines but keeps the summary.
  - `validate --strict --quiet` still exits 3.
  - `edit --quiet` drops the `  warning operation` lines.
  - `--format json` keeps every warning.
  - `--quiet` after `--` stays positional.
- `native-parity/edit-usability.test.ts` (`compare` from `harness.ts`):
  update label, an unknown-field error, `carryMembers:false`, collapsed
  warnings and `--quiet` on `validate`, `edit` and `export --format svg`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit apps/cli/src/edit-frame-carry.test.ts apps/cli/src/warnings.test.ts`.
2. `bun test apps/cli/src/ai-commands.test.ts apps/cli/src/ai-features.test.ts apps/cli/src/commands.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts apps/cli/src/pages-command.test.ts apps/cli/src/shape-lateral.test.ts apps/cli/src/shapes-command.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/export-command.test.ts`.
3. `bun run typecheck`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-usability.test.ts apps/cli/src/native-parity/drawing.test.ts apps/cli/src/native-parity/documents.test.ts`.
   It must run more than 0 tests, and all must pass. Use up to 3 attempts
   on a deadline timeout.
5. `bunx biome check <owned TS files>`.

## Done criteria

- Verification commands 1 to 5 exit 0, and their logs are under
  `tmp/clm-s725/clm-04-edit-usability/`.
- The progress log lists the audited field table and every existing test
  change.
- `git diff --stat` shows only writePaths.
