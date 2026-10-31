# sms-02-cli-edit progress

Status: implementation and final gates complete; independent reviews pending.

Intent: move parsing and types to `edit/operation-input.ts` and `edit/types.ts`, batch state and dispatch to `edit/batch.ts`, domain handlers to `edit/operations/`, application and reporting to `edit/apply-batch.ts` and `edit/report.ts`, keeping the public entry point and behavior unchanged. After the move gates pass, perform the planned deduplication, add eleven focused tests, and document the module boundaries.

- B1: `BUN_OPTIONS=--jsx-runtime=classic bun test` passed on attempt 1: 2945 pass, 25 skip, 0 fail; `tmp/source-module-split-s589/sms-02-cli-edit/baseline-bun-test.log`.
- B2: `apps/cli/src/edit-command.ts` has 1372 lines; `tmp/source-module-split-s589/sms-02-cli-edit/baseline-wc.txt`.
- B3: accepted sms-01 `final/test-cli.log` records 172 pass, 0 fail.
- Starting SHA-256 hashes are in `tmp/source-module-split-s589/sms-02-cli-edit/start-hashes.txt`; final hashes are in `final/hashes.txt` under that directory. Per-edit intentions and hashes are recorded there.
- The reference `/opt/homebrew/bin/nodetto-cli --version` reports `nodetto-cli 0.8.5`.
- The first move verification failed all three attempts on an incomplete comment inserted after typecheck. The logs are preserved in `attempt-1/verify-[123].log`; `add-comment-repair-intent.txt` records the repair. The moved tree then passed typecheck, verify (2945 pass, 25 skip, 0 fail; attempt 1), test-cli (172 pass, 0 fail, no skips; attempt 1), parity collection (17 skip), size and export checks. The CPU check passed on attempt 2: 23.50 s versus 34.97 s. Evidence is in `move/`.
- After the move gates, add/connect bookkeeping, element definitions and issue formatting were deduplicated, and 11 focused tests and the documentation sentences were added.
- Final `bun run typecheck`: exit 0, `final/typecheck.log`. Final verify: exit 0 on attempt 1, 2956 pass, 25 skip, 0 fail, `final/verify.log`. Focused edit tests: exit 0, 11 pass, 0 fail, `final/edit-unit.log`.
- Final test-cli: exit 0 on attempt 1, 183 pass, 0 fail, no skips, `final/test-cli.log`. CPU check: exit 0 on attempt 1, reference 20.62 s, new 21.97 s, ratio 1.0655, `final/cpu-time.log`. Collection: exit 0, 17 skip, `final/parity-collect.log`.
- Count, size, filename and unchanged-file checks: exit 0, `final/checks.log`; export-surface comparison: exit 0, `final/export.log`. Final line counts: `final/wc.log` (entry point 156 lines; largest module 293 lines).
- Formal test-integrity and adversarial reviews remain downstream.
