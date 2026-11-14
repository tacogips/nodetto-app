# zorder-05-canvas progress

Dependency zorder-01 was accepted by dispatch. Design sections 2.4 and 5 match this implementation.

- Canvas derives `paintElements` from the existing backdrop partition; all three layer memos filter it. `targetUnder` scans `pagePaintOrder`.
- Added six tests for the planned partitions, identity, connector targeting and static wiring. Existing BPMN backdrop test is unchanged.
- Source edit evidence: `tmp/zorder-s734/zorder-05-canvas/Canvas.tsx.intent.txt`, `Canvas.tsx.format-intent.txt`, `hit-testing.ts.intent.txt`, `hit-testing.ts.format-intent.txt`, `test-intent.txt`. Final hashes: Canvas d5d8f0544c3ca86fdb8b1656258f35ef51616f85; hit-testing cc534860aa207ddb91cba9dc40092b70ee258669; test 760a03edc4423b83be06c29a09971071b669cea7. The new test was formatted with a scoped Biome write; its pre-format hash dbc728e4a6962f22f8e55a87e8b4e3b76f918ee2 was recorded, but a separate pre-format intent was not recorded before that formatting edit.
- Moving shared tree checks: classic JSX targeted test exit 0 (16 pass, 0 fail), `test.log`; exact unconfigured test exit 1 due to Solid jsxDEV import, `test-attempt.log`; typecheck exit 2 due to sibling files `apps/cli/src/edit-order.test.ts` and `packages/core/src/svg-paint-order.test.ts`, `typecheck-final.log`; Biome exit 0, `biome-final.log`; grep exit 0, `grep-final.log`. Initial Biome formatting findings are in `biome.log` and were corrected.
- Completion criteria: canvas memo wiring and target scan implemented; BPMN backdrop tests pass unmodified with classic JSX. Exact test and typecheck require a stable combined-tree rerun. Formal reviews and final serial verification remain downstream.

- Fresh `bun run typecheck` retry exited 0 after sibling changes: `tmp/zorder-s734/zorder-05-canvas/typecheck-retry.log`.

- Redispatch finding `ZORDER-05-VERIFY-JSX`: the default-runtime three-file command failed with a missing Solid `jsxDEV` export before this change as well. The reconciliation evidence is `tmp/zorder-s734/reconcile-wave-002/plan05-exact.log` and `tmp/zorder-s734/reconcile-wave-002/base-bpmn-palette-full-default-bun.log`. The review decision accepts the classic-runtime run as plan command 1 without amending the plan or manifest.
- Fresh moving-tree verification: classic three-file test exit 0, 16 pass, 0 fail (`tmp/zorder-s734/zorder-05-canvas/review-classic.log`); default two-file test exit 0, 8 pass, 0 fail (`tmp/zorder-s734/zorder-05-canvas/review-default.log`); typecheck, scoped Biome and wiring grep each exit 0 (`review-typecheck.log`, `review-biome.log`, `review-grep.log` in the same evidence directory). Both existing BPMN test files have no diff against `c4244e3`. Source hashes remain Canvas d5d8f054, hit-testing cc534860 and test 760a03ed.
- Implementation criteria and verification are complete on the moving tree. Independent test-integrity and adversarial review and serial combined-tree verification remain downstream; no acceptance is claimed here.

- The two reconciliation log paths above are cited by the review feedback; they are not present in this checkout and were not inspected during this redispatch. The prior local default-runtime failure is retained in `tmp/zorder-s734/zorder-05-canvas/test-attempt.log`.
