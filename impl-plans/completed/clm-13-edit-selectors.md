# clm-13-edit-selectors

- planId: clm-13-edit-selectors
- planPath: impl-plans/active/clm-13-edit-selectors.md
- progressPath: impl-plans/progress/clm-13-edit-selectors.md
- wave: 1
- dependsOn: none (clm-04-edit-usability is landed: `labelField`,
  `OPERATION_FIELDS`, `checkOperationFields`)
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections F1,
  F2, F3, F4 (C2 rows and unknown-op list), contracts in "Continuation
  contracts" (clm-13 block), Verification rows F1-F4. Owner questions Q9 and
  Q10 (defaults implemented).
- writePaths:
  - `apps/cli/src/edit/selectors.ts` (new)
  - `apps/cli/src/edit/selectors.test.ts` (new)
  - `apps/cli/src/edit/operations/select.ts` (new)
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/edit/operations/connect.ts`
  - `apps/cli/src/edit/operations/add.ts`
  - `apps/cli/src/edit/operations/groups.ts`
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/operation-fields.test.ts`
  - `apps/cli/src/edit/report.ts`
  - `apps/cli/src/edit/report.test.ts`
  - `apps/cli/src/edit/types.ts`
  - `impl-plans/progress/clm-13-edit-selectors.md`
  - `tmp/clm-s731/clm-13-edit-selectors`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Id-free editing: `name:<text>` references, `where` selection with `expect`
on `update` and `delete`, and a `select` op that binds an existing element to
an `@ref`. All logic lives in `apps/cli/src/edit/selectors.ts`; the handlers
call it.

Existing code to imitate / extend:
- `apps/cli/src/edit/batch.ts:Batch.element` (id, `@ref`, prefix via
  `apps/cli/src/ids.ts:resolveId`; page-name hint error).
- `apps/cli/src/edit/batch.ts:Batch.resolveReferences` (`@ref` substitution,
  edge `from`/`to`, ERD relation `table`).
- `apps/cli/src/edit/label-field.ts:labelField(editor, element)` for an
  element's text field.
- `apps/cli/src/edit/operation-fields.ts:checkOperationFields` and its
  suggestion format for unknown fields.
- `packages/core/src/frame-tree.ts:frameParents`,
  `packages/core/src/shapes/connector.ts:endpointReaderFor`.

## Contract (binding)

```ts
// apps/cli/src/edit/types.ts
export interface MatchReport {
  readonly operation: number; readonly op: string;
  readonly count: number; readonly ids: readonly string[];
}
// BatchResult gains: readonly matches?: readonly MatchReport[];
// apps/cli/src/edit/batch.ts: Batch gains `readonly matches: MatchReport[] = []`
// apps/cli/src/edit/selectors.ts
export function resolveElementReference(batch: Batch, value: string, index: number, scopePage?: string): Element;
export function matchWhere(batch: Batch, where: unknown, index: number): Element[];
export function formatMatchLines(matches: readonly MatchReport[]): string[];
```

`BatchResult.matches` stays optional: `apply-batch.ts` (owned by clm-02 in
this wave) is not edited here; clm-09 adds `matches: batch.matches`.

## Rules (implement exactly)

F1 reference resolution (`resolveElementReference`), in order:
1. Exact element id (anywhere in the document).
2. `@ref` (existing behavior and message).
3. `name:<text>`: candidates are elements in scope whose label-field value
   (`labelField`, string values only) equals `<text>` after trimming both
   sides; case-sensitive; no Unicode normalization. Exactly one -> it. Else
   throw `OperationError(index, ...)` with the candidate list.
4. Unique id prefix (existing `resolveId` behavior and messages).
Scope: `scopePage` when given, else the whole document.

Error formats (fixed text, stable order = page order then id; max 10 lines
then `  ... and <n> more`):
```text
"name:Approve" matches 2 elements:
  <shortid> <type> "<text>" on page "<page name>"
  ...
Use an id, or "where" with "page".
```
Zero matches: `no element named "<text>"; similar:` followed by lines for
elements whose text contains `<text>` case-insensitively, or
`no element named "<text>"; no similar names`. Short ids use
`apps/cli/src/ids.ts:shortIds`. `OperationError` prefixes the op index as
today.

