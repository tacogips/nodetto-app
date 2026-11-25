# car5-f6-diagnostic-ids

- planId: car5-f6-diagnostic-ids; wave 1; dependsOn: none
- planPath: impl-plans/active/car5-f6-diagnostic-ids.md
- progressPath: impl-plans/progress/car5-f6-diagnostic-ids.md
- Finding: maintainability-capture-diagnostic-id-scope (R5-6, high).
- Design: `design-docs/specs/design-ai-capture.md` 23.1 R5-6, 23.3.
- writePaths: `apps/cli/src/capture-cad.ts`, `apps/cli/src/capture-command.ts`,
  `apps/cli/src/capture-cad.test.ts`, `tmp/car5-r5/car5-f6-diagnostic-ids`,
  `impl-plans/progress/car5-f6-diagnostic-ids.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car5-00-overview.md`.

## Intent and context

`errorLines` (`capture-cad.ts:105-112`) and the sampled lines (`:150`, `:170-172`) call
`shortIds` over the page-scoped CAD input (`capture-command.ts:241-242`). `cad check`
(`cad-command.ts:72`) and `edit` (exact id first, `edit/selectors.ts`) use the whole
document, so a capture token can be the exact id of an unrelated element.

Non-goals: no change to `ids.ts`, `cad-command.ts`, edit resolution, JSON output, text
format/order/counts, page-scoped geometry, or `cadInputMessage` signature.

## Changes

`capture-cad.ts`:
- `renderCadCapture` gains a required second parameter
  `documentElements: readonly Element[]`; build
  `shortIds(documentElements.map(({ id }) => id))` once.
- `errorLines(ids: ReadonlyMap<string, string>, errors)`; structural and sampled lines
  both use the document map. Geometry still from page-scoped `elements`.
- `cadInputMessage` keeps its signature and builds its map from the `elements` it
  already receives (`document.elements` at `capture-command.ts:318`).

`capture-command.ts`: pass `document.elements` as the new second argument.

## Pitfalls

- Do not compute short ids from the CAD input anywhere; only one map per call.
- JSON `errors` keep full ids.
- `MIN_PREFIX` is 6: a collision needs an exactly 6-character other id that is a prefix.

## Tests (`capture-cad.test.ts`, existing `harness` and fake `renderSolid` at `:28-80`)

- Structural: cad3d page with failing feature `collar-groove`
  (`cad.reference.missing`), element `collar` on another page -> capture text has
  `  collar- cad.reference.missing`, equal to the `cad check` line; `editCommand`
  deleting `collar-` removes `collar-groove` and `collar` survives; `--json` error id
  `collar-groove`. Fails before (prints `collar`).
- Sampled: fake report sets `emptiedByStep` on a body whose step tool feature is
  `sleeve-cut`, element `sleeve` on another page -> sampled line token `sleeve-`
  resolves in `editCommand` to `sleeve-cut`; `sleeve` survives; JSON id `sleeve-cut`.
  Fails before.
- Existing comparison with `cad check` (`:118-150`) unchanged.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn apps/cli/src/capture-cad.ts apps/cli/src/capture-command.ts apps/cli/src/capture-cad.test.ts && bun test apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts`
   - evidence: new cases fail before (log), all pass after.

## Done criteria

- Both collisions print document-wide tokens and edit removes the feature; JSON full
  ids; progress log `done`.

Implementation status: done; formal review and integration gates remain downstream.
