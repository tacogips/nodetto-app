# clm-09-arrange-cli

- planId: clm-09-arrange-cli
- planPath: impl-plans/active/clm-09-arrange-cli.md
- progressPath: impl-plans/progress/clm-09-arrange-cli.md
- wave: 4
- dependsOn:
  - clm-06-route-core: `planRouteArrangement` and `pageMetrics`;
  - clm-07-layered-core: `planLayeredArrangement` and `columnFrames`;
  - clm-08-lint-cli: the wave-3 owner of the shared CLI files and
    `lintCommand`.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections
  "A. arrange and routing" ("CLI surface", "Eligible pages", A1, A2) and
  "A3 metrics", plus the A1, A2 and A3 rows of "Verification", "Help and
  documentation" and "Rollout constraints".
- writePaths:
  - `packages/core/src/index.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/arrange-modes.test.ts` (new)
  - `apps/cli/src/native-parity/layout.test.ts` (new)
  - `apps/cli/src/help.ts`
  - `apps/cli/src/ai-commands.test.ts`
  - `docs/cli.md`
  - `README.md`
  - `design-docs/specs/design-cli-ai-drawing.md`
  - `impl-plans/progress/clm-09-arrange-cli.md`
  - `tmp/clm-s725/clm-09-arrange-cli`
  - `target`
- artifactRoots: `target`

## Intent and context

Expose the core planners as `arrange --mode layered|route` and add
`lint --metrics`.

- `commands.ts:arrangeCommand` (about lines 740-800) parses with
  `ARRANGE_OPTIONS`, calls `planArrangement` and handles `--write` and
  `--check`. Keep that flow.
- Resolve `--frames` like `ddl --frame`, following the private resolver
  next to `ddlCommand` in `commands.ts`: exact id, then exact name, then a
  unique prefix of at least `MIN_PREFIX` characters. Restrict it to
  `columnFrames`, and list the candidates on failure.
- Resolve `--ids` with `resolveId` from `ids.ts`, restricted to connectors
  on the page.

## Non-goals

- `tidy`, `overlaps` and `edit --arrange` must behave exactly as before.
- No core logic changes beyond `index.ts` exports. If a core defect is
  found, record it and stop: it is a Step-5 finding for the owning plan.

## File-level changes

1. `packages/core/src/index.ts`: export
   - `planLayeredArrangement`, `columnFrames`, `LAYERED_PAGE_KINDS` and the
     types from `./arrange-layered.ts`;
   - `planRouteArrangement`, `ROUTE_PAGE_KINDS`, `pageMetrics` and the
     types from `./arrange-route.ts` and `./diagram-lint/metrics.ts`.
2. `commands.ts:arrangeCommand`
   - `--mode` accepts `tidy`, `overlaps`, `layered` and `route`.
   - New value options `--frames` and `--ids` (comma-separated, each
     trimmed) and the new flag `--reset-manual`.
   - Usage errors (exit 2):
     - `--frames` without `layered`;
     - `--ids` without `route`;
     - `--reset-manual` with `tidy` or `overlaps`;
     - an ineligible page kind, with a message naming the supported kinds.
   - `layered`:
     1. Resolve `--frames` against `columnFrames`.
     2. `planLayeredArrangement`. On `ok:false`, exit 2 with its message.
     3. `editor.apply(commands, { placed })`.
     4. `planRouteArrangement` on the result with every connector and the
        same `resetManual`.
     5. Apply that.
   - `route`: `planRouteArrangement` with the resolved ids, then apply.
   - `--check` counts both stages' commands. `--write` and stdout are as
     today.
3. `commands.ts:lintCommand`
   - Add the flag `--metrics`. For each linted page that has connectors,
     compute `pageMetrics`.
   - Text: one line per such page, after the findings table and before the
     summary:
     `metrics <page name>: <n> edge crossing(s), <m> edge-label overlap(s)`.
     With no findings, print the metrics lines only.
   - JSON: add `metrics` per page and `summary.metrics` totals.
   - Metrics never change the exit code. Without the flag, output stays
     byte-identical.
4. `help.ts`:
   - `arrange`: the modes, flags, eligible page kinds, the manual-setting
     rule (Q6) and `--reset-manual` (DR-01 semantics), plus examples using
     `Stage0` frames.
   - `lint`: `--metrics`.
5. `docs/cli.md` and `README.md`: arranging state diagrams and measuring
   with `--metrics`.
6. `design-docs/specs/design-cli-ai-drawing.md`: no content change unless
   the arrange help wording differs from the pointer section. In that case
   update only the pointer line.

## Pitfalls

- Apply the layered placement before planning routes. Route scoring uses
  the moved geometry.
- Idempotency: `arrange --mode layered --write` followed by
  `arrange --mode layered --check` must exit 0. Do the same for route.
- `--ids` must not accept a non-connector or an id on another page. Exit 2.
- Native performance: time
  `arrange --mode layered` on the clm-02 fixture document (20 states, 50
  edges, 3 frames) with the release binary. It must finish in under 10 s;
  record the CPU time.

## Tests (input -> expected)

`arrange-modes.test.ts`:
- A state page with frames `Stage0`, `Stage1` and states `Idle`,
  `Running`, `Done`:
  - `--mode layered` puts the columns in traversal order and keeps members
    inside their frames;
  - running `--check` after `--write` exits 0.
- `--frames Stage1,Stage0` -> the order is reversed. An unknown frame name
  -> exit 2 with a candidate list.
- `--direction TB` -> rows.
- `--mode route` -> no element moves, and connectors get orthogonal routing
  and ports. `--ids <one>` limits the change.
- The reset regression:
  - a manual connector with waypoints and a blocking element;
  - without `--reset-manual` it is unchanged;
  - with it, it becomes orthogonal and its resolved route avoids the
    element.
- An erd page with `--mode layered` -> exit 2. `--frames` with route ->
  exit 2.
- `lint --metrics` on a page with two crossing edges -> the metrics line
  shows 1 crossing. JSON has `metrics`. Without `--metrics`, the output is
  unchanged (compare with a run of the pre-change command recorded in the
  test as an expected string).

`native-parity/layout.test.ts` (`compare`):
- layered, route, the reset regression, and `lint --metrics`;
- the clm-02 fixture `arrange --mode layered` deadline: 10000 ms, spawn
  timeout 60000, test timeout 120000.

## Verification (each must exit 0)

1. `bun test apps/cli/src/arrange-modes.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/commands.test.ts apps/cli/src/lint-rules.test.ts`.
2. `bun test packages/core/src/arrange-layered.test.ts packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint`.
3. `bun run typecheck`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/layout.test.ts`.
   It must run more than 0 tests, and all must pass. Use up to 3 attempts
   on a deadline timeout.
5. `bunx biome check <owned TS files>`.

## Done criteria

- Verification commands 1 to 5 exit 0, with their logs.
- The native timing of the fixture layered arrange is recorded.
- `git diff --stat` shows only writePaths.
- This is the last plan. The integration gates (`mise run verify`,
  `mise run test-cli` and the clm-00 timing comparison) run in integration
  review.