Where F1 applies:
- `Batch.element` delegates to `resolveElementReference` (this covers `id`,
  each `ids` item in `scale`, `group`, `replace-text`, `ungroup`, `move`,
  `append`, `remove-item`).
- `connect`: `from` scope = op `page` if present else whole document; `to`
  scope = page of the resolved `from` (edit `operations/connect.ts`).
- `semantic` on `update` and `add`/`connect`: after the existing `@ref`
  substitution, call the type definition's `references(semantic)`; for each
  reported reference whose value is a string starting with `name:` and that
  is not an exact element id, resolve with scope = page of the element being
  updated (for `add`, the target page) and write the id back at that field
  path (`parent`, `attachedTo`, `memberIds[3]`, ...). Other strings in
  `semantic` are never touched (a note `text` of `"name: x"` stays).

F2 `where` (`matchWhere`), `update` and `delete`:
- `where` must be a non-empty plain object with keys from
  `type, from, to, parent, name, page`; an unknown key throws with the C2
  suggestion format (reuse the Levenshtein/prefix suggestion helper from
  `operation-fields.ts`; export it if needed, it is in writePaths).
- `type` exact type string. `from`/`to`: references (F1, scope = `page` key or
  document); an element matches when `endpointReaderFor(element.type)(semantic)`
  returns that id at that end; non-connectors never match. `parent`: a
  reference; matches when it equals the element's direct container: its
  `semantic.parent` string if present, else its `frameParents` parent on its
  page, else the `group` whose `memberIds` lists it. `name`: F1 text rule.
  `page`: page query via `resolvePageQuery`; limits candidates to that page.
- Match order: stable (page order, then id).
- `id` with `where` -> `use either "id" or "where"`. `expect` without `where`
  -> `"expect" needs "where"`. `expect` must be an integer >= 0, else
  `"expect" must be a whole number >= 0`.
- Count check: with `expect`, a different count throws
  `where matched <n> element(s), expected <e>:` plus the candidate lines (the
  matched elements, F1 list format). Without `expect`, 0 matches throws
  `where matched no elements` plus the similar-name list when `name` was
  given. `expect: 0` with 0 matches is a successful no-op.
- Record `batch.matches.push({ operation: index, op, count, ids })` for every
  `where` and every `select`.
- `update` + `where`: refactor `updateElement` into a per-element helper
  `updateOne(batch, element, operation, index)` that contains today's body
  (semantic merge, visual, the existing A6 `carryMembers` block unchanged,
  label) and call it per match in order. Keep the A6 carry block textually in
  `updateOne` so clm-11 can replace it in wave 2.
- `delete` + `where`: one `deleteElements` command with all matched ids (keep
  the existing single-id path for `id`).
- Errors are `OperationError`; `applyBatch` already aborts the whole batch
  and nothing is written (do not edit `apply-batch.ts`).

F3 `select` (`operations/select.ts`, dispatched from `Batch.apply`):
- Fields: op, ref, id, where, expect. `ref` required non-empty string; reuse
  the `ref "<r>" is already used.` message. Exactly one of `id`/`where`
  (`select needs "id" or "where"`, `use either "id" or "where"`). With
  `where`, `expect` defaults to 1; any other value ->
  `select binds exactly one element; "expect" must be 1`.
- Binds `batch.refs.set(ref, id)`. Does not add to `created` or
  `touchedPages`.

F4:
- `OPERATION_FIELDS`: `update`: op, id, where, expect, semantic, visual,
  label, carryMembers; `delete`: op, id, where, expect; new `select`: op,
  ref, id, where, expect.
- `update needs semantic, visual or label` still applies with `where`.
- Unknown-op message in `Batch.apply` lists `select` after `delete`.
- `report.ts`: `formatMatchLines` lines `operation <i> (<op>): matched <n> element(s)`;
  text report prints them after the operation summary when
  `result.matches?.length`; JSON report adds `matches` only when present. These
  lines are not warnings (not collapsed, not dropped by `--quiet`).

## Pitfalls

