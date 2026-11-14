# clm-14-lint-image-path progress

Design D3 and the assigned plan agree; no plan dependencies are required.
Implemented normalized document-relative exists probes without changing the confined reader arguments. Added normalization table, real filesystem dot/parent path coverage, and symlink escape coverage with cleanup.

Per-edit git hash-object (pre -> post):
- lint-diagram.ts implementation: afb64e249302827bbdf42218007cfff7afbcb19d -> f39bbdabe4d48c94c210f14e112907db75088682
- lint-diagram.test.ts implementation: 1b3b3cc0db6a89a6605153472a663b73b5719854 -> 5fdc3bed8b0afb0edb4f8c9547bb330a1ce047a1
- lint-diagram.ts formatting: f39bbdabe4d48c94c210f14e112907db75088682 -> a2522c4ef9750088cb3c834b285bdd18c430274e
- lint-diagram.test.ts formatting: 5fdc3bed8b0afb0edb4f8c9547bb330a1ce047a1 -> 1217075ed26ac12c3bdeba74d63418faf85d0a98
- Progress file pre-edit: absent; post-edit hash recorded in progress.post.hash in the evidence directory.

Baseline: 3 tests passed (baseline.log). On the moving shared tree, Biome and export grep pass (final-1.log, final-2.log); the targeted test fails to load because sibling edit/report.ts imports missing edit/selectors.ts (final-3.log). Typecheck additionally reports an error in sibling packages/core/src/arrange-layered-bpmn.ts (final-4.log). Rerun both required gates after those sibling changes are complete. Formal review and final integration are downstream.

Continuation: all four required gates pass on the current shared tree. The targeted suite runs 5 tests (baseline 3), 0 failures; typecheck, scoped Biome, and export grep exit 0. Complete logs are continuation-test.log, continuation-typecheck.log, continuation-biome.log, and continuation-export.log. Source hashes remain a2522c4ef9750088cb3c834b285bdd18c430274e and 1217075ed26ac12c3bdeba74d63418faf85d0a98. The earlier sibling-related failures are superseded. Implementation criteria are complete; formal review and integration remain downstream.

Progress continuation pre-edit hash: 21ca83ab42eb3b2539a3d0dc406fe468836fd0db; post-edit hash is recorded in continuation-progress-post.hash.
