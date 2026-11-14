# slc-02-ir-unknown-field progress

Intent: implement semantic unknown-field warnings, append legitimate registry keys, and audit fixture, example, default, template and BPMN semantic payloads. Pre-edit content and SHA-256 hashes and per-file intentions are recorded in `tmp/shape-lateral-s544/slc-02-ir-unknown-field/before-*.txt` and `intent-*.txt`; current hashes are in `after-sha256.txt`.

Registry additions:
- bpmn.boundaryEvent: added keys parent
- bpmn.gateway: added keys gatewayDirection
- bpmn.group: added keys parent
- erd.view, erd.materialized-view, erd.function, erd.procedure columns: added keys autoIncrement, comment, defaultExpression, generatedExpression, identityGeneration, nullable, pk

The recursive warning walker and audit are implemented. The focused audit passed: `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/semantic-field-audit.test.ts`, exit 0, 3 tests, 0 failures, log `tmp/shape-lateral-s544/slc-02-ir-unknown-field/audit.log`.

The amendment removes `kind` from component and port key orders while retaining the interface order. Pre-edit and post-edit hashes and intent are in `uml-amendment-*.sha256` and `intent-uml-amendment.txt`. The initial IR failure is superseded by the rerun. Typecheck and Biome initial failures were fixed; pre-edit evidence is in `type-lint-*` and `intent-type-lint.txt`.

Current-source checks (logs under `tmp/shape-lateral-s544/slc-02-ir-unknown-field/`):
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ir`: exit 0, 145 passed, 0 failed, `ir-final.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/semantic-field-audit.test.ts`: exit 0, 3 passed, 0 failed, `audit-final.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/io`: exit 0, 257 passed, 1 skipped, 0 failed, `io-final.log`; pending serial join because sibling progress is not done.
- `bunx tsc -p tsconfig.json --noEmit`: exit 0, `tsc-final.log`; pending serial join because sibling progress is not done.
- `bunx biome check` on all seven plan TypeScript files: exit 0, `biome-final.log`.
- `grep -c 'semantic.unknownField' packages/ir/src/validate.ts`: exit 0, `grep-final.log`.
- `git diff --quiet -- packages/io/src/__fixtures__ examples`: exit 0, `diff-final.log`.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core apps/cli/src`: exit 0, 1559 passed, 22 skipped, 0 failed, `core-cli-final.log`; pending serial join because sibling progress is not done. Earlier actor catalogue failure is superseded by this run; its log remains `core-cli-rerun.log`.

Formal review, serial reconciliation and final workflow checks are downstream.

STATUS: done