- Exact id must win over `name:`; existing op files must behave identically.
- Do not resolve `name:` in arbitrary semantic strings; only
  `references(semantic)` fields.
- `where` with `update` must evaluate matches once before applying, then
  update each matched element (later matches must not be re-evaluated
  mid-loop).
- `delete` via where on an element and its connector: one command, the
  existing reference-deletion behavior applies.
- The static AST test in `operation-fields.test.ts` checks handlers read only
  listed fields: add `where`/`expect` rows and include `select.ts` and
  `selectors.ts` in its scan list.
- Keep `noUncheckedIndexedAccess`-safe code; no regex split.

## Tests

`apps/cli/src/edit/selectors.test.ts` (drive `new Batch(new Editor({ document }))`
and `batch.apply(op, i)` directly; documents built with neutral names on two
pages `Orders` and `Returns`, BPMN tasks `Approve`, `Update status`, state
nodes `Idle`, `Running`):
- exact id equal to a string starting with `name:` -> resolves the id.
- `name:Idle` unique -> resolves; `name: Idle ` with spaces -> resolves.
- `name:Approve` on two pages without scope -> error lists 2 candidates with
  page names; with `where.page` -> 1.
- `name:Nothing` -> `no element named`, similar list for `name:approve`
  (case-insensitive contains).
- `connect` `from: name:Idle`, `to: name:Running` -> edge between them;
  `to` resolved on the `from` page.
- `update` with `semantic.parent: "name:Intake"` (BPMN task) -> parent id
  written; `text.note` update with `semantic.text: "name: Idle"` -> stays text.
- `delete` `where {type: bpmn.sequenceFlow, from: name:Approve, to: name:Update status}`
  `expect: 1` -> flow deleted, `batch.matches` = [{count: 1}].
- same with `expect: 2` -> `OperationError` with candidate list; the store is
  unchanged afterwards (drive through `applyBatch` to assert it throws and no
  text is produced).
- `where` no `expect`, 0 matches -> error; `expect: 0`, 0 matches -> no-op.
- `update where {type: state.node}` with `visual: {width: 100}` -> every
  state updated, count reported.
- `where.parent` by frame (geometric), by BPMN parent, by group.
- `id` and `where` together -> error; `expect` without `where` -> error;
  unknown where key `nam` -> suggestion `name`.
- `select` by id then `update @ok` -> updates; by where `expect: 1` -> ok;
  `expect: 2` -> error; duplicate ref -> error; missing ref -> error;
  `select` does not add the page to `touchedPages`.
`operation-fields.test.ts`: rows for update/delete/select; unknown field on
select -> exit 2 with valid list.
`report.test.ts`: text and JSON with `matches`; without matches unchanged.

## Working rules

- Fresh read before each edit; record pre/post `git hash-object` for every
  edited existing file in the progress log; edit only writePaths; logs under
  `tmp/clm-s731/clm-13-edit-selectors/`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit/selectors.test.ts apps/cli/src/edit/operation-fields.test.ts apps/cli/src/edit/report.test.ts apps/cli/src/edit/label-field.test.ts apps/cli/src/edit/apply-batch.test.ts` -> 0 fail.
2. `bun test apps/cli/src/commands.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/ai-features.test.ts` -> 0 fail (existing edit behavior unchanged).
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/edit/selectors.ts apps/cli/src/edit/selectors.test.ts apps/cli/src/edit/operations/select.ts apps/cli/src/edit/batch.ts apps/cli/src/edit/operations/elements.ts apps/cli/src/edit/operations/connect.ts apps/cli/src/edit/operations/add.ts apps/cli/src/edit/operations/groups.ts apps/cli/src/edit/operation-fields.ts apps/cli/src/edit/operation-fields.test.ts apps/cli/src/edit/report.ts apps/cli/src/edit/report.test.ts apps/cli/src/edit/types.ts`.
5. `grep -n "export function resolveElementReference\|export function matchWhere\|export function formatMatchLines" apps/cli/src/edit/selectors.ts` -> 3 matches.

## Done criteria

- Contract symbols exist; verification 1-5 exit 0 with logs; progress log
  lists hashes and any existing-test assertion changes (none expected).
- `git status --short` shows only writePaths changed by this plan.
