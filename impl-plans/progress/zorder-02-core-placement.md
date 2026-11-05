# zorder-02-core-placement progress

- Implemented `ZOrderPlacement`, `relativeOrder`, `planElementOrder`, and `Editor.orderElements` per the accepted design. Page moves expand container blocks; group moves update memberIds without changing indexes. Invalid scopes and anchors are refused, selection is preserved, and read-only moves return false.
- Existing tests remain intact; appended placement, action parity, frame, group, invalid input, no-op, selection, and read-only coverage.
- On the moving shared tree: targeted Bun tests passed (31 tests), typecheck passed, scoped Biome passed, and the specified noUncheckedIndexedAccess owned-file gate passed. Logs and per-edit hashes are in `tmp/zorder-s734/zorder-02-core-placement/`. An initial test attempt had two incorrect new assertions, corrected before the final run.
- Implementation acceptance criteria complete. Formal reviews, dependent CLI integration, and final serial combined-tree verification remain downstream.
