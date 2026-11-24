# car1-d2-pcb-insert-guard: reject stale PCB board choices at insertion (F2, gated Q1)

- planId: car1-d2-pcb-insert-guard. Wave 2. dependsOn: car1-d-pcb-page-kind.
  Gate: Q1.
- Design: `design-docs/specs/design-cad3d.md` 19 F2 ("Commit-time
  guard"); `design-docs/user-qa/ai-capture-audit-r1.md` Q1.
- Progress log: `impl-plans/progress/car1-d2-pcb-insert-guard.md`.

## Gate (do this first)

Read the `Decision:` line under Q1 in
`design-docs/user-qa/ai-capture-audit-r1.md`. If it is not exactly
`Decision: approved`, make no edit, write `blocked: Q1 pending` in the
progress log and stop.

## Intent

Insertion re-checks board eligibility on a fresh snapshot, so a picker
opened before the board's page was converted cannot insert a reference.

## Non-goals

- Do not edit `pcb-insert.ts` (plan d owns it), core `authoring.ts`, or
  any other picker behaviour.

## Changes

- `packages/ui-solid/src/cad/board-picker.tsx`, `insert(boardId, version)`
  (around `:79`): after `canInsert(version)` and the record-type check,
  require `isPcbBoardChoice(editor.getSnapshot(), boardId)`. Otherwise
  show the existing notice, "Could not insert the PCB board.", and apply
  nothing.

## Tests

- `packages/ui-solid/src/test-dom/cad-workspace.dom.tsx`, run by
  `packages/ui-solid/src/cad-palette.test.ts`:
  1. With two boards, open the picker.
  2. Call `editor.setPageKind` on the chosen board's page to `freeform`.
  3. Click the stale option: no command is applied and the notice shows.
  4. Undo the conversion, reopen, choose again: the reference is inserted.

  This fails before, when the stale click inserts.

## Verification

1. `biome check packages/ui-solid/src/cad/board-picker.tsx packages/ui-solid/src/test-dom/cad-workspace.dom.tsx && bun test packages/ui-solid/src/cad-palette.test.ts packages/ui-solid/src/cad/pcb-insert.test.ts`
   must exit 0, including the `ok light` and `ok dark` markers of the DOM
   run.
2. `bun run typecheck && bun test packages/ui-solid/src/cad/pcb-insert.test.ts`
   must exit 0.

## Done when

- The stale submission is rejected and Undo restores insertion.
- The gate decision and evidence are in the progress log.
