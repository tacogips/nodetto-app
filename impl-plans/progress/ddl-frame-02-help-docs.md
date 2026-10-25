# Progress: ddl-frame-02-help-docs

Issue reference: none (workflow request only).
Workflow mode: issue-resolution. Plan: `impl-plans/active/ddl-frame-02-help-docs.md`.

## Implementation

- Accepted design reviewed: `design-docs/specs/design-cli-ai-drawing.md`, sections "Ids and names", "ddl --frame resolution", and "Help and docs". No dependency plans; `dependsOn` is empty.
- Before edit 1, `apps/cli/src/ai-commands.test.ts` SHA-256: 8ae2039204e30967173642207407a4719489a2ab2ccf350bba5dc534571bab65.
- Edit 1 intention and pre-edit snapshot: `tmp/ddl-frame/ddl-frame-02-help-docs/intent-edit-1.txt` and `pre-ai-commands.test.ts.edit-1.txt`.

## Verification

Pending.
- Edit 1 post-edit `apps/cli/src/ai-commands.test.ts` SHA-256: 3f9bab08d964279bf6f889ff4ea5c3977d503c205e3e5a238750c8327cc9a35d; red regression run failed as expected on old help (12 passed, 1 failed, 75 assertions), log: `tmp/ddl-frame/ddl-frame-02-help-docs/red.log` (runner exit 1).
- Before edit 2, `apps/cli/src/help.ts` SHA-256: c9423066fe09d230241ac1f37db0e7d7056c8293b209a41bb953c05fc912fe00; intention and pre-edit snapshot: `intent-edit-2.txt` and `pre-help.ts.edit-2.txt` in evidence directory.
- Edit 2 post-edit `apps/cli/src/help.ts` SHA-256: ed228c6d1ba868d5f93ffb0291ebf4a4d028782b8426b6fe5ee16fb4b0f46f81. It includes pages/ddl ids guidance and frame resolution help. Pre-edit and intent: `pre-help.ts.edit-2.txt`, `intent-edit-2.txt`.
- Before edit 3, `README.md` SHA-256: e191d2ee12a777af44266dbcc4966e99233c1097a8d7bb95778c46b36245f5a0; intention and pre-edit snapshot: `intent-edit-3.txt` and `pre-README.md.edit-3.txt`.
- Edit 3 changed only the scoped schema example and added one resolution sentence. `git diff --stat -- README.md`: 1 file changed, 3 insertions(+), 1 deletion(-).
- Before edits 4/5, help SHA-256 was ed228c6d1ba868d5f93ffb0291ebf4a4d028782b8426b6fe5ee16fb4b0f46f81 and README SHA-256 was 29c5a6ff91f7a8d3aae5818cbe6b4cded783130a33f3f6c4b25e17871cb2cb13. Intended edits: `intent-edit-4-5.txt`; pre-edit snapshots `pre-help.ts.edit-4.txt` and `pre-README.md.edit-5.txt`.
- First current-source test attempt failed before tests due literal backticks around `rename-page` terminating help template literals. Full log preserved at `tmp/ddl-frame/ddl-frame-02-help-docs/attempt-1/green.log` (exit 1; 0 pass, 2 errors).
- Before edit 6, help SHA-256 recorded below; intention and snapshot: `intent-edit-6.txt` and `pre-help.ts.edit-6.txt`.

## Hashes and source changes

