# cpf-04 edit convert operation progress

Implementation and assigned test coverage are complete; formal review remains downstream. The branch implements conversion, reconnect, reports, warnings, operation field validation, and the post-apply BPMN flow recheck requested by cpf-01. A self-check corrected locked reconnect sources and edges and duplicate self-loop report entries.

Per-edit intentions and before/after hashes are in `tmp/cpf-s748/cpf-04-edit-convert-op/`, including `wiring-*`, `convert*-intent-*`, `report-*`, `reconnect-elements-*`, and `atomicity-*`.

Final-source checks on the moving shared tree:

- `bun test apps/cli/src/edit`: exit 0, 99 tests, 0 failures; `edit-suite-final-2.log`.
- `bun test apps/cli/src/edit-order.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit-performance.test.ts`: exit 0, 14 tests, 0 failures; `regression-final-2.log`.
- `bun run typecheck`: exit 0; `typecheck-final-2.log`.
- `bunx biome check` on the ten changed TypeScript files: exit 0; `biome-final-2.log`.

Continuation added coverage for frame membership, exact bounds and index, participant ports and order, derived-size resize, BPMN and cross-page reconnect rejection, state and ERD self-loops, null semantic fields, connector route and label position, and temp-file dry-run behavior. Per-edit intentions and hashes are in `continuation-*` evidence files.

Final continuation checks on the moving shared tree:

- `bun test apps/cli/src/edit`: exit 0, 114 tests, 0 failures; `continuation-edit-final-2.log`.
- `bun test apps/cli/src/edit-order.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit-performance.test.ts`: exit 0, 14 tests, 0 failures; `continuation-regression-final-2.log`.
- `bun run typecheck`: exit 0; `continuation-typecheck-final-2.log`.
- Scoped `bunx biome check` on the ten changed TypeScript files: exit 0; `continuation-biome-final-2.log`.

Evidence logs are under `tmp/cpf-s748/cpf-04-edit-convert-op/`. Formal reviews and final combined-tree verification are downstream.

## Test-integrity revision

TI-CPF04-001: The same-type participant test now parses a JSONL record with `visual: {}`, asserts that precondition, and checks the converted visual remains `{}` and kind becomes actor. Test hash before: `137b769b693c4aa05f2d5baf05b54e27c46bc708`; after: see `ti-format-hash-after.txt`. Production hashes were unchanged; `convert.ts` is `def46c9a9fc3db0bb5189521e94be8565a5b3ba2` (`ti-production-hashes.log`).

- `bun test apps/cli/src/edit/operations/convert.test.ts`: exit 0, 31 pass, `ti-focused.log`.
- `bun test --preload ./tmp/cpf-s748/cpf-04-edit-convert-op/ti-preload.ts apps/cli/src/edit/operations/convert.test.ts`: expected exit 1, 30 pass and only the semantic-only test fails, `ti-negative-final.log`. The first preload invocation lacked `./` and could not resolve the file; `ti-negative.log` records that superseded attempt.
- `bun test apps/cli/src/edit`: exit 0, 114 pass, `ti-edit.log`.
- `bun test apps/cli/src/edit-order.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit-performance.test.ts`: exit 0, 14 pass, `ti-regression.log`.
- `bun run typecheck`: exit 0, `ti-typecheck.log`.
- `bunx biome check apps/cli/src/edit/operations/convert.test.ts`: exit 0, `ti-biome.log`.

All logs and per-edit intentions are under `tmp/cpf-s748/cpf-04-edit-convert-op/`. Independent review remains pending.

## Reconnect cascade revision

CPF04-ADV-01: after deletion, verify that the reconnect target and every moved connector not explicitly selected for deletion remain in the store. Missing items raise a named operation error before writing. Ordinary delete remains unchanged. Tests cover both cascades in real and dry runs and the explicitly selected connector exception.

Git object hashes before and after: `convert.ts` def46c9a9fc3db0bb5189521e94be8565a5b3ba2 -> a022e516ae02089d44a45cf4a44ffa911c849f80; `elements.ts` a4e863a51f8b8d64c6074ccaace11d8fbc895677 -> d53c43aef0e856461a9f6786992774a0c12c99d1; `convert.test.ts` cf1e3e516205649d4538a139da7f35a17cbf4abf -> 1a18788bdd97efa8373dd6ace79a0f01e078d986 -> d6915def900c018fca3979dc5b8398899fba471d. Intermediate format hashes and edit intentions are in `tmp/cpf-s748/cpf-04-edit-convert-op/adv-*`.

- `bun test apps/cli/src/edit/operations/convert.test.ts`: exit 0, 33 pass, `adv-final-focused.log`.
- `bun test apps/cli/src/edit`: exit 0, 116 pass, `adv-final-edit.log`.
- `bun test apps/cli/src/edit-order.test.ts apps/cli/src/edit-scale-text-group.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit-performance.test.ts`: exit 0, 14 pass, `adv-final-regression.log`.
- `bun run typecheck`: exit 0, `adv-final-typecheck.log`.
- `bunx biome check apps/cli/src/edit/operations/convert.ts apps/cli/src/edit/operations/convert.test.ts apps/cli/src/edit/operations/elements.ts`: exit 0, `adv-final-biome.log`.
- In-memory negative control `bun test --preload ./tmp/cpf-s748/cpf-04-edit-convert-op/adv-preload.ts apps/cli/src/edit/operations/convert.test.ts`: expected exit 1, 32 pass, one cascade test fails; `adv-negative-final.log`. The pre-fix reproduction is `adv-prefx.log`.

Logs are under `tmp/cpf-s748/cpf-04-edit-convert-op/`. Independent re-review remains pending.
