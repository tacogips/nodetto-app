# slk-00 strict-index gate progress

Implementation complete for the assigned plan; formal review and integration remain downstream. The gate captures a pristine, uniquely named baseline tree and cleans it in `finally`; it compares diagnostics as multisets and fails closed on invalid compiler or baseline states.

Baseline: `target/strict-index/baseline.log` with `.exit` 2, 124 parsed diagnostics, `.ref` `ccac2d37cf4274e35a9fc515086397f20e60d19b`. Capture and cleanup passed. Evidence logs are in `tmp/slk-s855/slk-00-strict-index-gate/`.

- `bun test ./.agents/scripts/strict-index-gate.test.ts`: exit 0, 8 passed (1.log).
- `bunx biome check --diagnostic-level=warn --no-errors-on-unmatched .agents/scripts/strict-index-gate.ts .agents/scripts/strict-index-gate.test.ts`: exit 0, zero files matched (2.log).
- `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`: exit 0 (3.log).
- Both `find` cleanup assertions and node_modules assertion: exit 0 (4.log, 5.log, 6.log).
- Gate check on both authored files: exit 0 (check.log).
- `bun run typecheck`: final exit 0 (typecheck-final.log); earlier exit 2 in sibling `packages/ir/src/link-id.test.ts` retained in typecheck.log.
