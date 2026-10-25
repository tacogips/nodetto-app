# breadboard-01-ir-contract progress

Status: implementation complete; pending downstream integrity/adversarial review and serial commit.

Issue reference: workflow input "Circuit breadboard drawing mode (KiCad/Fritzing-inspired)"; no GitHub issue. Workflow mode: issue-resolution. Plan: `impl-plans/active/breadboard-01-ir-contract.md`.

Implemented the additive IR contract: appended the breadboard page kind; declared all 13 semantic types, enums, reference mappings, guards and pitch; registered structural validation and canonical nested key order; added the shared value parser, import/netlist models and natural reference comparator; exported the API; added all-type semantic tests, registry entries and a canonical JSONL fixture. `SCHEMA_VERSION` remains 1; migrations and electrical validation were not changed.

Final verification on the current shared source (all logs under `tmp/breadboard-mode-s485/breadboard-01-ir-contract/`):

| Command | Exit | Counts | Log |
|---|---:|---|---|
| `bun test packages/ir/src/breadboard.test.ts packages/ir/src/registry.test.ts packages/io/src/jsonl/golden.test.ts` | 0 | 108 pass, 0 fail | `focused-step6.log` |
| `bun test packages/ir packages/io/src/jsonl` | 0 | 255 pass, 0 fail | `ir-io-step6.log` |
| `bun run typecheck` | 0 | 0 tests; no diagnostics | `typecheck-step6.log` |
| G1 owner-regex grep over `typecheck-step6.log` | 0 | 0 tests; no owned diagnostics | `g1-ownregex-step6.log` |
| `bunx biome check packages/ir/src/types.ts packages/ir/src/semantics.ts packages/ir/src/registry.ts packages/ir/src/breadboard.ts packages/ir/src/breadboard.test.ts packages/ir/src/index.ts packages/ir/src/registry.test.ts packages/io/src/jsonl/golden.test.ts apps/cli/src/types-command.ts` | 0 | 0 tests | `biome-step6.log` |
| New-file ASCII gate | 0 | 0 tests; no output | `ascii-new-step6.log` |
| Added-line ASCII gate | 0 | 0 tests; no output | `ascii-added-step6.log` |
| Migration unchanged check | 0 | 0 tests; no migration diff | `migrations-step6.log` |
| `rg -n 'SCHEMA_VERSION' packages/ir/src` | 0 | 0 tests; constant is 1 | `schema-version-step6.log` |
| Fixture coverage check | 0 | all 13 breadboard types found | `fixture-step6.log` |

An initial focused run exposed floating-point multiplication precision in `10u`, then a micro-sign test escape issue; both were corrected. The current workspace typecheck now passes, including the CLI page-kind entry owned by this plan's checkpoint amendment.

Additional final evidence paths:
- Current-source typecheck: `typecheck-step6.log` (exit 0).
- Current-source Biome: `biome-step6.log` (exit 0, clean).
- Current-source new-file and added-line ASCII: `ascii-new-step6.log` and `ascii-added-step6.log` (both exit 0, empty).
- Current-source fixture coverage: `fixture-step6.log` (exit 0; all 13 types found).
- Current-source migration guard: `migrations-step6.log` (exit 0).
- Existing fixture registration evidence: `golden-entry.log` (exit 0, line 35).
- ASCII sentinel control: command returned exit 0 after confirming the test input is rejected; the non-ASCII sentinel line was rejected as expected (`ascii-sentinel.log`).
