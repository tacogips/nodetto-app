# dps-15-cli-authoring

- planId: dps-15-cli-authoring. Wave 2.
- dependsOn: dps-01-syntax, dps-03-model.
- Design: section 8 of `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - Existing files: `apps/cli/src/edit/operations/add.ts`,
    `apps/cli/src/edit/operations/pages.ts`, `apps/cli/src/edit/batch.ts`.
  - New test: `apps/cli/src/edit/operations/document-authoring.test.ts`.
  - Logs and artifacts: `impl-plans/progress/dps-15-cli-authoring.md`,
    `tmp/dps-s861/dps-15-cli-authoring`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

The CLI must create and edit `text.code` with canonical languages, and set
`Page.pageFlow`. The generic `add` op already creates any type from an
inline semantic. This plan adds language normalisation and the
`set-page-flow` op.

## Non-goals

- No help, types or catalogue text. Those belong to dps-17.
- No CLI re-layout of frames. The CLI places frames explicitly (design 8).
- No `export` changes.

## Changes

- `add.ts`: when `type === "text.code"` and the semantic has `language`:
  - a non-string `language` is an `OperationError`;
  - a string resolved through `resolveSyntaxKind` is replaced by the
    canonical id;
  - an unknown string is an
    `OperationError(index, 'Unknown language "<x>". Choose one of: <SYNTAX_KINDS joined by ", ">')`;
  - a missing `language` gets `"plain"`;
  - a missing `code` gets `""`.

  Do not edit `edit/operations/elements.ts`. A generic semantic update of
  `language` stays raw, and IR validation reports bad patterns. Record
  this boundary in the progress log.
- `pages.ts`: add `setPageFlow(batch, operation, index)` for the op
  `{"op":"set-page-flow","page":"<id or name>","flow":"vertical"|"horizontal"|null}`.
  - Imitate `setPageMode` (:155) for page lookup and errors.
  - Apply `updatePage` with
    `pageFlow: flow === "vertical" ? null : flow` and treat `null` as
    vertical, so vertical always removes the key, as the facade does.
  - Any other value is
    `OperationError(index, '"flow" must be vertical, horizontal or null')`.
- `batch.ts`: add `case "set-page-flow": setPageFlow(this, operation, index);`
  next to `set-page-mode` (:336), with the import next to :37.

## Pitfalls

- Use `requireText` and the existing `OperationError` conventions.
- Unknown-field checks: follow how `setPageMode` rejects extra keys, if it
  does.

## Tests (run the edit pipeline, imitating existing operation tests in `apps/cli/src/edit/operations/table.test.ts`)

- add `text.code` with `language:"TS"` stores the canonical TypeScript id
  from chilla.
- `language:"klingon"` fails with "Unknown language".
- A missing language stores `"plain"`, and a missing code stores `""`.
- `set-page-flow` horizontal sets `pageFlow`. Vertical, then null, removes
  it.
- `flow:"diagonal"` fails with the message above.
- An unknown page fails with the existing page-not-found message.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-15-cli-authoring/)

1. `bun test apps/cli/src/edit/operations/document-authoring.test.ts apps/cli/src/edit/operations/table.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn apps/cli/src/edit/operations/add.ts apps/cli/src/edit/operations/pages.ts apps/cli/src/edit/batch.ts apps/cli/src/edit/operations/document-authoring.test.ts`

## Done criteria

- Both behaviours work.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.

## Implementation status

Source and tests are authored. Verification remains incomplete: the required
edit pipeline test needs dps-17 text.code registry wiring, and workspace
 typecheck currently reports sibling-owned errors. See
`impl-plans/progress/dps-15-cli-authoring.md` for exact results.
