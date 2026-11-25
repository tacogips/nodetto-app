# car4-f1c-capture-report

- planId: car4-f1c-capture-report; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f1c-capture-report.md
- progressPath: impl-plans/progress/car4-f1c-capture-report.md
- Finding: function-capture-hidden-target-empty-cut (R4-1, high), report parser and
  error text part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-1 (TypeScript report).
- writePaths: `packages/core/src/capture/report.ts`,
  `packages/core/src/capture/describe.ts`, `packages/core/src/capture/report.test.ts`,
  `packages/core/src/capture/describe.test.ts`, `tmp/car4-r4/car4-f1c-capture-report`,
  `impl-plans/progress/car4-f1c-capture-report.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

The renderer will report (f1d) that a shared cut empties a hidden target via an optional
per-body key `hiddenEmptiedByStep` (a step index of the visible body). The TS side must
accept it and name the cut feature as a sampled `cad.result.empty` discrepancy affecting
the visible body. Callers (`apps/cli/src/capture-cad.ts:142-172`,
`apps/desktop/src/shell/export-handlers.ts:262`) already print `describeBodies` errors.

Non-goals: no change to existing keys, the `emptiedByStep` text, interference text,
exit codes or callers.

## Changes

- `report.ts`: `SolidBodyReport` gains `readonly hiddenEmptiedByStep?: number`. In
  `body()`, accept it only when absent or `integer(value, 0)`; anything else (-1, 1.5,
  string, null) fails `parseSolidReport` with the existing message.
- `describe.ts` `describeBodies`: per body, if `state.hiddenEmptiedByStep !== undefined`
  and `body.steps[k]` names a tool, push
  `{ id: tool.feature, code: "cad.result.empty", text: '(sampled): leaves no material in a hidden target body; the app rejects this feature and keeps "<plain(name)>" as it was, this picture applies it' }`
  INSTEAD of the `emptiedByStep` error for that body; otherwise keep today's logic.
  The `[differs from the app, see errors]` note is appended when either key reports a
  step, under the existing state condition (`drawn`, `hidden`, `outside`).

## Pitfalls

- Use `plain()` for the name (control-character stripping, `describe.ts:35-38`).
- Keep error order: bodies in model order, one error per body at most.
- Do not change the existing literal text or its test (`describe.test.ts:90`).

## Tests

- `report.test.ts`: a body with `hiddenEmptiedByStep: 1` parses; `-1`, `1.5`, `"1"`
  each throw `Invalid solid capture report.`; absent key still parses (existing cases).
- `describe.test.ts` (imitate the model/report literals at `:6-35`, `:90`): model with
  body `wide` (steps union tool 0, difference tool 2 whose `feature` is `trim`), report
  `{ state: "drawn", emptiedByStep: -1, open: false, hiddenEmptiedByStep: 1 }` -> exactly
  one error `{ id: "trim", code: "cad.result.empty", text: <exact text with "wide"> }`
  and the line contains `wide [differs from the app, see errors]`; same model without
  the key -> no error, no note.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/capture/report.ts packages/core/src/capture/describe.ts packages/core/src/capture/report.test.ts packages/core/src/capture/describe.test.ts && bun test packages/core/src/capture/report.test.ts packages/core/src/capture/describe.test.ts`
   -> new cases pass (failed before); existing cases unchanged.

## Done criteria

- Exact text asserted; parser bounds asserted; progress log `done`.
