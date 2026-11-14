# BPMN export placement progress

- Workflow: issue-resolution, session 550; plan 03; no dependencies.
- Started: 2026-10-30 (session date).
- Done: effective parent and cycle-safe ancestry, source-container flow placement, collaboration artifacts and association ownership, five focused regression cases.
- Done: scoped formatting, focused and existing BPMN/CLI tests, Biome and TypeScript verification. Tests ran on the shared fanout tree; serial reconciliation will repeat final integration gates.
- Pending downstream: plan 04 duplicate-ID wiring and integration; formal reviews and workflow finalization.
- Deviation: the cycle test imports valid participant-owned lanes and removes the participant before establishing the pool-less cycle, because importing parentless lanes fails document validation. The first test attempt and initial lint/typecheck failures are retained in the plan-local evidence directory; targeted fixes were verified by final reruns.

## SHA-256 before / after

| Path | Before | After |
| --- | --- | --- |
| packages/io/src/bpmn/export-scope.ts | 99f3d2536a4c1a0bdfa89a6893b45d02d3c3a8653d8e1a9533e20fbc98199175 | ce9f8ce5ac26e53b5fa86a016d78edc4ebbb0bd90f93423c0f3efa55eb2190a8 |
| packages/io/src/bpmn/export-process.ts | 260493a1500e6dba130b8e37878148d1767d9a5630854bb7193f818367a84ca0 | 02e4252681cbfe79be083358e7218fc66fdf161d6b555ef1ba7a0769e8eb2cc1 |
| packages/io/src/bpmn/export.ts | 47ebc98e317b42acf299ef50883f1757301bc3886da2ab11f55deba6fecb15e5 | 5148966c28e066a554b267090964975ec275fdf4472fc11eb05c10249e5153a5 |
| packages/io/src/bpmn/export.test.ts | c1c4826717ca081279412468c6874f8ba89a3fe663d1f906c25da51d13bc0b01 | 6fb8c7d8b5712149a98f49cec97101c82b3bf5be03ebd485d13d26d359e0df40 |
| This progress file | absent | recorded in plan-local progress-post.sha256 |

## Verification

All logs are under `tmp/bpmn-export-ownership-s550/bpmn-export-ownership-03-export-placement/`.

- `bunx biome format --write packages/io/src/bpmn/export-scope.ts packages/io/src/bpmn/export-process.ts packages/io/src/bpmn/export.ts packages/io/src/bpmn/export.test.ts`: 0, `format.log`; subsequent test-only format: 0, `format-2.log`.
- `bun test packages/io/src/bpmn/export.test.ts`: 0, 8 pass, `export-test-final.log`.
- `bun test packages/io/src/bpmn/roundtrip.test.ts packages/io/src/bpmn/reference.test.ts packages/io/src/bpmn/xml.test.ts`: 0, 11 pass, 1 skip, `existing-bpmn-final.log`.
- `bun test apps/cli/src/bpmn-commands.test.ts`: 0, 7 pass, `cli-bpmn-final.log`.
- `bunx biome check packages/io/src/bpmn/export-scope.ts packages/io/src/bpmn/export-process.ts packages/io/src/bpmn/export.ts packages/io/src/bpmn/export.test.ts`: 0, `biome-final.log`.
- `bun run typecheck`: 0, `typecheck-final.log`.
