# clm-04-edit-usability

- planId: clm-04-edit-usability
- planPath: impl-plans/active/clm-04-edit-usability.md
- progressPath: impl-plans/progress/clm-04-edit-usability.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections C1,
  C2, C3 and A6, and the C and A6 rows of "Verification". Owner question
  Q5: `add` with `type` applies `label`.
- writePaths:
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/operation-fields.ts` (new)
  - `apps/cli/src/edit/operation-fields.test.ts` (new)
  - `apps/cli/src/edit/label-field.ts` (new)
  - `apps/cli/src/edit/label-field.test.ts` (new)
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/edit/operations/add.ts`
  - `apps/cli/src/edit/operations/connect.ts`
  - `apps/cli/src/edit/operations/groups.ts`
  - `apps/cli/src/edit/operations/pages.ts`
  - `apps/cli/src/edit/report.ts`
  - `apps/cli/src/edit/report.test.ts`
  - `apps/cli/src/edit-frame-carry.test.ts` (new)
  - `apps/cli/src/warnings.ts` (new)
  - `apps/cli/src/warnings.test.ts` (new)
  - `apps/cli/src/edit-command.ts`
  - `apps/cli/src/draw-command.ts`
  - `apps/cli/src/export-command.ts`
  - `apps/cli/src/shapes-command.ts`
  - `apps/cli/src/types-command.ts`
  - `apps/cli/src/ai-features.test.ts`
  - `apps/cli/src/ai-commands.test.ts`
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
  - `impl-plans/progress/clm-04-edit-usability.md`
  - `tmp/clm-s725/clm-04-edit-usability`
  - `target`
- sharedPaths: none
- sharedPathNotes:
  - The existing test files above may change only where an operation passes
    a top-level field that C2 now rejects, or where a warning assertion must
    reflect collapsing. Record every such change in the progress log, with
    the operation and the reason.
  - `edit/operations/groups.ts` and `edit/operations/pages.ts` change only if
    the C2 audit shows a handler reads a field outside its table row.
  - `shapes-command.ts` and `types-command.ts` print example operations.
    Change them only if an example passes a field that C2 rejects. Example
    operations in `help.ts` are clm-09's: record any invalid one as a
    finding for clm-09.
- artifactRoots: `target`

## Intent and context

- `update` accepts `label`.
- Unknown operation fields fail and suggest valid names.
- Repeated warnings collapse into one line with a count.
- A `--quiet` helper exists for clm-09 to wire in.
- `carryMembers:false` moves a frame without its members.

Relevant existing code:

- `edit/operations/add.ts:addShape` (around lines 124-150) resolves labels
  with `editableField`/`setText`, falling back to `name`, `label`, `text`.
  `edit/operations/connect.ts` (around lines 108-116) writes `trigger` for
  `state.transition`, `name` for `bpmn.*`, and `label` otherwise.
- `edit/batch.ts:Batch.apply` dispatches by `op` (the `switch` around lines
  240-290).
- `edit/operations/elements.ts:scaleElements` passes `placed` to
  `editor.apply`. `apps/cli/src/edit/apply-batch.ts:141-147` passes
  `placed` from `planArrangement`. `frameParents` is exported from
  `@nodetto/core`.
- Warning text: `edit/report.ts` (`  warning operation <i> (<op>): ...`),
  and `export-command.ts` text-layout warnings
  (`warning: <rule-id> <element-id>: <message>`).
- `commands.ts:loadDocument` warnings and every `--quiet` entry point are
  in shared files. clm-09 wires them with this plan's helpers.

## Non-goals

- Do not edit `commands.ts`, `help.ts`, `cli.ts`, `native-engine.ts`,
  `main.ts`, docs, `README.md` or any core file.
- Do not edit `apps/cli/src/edit/apply-batch.ts` (clm-02 owns it).
- `semantic.unknownField` handling inside `semantic` stays a warning.
- Connect keeps its precedence: its `semantic` still overrides `label`.
- No `carryMembers` on `move`. JSON output is never collapsed or filtered.

## Contract (clm-09 depends on it)

```ts
// edit/label-field.ts
export function labelField(editor: Editor, element: Element): { field: string } | { error: string };
export function applyLabel(batch: Batch, elementId: string, label: Json, index: number): void;
// warnings.ts
export function collapseWarnings(lines: readonly string[], keys?: readonly string[]): string[];
export function issueWarningKey(issue: ValidationIssue, document: Document): string;
export function extractQuiet(args: readonly string[]): { args: string[]; quiet: boolean };
export function applyQuiet(command: string, result: CommandResult): CommandResult;
```

## File-level changes

1. `edit/label-field.ts`
   - `labelField` resolution order (design C1):
     1. Connector types (definition category `edge`): `trigger` for
        `state.transition`, `name` for `bpmn.*`, `label` otherwise.
     2. `editor.editableField(id)` when defined.
     3. The first string semantic field among `name`, `label`, `text`.
     4. Otherwise `{ error: "<type> has no text label; set its fields with \"semantic\"." }`.
   - `applyLabel` throws `OperationError` for the error case, or when
     `label` is not a string (`"label" must be a string`). It writes with
     `editor.setText` for case 2, and a semantic update otherwise.
   - `add.ts:addShape` and `connect.ts` use the helper with their current
     behavior. `add.ts:addElement` (with `type`) now applies `label` (Q5).
2. `edit/operations/elements.ts:updateElement`
   - Accept `label`, applied after the semantic and visual commands.
   - The error becomes `update needs semantic, visual or label`.
   - `carryMembers`:
     - `undefined`: today's behavior.
     - not a boolean: throws `"carryMembers" must be true or false`.
     - `false` on a non-frame: throws `carryMembers applies only to frames`.
     - `false` on a frame: collect the frame's transitive descendants with
       `frameParents(store, page, context)` before applying, then call
       `batch.editor.apply(commands, { placed })`. Get the context with
       `setCurrentPage(element.page)` and `createShapeContext(1)`, as
       `Batch.boundsOf` does.
