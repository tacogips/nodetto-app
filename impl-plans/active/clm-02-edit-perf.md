# clm-02-edit-perf

- planId: clm-02-edit-perf
- planPath: impl-plans/active/clm-02-edit-perf.md
- progressPath: impl-plans/progress/clm-02-edit-perf.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, section A7,
  and the A7 row of "Verification".
- writePaths:
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` (new generator)
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl` (new; output of the pre-change code)
  - `apps/cli/src/edit-performance.test.ts` (new)
  - `apps/cli/src/native-parity/edit-performance.test.ts` (new)
  - `apps/cli/src/edit/apply-batch.ts`
  - `packages/core/src/editor/transaction.ts`
  - `packages/core/src/frame-translation.ts`
  - `packages/core/src/frame-tree.ts`
  - `packages/core/src/manual-route-preservation.ts`
  - `packages/core/src/orthogonal-routing.ts`
  - `packages/core/src/shapes/connector/resolve.ts`
  - `impl-plans/progress/clm-02-edit-perf.md`
  - `tmp/clm-s725/clm-02-edit-perf`
  - `target`
- artifactRoots: `target`

## Intent and context

An `edit` batch of about 50 `update` operations that set
`routingAvoidObstacles: true`, on a state page with about 20 states and 3
frames, takes more than two minutes natively. The target is a few seconds.
The output must stay byte-identical.

- Routes are never stored. They are computed at render and bounds time by
  `resolveConnector` (`shapes/connector/resolve.ts`) and
  `avoidOrthogonalObstacles` (`orthogonal-routing.ts`).
- The caches there are keyed by a `ShapeContext` (`pageObstacles`,
  `resolvedRoutes`) or by an element object (`routeCache`).
- Per operation, `planDerivedCommands` (`editor/transaction.ts`) copies the
  store and runs all planners. `planFrameTranslations` resolves frame
  membership, which includes connector routes, and
  `planManualRoutePreservation` creates a fresh shape context.
- `apps/cli/src/edit/apply-batch.ts:applyBatch` lists all elements after
  every operation and validates every changed element.

## Non-goals

- No change to any written output, error text, operation index, exit code
  or the all-or-nothing and concurrency re-apply behavior.
- No new CLI flags. Do not relax any existing deadline. No Rust change
  unless the profile proves a host cost; in that case stop and report it as
  a Step-5 blocker, because Rust paths are not owned here.
- Do not touch `shapes/connector/boundary.ts`, `route.ts` or `label-box.ts`
  (clm-05 owns them in wave 2).

## Tasks

1. Fixture generator, `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`.
   - Export `obstacleRoutingBatch(): { document: string; operations: string }`.
   - Build it with `new Editor()` and `createElement`. The default page must
     have kind `state`; follow how existing fixtures set kind, for example
     `apps/cli/src/__fixtures__/dense-relations.ts`.
   - Contents: 3 frames named `Stage0` to `Stage2` with fixed integer
     geometry, 20 `state.node` elements (`Idle`, `Running`, `Paused`,
     `Done`, ... plus numbered names, one with kind `initial`) placed inside
     the frames, and 50 `state.transition` elements between deterministic
     pairs (for example `i % 20` to `(i * 7 + 3) % 20`, skipping
     self-pairs), each with a `trigger` label, `routing: "orthogonal"` and
     `routingAvoidObstacles: false`.
   - Operations: 50 `update` operations with
     `semantic: {routingAvoidObstacles: true}`.
   - Ids must be fixed strings (pass `id`) so the output is deterministic.
2. Baseline. Before changing any source:
   - Run the edit with Bun against the fixture and commit nothing. Write
     the result to `obstacle-routing-batch.expected.jsonl`.
   - Build the release binary and time it with
     `/usr/bin/time -p target/release/nodetto-cli edit <tmp doc> --ops <tmp ops>`,
     saving to `tmp/clm-s725/clm-02-edit-perf/baseline-native.log`.
   - If it runs over 300 s, stop it at 300 s and record "> 300 s".
