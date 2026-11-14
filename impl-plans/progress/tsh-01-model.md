# tsh-01-model progress

Status: incomplete. Workflow mode: issue-resolution. No dependencies.
Intent snapshot: `55d9518c2684181caf05edc7140dbc7c48fd68c1`.

- Edit 001: `packages/ir/src/semantics/table.ts`, absent -> `598e7f1538fab5ad39f66d2d15992e58ea489918`; added types, constants and value/date checks.
- Edit 002: same file, `598e7f1538fab5ad39f66d2d15992e58ea489918` -> `3b160492a7c5a7c5b8a75c52da19c0d3f22bf10c`; formatted.
- Edit 003: `packages/ir/src/registry/table.test.ts`, absent -> `fdf04f4bc0ec5acf0d1479b64d53fbb09f745575`; focused primitive tests.
- Edit 004: same test, `fdf04f4bc0ec5acf0d1479b64d53fbb09f745575` -> `0779e9062ba843bb874c546eebef14cefe9e5020`; formatted.
- Edit intentions and snapshots are under `tmp/tsh-s776/tsh-01-model/edits/`.

Current-source checks under `tmp/tsh-s776/tsh-01-model/final/`: IR exit 0 (16 tests); IO exit 0 (54 existing tests, table fixture test absent); core exit 1 (no tests found); semantic audit exit 0 (3 tests); typecheck exit 0; Biome exit 0 but reports missing paths, therefore incomplete. Earlier attempts are in `attempt-1/`.

Outstanding: registry validation, IR registration and exports, JSONL fixture and tests, all core modules and tests, one core barrel line, and the complete plan verification. Formal review and downstream wiring remain later workflow steps. No acceptance criteria are marked complete.
