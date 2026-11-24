# car1: AI capture and CAD audit round 1, 16 major findings (overview)

- Issue: `audit-round-1:feat/ai-capture:0a357086e71f252f35c6639f755d28551f772517..eb7d8c912fa38f669082aaa318ce28de1dab987b`
- Design (accepted): `design-docs/specs/design-ai-capture.md` section 19
  (19.1 rules F1, F2, F4, F5, F7, F9, F10, F11, F13, F15, F16; 19.2 to 19.4),
  `design-docs/specs/design-cad3d.md` section 19 (F2 editor half, F3, F6,
  F8, F12, F14), `design-docs/user-qa/ai-capture-audit-r1.md` (gates Q1 and
  Q2).
- Branch: `feat/ai-capture`, working tree
  `/Users/taco/gits/tacogips/nodetto-app-capture`. No push and no history
  rewrite. No worktrees and no private branches. Never touch other
  worktrees.

## Plans and waves

| Plan | Findings | dependsOn | Gate |
| --- | --- | --- | --- |
| car1-a1-nmesh-contract | F1 eligibility and F4 decoder seam (decoder side) | - | - |
| car1-b1-shared-contours | F4 tail memory (history, construction) | - | - |
| car1-c-body-selection | F7 | - | - |
| car1-d-pcb-page-kind | F2 (capture entry points, choices) | - | - |
| car1-f-desktop-transport | F10 | - | - |
| car1-g-boundary-fold | F5 | - | - |
| car1-h-overlay-alloc | F11 | - | - |
| car1-j-cad-ui-strict | F3 | - | - |
| car1-k-inspector | F6, F14 | - | - |
| car1-l-sketch-loops | F8 | - | - |
| car1-m-stl-refusal | F12 | - | - |
| car1-e-report-contract | F15 | d, j | - |
| car1-i-pairs-classification | F13, F16 | g, h | - |
| car1-d2-pcb-insert-guard | F2 (commit-time guard) | d | Q1 |
| car1-a2-native-wiring | F9 and the core decoder type | a1, c, j | Q2 |
| car1-b2-open-mesh-targets | F1 (walk, capture) | a2, b1 | Q2 through a2 |
| car1-b3-point-limit | F4 (capture walk, metadata walk, precedence) | b2, c | Q2 through a2 |

The table runs in four waves:
- Wave 1: a1, b1, c, d, f, g, h, j, k, l, m.
- Wave 2: e, i, plus a2 and d2 (each only when its gate is approved).
- Wave 3: b2.
- Wave 4: b3.

## Gates

A gated plan first reads its `Decision:` line in
`design-docs/user-qa/ai-capture-audit-r1.md`:
- If it reads `approved`, the plan proceeds.
- Otherwise it makes no edit and writes `blocked: Qn pending` in its
  progress log. Its dependants stay blocked too.

## Common rules for every plan

- Every fix ships a test that fails on `eb7d8c9` and passes after the
  fix. Each plan records that failure in its progress log, from a pre-fix
  run or from a reasoned argument when a pre-fix run is impossible.
- Performance findings assert deterministic counts, never wall-clock time.
- Admitted capture bytes, goldens, digests, error codes and messages stay
  unchanged unless the design names the change.
- Indexed reads must type-check under `noUncheckedIndexedAccess`.
- `packages/io` never imports `@nodetto/core`.
- English only, no emojis, strict typing.
- Cargo always runs with `CARGO_TERM_QUIET=true` and a plan-local
  `CARGO_TARGET_DIR=target/car1-<plan>`. Run `cargo fmt` on touched Rust.
- Native parity needs the release binary first:
  `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-<plan> cargo build --release -p nodetto-cli`,
  then `NODETTO_CLI_TEST_BINARY="$PWD/target/car1-<plan>/release/nodetto-cli"`.
- Same-branch safety:
  - Before each edit, read the file fresh and record its sha256 in the
    progress log.
  - After the edit, record the new sha256.
  - If a file outside `writePaths` changed under you, stop and report.
  - Edit only `writePaths` and your own progress log.
- Sibling in-progress state: plans in one wave share the tree. Repo-wide
  `bun run typecheck`, the strict-index probe, and Cargo builds and tests
  of a crate a sibling edits can fail transiently:
  - `crates/capture` is edited by a1, g and h in wave 1, and by i while
    a2 builds `nodetto-cli` in wave 2.
  - On such a failure, rerun after the sibling's progress log reads
    `done`, and record both runs.
  - Never edit a sibling's files to make your run pass.
- From wave 2 on, the TS plans (e, a2, b2, b3) also run
  `bun test packages/ui-solid/src/cad/strict-index.test.ts`, so that a
  `noUncheckedIndexedAccess` regression in shared packages surfaces early.
- Timing tests may be retried up to three times under load. A failure
  after that is compared in isolation before it is reported. Never relax
  or delete a test.
- Do not edit `impl-plans/README.md`, lockfiles or any index. Do not
  archive plans. Do not run workspace-wide formatters. Those belong to
  reconciliation.
- Progress log: `impl-plans/progress/<planId>.md`. Record:
  - each task;
  - each pre/post hash;
  - each command, with its exit code and log path under `target/car1-<plan>/logs/`;
  - the pre-fix failing evidence;
  - the final status (`done`, `blocked: <reason>`).

## Final integration (not owned by any plan)

`CARGO_TERM_QUIET=true mise run verify` on the reconciled tree, plus
`bun run typecheck` and `bun run lint`. The pre-existing EPERM failure on
`tmp/cad3d/m7/roundtrip.log` in
`packages/cad-kernel/src/worker-host.test.ts` (reviewer V3) is
environmental. It is compared in isolation before it is reported.
