# clm-00 overview: layered/route arranging, merge, edit usability, lint additions

- Design: `design-docs/specs/design-cli-layout-merge-lint.md`. It was accepted
  in Step 3 after DR-01, DR-02 and DR-03 were fixed.
- Owner questions: `design-docs/user-qa/cli-layout-merge-lint.md`, Q1 to Q6.
  Implement each default.
- This overview is not dispatched and has no write paths.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | clm-01-merge | B1-B3: merge engine, `merge` command, git driver end-to-end test, export determinism | - |
| 1 | clm-02-edit-perf | A7: profile and fix edit batches with obstacle routing, deadline tests | - |
| 1 | clm-03-lint-core | D1 `node-overlap` core rule, D2 text wrapper and fix planner | - |
| 1 | clm-07-layered-core | A1 layered placement (pure core) | - |
| 2 | clm-04-edit-usability | C1-C3, A6, global `--quiet` | clm-01 |
| 2 | clm-05-connector-fields | IR fields, port positions, label position, same-side self-loop | clm-02 |
| 3 | clm-06-route-core | A2-A5 route planner, A3 scoring and metrics (pure core) | clm-05 |
| 3 | clm-08-lint-cli | D1-D3 lint wiring, `lint --fix`, `image-missing` | clm-03, clm-04 |
| 4 | clm-09-arrange-cli | `arrange --mode layered|route`, `lint --metrics`, layout parity | clm-06, clm-07, clm-08 |

Some files are edited by several plans, in successive waves:
`apps/cli/src/commands.ts`, `apps/cli/src/help.ts`, `docs/cli.md`,
`README.md` and `packages/core/src/index.ts`. In each wave exactly one plan
owns them: wave 1 clm-01, wave 2 clm-04, wave 3 clm-08, wave 4 clm-09.

Core-only plans (clm-03, clm-06, clm-07) do not edit
`packages/core/src/index.ts`. Their tests import by relative path, and the
CLI wiring plan that uses a module adds its `export` lines.

## Shared working rules (all plans)

- Before every edit, read the file again and record its `git hash-object`
  in the progress log. After the edit, record the new hash. If a file outside
  your `writePaths` changed while you worked, record it as drift and leave it
  alone.
- Before the first edit, write an intent snapshot into the progress log:
  plan id, HEAD, and the list of files you will touch.
- Edit only your own progress log, `impl-plans/progress/<planId>.md`.
  Evidence logs go under `tmp/clm-s725/<planId>/`. `tmp/` is git-ignored.
  Write only `.log` and `.txt` files there.
- Do not run worktrees, branches, commits, pushes, broad formatters or
  lockfile changes. Format only your own files:
  `bunx biome format --write <owned files>`. Run cargo with
  `CARGO_TERM_QUIET=true`.
- Run `bun run typecheck` after TS changes. Core code must be safe under
  `noUncheckedIndexedAccess`.
- Boa rules: no regex `split` on whole documents, and no per-point
  destructuring in hot geometry loops. Use indexed loops instead.
- Fixtures and text must be neutral and self-authored: widgets, orders,
  `Idle`, `Running`, `Stage0` and similar. Never name external issues,
  organizations, reporters or downstream products.
- Native parity commands always set the binary:
  `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test <file>`.
  Never use a binary-less native parity command. Give native deadline tests
  up to 3 attempts before treating a timeout as a failure, and never relax
  an existing deadline.
- Every plan declares `artifactRoots ["target"]`.

## Final gates (integration, after wave 4)

- `CARGO_TERM_QUIET=true mise run verify` exits 0.
- `mise run test-cli` exits 0. Use the 3-attempt retry for native deadline
  timeouts, and compare `/usr/bin/time -p` CPU time with the pre-change
  binary (HEAD 196f9f5).
- The manual release-binary timing of the clm-02 fixture is recorded, with
  a target of about 3 s or less of CPU time.
