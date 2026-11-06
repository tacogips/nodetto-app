# cpf-01 conversion command progress

Implementation complete for the assigned plan. The in-place command validates target type, semantic and visual payloads, preserves identity and accessibility, records an inverse, and rechecks referrers after the batch. Lock filtering and dirty-page and derived planning apply. The facade exposes participant ordering and strict BPMN flow compatibility, including corrected flow types. Conversion mapping, bounds enforcement and CLI wiring belong to dependent plans.

Verification on the shared working tree (moving fanout; final combined verification belongs to the serial workflow):

- `bun test packages/core/src/convert-element.test.ts`: exit 0, 4 passed, 0 failed; `tmp/cpf-s748/cpf-01-convert-command/convert-test-final.log`.
- `bun test packages/core/src/bpmn/connection.test.ts packages/core/src/connector-policy.test.ts`: exit 0, 11 passed, 0 failed; `tmp/cpf-s748/cpf-01-convert-command/connector-test-final.log`.
- `bun run typecheck`: exit 0; `tmp/cpf-s748/cpf-01-convert-command/typecheck-final.log`. An initial typecheck found a test narrowing error; corrected before the final run, with initial output in `typecheck.log`.
- `bunx biome check packages/core/src/commands.ts packages/core/src/editor/transaction.ts packages/core/src/editor/dirty-pages.ts packages/core/src/editor/bpmn.ts packages/core/src/editor/facade/notation-editing.ts packages/core/src/convert-element.test.ts`: exit 0; `tmp/cpf-s748/cpf-01-convert-command/biome.log`.
- `git diff --quiet 1e8f43d -- packages/core/src/frame-tree.ts`: exit 0; `tmp/cpf-s748/cpf-01-convert-command/frame-tree.log`.
- `git diff --quiet 17ac03f001e612be396c544dcd37d0e9f16384b4 -- packages/core/src/index.ts`: exit 0; `tmp/cpf-s748/cpf-01-convert-command/index.log`.

Per-edit intentions and before/after `git hash-object` values are in `tmp/cpf-s748/cpf-01-convert-command/edit-intentions.log`. Formal review, integration and final serial verification remain downstream.

## Test integrity revision

The invalid semantic and unknown type checks now use an unconnected node and assert the exact `value.enum` issue path, absence of `connector.endpointType`, and unchanged snapshots. The connected endpoint check remains unchanged. No production file was changed. Source hashes: `commands.ts` bee1b37214ac1f582ec01d8946dd9eb529d9a9f4; `convert-element.test.ts` e990fe46f2b255b5db4b37d362b070bd91eb16c6 (`revision-hashes.log`).

Current-source checks on the moving shared tree: `bun test packages/core/src/convert-element.test.ts` exit 0, 5 passed (`revision-convert.log`); `bun test packages/core/src/bpmn/connection.test.ts packages/core/src/connector-policy.test.ts` exit 0, 11 passed (`revision-connector.log`); `bun run typecheck` exit 0 (`revision-typecheck.log`); `bunx biome check packages/core/src/convert-element.test.ts` exit 0 (`revision-biome.log`). Logs are under `tmp/cpf-s748/cpf-01-convert-command/`.

In-memory Bun plugin negative controls independently disabled unknown-type validation, semantic validation, and the referrer pass. Each selected test failed as expected with exit 1 and one failure (`mutation-unknown.log`, `mutation-semantic.log`, `mutation-referrer.log`); source was not mutated. Independent review remains pending.
