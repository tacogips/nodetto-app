# car6-f1-diagnostic-tokens

- planId: car6-f1-diagnostic-tokens; wave 1; dependsOn: none
- planPath: impl-plans/active/car6-f1-diagnostic-tokens.md
- progressPath: impl-plans/progress/car6-f1-diagnostic-tokens.md
- Finding: function-capture-diagnostic-selector-prefix (R6-1, high).
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-1, 24.3.
- writePaths: `apps/cli/src/ids.ts`, `apps/cli/src/ids.test.ts` (new),
  `apps/cli/src/capture-cad.test.ts`, `apps/cli/src/cad-command.test.ts`,
  `impl-plans/active/car6-f1-diagnostic-tokens.md`,
  `impl-plans/progress/car6-f1-diagnostic-tokens.md`, `tmp/car6-r6/car6-f1-diagnostic-tokens`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car6-00-overview.md`.

## Intent and context

`shortIds` (`apps/cli/src/ids.ts:10-31`) prints the shortest unique prefix (at least
`MIN_PREFIX` = 6). `resolveElementReference` (`apps/cli/src/edit/selectors.ts:60`) tries
the exact id first, then `name:` (label selector) and `@` (batch reference), then a
prefix. A stored id starting with `name:` or `@` therefore prints a selector-shaped token
(`name:l`), and an edit using it deletes another element. Capture structural and sampled
lines (`capture-cad.ts:150`, `:186`) and `cad check` (`cad-command.ts:73`) all use
`shortIds`.

Non-goals: no change to `resolveId`, `selectors.ts`, `edit/batch.ts`, the selector
grammar, `capture-cad.ts`, `cad-command.ts`, JSON output (already full ids), or help text.

## Change (`apps/cli/src/ids.ts`)

- In `shortIds`, an id that starts with `name:` or `@` maps to itself. All other ids keep
  today's computation exactly. Test the id, not the computed prefix (every prefix of
  length >= 6 of such an id starts with the reserved text).
- Update the file header comment by one sentence describing the exception.

Pitfalls:
- Do not drop such ids from the neighbour comparison: other ids' prefixes must stay
  byte-identical to today (they are computed against sorted neighbours).
- `name:` is case-sensitive as in `selectors.ts` (`value.startsWith("name:")`).
- Do not touch any other `shortIds` caller; they inherit the fix.

## Tests (write first; record failures on the unmodified `ids.ts`)

New `apps/cli/src/ids.test.ts` (imitate `bun:test` style of `capture-cad.test.ts`):
- `shortIds(["name:latch-bore","name:latch-pin","@spindle-cut","collar-groove","collar"])`
  -> `name:latch-bore` and `name:latch-pin` and `@spindle-cut` map to themselves;
  `collar-groove` -> `collar-`, `collar` -> `collar`.

`apps/cli/src/capture-cad.test.ts`: a new `test.each` beside the existing
`"%s diagnostic IDs resolve across pages"` test (`:185-265`); reuse `harness`,
`extrude`, `element`, `TEST_PAGE`, `editCommand`, `cadCommand` exactly as it does. Four
cases; in each, read the token from the actual text output line
(`/^  (\S+) <code>/m` on `result.stdout`), never hard-code it:
- structural + label: failing feature `name:latch-bore` (`extrude` with
  `sketch: "missing-profile"`, code `cad.reference.missing`) and a `node.generic` element
  on `TEST_PAGE` with `semantic.label: "l"` -> token equals `name:latch-bore`; edit
  `[{op:"delete", id: token}]` exits 0, the written document lacks the feature and keeps
  the labelled element; JSON `errors` contain `{id:"name:latch-bore"}`.
- structural + batch reference: failing feature `@spindle-cut` and a `node.generic`
  element on `TEST_PAGE` labelled `Spindle cap`; the edit ops are
  `[{op:"select", where:{name:"Spindle cap"}, ref:"spind"}, {op:"delete", id: token}]`
  (check the exact `select` fields in `apps/cli/src/edit/operations/select.ts` and the
  `where` keys in `selectors.ts:matchWhere` before writing) -> token equals
  `@spindle-cut`; feature deleted, the bound element survives, exit 0.
- sampled + label, sampled + batch reference: rename the `drill` element to the same two
  ids as the existing sampled case does, fake `renderSolid` report with
  `emptiedByStep: 1` on body 0 (copy the existing literal), code `cad.result.empty` ->
  same assertions.
- Before the change: tokens are `name:l` / `@spind` and the competing element is deleted
  (record this failure in the progress log).

`apps/cli/src/cad-command.test.ts`: one new test building the structural label document
in memory (imitate `io`/`check` helpers at `:22-33`, but with a serialized custom
document) -> `cad check` stdout contains `name:latch-bore cad.reference.missing` and not
`name:l `.

Test data names (`latch-bore`, `spindle-cut`, label `l`, ref `spind`) are design data;
do not reuse the audit's ids or labels.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn apps/cli/src/ids.ts apps/cli/src/ids.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/cad-command.test.ts && bun test apps/cli/src/ids.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/cad-command.test.ts`
   - evidence: new tests fail before (log), pass after; existing tests in those files
     pass unchanged.

## Done criteria

- `shortIds` exception in place; five new test cases pass; pre-change failures logged;
  biome clean; progress log `done` with hashes and log paths.

## Implementation status

Done: reserved diagnostic IDs remain full, regression cases pass, and focused verification is recorded in the plan-local progress log. Formal review and integration gates remain downstream.
