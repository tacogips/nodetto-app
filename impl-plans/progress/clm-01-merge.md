# clm-01-merge progress

Starting at ee2cb43938ca5e66289ed87d925f6354c223b14b. Scope: document-merge.ts, document-merge-versions.test.ts, merge-command.ts, merge-command.test.ts, export-determinism.test.ts and this log. Design B1/B3 and plan agree; no dependencies.

Implemented B1 version merge and direct CLI command, preserving the existing live merge, and B3 SVG determinism tests. Arrays are atomic; conflicts and records are sorted, referential integrity is repaired before validation, and the command writes only after validation. The git driver, registration, documentation, and native parity remain clm-09 work.

Final-source verification on the moving shared tree (complete logs in `tmp/clm-s725/clm-01-merge/`):

- `final-1.log`: core merge tests, 9 passed, exit 0 (4 existing tests unchanged).
- `final-2.log`: CLI and export determinism tests, 4 passed, exit 0.
- `final-3.log`: `bun run typecheck`, exit 0.
- `final-4.log`: scoped Biome check, exit 0.
- `final-5.log`, `final-6.log`: required exported symbols, exit 0.

Earlier typecheck and Biome attempts identified and resolved owned-file diagnostics; the initial typecheck also observed a transient sibling `arrange-layered.ts` error, absent in the final run. Other plans' concurrent changes appear in `git status` and were left untouched. Formal independent review and final integration remain downstream.

Review revision clm01-ti-001: the SVG fixture now includes a second element and reverses non-header JSONL records with an extra blank line. The test asserts formatting changes the bytes to the canonical serialization, while exports remain equal before and after formatting and across both environments. Raster attachment coverage remains intact.

Current-source checks on the moving shared tree: `review-core.log` (9 passed), `review-cli.log` (4 passed), `review-biome-focused.log`, `review-biome.log`, `review-typecheck.log`, `review-symbol-core.log`, and `review-symbol-cli.log` all exit 0. Independent re-review remains pending.

Adversarial review revision clm01-adv-001: reference integrity now preserves references absent from all three inputs, avoiding deletion of an unchanged element with an existing dangling reference. References to records that existed in an input retain the existing restore/drop behavior. The regression checks both cases; existing tests remain unchanged.

Current-source verification on the moving shared tree: `adv-core.log` (10 passed), `adv-cli.log` (4 passed), `adv-typecheck.log`, `adv-biome.log`, `adv-symbol-core.log`, and `adv-symbol-cli.log` all exit 0. `adv-reproduction.log` captures the pre-fix loss. Independent re-review remains pending.
