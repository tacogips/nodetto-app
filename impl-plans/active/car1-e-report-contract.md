# car1-e-report-contract: one shared solid-report check for CLI and desktop (F15)

- planId: car1-e-report-contract. Wave 2. dependsOn: car1-d-pcb-page-kind
  (both edit `export-handlers.ts` and its test), car1-j-cad-ui-strict
  (provides `strict-index.test.ts`, which this plan's verification runs).
  Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F15 and 13.
- Progress log: `impl-plans/progress/car1-e-report-contract.md`.

## Intent

A renderer report whose width, height or body count differs from the
request is rejected by both adapters. The desktop rejects it before the
save picker opens or any bytes are written.

## Non-goals

- No transport change (plan f) and no change to the report JSON schema or
  `parseSolidReport`.
- Do not change the existing CLI message text.

## Changes

1. `packages/core/src/capture/report.ts`: export
   `assertSolidReportMatches(report: SolidReport, expected: { width: number; height: number; bodies: number }): void`.
   It throws `new Error("The solid capture report does not match the requested scene.")`.
2. `apps/cli/src/capture-cad.ts` `renderCadCapture`: replace the inline
   check (`:131-137`) with a call to the shared function. The message and
   error class are unchanged.
3. `apps/desktop/src/shell/export-handlers.ts` `captureCadImage`: call it
   right after `parseSolidReport` and before `pickExportPath`, with
   `{ width: options.width, height: options.height, bodies: prepared.model.bodies.length }`.

## Pitfalls

- The desktop error surfaces through the existing catch as
  `could not capture: <message>`. Do not add a new channel.
- The cancellation tests (`export-handlers.test.ts:328` and `:372` today)
  must use a matching fake report, so that they still test cancellation
  and not rejection.

## Tests (each fails before for the desktop)

- `packages/core/src/capture/report.test.ts`: a matching report passes;
  each of width, height and body count off by one throws the message.
- `apps/desktop/src/shell/export-handlers.test.ts`, with an accepting
  fake picker: width, height and body count each varied alone.
  - Each gives `could not capture: The solid capture report does not
    match the requested scene.`
  - Neither `pickExportPath` nor `writeBytes` is called.
  - The cancellation tests get a matching report and still pass.
- `apps/cli/src/capture-cad.test.ts`: the same three mismatches are
  rejected with the same message (the CLI already behaves this way; the
  test pins it).

## Verification

1. `biome check packages/core/src/capture/report.ts packages/core/src/capture/report.test.ts apps/cli/src/capture-cad.ts apps/cli/src/capture-cad.test.ts apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/core/src/capture/report.test.ts apps/cli/src/capture-cad.test.ts apps/desktop/src/shell/export-handlers.test.ts`
   must exit 0.
2. `bun run typecheck && bun test apps/cli/src/capture-command.test.ts packages/ui-solid/src/cad/strict-index.test.ts`
   must exit 0.

## Done when

- Both adapters share the check.
- The desktop never reaches the picker on a mismatch.
- Existing PNG, JPG, cancellation and scene-byte tests pass.

## Implementation status

Implemented and verified; formal review and integration remain downstream. See `impl-plans/progress/car1-e-report-contract.md`.
