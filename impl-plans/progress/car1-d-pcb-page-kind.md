# car1-d-pcb-page-kind progress

F2 implementation: CLI and desktop capture collect CAD input; PCB board choices and predicate require a PCB page. Conversion and undo regressions cover CLI, desktop, and picker. The commit-time guard belongs to d2.

Pre/post SHA-256: `tmp/car1-r1/car1-d-pcb-page-kind/pre-sha256.txt` and `tmp/car1-r1/car1-d-pcb-page-kind/post-sha256.txt`. Per-edit intentions and snapshots are in that directory.

- `bunx biome check apps/cli/src/capture-command.ts apps/desktop/src/shell/export-handlers.ts packages/ui-solid/src/cad/pcb-insert.ts packages/ui-solid/src/cad/pcb-insert.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/ui-solid/src/cad/pcb-insert.test.ts apps/cli/src/capture-command.test.ts apps/desktop/src/shell/export-handlers.test.ts`: exit 0, 56 passed; `tmp/car1-r1/car1-d-pcb-page-kind/verification-1.log`.
- `bun run typecheck && bun test apps/cli/src/mcp.test.ts packages/core/src/capture/cad-request.test.ts`: exit 2 at typecheck; `tmp/car1-r1/car1-d-pcb-page-kind/verification-2.log`. Concurrent inspector files outside this plan fail. Rerun after their owner finishes.
- `bun test apps/cli/src/mcp.test.ts packages/core/src/capture/cad-request.test.ts`: exit 0, 34 passed; `tmp/car1-r1/car1-d-pcb-page-kind/verification-3.log`.
- Initial focused test attempt: exit 1 due to incorrect expectation of a single model error; corrected using prepared model count. `tmp/car1-r1/car1-d-pcb-page-kind/attempt-tests.log`.

Formal review, final integration, staging and commit remain downstream. Regression behavior against the original revision has not been executed in isolation in this shared working tree.
- Required combined gate retried: exit 2, still fails in concurrent `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx`; `tmp/car1-r1/car1-d-pcb-page-kind/verification-2-retry.log`.

- Redispatch gate 1: exit 0, 56 passed; `tmp/car1-r1/car1-d-pcb-page-kind/resume-gate1.log`.
- Redispatch gate 2: exit 0, typecheck clean and 34 passed; `tmp/car1-r1/car1-d-pcb-page-kind/resume-gate2.log`. The prior shared-tree typecheck blocker is resolved.
- Baseline negative controls against eb7d8c9 remain unrun. An isolated baseline projection is needed without overwriting the shared tree; baseline evidence is still required.

- Baseline controls: eb7d8c9 archive under `tmp/car1-r1/car1-d-pcb-page-kind/baseline-eb7d8c9`, with current test files and existing dependency links. CLI, desktop, and picker each exit 1 with one failing test: `baseline-cli-2.log`, `baseline-desktop-2.log`, `baseline-picker-3.log`. CLI fails the exit-code assertion because its fake report expects three bodies; desktop shows an extra reference body in scene bytes; picker retains the converted board. The picker-only baseline projection removes the new predicate import and assertion because that export is absent on eb7d8c9; the unmodified test fails to load as recorded in `baseline-picker-2.log`. Initial runs failed to resolve dependencies; see `baseline-*.log`. The baseline uses workspace dependency symlinks, so the three target implementation modules are baseline versions while workspace package dependencies may resolve to the current shared tree.
