# cpf-06-wiring

- planId: cpf-06-wiring
- planPath: impl-plans/active/cpf-06-wiring.md
- progressPath: impl-plans/progress/cpf-06-wiring.md
- wave: 3
- dependsOn: cpf-02-participant-export, cpf-03-ddl-frame-scope, cpf-04-edit-convert-op,
  cpf-05-desktop-reconcile
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "Lint", "Documentation",
  "Rollout and verification constraints".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `packages/core/src/index.ts`
  - `apps/cli/src/lint-diagram.ts`
  - `apps/cli/src/lint-diagram.test.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/help.ts`
  - `apps/cli/src/help-convert-frame.test.ts`
  - `docs/cli.md`
  - `README.md`
  - `impl-plans/progress/cpf-06-wiring.md`
  - `tmp/cpf-s748/cpf-06-wiring`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

The feature plans left shared registration alone. This plan exports the new core symbols, connects
the lint rule, and documents every new op, field and rule. `cpf-07` and `cpf-08` depend on it.

## Non-goals

- No behavior change in the feature modules. A defect there goes in the progress log as a
  reconciliation finding.
- `apps/cli/src/commands.ts` is authorized only if the lint row type requires it. `LintFindingRow.ruleId`
  is already `string`, so the expected diff is empty.
- No design doc, plan index, version or release change.

## File-level changes

`packages/core/src/index.ts`, additive only, near `stateNodeNotation` and `lintNodeOverlaps`:

- `sequenceParticipantNotation` and type `SequenceParticipantNotation`.
- `lintFrameStraddles` and type `FrameStraddleFinding`.

`apps/cli/src/lint-diagram.ts`:

- Import `lintFrameStraddles`.
- Add `"frame-straddle"` to the `DiagramLintRow.ruleId` union.
- In the page loop in `lintDiagramPages`, after the `lintNodeOverlaps` rows and before the
  `io.readAttachment` guard, push one row per finding with `severity: "warning"` and
  `ruleId: "frame-straddle"`.

`apps/cli/src/help.ts`:

- `edit` help: the `convert` op, its fields, the mapping rule, the bounds contract, the rejected
  types, `--dry-run` listing and report lines. `delete` with `reconnectTo` and its failure cases.
  Add one line for each to the "Operations" examples:
  `{"op":"convert","id":"@a","shape":"flowchart:database"}` and
  `{"op":"delete","id":"@a","reconnectTo":"@b"}`.
- `ddl` help: change the `--frame` line. State the membership rule: `memberIds` lists are
  authoritative; position applies to open frames (no `memberIds`, or a list of only frames),
  regardless of nested positional edges and z-order; an ambiguous exclusion warns and names the
  table, so `--strict` exits 3.
- `lint` help: rule `frame-straddle`, its severity, and that it does not change the exit code.
- `types` help (`help.ts:160`): `sequence.participant` output gains a `Rendering:` line, and its JSON
  a `rendering` key.

`docs/cli.md`:

- The same E1 and E3 content, near the `update`/`delete` selector text (line 296) and the `ddl`
  section, including that canvas ownership can differ from DDL scope.
- In the sequence paragraph (line 201): `actor` draws a stick figure with the name below, `db` draws
  a cylinder, `service` draws the rounded box, in export and on the canvas, and all keep a lifeline.
  Add that `types sequence.participant` states this, in its text and in the JSON `rendering` key.

`README.md`: extend the CLI paragraph at line 91 with one sentence each on `convert`, `reconnectTo`,
and the frame membership rule. Do not add images.

## What a careless implementation gets wrong

- Keep the existing help wording that tests assert. Add text, and run the help tests.
- `--frame must identify a frame on the selected --page.` must stay exact.
- `lintFrameStraddles` returns `[]` for non-ERD pages, but `LINT_NO_PAGES_MESSAGE` and page selection
  must not change.
- Exports only: do not re-export the DDL scope resolver or predicates, which have no consumer.
- `apps/cli/src/lint-diagram.ts` rows come after node-overlap, so existing findings keep their order.

## Tests

`apps/cli/src/lint-diagram.test.ts` (add):

- ERD page with a table straddling a frame -> a `frame-straddle` warning row naming both, exit 0.
- `--format json` -> `ruleId` is `frame-straddle`, severity `warning`.
- ERD page with a table fully inside -> no such row.
- The existing cases stay unchanged.

`apps/cli/src/help-convert-frame.test.ts` (new):

- `help edit` -> contains `convert`, `reconnectTo` and `cannot carry`.
- `help ddl` -> contains `memberIds` and states the `--strict` behavior.
- `help lint` -> contains `frame-straddle`.
- `help types` -> contains `rendering`.
- `docs/cli.md` -> contains `rendering` and `stick figure`.
- `docs/cli.md` and `README.md` -> contain `convert`, `reconnectTo` and `frame-straddle` or
  `memberIds`.

## Verification

1. `bun test apps/cli/src/lint-diagram.test.ts apps/cli/src/help-convert-frame.test.ts apps/cli/src/help-style-export.test.ts apps/cli/src/cli-wiring.test.ts apps/cli/src/commands.test.ts` exits 0.
2. `bun test apps/cli/src/lint-metrics.test.ts apps/cli/src/ai-commands.test.ts` exits 0, showing no new finding breaks ERD fixtures. A failure caused by `frame-straddle` is reported, not silenced.
3. `bun run typecheck` exits 0.
4. `bunx biome check` on the TypeScript files you edited exits 0.

## Done criteria

- `grep -n "sequenceParticipantNotation\|lintFrameStraddles" packages/core/src/index.ts` shows both.
- `git diff 1e8f43d -- apps/cli/src/commands.ts` is empty, or the progress log explains the change.
- The progress log lists evidence for each verification command.