3. Profile.
   - Run `bun --cpu-prof` on the Bun edit, and add temporary timing
     counters if needed. Remove them before you finish.
   - Record the top self-time functions and which work repeats per
     operation in the progress log as "Confirmed root cause".
4. Fix only the confirmed cause, with one of the techniques the design
   allows:
   - per-batch memoisation keyed by unchanged inputs;
   - skipping planners whose triggers cannot fire for the given commands;
   - avoiding per-operation full-store copies.
   Keep every cache invariant correct: a cache key must include everything
   the cached value depends on (element object identity, store version,
   page). Do not cache across documents or across `Editor` instances in a
   way that leaks memory in the app. Prefer `WeakMap` keyed by store or
   element objects.
5. Tests:
   - `apps/cli/src/edit-performance.test.ts` (Bun, through `runCli` with an
     in-memory io, or by spawning `bun main.ts`): the output equals the
     expected file exactly, and it finishes in under 10000 ms.
   - `apps/cli/src/native-parity/edit-performance.test.ts`: spawn the binary
     in a temp dir (spawn timeout 60000, test timeout 120000). Assert exit 0,
     that the written file equals the expected file, that wall time is
     under 10000 ms, and that stdout and stderr match the Bun run
     (`compare` pattern in `native-parity/harness.ts`).
6. Final manual timing: `/usr/bin/time -p` on the new release binary, saved
   to `after-native.log`. Report the ratio against the baseline. The target
   is about 3 s of CPU time or less.

## Pitfalls

- The 10 s deadline is new. Never edit existing deadlines (for example
  `native-parity/documents.test.ts` 20000).
- Byte-identical means exact string equality with the expected file
  generated before the change. Do not regenerate the expected file after
  the fix.
- Under load, give a native deadline timeout 3 attempts before calling it
  a failure, and record each attempt.
- Do not add regex `split` over the document. Do not destructure points in
  routing loops.
- If `bun run typecheck` or the native `cargo build` fails only because of
  a sibling plan's in-progress file, record the drift in the progress log
  and rerun later. `apps/cli/native/build.rs` bundles the shared TS
  engine, so a sibling's broken file can break the native build. Never edit
  that file.
- Every existing core and CLI test must still pass, especially
  `packages/core/src/frame*.test.ts`, the connector tests and
  `apps/cli/src/edit/apply-batch.test.ts`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit-performance.test.ts apps/cli/src/edit/apply-batch.test.ts apps/cli/src/edit/report.test.ts`.
2. `bun test packages/core/src/frame-translation.test.ts packages/core/src/frame-tree.test.ts packages/core/src/frame-membership.test.ts packages/core/src/connector-endpoints.test.ts packages/core/src/connector-policy.test.ts`.
3. `bun test packages/core/src/orthogonal-routing.test.ts packages/core/src/manual-route-preservation.test.ts packages/core/src/frame.test.ts packages/core/src/frame-selection.test.ts packages/core/src/connector-outlines.test.ts packages/core/src/svg-export.test.ts packages/io/src/jsonl/golden.test.ts`.
   These existing tests cover the modules this plan owns. All of these
   files exist at HEAD 196f9f5.

   This plan does not run the full core suite, because wave-1 siblings
   (clm-01, clm-03 and clm-07) edit core sources and tests at the same
   time. clm-05 runs `bun test packages/core/src packages/io/src` in wave 2,
   and integration runs `mise run verify`.
4. `bun run typecheck`.
5. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts`.
   It must run more than 0 tests, and all must pass. Use up to 3 attempts
   on a deadline timeout.
6. `bunx biome check <owned TS files>`.

## Done criteria

- The progress log contains: the baseline timing, the confirmed root cause,
  the after timing (CPU time from `/usr/bin/time -p`) and the ratio.
- The Bun and native deadline tests pass, and the expected file is
  unchanged since its creation (record its hash before and after).
- `git diff --stat` shows only writePaths.
