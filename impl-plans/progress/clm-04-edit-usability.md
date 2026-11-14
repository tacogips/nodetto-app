# clm-04-edit-usability progress

HEAD: ee2cb43938ca5e66289ed87d925f6354c223b14b. Scope: C1-C3 and A6 within the plan writePaths. The accepted design and plan agree; no dependencies.

## Field audit

The table in `apps/cli/src/edit/operation-fields.ts` records all design rows in design order. Reviewed direct and dynamic reads in batch and operation handlers: page positioning reads `before`, `after`, and `order`; targets reads `ids` and `page`; record reads `ref`; shape reads `shape` and `type`. No additions to the design table were identified. Draw constructs add/connect fields already in their rows. `edit-command.ts` and `draw-command.ts` do not format warnings themselves.

## Existing tests changed

- `edit/report.test.ts`: added text-collapse and unchanged JSON assertions.
- `text-layout-export.test.ts`: updated SVG, PNG and PDF warning assertions for collapse by rule and element type; artwork and byte assertions remain.

## Status

Implemented label mapping, field checking, frame opt-out and warning helpers/call sites. Focused and aggregate Bun tests passed on the moving shared tree. Typecheck is blocked by sibling `apps/cli/src/merge-command.test.ts`; see final/typecheck.log. Native and final checks are recorded separately in the plan-local evidence directory. Remaining: complete exhaustive label and static audit coverage, verify connect helper contract and final stable gates. Shared registration, help, documentation and final integration are owned by clm-09.

## Latest verification and remaining criteria

On the moving shared tree, `final2/focused.log` reports 23 pass, `final2/aggregate.log` reports 91 pass, `final2/typecheck.log` exits 0, `final2/biome.log` exits 0, and `final2/native.log` reports 9 pass with the release binary. The earlier typecheck failure in a sibling file cleared. The attempted exhaustive type fixture in `exhaust-attempt.log` failed because some edge defaults require endpoints; it was removed and is not positive evidence. Still required: valid exhaustive all-element label fixtures and static per-handler read-field audit test; connect precedence should receive explicit regression coverage. Existing targeted label/frame/warnings tests do not cover these requirements completely. Review, shared wiring and documentation remain downstream.

## Continuation completion

The earlier remaining criteria are now covered: `label-field.test.ts` creates every registered type with required nonempty references and verifies update or the no-label error; it tests state and generic connectors, smart and typed connect semantic precedence, and non-string labels. `operation-fields.test.ts` statically scans per-operation handlers and shared helpers using the TypeScript AST, checks dynamic key arrays, and exercises unknown-field exit 2 and no write for every operation. Typed connect now rejects non-string labels consistently.

Current verification: `final4/focused-final.log` 27 pass; `final4/aggregate.log` 91 pass; `final4/typecheck-final.log` exit 0; `final4/native.log` 9 pass with `NODETTO_CLI_TEST_BINARY`; `final4/biome.log` exit 0. The focused test was rerun after the final test-only edit; no production code changed after the aggregate and native build began. Earlier failed fixture and typecheck attempts remain in plan-local logs. Field table unchanged from design. Existing test changes remain as listed above. Shared wiring, documentation, formal review and final integration remain downstream.