- Edit 1 pre/post `apps/cli/src/ai-commands.test.ts`: `8ae2039204e30967173642207407a4719489a2ab2ccf350bba5dc534571bab65` -> `3f9bab08d964279bf6f889ff4ea5c3977d503c205e3e5a238750c8327cc9a35d`.
- Edit 2 pre/post `apps/cli/src/help.ts`: `c9423066fe09d230241ac1f37db0e7d7056c8293b209a41bb953c05fc912fe00` -> `ed228c6d1ba868d5f93ffb0291ebf4a4d028782b8426b6fe5ee16fb4b0f46f81`.
- Edit 3 pre/post `README.md`: `e191d2ee12a777af44266dbcc4966e99233c1097a8d7bb95778c46b36245f5a0` -> `29c5a6ff91f7a8d3aae5818cbe6b4cded783130a33f3f6c4b25e17871cb2cb13`.
- Edits 4 and 6 pre/post `apps/cli/src/help.ts`: `ed228c6d1ba868d5f93ffb0291ebf4a4d028782b8426b6fe5ee16fb4b0f46f81` -> `29ff8b2836a7489fa9a07a5cfe5a5b75d1bb9e0a7478cae7e160f9701d8e253e` -> `c8439537f8968ad94e9a9f55e0ce92c9ceff63aa7dd5375b6274faae06e1fac4`.
- Edit 5 pre/post `README.md`: `29c5a6ff91f7a8d3aae5818cbe6b4cded783130a33f3f6c4b25e17871cb2cb13` -> `295b21714e75936701c50b7c2bea7e92a1695a716e5710c81f6b83909a9c4cf2`.
- Edit 7 progress pre-edit hash: `c2ba08698841c92bdaf04237e173e43a5dad32dac96afeb86a8abe8b8cdb1ef7`; intent and snapshot are `tmp/ddl-frame/ddl-frame-02-help-docs/intent-edit-7.txt` and `pre-progress.edit-7.txt`.
- Per-edit intentions and pre-edit snapshots are saved under `tmp/ddl-frame/ddl-frame-02-help-docs/intent-edit-*.txt` and `pre-*.edit-*.txt`.

## Verification results

- Expected red regression on old help: `bun test apps/cli/src/ai-commands.test.ts`; exit 1, 12 passed / 1 failed / 75 assertions. The new usage assertion failed as intended. Complete log: `tmp/ddl-frame/ddl-frame-02-help-docs/red.log`.
- Current-source focused tests: `bun test apps/cli/src/ai-commands.test.ts apps/cli/src/pages-command.test.ts`; exit 0, 21 passed / 0 failed / 133 assertions. Complete log: `tmp/ddl-frame/ddl-frame-02-help-docs/green.log`.
- Typecheck: `bun run typecheck`; exit 0. Log: `tmp/ddl-frame/ddl-frame-02-help-docs/typecheck.log`.
- Scoped style check: `bunx biome check apps/cli/src/help.ts apps/cli/src/ai-commands.test.ts`; exit 0. Log: `tmp/ddl-frame/ddl-frame-02-help-docs/biome.log`.
- Direct help: `bun apps/cli/src/main.ts help ddl`; exit 0, output saved to `tmp/ddl-frame/ddl-frame-02-help-docs/help-ddl.txt`. Byte comparison against `COMMAND_HELP.ddl + "\\n"` also exited 0; statuses in `help-cli.log`.
- Structural checks: expected usage occurs once; old usage and `database-frame-id` are absent; `OVERVIEW` is 35 lines; README diff is limited to the scoped schema example and its explanation (5 insertions, 1 deletion). Exit 0; log: `tmp/ddl-frame/ddl-frame-02-help-docs/structural.log`.
- An earlier structural-count attempt used a source-range count and was invalid; preserved in `attempt-1/structural.log`, then replaced with the runtime `OVERVIEW.split("\\n").length` check above.
- An earlier current-source test attempt found the help template literal backtick issue; it is preserved in `attempt-1/green.log`, fixed by removing delimiters around `rename-page`, and superseded by the passing current-source suite.

## Assigned completion criteria

- [x] Usage documents `[--frame <id|short-id|name>]`; description states selected-page scope, id/name/prefix order, minimum prefix, exit 2, and listed candidate fields.
- [x] `ddl` and `pages` help state auto-assigned opaque unchanging page/element IDs, `rename-page` behavior, and names as the human-facing key.
- [x] README uses a quoted frame name and has one resolution sentence; no other README section changed.
- [x] Regression is red on old help and green after the fix; exact `runCli` help output is asserted; `OVERVIEW` remains below 40 lines; pages command tests pass.
- [x] Required plan-local logs and this progress record are saved. Reconciliation-wide lint, all CLI tests and native CLI tests remain for the serial workflow gate.
