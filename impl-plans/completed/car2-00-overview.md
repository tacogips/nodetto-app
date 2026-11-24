# car2: AI capture and CAD audit round 2, 10 blocking findings (overview)

- Issue: `feat/ai-capture audit round 2 (base 0a35708, head 3cd2401ce1044d7c51dc0f4af9b0a6d4457e8589): 10 blocking findings`
- Design (accepted by step 3): `design-docs/specs/design-ai-capture.md`
  section 20. It contains rules R2-1 to R2-10 and R2-D, the plan grouping
  in 20.3, the decisions in 20.4 and the risks in 20.5. It inherits
  section 19.1 rules F1, F4, F9, F13 and F16 wherever section 20 says so.
- Branch: `feat/ai-capture`, working tree
  `/Users/taco/gits/tacogips/nodetto-app-capture`.
  - Do not push, rewrite history, create worktrees, create private
    branches or touch other worktrees.
  - Do not add server code, auth logic, secrets or deployment config.
- No plan is gated on a user question, and none writes a user-qa
  document.

## Plans and waves

| Wave | Plan | Findings | dependsOn |
| --- | --- | --- | --- |
| 1 | car2-a1-rust-decoder | R2-D Rust half, `closed_by` | - |
| 1 | car2-a1-ts-decoder | R2-D TS half | - |
| 1 | car2-a3-loop-normalisation | R2-4 | - |
| 1 | car2-a5-point-rule | R2-3 shared rule | - |
| 1 | car2-b-wireframe | R2-8, R2-9 | - |
| 1 | car2-c1-sweep | R2-6 | - |
| 1 | car2-p-picker-guard | R2-2 | - |
| 1 | car2-r-raster-rounding | R2-10 | - |
| 2 | car2-a2-native-host | R2-D native host | a1-rust-decoder |
| 2 | car2-c2-closure-once | R2-7 | c1-sweep, a1-rust-decoder |
| 3 | car2-a2-core-wiring | R2-D TS callers, R2-5 shaded bounds | a2-native-host, a1-ts-decoder, a3-loop-normalisation, r-raster-rounding |
| 3 | car2-a2-export-bounds | R2-5 export path | a2-native-host, b-wireframe |
| 4 | car2-a4-open-mesh-targets | R2-1 | a2-core-wiring |
| 5 | car2-a5-charged-walk | R2-3 | a4-open-mesh-targets, a5-point-rule |

Every plan id above takes the `car2-` prefix.

Two plans in the same wave never own the same source file. The shared
artifact roots `target` and `tmp/cad3d` are the only exception. The
dispatch manifest is `impl-plans/active/car2-r2b-dispatch.json`, with
evidence root `tmp/car2-r2b`.

The wave order follows design 20.3:

- Native capture decodes in Rust at the end of every wave.
- Each packet writer lands together with its reader.
- The `cad check` path (`nmeshDecode`, `CommandIo.decodeMesh`,
  `checkCadPage`) is never changed.

## Common rules for every plan

- Every fix ships a test that fails on `3cd2401` and passes after the fix.
  - Record that failure in the progress log, either from a pre-fix run or
    from a reasoned argument when a pre-fix run is impossible (for
    example, the API under test does not exist yet).
  - Performance tests assert deterministic counts, never wall-clock time.
- Do not change admitted NCS1, PNG or SVG bytes, goldens, digests, error
  codes or messages unless the design names the change. Do not regenerate
  goldens.
- Do not relax or delete any existing test or deadline. Timing tests may be
  retried up to three times under load; a failure after that is compared in
  isolation before it is reported.
- Language and tooling:
  - Strict TypeScript. Indexed reads type-check under
    `noUncheckedIndexedAccess`.
  - `packages/io` never imports `@nodetto/core`.
  - English only. No emojis.
  - Biome must pass on touched TS files (one variable per declaration).
- Cargo:
  - Always run cargo with `CARGO_TERM_QUIET=true` and the plan-local
    `CARGO_TARGET_DIR=target/car2-<plan>`.
  - Run `cargo fmt` on touched Rust files only: `rustfmt --edition 2021
    <files>`, or `cargo fmt -p <crate>` when the plan owns the whole crate
    diff.
- Native parity: first build the release binary with
  `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-<plan> cargo build
  --release -p nodetto-cli`, then set
  `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-<plan>/release/nodetto-cli"`.
- Same-branch safety, because all plans of a wave share one working tree:
  - Before each edit, read the file fresh and record its sha256 in the
    progress log. After the edit, record the new sha256.
  - If a file outside your `writePaths` changes under you, do not touch
    it. A compile or test failure caused by a sibling's in-progress edit
    is rerun after the sibling's progress log reads `done`. Record both
    runs.
  - Edit only your `writePaths` and your own progress log.
- Per-plan verification stays focused on the plan's own tests.
  - Workspace `bun run typecheck`, `bun run lint` and `mise run verify`
    run only at integration.
  - Leave no `*.test.ts` file under `target/` or `tmp/`. Oracle copies of
    pre-fix functions live inside the test files.
- Do not edit `impl-plans/README.md`, lockfiles or indexes, do not archive
  plans and do not run workspace-wide formatters. These belong to
  reconciliation.
- Progress log: `impl-plans/progress/<planId>.md`. Record:
  - each task;
  - the pre and post hash of each edited file;
  - each command with its exit code and log path under
    `target/car2-<plan>/logs/`;
  - the pre-fix failing evidence;
  - the final status: `done` or `blocked: <reason>`.

## Final integration (not owned by any plan)

On the reconciled tree, run:

- `bun run typecheck`
- `bun run lint`
- `CARGO_TERM_QUIET=true mise run verify`
- the native parity suite against a fresh release build
- `CARGO_TERM_QUIET=true mise run test-cli`
- the scan in design 20.3 gate 4, which fails if any `*.test.ts` file is
  under `target/` or `tmp/`

Record the exit status and complete log path of each gate. A pre-existing environmental failure is compared in isolation before it is
reported.
