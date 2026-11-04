# sef-01-edit-visual-merge

- planId: sef-01-edit-visual-merge
- planPath: impl-plans/active/sef-01-edit-visual-merge.md
- progressPath: impl-plans/progress/sef-01-edit-visual-merge.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-style-export-fixes.md`, section "G1".
- Worker rules: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/edit/visual-patch.ts` (new)
  - `apps/cli/src/edit/visual-patch.test.ts` (new)
  - `apps/cli/src/edit/operation-input.ts`
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/native-parity/style-edit.test.ts` (new)
  - `impl-plans/progress/sef-01-edit-visual-merge.md`
  - `tmp/sef-s733/sef-01-edit-visual-merge`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`edit update` with `visual.style.strokeDashArray: null` fails with "must be an array", and
`[]` fails with "must contain between 1 and 32 intervals", although help says null removes a
key. `updateOne` (`apps/cli/src/edit/operations/elements.ts:116-125`) pushes the raw patch as
`updateVisual`, and core `mergeVisual` (`packages/core/src/commands.ts:405`) is a shallow merge
that keeps null. That also makes a partial `style` patch replace the whole stored `style`.

## Non-goals

- Do not change `packages/core/src/commands.ts` or `mergeVisual`; app callers depend on it.
- Do not change `add`: it keeps rejecting `strokeDashArray: []`.
- Do not write `boxLabelAlign`; sef-06 adds that to this module.
- Do not touch `apps/cli/src/edit/operation-fields.ts` (sef-02) or `operations/add.ts` (sef-06).

## File-level changes

`apps/cli/src/edit/operation-input.ts`, `deepMerge`:

- An object patch over a non-object base merges against an empty object, so nested nulls are
  stripped. Non-object patches still replace.
- Existing callers keep working. Do not change the function's signature.

`apps/cli/src/edit/visual-patch.ts`, new
`visualPatchCommand(element: Element, patch: JsonObject, index: number): Command`:

1. If `style` is an object and `style.strokeDashArray` is an empty array, treat it as null, and
   also set `style.dash` to null unless the patch has its own `dash` key.
2. If every patch key is `locked` or `hidden`, return `updateVisual` with null values mapped to
   `false`. `permittedCommands` (`packages/core/src/editor/transaction.ts:57`) only lets this
   exact shape reach a locked element.
3. Otherwise return `replaceVisual` with `deepMerge(element.visual, patch)`, removing `style`
   when the merge leaves it empty.

`index` is for `OperationError` if you need one. Imitate `Command` usage in
`packages/core/src/editor/style-text.ts:planSelectionStyle`.

`apps/cli/src/edit/operations/elements.ts`, `updateOne`:

- Replace the `visual` command push with one `visualPatchCommand` call. Keep the
  "`visual` must be an object" check. Keep the hunk small: a sibling branch edits this file.
- When the `semantic` patch contains a null at any depth: run the type's
  `definition.validateSemantic(merged, "semantic")` on the `deepMerge` result before
  `resolveReferences`. If an issue's path equals `semantic.<nulled path>` or lies below it, throw
  `OperationError(index, 'update cannot remove required field "<name>" of <type>')`, where
  `<name>` is the nulled path, such as `label`. Unknown element types skip this. A helper for the
  null paths can live in `visual-patch.ts`.

## What a careless implementation gets wrong

- `{style: {strokeDashArray: null}}` on an element with no `style`: must succeed, leaving no
  `style` key. This is why `deepMerge` changes.
- `strokeDashArray` removed while `style.dash` stays set: `resolvedStrokeDashArray` falls back to
  the preset. `null` keeps `dash` (documented merge behavior); `[]` clears it.
- Using `replaceVisual` for lock-only patches silently blocks unlocking.
- Frame carry must still work. `planFrameTranslations` takes both store and draft, so
  `replaceVisual` should be fine, but `apps/cli/src/edit-frame-carry.test.ts` is the proof.
- Do not validate the raw patch. Validation stays after the merge, in core commands and
  `apps/cli/src/edit/apply-batch.ts`.

## Tests

Imitate `apps/cli/src/edit/selectors.test.ts` (`Editor`, `Batch`, `runOperations`).
`apps/cli/src/edit/visual-patch.test.ts`:

- node.generic with `strokeDashArray: [4, 2]`, patch null -> key gone, batch succeeds, no `style` if empty.
- Same node, patch `[]` -> key gone.
- Node with `dash: "dashed"`, `strokeDashArray: []` -> both gone; `resolvedStrokeDashArray` is empty.
- `strokeDashArray: []` with `dash: "dotted"` in the same patch -> `dash` is `dotted`.
- Node with `dash: "dashed"`, `strokeDashArray: null` -> `dash` stays.
- No stored `style`, `style.strokeDashArray: null` -> succeeds, no `style`.
- Stored `fill`, patch `{style: {stroke: "#112233"}}` -> both keys stored.
- `visual.aspectRatio: null`, `style.fontSize: null`, optional semantic key null -> each removed.
- `semantic.label: null` on node.generic -> error containing `update cannot remove required field "label" of node.generic`; document unchanged.
- Locked element, `visual: {locked: false}` and `{locked: null}` -> unlocked.
- Locked element, `visual: {width: 10}` -> width unchanged (still blocked).
- `add` with `strokeDashArray: []` -> still rejected.

`apps/cli/src/native-parity/style-edit.test.ts` using `nativeTest` from `./harness.ts`:

- Each of Bun and native runs its own copy of the same seed document with the dash null, dash `[]`,
  partial style and required-field batches -> same exit codes, same stderr, identical written bytes.
  Do not use `compare` on an in-place edit; the second run would see the first run's result.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit/visual-patch.test.ts` -> new cases pass.
2. `bun test apps/cli/src/edit apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit-scale-text-group.test.ts` -> 0 fail. Any existing test that encodes whole-style replacement is reported in the progress log, not rewritten silently.
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/edit/visual-patch.ts apps/cli/src/edit/visual-patch.test.ts apps/cli/src/edit/operation-input.ts apps/cli/src/edit/operations/elements.ts apps/cli/src/native-parity/style-edit.test.ts`.
5. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/style-edit.test.ts'` -> 0 fail, 0 skip.

## Done criteria

- Verification 1-5 exit 0 with logs recorded.
- `grep -n "export function visualPatchCommand" apps/cli/src/edit/visual-patch.ts` matches.
- `git diff --stat packages/core/src/commands.ts` is empty.
- Progress log complete.
