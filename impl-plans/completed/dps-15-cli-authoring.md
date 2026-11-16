# dps-15-cli-authoring

- planId: dps-15-cli-authoring. Session 863 wave 1, run in parallel with
  dps-14. Revised 2026-11-16 for the owner decision IR-DPS15-DAG-VERIFY.
- dependsOn (this run): none. Accepted and committed at e8fd3c4:
  dps-01-syntax, dps-03-model.
- Design: sections 8 and 10.1 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths: `apps/cli/src/edit/operations/add.ts`,
  `apps/cli/src/edit/operations/pages.ts`, `apps/cli/src/edit/batch.ts`,
  `apps/cli/src/edit/operations/document-authoring.test.ts`,
  `impl-plans/progress/dps-15-cli-authoring.md`,
  `tmp/dps-s863/dps-15-cli-authoring`, `target` (artifact root).
- sharedPaths: none.

## Intent and context

The code already in the tree is the starting point:

- `add.ts:115-135` normalises `text.code` `language` inline inside
  `addElement`, but `addElement` rejects `text.code` earlier at the
  unknown-type guard (`add.ts:37-41`) because the IR registry does not
  list the type until dps-17.
- `set-page-flow` (`pages.ts:setPageFlow`, dispatched in `batch.ts`) works
  and its test passes.
- `document-authoring.test.ts` test 1 runs the full edit pipeline and
  therefore fails until dps-17 (progress log, exit 1, 3 pass / 1 fail).

Owner decision: dps-15 verification must not depend on the registry. The
end-to-end "add `text.code` through the edit pipeline" assertion moves to
dps-17's `apps/cli/src/document-wiring.test.ts`.

## Non-goals

- No registry, help, types or catalogue change (dps-17).
- No change to `edit/operations/elements.ts`; generic semantic updates of
  `language` stay raw (IR validation reports them).
- No frame re-layout from the CLI.

## Changes

1. `add.ts`: extract the inline block at :115-135 into an exported pure
   function, called from the same place with the same behaviour:

   ```ts
   export function normalizeCodeSnippetSemantic(semantic: Json | undefined, index: number): Json | undefined; // Json is already imported in add.ts
   ```

   Rules (unchanged): applies when `semantic` is undefined or a plain
   object; missing `language` -> `"plain"`; non-string language ->
   `requireText` error mentioning `language`; alias -> canonical id via
   `resolveSyntaxKind`; unknown -> `OperationError(index, 'Unknown language "<x>". Choose one of: <SYNTAX_KINDS joined by ", ">')`;
   missing `code` -> `""`; other keys preserved. Non-object input is
   returned unchanged. `addElement` calls it only when `type === "text.code"`.
2. `document-authoring.test.ts`: replace test 1 with direct tests of
   `normalizeCodeSnippetSemantic` (no `Batch`, no `Editor`). Keep the
   page-flow test unchanged.
3. `pages.ts`, `batch.ts`: no change expected; edit only to fix a defect
   found by the tests, and record why.

## Pitfalls

- Do not delete the end-to-end intent: record in the progress log that it
  moves to dps-17 `apps/cli/src/document-wiring.test.ts`. Do not create
  that file (dps-17 owns it).
- Do not mock the registry or call `isKnownElementType` from the helper.
- Keep the error texts byte-identical to the current ones.

## Tests (input -> expected)

- `{ language: "TS" }` -> `{ language: "typescript", code: "" }`.
- `undefined` -> `{ language: "plain", code: "" }`.
- `{ code: "x", language: "rust", lineNumbers: true }` -> same keys kept,
  language `rust`.
- `{ language: "klingon" }` -> throws `Unknown language "klingon"` with
  the kinds list.
- `{ language: 3 }` -> throws an error mentioning `language`.
- Existing page-flow test: horizontal sets `pageFlow`; vertical and null
  remove it; `diagonal`, unknown page and an extra field fail.

## Verification (each must exit 0; logs go to tmp/dps-s863/dps-15-cli-authoring/)

1. `bun test apps/cli/src/edit/operations/document-authoring.test.ts apps/cli/src/edit/operations/table.test.ts`
   (0 fail, at least 2 tests in document-authoring.test.ts).
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn apps/cli/src/edit/operations/add.ts apps/cli/src/edit/operations/pages.ts apps/cli/src/edit/batch.ts apps/cli/src/edit/operations/document-authoring.test.ts`

## Done criteria

- `rg -n "export function normalizeCodeSnippetSemantic" apps/cli/src/edit/operations/add.ts` matches.
- `rg -n "new Batch" apps/cli/src/edit/operations/document-authoring.test.ts`
  matches only inside the page-flow test.
- All three commands exit 0; the progress log records commands, exit
  codes, log paths, file hashes and the moved-assertion note.

## Coordination

Parallel with dps-14; disjoint write sets. Re-read before each edit and
record hashes. No git state changes.
