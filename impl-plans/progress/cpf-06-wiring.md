# cpf-06 wiring progress

- Implemented additive participant notation and frame-straddle exports; DDL resolver remains private.
- ERD lint appends warning rows after node-overlap, naming the table and frame. CLI text and JSON cases and a contained-table case pass.
- Help, CLI guide and README describe conversion, reconnectTo including the cascaded port rule, participant rendering and frame scope. Existing asserted wording remains intact. `apps/cli/src/commands.ts` is unchanged against 1e8f43d.
- Source edits and before/after blob hashes are recorded in `tmp/cpf-s748/cpf-06-wiring/edit-intentions.log`. This shared-tree run is provisional pending review.
- `bun test apps/cli/src/lint-diagram.test.ts apps/cli/src/help-convert-frame.test.ts apps/cli/src/help-style-export.test.ts apps/cli/src/cli-wiring.test.ts apps/cli/src/commands.test.ts`: exit 0, 34 pass, 0 fail; `tmp/cpf-s748/cpf-06-wiring/focused-final.log`.
- `bun test apps/cli/src/lint-metrics.test.ts apps/cli/src/ai-commands.test.ts`: exit 0, 17 pass, 0 fail; `tmp/cpf-s748/cpf-06-wiring/regression-final.log`.
- `bun run typecheck`: exit 0; `tmp/cpf-s748/cpf-06-wiring/typecheck-final.log`.
- `bunx biome check packages/core/src/index.ts apps/cli/src/lint-diagram.ts apps/cli/src/lint-diagram.test.ts apps/cli/src/help.ts apps/cli/src/help-convert-frame.test.ts`: exit 0; `tmp/cpf-s748/cpf-06-wiring/biome.log`. Initial formatting diagnostics were corrected; `biome-initial.log` retains that attempt.
- Combined-tree `CARGO_TERM_QUIET=true mise run verify` and `CARGO_TERM_QUIET=true mise run test-cli` are serial integration gates after pending cpf-07 and cpf-08; native parity belongs to cpf-08. Formal review remains downstream.

## CPF-INT-13 integration revision

- Corrected convert help and guide: optional `semantic` and `label`, rejected `visual`, and the `shape.geo` / `semantic.geo` example. Split the ERD lint table row to include `frame-straddle`. Existing operation fields and `commands.ts` remain unchanged.
- Blob hashes before -> after: `apps/cli/src/help.ts` 223451f426741e2a3838ff75c826253714e39ea8 -> b76f5897675cb4b4b59cc8dda06ab6798107cff5; `docs/cli.md` dd7b2ab3c3d1a70a1a27eef6482b05ae0283478b -> f7526935e7180da9cbe16902059ea0c849b3ded1; `apps/cli/src/help-convert-frame.test.ts` 95c110da7576fd4769d30702df609a382e43a4a6 -> 17028c0ae6803b120e2fd127ffc01bd9fb1bde0b. Progress log before/after hashes and all per-edit intentions are in `tmp/cpf-s748/cpf-06-wiring/cpf-int-13-intentions.log`.
- Final shared-tree verification: focused tests 34 passed, regression tests 17 passed, typecheck and scoped Biome all exit 0; complete logs are `cpf-int-13-focused-final.log`, `cpf-int-13-regression-final.log`, `cpf-int-13-typecheck-final.log`, and `cpf-int-13-biome-final.log` in the evidence directory. A negative control restoring the old wording in memory exits 1 as expected (`cpf-int-13-negative.log`). The initial Biome formatting failure is retained in `cpf-int-13-biome.log` and was corrected.
- Completion criteria for CPF-INT-13 are met; independent review and combined-tree serial gates remain downstream.