3. `edit/operation-fields.ts`
   - `OPERATION_FIELDS: Readonly<Record<string, readonly string[]>>` is the
     design C2 table.
   - `checkOperationFields(operation: JsonObject, index: number): void`.
   - First audit every handler in `edit/operations/*.ts` and `edit/batch.ts`
     for `operation["..."]` (and destructured) reads. Correct the table, and
     record each difference in the progress log. `draw-command.ts` must
     produce only valid fields.
   - Error: `unknown field "<f>". Did you mean "<s>"? Valid fields: <row in table order>.`,
     thrown as `OperationError`. `runOperations` prefixes
     `Operation <i> (<op>): `. Several unknown fields are each named in one
     message.
   - Suggestion: the closest field by case-insensitive Levenshtein distance
     of at most 2, or a prefix relation either way. Ties go to table order.
     Omit "Did you mean" when nothing qualifies.
   - In `replace-text`, a non-boolean `regex` throws
     `"regex" must be true or false (true reads "find" as a regular expression)`.
     The same message, with `ignoreCase`, applies to `ignoreCase`.
4. `edit/batch.ts:Batch.apply` calls `checkOperationFields` after
   recognizing `op` and before dispatch. An unknown `op` keeps its message.
5. `warnings.ts`
   - `collapseWarnings(lines, keys?)`: group by `keys[i]` when given,
     otherwise by the exact line. A group of n >= 2 prints its first line
     plus ` (and <n-1> more like this)`. Groups keep the order of their
     first line.
   - `issueWarningKey(issue, document)`: `code|elementType|path after elements[i].`
     when the issue has a code, else the message.
   - `extractQuiet(args)`: removes every `--quiet` before the first `--`.
   - `applyQuiet(command, result)`: drops stderr lines that start with
     `warning: `. For `edit` and `draw` it also drops stdout lines that start
     with `  warning operation `. It never changes the exit code, and never
     drops `error:` or `conflict:` lines, `--strict` summary lines or lint
     findings.
6. `edit/report.ts`: text output collapses warnings by
   (code, element type, path). JSON keeps the full list.
7. `export-command.ts`: collapse the text-layout `warning:` lines by rule id
   and element type.
8. `edit-command.ts` and `draw-command.ts`: change only where they format
   warning text themselves. Record whether a change was needed.

## Pitfalls

- The C2 check runs before any editor command, so an invalid batch writes
  nothing.
- `draw --label` output stays byte-identical under the new label helper.
  Check with the existing draw tests.
- An existing test fixture that passes an extra field: fix the fixture,
  not the rule. A production caller that passes one means the table is
  wrong: fix the table and record it.
- clm-02's A7 fixture uses only `op`, `id` and `semantic` on `update`, which
  must stay valid.

## Tests (input -> expected)

- `label-field.test.ts`:
  - For every known element type, add a default element and `update` it
    with `label:"Widget"`. The mapped field equals `"Widget"`, or the update
    fails with `has no text label`.
  - Asserted mappings: `text.note`->`text`, `frame`->`name`,
    `node.generic`->`label`, `state.node`->`name`, `erd.table`->`tableName`,
    `state.transition`->`trigger`, `edge.generic`->`label`.
  - Label and semantic on the same field -> label wins.
  - `add` with `type` and `label` -> the field is set.
- `operation-fields.test.ts`:
  - For each op in the table, an extra field `bogus` -> exit 2,
    `unknown field "bogus"` and the valid list.
  - `replace-text` with `replacement` -> suggests `replace`.
  - `regex:"a."` -> the boolean message.
  - A static scan of `operations/*.ts` and `batch.ts` finds every read
    field in its op's row.
- `edit-frame-carry.test.ts`:
  - Move a member, then update the frame `x` by +100 in one batch -> the
    member shifted by 100 (default).
  - The same with `carryMembers:false` -> the member keeps the position the
    first op set.
  - `carryMembers` on a non-frame -> exit 2. `carryMembers:"no"` -> exit 2.
- `warnings.test.ts`:
  - 42 identical-key lines -> one line ending `(and 41 more like this)`.
  - Different keys stay separate, in first-seen order.
  - `extractQuiet(["validate","--quiet","a.jsonl","--","--quiet"])` ->
    args `["validate","a.jsonl","--","--quiet"]`, quiet true.
  - `applyQuiet` keeps the exit code, `error:` lines and the strict summary.
- `report.test.ts`: collapsed text warnings, unchanged JSON.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit apps/cli/src/edit-frame-carry.test.ts apps/cli/src/warnings.test.ts`.
2. `bun test apps/cli/src/ai-features.test.ts apps/cli/src/pages-command.test.ts apps/cli/src/shape-lateral.test.ts apps/cli/src/shapes-command.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/export-command.test.ts apps/cli/src/text-layout-export.test.ts apps/cli/src/commands.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts apps/cli/src/mcp-stdio.test.ts`.
3. `bun run typecheck`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/drawing.test.ts apps/cli/src/native-parity/documents.test.ts`:
   more than 0 tests run, and all pass. Use up to 3 attempts on a deadline
   timeout.
5. `bunx biome check <owned TS files>`.

## Done criteria

- The contract symbols exist.
- The progress log lists the audited field table and every existing test
  change.
- Verification 1 to 5 exit 0, with logs under
  `tmp/clm-s725/clm-04-edit-usability/`.
- `git status --short` shows only writePaths changed.
