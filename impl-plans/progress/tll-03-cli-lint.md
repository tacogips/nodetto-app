# tll-03 CLI lint progress

Intent: include architecture pages in CLI lint using the accepted core API, preserve BPMN and breadboard routing and report semantics, update two expected strings, and test the assigned CLI cases. See tmp/text-layout-lint-s551/tll-03-cli-lint/intent-01.txt and pre-sha256.txt.

Source hashes: pre-sha256.txt and post-sha256.txt in the plan evidence directory. New test did not exist before implementation. Per-edit snapshots and intentions are in intent-01 through intent-04 and the corresponding before/after files.

- Focused Bun test: exit 0, 34 pass, 0 fail, focused.log.
- Biome check: exit 0, biome-final.log.
- TypeScript checks: tsc and bun run typecheck exit 0, tsc.log and typecheck.log.
- CLI suite: exit 0, 146 pass, 18 skip, 0 fail, cli-all.log.
- Shared-input checks tsc, typecheck and CLI suite are pending-join: tll-04 has not recorded STATUS: done; repeat at stable join.
- Breadboard diff: exit 0, only the two message strings, breadboard-diff.log.
- Old phrase grep: exit 1 because both counts are 0, grep.log.
- Protected paths diff against a9728e6: exit 0, protected-diff.log.
- Initial focused test failed on the existing blank separator; corrected the test and reran. Initial tsc failed on sibling apps/cli/src/text-layout-export.test.ts; current rerun passed. Earlier logs are retained as attempt-1.
- Formal review and serial integration belong to later workflow steps.

STATUS: done
