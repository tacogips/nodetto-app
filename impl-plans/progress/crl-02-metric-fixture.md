# crl-02 metric and fixture progress

- Plan intent hash: `d1831daab0235d41e9beb39b8c138f4a20041189`.
- Design alignment: metric and fixed fixture match the accepted design; no dependencies.
- Input baseline: edgeCrossings **604**, labelOverlaps **104**, segmentOverlaps **332**.
- Implemented route-pair overlap counting, page aggregation, text reporting, fixture, and tests. JSON page values flow through PageMetrics; summary wiring belongs to crl-07.
- Verification on moving shared tree: targeted tests exit 0 (13 passed, 0 failed); typecheck exit 0; scoped Biome exit 0. Complete logs: `tmp/crl-s749/crl-02-metric-fixture/final/{test,typecheck,biome}.log`.
- Earlier attempts and formatter recovery are preserved under `attempt-1`, `attempt-2`, and `edits`. Initial fixture baseline measurement intentionally failed against placeholder values. A formatter invocation error was recovered from recorded pre-edit content, then all gates reran successfully.
- `countRouteOverlaps` export exists; `git diff --stat apps/cli/src/commands.ts packages/core/src/index.ts` was empty at self-check. Formal review, final wiring, integration verification and commit are downstream.

## Per-edit hashes

