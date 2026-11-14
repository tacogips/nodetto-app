# ddl-frame-01-resolver progress

Status: implementation complete; ready for integrity and adversarial review.

## Implementation

- Added private `resolveFrameQuery(document, page, query)` immediately above
  `ddlCommand` in `apps/cli/src/commands.ts`.
- Resolution is limited to selected-page frames and follows exact full id, exact
  case-sensitive name (ambiguous names fail), then a unique prefix of at least
  `MIN_PREFIX` (6). Candidate short ids are computed across all document element
  ids, in document order; empty or non-string names display as `(unnamed)`.
- Replaced the command-layer `editor.store.get(frameId)` check with resolver
  output while continuing to pass the resolved full id unchanged to DDL
  generation.
- Added one regression test block in `apps/cli/src/commands.test.ts` covering
  page-scoped names, full ids, six-character and five-character prefixes,
  missing and ambiguous queries, output-file failure, other-page exclusions,
  name-before-prefix precedence, and unnamed candidate formatting. The existing
  `DDL frame scopes validate page ownership and retain check/strict behavior`
  test was not modified.

## Edit hash trail

SHA-256 values are recorded before and after each source edit. The baseline
control temporarily restored the exact-id-only `ddlCommand` wiring matching
`f705c09`; the implementation wiring was then restored and verified.

| File | Edit | Pre-edit SHA-256 | Post-edit SHA-256 |
| --- | --- | --- | --- |
| `apps/cli/src/commands.test.ts` | Add resolver regression test block | `23368fe856a145584ecf5174da741f9569f28f44a82c61f572b30b43c2138dae` | `3a8e79ccce44d8ca9d4dfe3be3e78b0ad2946814615257d9adecb8adbe073937` |
| `apps/cli/src/commands.test.ts` | Replace fixture indexes with valid ordered `a0...` keys | `3a8e79ccce44d8ca9d4dfe3be3e78b0ad2946814615257d9adecb8adbe073937` | `6d17ed6083eb15b93126d742d7e0023df5dbfdd1154f7ca8b04d9cf6846972e4` |
| `apps/cli/src/commands.test.ts` | Apply scoped Biome line wrapping | `6d17ed6083eb15b93126d742d7e0023df5dbfdd1154f7ca8b04d9cf6846972e4` | `1e4a68ed5e27121567a3632c37174fd04ef8eb3e4dc896418142dcfc93c1e369` |
| `apps/cli/src/commands.ts` | Add imports, resolver, and resolver wiring | `e11c56431d04b0d48195bf8cf1aa8ad7e3adcc08c0fd7e6a24902cdaa095bed8` | `d3137c740702881239e4426be906782717012aaef4245987a51e3e8fa91fc26d` |
| `apps/cli/src/commands.ts` | Temporary exact-id-only baseline control | `d3137c740702881239e4426be906782717012aaef4245987a51e3e8fa91fc26d` | `d4dff50a255dfafbc43450c07f1cb52d2a5a06d5ab2fa4c7d7a010a0e015588e` |
| `apps/cli/src/commands.ts` | Restore accepted resolver wiring | `d4dff50a255dfafbc43450c07f1cb52d2a5a06d5ab2fa4c7d7a010a0e015588e` | `d3137c740702881239e4426be906782717012aaef4245987a51e3e8fa91fc26d` |
| `impl-plans/progress/ddl-frame-01-resolver.md` | Initial progress log creation | absent | `31c63a7ef59a0f23d55b58147c2c543951e80af30da97cb73ca9a6c902f60671` |

## Regression and verification

- Corrected regression test against the exact-id-only control matching `f705c09`:
  `bun test apps/cli/src/commands.test.ts 2>&1 | tee tmp/ddl-frame/ddl-frame-01-resolver/red.log`
  exited 1; 13 tests ran, 12 passed and 1 failed at the new name resolution
  assertion. Complete log: `tmp/ddl-frame/ddl-frame-01-resolver/red.log`.
- Final-source focused suite:
  `bun test apps/cli/src/commands.test.ts 2>&1 | tee tmp/ddl-frame/ddl-frame-01-resolver/green.log`
  exited 0; 13 passed, 0 failed. Complete log:
  `tmp/ddl-frame/ddl-frame-01-resolver/green.log`.
- `bun run typecheck 2>&1 | tee tmp/ddl-frame/ddl-frame-01-resolver/typecheck.log`
  exited 0. Complete log: `tmp/ddl-frame/ddl-frame-01-resolver/typecheck.log`.
- `bunx biome check apps/cli/src/commands.ts apps/cli/src/commands.test.ts 2>&1 | tee tmp/ddl-frame/ddl-frame-01-resolver/biome.log`
  exited 0; checked 2 files. Complete log:
  `tmp/ddl-frame/ddl-frame-01-resolver/biome.log`.
- Mechanical check command:
  `test "$(grep -c 'function resolveFrameQuery' apps/cli/src/commands.ts)" -eq 1 && ! grep -n 'export function resolveFrameQuery' apps/cli/src/commands.ts && ! grep -n 'editor.store.get(frameId)' apps/cli/src/commands.ts && git diff --stat`
  exited 0. Complete log: `tmp/ddl-frame/ddl-frame-01-resolver/mechanical.log`.
- Exact full-id behavior remains wired to the same `generateDatabaseDdl` call
  with the same full `frameId`; the existing exact-id scope/check/strict test
  passes unchanged.

## Superseded attempts

- Initial regression invocation exited 1 before running tests because the
  concurrently edited `apps/cli/src/help.ts` had a transient parse error (0
  tests). Log: `tmp/ddl-frame/ddl-frame-01-resolver/red-parse-blocker.log`.
- First corrected-source green attempt used invalid fixture index values and
  exited 1 in the new assertion. Log:
  `tmp/ddl-frame/ddl-frame-01-resolver/red-invalid-fixture.log`.
- First scoped Biome check exited 1 with three requested line-wrap changes;
  those were applied and the final scoped check passed. Its complete diagnostic
  is preserved at `tmp/ddl-frame/ddl-frame-01-resolver/biome-first-failure.log`;
  the final complete log is `tmp/ddl-frame/ddl-frame-01-resolver/biome.log`.

## Completion criteria

- [x] Exactly one private `resolveFrameQuery`; no `editor.store.get(frameId)`.
- [x] Corrected test fails on exact-id-only baseline behavior; final focused suite
      passes with 13 tests and 0 failures.
- [x] Typecheck and scoped Biome check pass.
- [x] Pre/post source hashes, commands, exit statuses, and complete log paths are
      recorded.

Workspace-wide lint, `bun test apps/cli/src`, and
`CARGO_TERM_QUIET=true mise run test-cli` belong to the serial reconciliation
and integration-review gate, not this plan's implementation-phase gate.
