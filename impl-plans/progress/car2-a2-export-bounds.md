# car2-a2-export-bounds

Status: done

Design alignment: section 20.2 R2-5 and R2-9; dependency admission from runtime acceptedPlanIds.

Pre/post SHA-256 for each edited source: `tmp/car2-r2b/car2-a2-export-bounds/attempt-1/pre-sha256.txt` and `post-sha256.txt`. The progress log was absent before this plan.

Negative control: `bun test packages/core/src/cad/wireframe.test.ts --test-name-pattern 'bounds hook matches'` exited 1 with one failed test before source edits; `tmp/car2-r2b/car2-a2-export-bounds/attempt-1/negative.log`.

Focused manifest verification exited 0: 91 passed, 0 failed; `tmp/car2-r2b/car2-a2-export-bounds/attempt-1/focused.log`.

Commands and final outcomes:

- `bunx biome check --diagnostic-level=warn packages/core/src/svg-export/theme.ts packages/core/src/svg-export/document.ts packages/core/src/cad/wireframe.ts packages/core/src/cad/wireframe.test.ts apps/cli/src/export-command.ts apps/cli/src/export-command.test.ts apps/cli/src/native-parity/export.test.ts && bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export apps/cli/src/export-command.test.ts`: exit 0, 91 passed; `target/car2-a2-export-bounds/logs/attempt-1/focused.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-export-bounds cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-export-bounds/release/nodetto-cli" bun test apps/cli/src/native-parity/export.test.ts apps/cli/src/native-parity/cad.test.ts`: exit 0, 11 passed, 0 failed; `target/car2-a2-export-bounds/logs/attempt-1/parity-retry-2.log`. First two runs exited 1 with 10 passed and one CAD timing failure; logs `tmp/car2-r2b/car2-a2-export-bounds/attempt-1/parity-tests.log` and `parity-retry.log`.

Formal review and integration are downstream.

## Attempt 2: INT-A2EB-01

All seven source and test files match `attempt-1/post-sha256.txt` before and after verification; no source changes were made. The prior pre-fix negative control remains recorded above.

- `bunx biome check --diagnostic-level=warn packages/core/src/svg-export/theme.ts packages/core/src/svg-export/document.ts packages/core/src/cad/wireframe.ts packages/core/src/cad/wireframe.test.ts apps/cli/src/export-command.ts apps/cli/src/export-command.test.ts apps/cli/src/native-parity/export.test.ts && bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export apps/cli/src/export-command.test.ts`: exit 0; 91 tests, 91 passed, 0 failed. Logs: `tmp/car2-r2b/car2-a2-export-bounds/attempt-2/focused.log` and `target/car2-a2-export-bounds/logs/attempt-2/focused.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-export-bounds cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-export-bounds/release/nodetto-cli" bun test apps/cli/src/native-parity/export.test.ts apps/cli/src/native-parity/cad.test.ts`: first run exit 1, 10 passed, 1 CAD timing failure (13,319.6 ms); `tmp/car2-r2b/car2-a2-export-bounds/attempt-2/parity.log`. Exact retry exit 0, 11 tests, 11 passed, 0 failed; logs `tmp/car2-r2b/car2-a2-export-bounds/attempt-2/parity-retry.log` and `target/car2-a2-export-bounds/logs/attempt-2/parity-retry.log`.

Status remains done. Independent test-integrity and adversarial reviews are downstream and pending.