- 001: `packages/core/src/diagram-lint/metrics.ts` c244848af11783b076f2d22bb6f183c38410ae2f -> 057d0409349b2f64c911ff03bbee3ee5aae07731; Add pairwise collinear overlap metric without altering existing scores.
- 002: `apps/cli/src/lint-metrics.ts` d9ee7331b99510fec4cce6f08eddfe5cde575de7 -> 83642ba3dab600e9ebb0595d856d2190583af0a8; Report segment overlap count in text.
- 003: `apps/cli/src/lint-metrics.test.ts` 333004b4f7974e241e09e1635b3ad944757adfe7 -> a2332790ec2fb1ab5c97b59fce0766926e9342ab; Assert new text and metric fields.
- 004: `apps/cli/src/__fixtures__/connector-arrange.ts` e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 -> 96b64dce54c6d93d2cc6b04018a4f8ade2a24994; Create fixed neutral two-page fixture with prescribed geometry and routes.
- 005: `packages/core/src/diagram-lint/metrics.test.ts` a115d25b51a28314c46f4ea8feedb78f8b0aa587 -> 0f793aa8ea373e9d8364ce64fa710d485c5c0565; Test segment thresholds, geometry and page aggregation.
- 006: `apps/cli/src/__fixtures__/connector-arrange.test.ts` e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 -> 25aca3b69ae0722062491c5f369cf8bbdc844f3a; Validate deterministic fixture, page counts, containment and baseline metrics.
- 007: `apps/cli/src/__fixtures__/connector-arrange.test.ts` 25aca3b69ae0722062491c5f369cf8bbdc844f3a -> bb6a395e8ce5e5f932c47ea2d9474fa1bcfea9a8; Pin measured pre-algorithm fixture baseline.
- 008: `packages/core/src/diagram-lint/metrics.ts` 057d0409349b2f64c911ff03bbee3ee5aae07731 -> fe1d77c863a2f61912ddfec828b670e648ec3a97; Apply scoped Biome formatting preserving behavior.
- 009: `packages/core/src/diagram-lint/metrics.test.ts` 0f793aa8ea373e9d8364ce64fa710d485c5c0565 -> 9dc07e471b4f2ed04b0d5f6c70070ab580225d1f; Apply scoped Biome formatting preserving behavior.
- 010: `apps/cli/src/lint-metrics.ts` 83642ba3dab600e9ebb0595d856d2190583af0a8 -> 7403fde508c71dcc8f94f4eb25039c626b5ecf37; Apply scoped Biome formatting preserving behavior.
- 011: `apps/cli/src/lint-metrics.test.ts` a2332790ec2fb1ab5c97b59fce0766926e9342ab -> a4735bb7ee06f7f02b3cca743dd99111029f2d5d; Apply scoped Biome formatting preserving behavior.
- 012: `apps/cli/src/__fixtures__/connector-arrange.ts` 96b64dce54c6d93d2cc6b04018a4f8ade2a24994 -> f40d85096e20347fb2ec4d8ac88b78098264641d; Apply scoped Biome formatting preserving behavior.
- 013: `apps/cli/src/__fixtures__/connector-arrange.test.ts` bb6a395e8ce5e5f932c47ea2d9474fa1bcfea9a8 -> 2ca5bebb6541949876f4b1c92e74bf2bd85136e2; Apply scoped Biome formatting preserving behavior.
- 014: `packages/core/src/diagram-lint/metrics.ts` fe1d77c863a2f61912ddfec828b670e648ec3a97 -> 057d0409349b2f64c911ff03bbee3ee5aae07731; Restore content from recorded pre-format intent after formatter invocation error.
- 015: `packages/core/src/diagram-lint/metrics.test.ts` 9dc07e471b4f2ed04b0d5f6c70070ab580225d1f -> 0f793aa8ea373e9d8364ce64fa710d485c5c0565; Restore content from recorded pre-format intent after formatter invocation error.
- 016: `apps/cli/src/lint-metrics.ts` 7403fde508c71dcc8f94f4eb25039c626b5ecf37 -> 83642ba3dab600e9ebb0595d856d2190583af0a8; Restore content from recorded pre-format intent after formatter invocation error.
- 017: `apps/cli/src/lint-metrics.test.ts` a4735bb7ee06f7f02b3cca743dd99111029f2d5d -> a2332790ec2fb1ab5c97b59fce0766926e9342ab; Restore content from recorded pre-format intent after formatter invocation error.
- 018: `apps/cli/src/__fixtures__/connector-arrange.ts` f40d85096e20347fb2ec4d8ac88b78098264641d -> 96b64dce54c6d93d2cc6b04018a4f8ade2a24994; Restore content from recorded pre-format intent after formatter invocation error.
- 019: `apps/cli/src/__fixtures__/connector-arrange.test.ts` 2ca5bebb6541949876f4b1c92e74bf2bd85136e2 -> bb6a395e8ce5e5f932c47ea2d9474fa1bcfea9a8; Restore content from recorded pre-format intent after formatter invocation error.
- 020: `packages/core/src/diagram-lint/metrics.ts` 057d0409349b2f64c911ff03bbee3ee5aae07731 -> 48133ddc3779b3355e24e47950f69a21326c44a2; Apply scoped Biome formatting preserving restored behavior.
- 021: `packages/core/src/diagram-lint/metrics.test.ts` 0f793aa8ea373e9d8364ce64fa710d485c5c0565 -> 67db9404ad9fb7a8bcb01191e25fe7f57f094074; Apply scoped Biome formatting preserving restored behavior.
- 022: `apps/cli/src/lint-metrics.ts` 83642ba3dab600e9ebb0595d856d2190583af0a8 -> 83642ba3dab600e9ebb0595d856d2190583af0a8; Apply scoped Biome formatting preserving restored behavior.
- 023: `apps/cli/src/lint-metrics.test.ts` a2332790ec2fb1ab5c97b59fce0766926e9342ab -> a2332790ec2fb1ab5c97b59fce0766926e9342ab; Apply scoped Biome formatting preserving restored behavior.
- 024: `apps/cli/src/__fixtures__/connector-arrange.ts` 96b64dce54c6d93d2cc6b04018a4f8ade2a24994 -> e52ef191fd62c8cea2102192217570aa88716aed; Apply scoped Biome formatting preserving restored behavior.
- 025: `apps/cli/src/__fixtures__/connector-arrange.test.ts` bb6a395e8ce5e5f932c47ea2d9474fa1bcfea9a8 -> 3c71cb18db62ebc137dfd9311ccdbbb6ef80fda2; Apply scoped Biome formatting preserving restored behavior.
- 026: `packages/core/src/diagram-lint/metrics.ts` 48133ddc3779b3355e24e47950f69a21326c44a2 -> 8ea91f4962c6eb2432e2b0c4509db161f232328d; Resolve scoped Biome style diagnostics without behavior change.
- 027: `apps/cli/src/__fixtures__/connector-arrange.test.ts` 3c71cb18db62ebc137dfd9311ccdbbb6ef80fda2 -> 9223156364b5801bd8d2c5d2dbb99505940f5ba7; Guard optional dimensions before containment checks.
