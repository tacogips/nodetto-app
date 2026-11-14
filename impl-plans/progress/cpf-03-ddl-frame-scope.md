# cpf-03 DDL frame scope progress

Implementation complete for this plan. The DDL-only resolver preserves expanded membership, adopts fully contained tables in open frames, and emits ordered ambiguity warnings. The ERD lint seam reports visible table/frame edge crossings. Shared registration and documentation are owned by cpf-06; native parity is owned by cpf-08. Formal reviews and final serial verification remain downstream.

Every edit has its fresh pre-edit content, intended hunk, and before/after `git hash-object` values in `tmp/cpf-s748/cpf-03-ddl-frame-scope/edit-*.txt`. Those snapshots also preserve the state observed before targeted formatting. These checks ran on the moving shared tree, not a final integrated tree.

- Focused tests: `bun test packages/core/src/erd-frame-scope.test.ts packages/core/src/diagram-lint/frame-straddle.test.ts apps/cli/src/ddl-frame-scope.test.ts`: 6 passed, 0 failed; `tmp/cpf-s748/cpf-03-ddl-frame-scope/focused-final.log`.
- Existing regressions: `bun test packages/core/src/database-ddl.test.ts packages/core/src/database-ddl-tables.test.ts packages/core/src/database-objects.test.ts packages/core/src/database-ddl-expressions.test.ts packages/core/src/erd-definition-edit.test.ts apps/desktop/src/design-workflow.test.ts`: 45 passed, 0 failed; `tmp/cpf-s748/cpf-03-ddl-frame-scope/regression-final.log`.
- `bun run typecheck`: exit 0; `tmp/cpf-s748/cpf-03-ddl-frame-scope/typecheck-final.log`.
- `bunx biome check packages/core/src/erd-frame-scope.ts packages/core/src/erd-frame-scope.test.ts packages/core/src/diagram-lint/frame-straddle.ts packages/core/src/diagram-lint/frame-straddle.test.ts packages/core/src/database-ddl.ts apps/cli/src/ddl-frame-scope.test.ts`: exit 0; `tmp/cpf-s748/cpf-03-ddl-frame-scope/biome-final.log`.
- `git diff --quiet 1e8f43d -- packages/core/src/frame-tree.ts packages/core/src/frame-membership.ts packages/core/src/database-ddl.test.ts`: exit 0; `tmp/cpf-s748/cpf-03-ddl-frame-scope/unchanged.log`.

## Test-integrity revisions

- TI-CPF03-01: the CLI test retains late-frame adoption and now asserts relaxed SQL excludes gadgets and includes widgets. A positional frame below widgets asserts the literal SQL with and without `--strict` frame scope.
- TI-CPF03-02: the core test asserts two exact alphabetically sorted scope warnings and the exact later warning, with a total of three.
- Per-edit hashes: CLI test `5289f830acccd724f4f55f90f25ac2e564928826` to `694b2eef1ff8e0bdaa8fba68500fbedb51b1dd94`; core test `afc81668a72ebd3056fb28ad4cf8998a28d0a98b` to `1592ef8124dade4eee6a05a3a92596ed40727337` to `7d57ad4c59528560da34c9320faf088357f06948` to `a73863e90bee82494db3fd863360547e74343999`. Fresh content and intentions are in `revision-1.txt` through `revision-4.txt` under the evidence directory.
- Current-source focused suites: both requested file orders and the plan order passed 7 tests each; logs `revision-focused-cli.log`, `revision-focused-core.log`, and `revision-plan-focused.log`.
- Existing DDL regressions: 45 passed, `revision-regression.log`. Typecheck passed, `revision-typecheck.log`. Each requested targeted Biome check passed, `revision-biome-cli.log` and `revision-biome-core.log`. Unchanged-file diff check passed, `revision-unchanged.log`. All logs are under `tmp/cpf-s748/cpf-03-ddl-frame-scope/` and reflect the moving shared tree.
- Independent review remains pending; downstream wiring and native parity retain their assigned owners.

## Adversarial review revisions

- CPF03-ADV-01: an owner competes only when it is non-nested relative to every open container holding the table. Tests cover catalog adoption, zone competition, and straddling-only warning.
- CPF03-ADV-02: an excluded table listed both in scope and by an external frame now receives a named warning; sole external claims remain silent. Core and CLI tests cover the strict exit and unchanged SQL apart from the warning comment. This refines plan/design case 1: duplicate explicit lists are ambiguous. The integration owner should update that wording and cpf-06 documentation.
- Per-edit hashes and fresh prior content are in `tmp/cpf-s748/cpf-03-ddl-frame-scope/adv-edit-01.txt` through `adv-edit-07.txt`: resolver `ee024fc1847c44a92ca14ed5da0563071d7328d8` to `0d4443cf3bbcbdd02ec04716f8ab0eff1b83f939`; core test `a73863e90bee82494db3fd863360547e74343999` to `75e3c31c123cf8346816f786037736fea6d93bad` to `57430d63d6054772f891733fc72dfdc85078956f`; CLI test `694b2eef1ff8e0bdaa8fba68500fbedb51b1dd94` to `86056560fc4494b206b4dc0b1c3302d775d5adca` to `b2bb2a7b4f171317cdb5926275400df18896ea59` to `d6edccf5a06350a41c06450955a83980f2ee8044`.
- Focused tests passed 9, regression tests passed 45, typecheck and both requested Biome checks passed, and the unchanged-file diff passed. Complete logs are `adv-focused-final.log`, `adv-regression-final.log`, `adv-typecheck-final.log`, `adv-biome-final.log`, `adv-biome-core-final.log`, and `adv-unchanged-final.log` in the evidence directory. These checks ran on the moving shared tree. `adv-reproduction.log` records the two expected pre-fix failures.
- Independent re-review and final integrated verification remain downstream.
