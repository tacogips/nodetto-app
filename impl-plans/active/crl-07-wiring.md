# crl-07-wiring

- planId: crl-07-wiring
- planPath: impl-plans/active/crl-07-wiring.md
- progressPath: impl-plans/progress/crl-07-wiring.md
- wave: 1 of the amended manifest (wave 3 of the original set; final wiring, runs alone)
- dependsOn: none pending. crl-01 to crl-06 are `acceptedDependencies` in the manifest (see the Amendment section).
- Design: `design-docs/specs/design-connector-routing-arranging.md`, sections "`arrange` report", "`lint --fix`", "Boa and performance", "Fixture and acceptance tests".
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `packages/core/src/index.ts`
  - `apps/cli/src/arrange-modes.ts`
  - `apps/cli/src/arrange-modes.test.ts`
  - `apps/cli/src/lint-diagram.ts`
  - `apps/cli/src/lint-diagram.test.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/commands.test.ts`
  - `apps/cli/src/cli-wiring.test.ts`
  - `apps/cli/src/help.ts`
  - `apps/cli/src/connector-arrange.test.ts` (new)
  - `apps/cli/src/native-parity/connector-arrange.test.ts` (new)
  - `docs/cli.md`
  - `docs/editing.md`
  - `README.md`
  - `packages/core/src/arrange-route.ts`
  - `packages/core/src/arrange-route.test.ts`
  - `packages/core/src/arrange-route-lanes.ts`
  - `packages/core/src/arrange-route-lanes.test.ts`
  - `packages/core/src/arrange-layered.ts`
  - `packages/core/src/arrange-layered.test.ts`
  - `packages/core/src/arrange-layered-order.ts`
  - `packages/core/src/arrange-layered-order.test.ts`
  - `packages/core/src/connector-label-placement.ts`
  - `packages/core/src/connector-label-placement.test.ts`
  - `apps/cli/src/connector-arrange-route.test.ts`
  - `impl-plans/progress/crl-07-wiring.md`
  - `tmp/crl-s749/crl-07-wiring`
  - `target`
- sharedPaths: none
- artifactRoots: `target`
- The `packages/core/src/arrange-*` and `connector-label-placement.*` paths and `apps/cli/src/connector-arrange-route.test.ts` are for serial repair only, if an acceptance test here shows a defect. Record each such edit with the failing test. Do not change `apps/cli/src/__fixtures__/connector-arrange.ts`.

## Amendment 2026-11-06 (blocked-wave-scope-or-contract, round 1)

Blocker: the first dispatch of this plan stopped before any edit, reporting that `crl-05-lanes-self-loops` was in `fanoutItem.dependsOn` but not in `fanoutItem.acceptedPlanIds`.

Findings:

- The recorded dispatch item contradicts that report. `tmp/opus-terra-waves/opus-terra-design-and-implement-review-loop-session-749/wave-007/fanout-join.json`, `/branches/0/item/acceptedPlanIds`, lists all six plans, including crl-05.
- `wave-006/wave-summary.json` classifies crl-05 as `successful`, and its test-integrity and adversarial reviews both accepted it. Why the worker read the list differently could not be determined from the recorded artifacts.

Decisions:

1. Authority. crl-01 to crl-06 are recorded as `acceptedDependencies` in `impl-plans/active/crl-s749-dispatch.json`, and this plan's `dependsOn` is empty. There is no pending dependency to admit. Do not stop for dependency readiness.
2. State of the accepted work. It is uncommitted on the shared working tree, on top of checkpoint `d4843e58b679160142ac07225bcf4b4519f17433`, so `commit` is null in those entries. Read it from the working tree. Do not expect it in `git log`, and do not commit, stash or reset it.
3. Provisional wording is not a blocker. The crl-05 progress log says independent review is pending, and wave 6 calls acceptance provisional until the serial integration review. Neither stops this plan.
4. Readback. Before the first edit, record `git hash-object` in the progress log for `packages/core/src/arrange-route.ts` and `packages/core/src/arrange-route-lanes.ts`, and compare them with the crl-05 log values `9c194325aefa9f8ca16471a476ba268772527b1a` and `4b1319eb2d09532fddfc548a1464307d516d8326`. Record a mismatch as drift and continue on the current file.
5. A real blocker is one of these: a pinned contract symbol from crl-00 missing from the working tree, a needed edit outside `writePaths`, or a verification failure with no repair inside `writePaths`. Name the file and symbol, or the failing command and its log path.
6. Repair scope. This plan is expected to measure the fixture first. A wave-006 review probe of rank-order `planLayered` then `planRoute`, without `selectLayeredOrder`, gave 1 label overlap, 11 segment overlaps and 196 crossings, against an input of 604 crossings in the crl-05 log. If the wired result is above 0 for either overlap metric, repair within the serial repair paths or document the bound with its geometric reason in `docs/cli.md`, as acceptance already requires. The sibling test files are authorized so a repair can keep or extend their regression tests. An existing assertion changes only under the crl-00 rebaseline rule.

No design change. Plan id, scope, acceptance criteria and existing verification commands are unchanged, apart from added verification 8.

## Amendment 2026-11-06 (blocked-wave-scope-or-contract, round 2)

Blocker: the native parity gate (verification 4) exited 1 with 15 pass and 2 fail, evidence fingerprint `db73444dfc87eaaf224a029e2bf97b57d89854514e8046fc59eba79286547b8c`, log `tmp/crl-s749/crl-07-wiring/native-attempt.log`.

Findings:

- `bun test <path>` treats a path as a filter that matches anywhere in the discovery tree, and it does not skip `target`. The filter `apps/cli/src/native-parity/layout.test.ts` therefore also selected `target/crl-baseline/src/apps/cli/src/native-parity/layout.test.ts`.
- Both failures come from that archived copy. It expects the old metrics line without `overlapping segment pair(s)`, so the failures say nothing about the current code.
- The same mechanism applies to `bun test apps/cli/src` in `mise run test-cli` and to bare `bun test` in `mise run verify`. Those two gates were not run, so this part is reasoned from the first result. Changing only verification 4 to a `./` path would not fix them.
- Outside `target/crl-baseline/src`, `target` and `tmp` hold no file matching a Bun test name pattern (checked with `find`, excluding `node_modules`).

Decisions:

1. Baseline storage. `target/crl-baseline/src` is a disposable build input, not part of the audit. The audit is the progress log record, the binary `target/crl-baseline/nodetto-cli`, and commit `1e8f43d224d7b43e200eb2229e7be17b39ca033c`, from which the source can be regenerated.
2. Do this first, before any other gate. Check that `shasum -a 256 target/crl-baseline/nodetto-cli` equals the recorded `c8f5c9049d8877d9e277e55c97ec4f76012b6adf6f7201a3440368f1aad2afa0`, run `rm -rf target/crl-baseline/src`, check the digest again, and record the command, its exit code and both digests under "Baseline audit" in the progress log. Do not rebuild while the digest matches. Keep `target/crl-baseline/nodetto-cli` and `target/crl-baseline/build`.
3. If the digest does not match, follow the baseline steps under "CPU comparison and timing", including step 4, and record again.
4. Do not change these to work around discovery: `bunfig.toml`, `mise.toml`, `package.json`, the verification command strings, or the archived test files. Do not skip or delete any test outside `target/crl-baseline/src`.
5. A native result counts only if its log shows no `target/crl-baseline` path. If such a path appears, stop and find out why before reading the result.
6. Continue from the working tree. The partial edits recorded in the progress log are uncommitted and stay in place, so do not restart them. Move the existing `tmp/crl-s749/crl-07-wiring/final/` to `attempt-<n>/` before repeating gates.
7. Work still owed, none of it blocked by a dependency: fixture repair (3 segment overlaps and 2 label overlaps remain, and `lint --fix` leaves those 2 label overlaps), the remaining tests in "Tests", native timing and CPU ratios, and verification 1 to 9 on final source. Amendment round 1 decision 6 still governs the overlap repair. A documented bound needs the connector ids involved and the geometric reason, and "no free position was found" is not a reason on its own.
8. The shared amendment budget (2 rounds) is now used up, so another blocked wave ends this workflow. Stop only for a blocker as defined in round 1 decision 5, and report the failing command, log path, and the file and symbol involved.

No design change. Plan id, write paths and acceptance criteria are unchanged. Added: baseline step 4, verification 9 and two done criteria.

## Intent and context

Connects the core modules to the CLI, documents everything, and measures acceptance on the fixture in both CLIs.

## Non-goals

- No new behavior beyond the design. No app or desktop change. No Rust change.
- `edit --arrange` keeps running Tidy only.
- Do not relax a deadline. Do not list a binary-less native command.
- `impl-plans/README.md` and plan archiving are handled at finalization, not here.

## File-level changes

`packages/core/src/index.ts`: export `selectLayeredOrder`, `planLabelFixes`, and the types `LabelMoveFix`, `LabelFields`, `LayeredEvaluate`. Keep the hunk small.

`apps/cli/src/arrange-modes.ts`:

- The non-BPMN layered path uses `selectLayeredOrder`. Its `evaluate(draft)` always runs `planRoute(draft, page.id, editor.registry, {resetManual: true, separation: false})`, whatever the user's flag, applies with `applyCommands` to the same draft, and returns `pageMetrics(draft, page.id, editor.registry)`. The metric then depends on layout only, because crl-05 adds `routingLane` and the label offsets to `resetFields`. `applyCommands` is needed from `@nodetto/core`; export it in `index.ts` if it is not exported.
- Manual connectors are measured as automatic during selection only. Nothing from `evaluate` leaves the draft, and without `--reset-manual` they stay untouched in the final route.
- The later `planRoute` call stays as is: the user's `--reset-manual` controls it, and separation defaults on. The `--ids` handling is unchanged.
- Report: snapshot the three label fields of page connectors before `planRoute`, compare after apply. In non-`--check` runs with moved labels, append to stderr, in stable id order: `Moved <n> connector label(s): <id>, <id>\n`. This covers both `--write` and stdout output. `--check` output and exit codes do not change.

`apps/cli/src/lint-diagram.ts`:

- One combined batch, written once. When `options.fix`:
  1. Build the wrap operations from `planTextWrapFixes` as today.
  2. If there are wrap operations, get the post-wrap document in memory: `applyBatch(io.readText(documentPath), wrapOperations, false)` (exported from `apps/cli/src/edit/apply-batch.ts` and re-exported by `edit-command.ts`; the same call `runOperations` makes), then parse `result.text`. With no wrap operations, use the input `document`. A read, batch or parse failure returns the existing error shape with nothing written.
  3. Call `planLabelFixes` on that document for each page in `ROUTE_PAGE_KINDS`, within `options.pageId`.
  4. Call `runOperations` once with the wrap operations followed by the label `update` operations, where each semantic sets the `after` values and sets `null` for keys in `before` that are absent in `after`. Skip the call when both lists are empty.
  5. Reload `currentDocument` as today after the write. Return `fixes` as wrap entries followed by label moves.
- `DiagramLintResult.fixes` becomes `readonly (TextWrapFix | LabelMoveFix)[]`. `formatFixLines` emits `fixed <id> label-collision: moved label` for moves, with the existing line for wraps, using a type guard on `ruleId`.
- `.bpmn` keeps its error before anything runs. `written` is true if the one write happened.

`apps/cli/src/commands.ts`: the `summary.metrics` reduce adds `segmentOverlaps`.

`apps/cli/src/help.ts` and `docs/cli.md`, plus `docs/editing.md` only if it lists connector fields, and `README.md` only where it lists these features:

- `connect` fields `routing`, `routingAvoidObstacles`, `visual` behavior, and the precedence line, verbatim: explicit field > page default > page convention > existing default.
- The convention rule.
- `set-page-routing` with an example, `add-page` `connectorRouting`, and the rejection of `manual`.
- Semantic fields `routingLane`, `labelOffsetX`, `labelOffsetY`, with a note that arranging writes them.
- Routing written under `visual` is honored, and `semantic` is the supported place.
- `segmentOverlaps` and the new metrics text, replacing the old text at `help.ts:599-601`.
- `arrange` route and layered separate routes, order members, place labels and report moves. Reruns need `--reset-manual` after moving elements.
- `lint --fix` moves labels.
- Self-loop side order `top`, `right`, `bottom`, `left`, the freed side rule, and the fallback.
- The candidate definition of "free position", and any bound measured on the fixture.
- A crossings statement: reduced where a candidate is better, not a general guarantee.

## What a careless implementation gets wrong

- `planRoute` copies the store it gets. `evaluate` must apply the returned commands to the draft before measuring.
- A moved-label report based on the command count would include ports. Compare the label fields.
- `lint` JSON keeps `fixes` only with `--fix`. Existing wrap entries keep their shape.
- `commands.ts` reloads when `diagram.written`. Keep the metrics computed after the fix.
- `evaluate` always resets on its draft, so runs compare on one basis. Do not pass the user's flag to it: stored ports from an earlier run would make a second `layered` measure stale routes and move members. The user's `--reset-manual` controls only the final `planRoute`.
- `lint --fix` writes at most once, and a failed batch writes nothing. Do not write wraps first and labels second: `apps/cli/src/lint-diagram.test.ts` "fix writes once" pins one write, is not on the rebaseline list, and must stay unchanged.
- Native parity on arrange compares bytes: the fixture has fixed ids and arrange creates nothing, so a difference is a real defect.
- Raster: do not add raster assertions. These tests assert on SVG geometry and metrics.

## Tests

`apps/cli/src/connector-arrange.test.ts`, using `connectorArrangeDocument`, imitating `apps/cli/src/arrange-modes.test.ts`. Print the before and after metrics to the progress log:

- `arrange --mode layered --page States --write`, then `arrange --mode route --page States --write` -> `segmentOverlaps` 0 (or the bound documented in `docs/cli.md` with the geometric reason), `labelOverlaps` 0, `edgeCrossings` not above the input baseline.
- Second `--mode route` -> "0 layer update(s)".
- Second `--mode layered` -> "0 layer update(s)".
- Small two-frame page where `barycenter` or `input` strictly beats `rank`: `layered --write`, then `layered --check` -> exit 0, and a second `--write` -> "0 layer update(s)".
- Same page with a manual connector, `layered` without `--reset-manual` -> that connector's stored semantic is unchanged, apart from label fields the route stage already places (baseline A2).
- On the arranged fixture, no route segment enters the box of a state that is not one of its endpoints.
- Each `loop-*` on a side no other connector end on that state uses, or the documented shared case, and its label box scores 0.
- Stderr names moved labels when labels moved.
- `--check` on the arranged page -> exit 0; `--check` on the input -> exit 1 with no `Moved` line.
- Fixture with labels forced into overlap, `lint --fix --metrics --format json` -> `labelOverlaps` 0 on `States`, `fixes` lists moves, second run -> no fixes.
- Architecture page with a `label-collision` finding, `lint --fix` -> finding gone.
- In `apps/cli/src/lint-diagram.test.ts`, add a test: a document with both wrap and label fixes -> exactly one `writeText` call, rerun -> none, and `formatFixLines` includes both `line break(s)` and `moved label`. The existing "fix writes once" assertion stays as it is.
- A label batch that fails -> nothing written and the wrap fixes are not saved.
- `.bpmn` with `--fix` -> exit 2, unchanged.
- Architecture: `connect` `box-a` to `box-b` with `routing: orthogonal` and `routingAvoidObstacles: true`, then `export --format svg` -> polyline equals `resolveConnector` points, no segment enters `box-c`, two exports byte-identical.
- The same with `set-page-routing` and a plain `connect`.
- The same with an existing edge stored with `visual` routing keys, loaded from JSONL.
- `lint --metrics` text and JSON include `segmentOverlaps` per page and in the summary.

`apps/cli/src/native-parity/connector-arrange.test.ts`, using `compareFile` or `compare` from `./harness.ts` and `nativeTest`:

- `arrange --mode layered --page States`, then `--mode route`, each from a copy -> byte-identical stdout, stderr and exit codes.
- `lint --metrics --format json` on the arranged document -> byte-identical.
- `export --format svg` of the architecture connector -> byte-identical.
- `lint --fix` on a copy -> same exit code and bytes.
- Use a generous spawn timeout. Do not add a new timing assertion.

## CPU comparison and timing

Baseline, built once:

1. `git archive 1e8f43d224d7b43e200eb2229e7be17b39ca033c` into `target/crl-baseline/src`.
2. `bun install --frozen-lockfile` there, then `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path target/crl-baseline/src/Cargo.toml --target-dir target/crl-baseline/build`.
3. Copy the binary to `target/crl-baseline/nodetto-cli`.
4. Record the sha256, then `rm -rf target/crl-baseline/src`, so its test files stay out of Bun test discovery. Only this subdirectory is removed.

Audit record, in `impl-plans/progress/crl-07-wiring.md`: the source commit, the `bun --version` and `cargo --version` output, the exact archive, install, build and removal commands with exit codes, and the sha256 of `target/crl-baseline/nodetto-cli` (`shasum -a 256`). Reuse an existing binary only when its sha256 equals the recorded value. Otherwise rebuild it and record again.

Measure with three `/usr/bin/time -p` runs each, baseline and current, on the batch and mixed fixtures used by `apps/cli/src/native-parity/edit-performance.test.ts`. Record user seconds and mean ratios. Then time the current binary on layered then route with the fixture from `bun apps/cli/src/__fixtures__/connector-arrange.ts`, on a copy, target a few seconds total. Record numbers in the progress log. A result above a few seconds is a repair item (hot loops first), not a reason to relax anything.

## Verification (each must exit 0)

1. `bun test apps/cli/src/connector-arrange.test.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-diagram.test.ts apps/cli/src/lint-metrics.test.ts apps/cli/src/cli-wiring.test.ts` -> 0 fail.
2. `bun run typecheck`.
3. `bunx biome check apps/cli/src/arrange-modes.ts apps/cli/src/lint-diagram.ts apps/cli/src/connector-arrange.test.ts apps/cli/src/native-parity/connector-arrange.test.ts`.
4. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/connector-arrange.test.ts apps/cli/src/native-parity/layout.test.ts apps/cli/src/native-parity/edit-performance.test.ts'` -> 0 fail, 0 skip. Retry up to 3 attempts on a deadline timeout.
5. `test -x target/crl-baseline/nodetto-cli`.
6. `CARGO_TERM_QUIET=true mise run verify` -> exit 0, with the log kept.
7. `CARGO_TERM_QUIET=true mise run test-cli` -> exit 0, native parity not skipped. Retry up to 3 attempts on a deadline timeout.
8. `bun test packages/core/src/arrange-route.test.ts packages/core/src/arrange-route-lanes.test.ts packages/core/src/arrange-layered.test.ts packages/core/src/arrange-layered-order.test.ts packages/core/src/connector-label-placement.test.ts apps/cli/src/connector-arrange-route.test.ts` -> 0 fail, with or without serial repairs.
9. `test ! -e target/crl-baseline/src` -> exit 0, which shows the archived source is out of test discovery.

## Done criteria

- Verification 1-9 exit 0 with complete logs recorded. Verification 4, 6 and 7 write `tmp/crl-s749/crl-07-wiring/final/native.log`, `final/verify.log` and `final/test-cli.log`.
- `grep -l "target/crl-baseline" tmp/crl-s749/crl-07-wiring/final/native.log tmp/crl-s749/crl-07-wiring/final/verify.log tmp/crl-s749/crl-07-wiring/final/test-cli.log` lists no file.
- The "Baseline audit" section of the progress log records the removal command, its exit code, and the digest before and after removal, both equal to the recorded value.
- The progress log holds the amendment readback hashes for `arrange-route.ts` and `arrange-route-lanes.ts`, with any drift noted.
- `grep -n "segmentOverlaps" apps/cli/src/commands.ts apps/cli/src/help.ts docs/cli.md` matches in each file.
- `grep -n "set-page-routing" apps/cli/src/help.ts docs/cli.md` matches in each file.
- `grep -n "routingLane" apps/cli/src/help.ts docs/cli.md` matches in each file.
- `git diff --stat apps/cli/src/__fixtures__/connector-arrange.ts` shows no change from this plan.
- The progress log holds before and after fixture metrics, the CPU ratios and the native timing.
- The progress log holds the baseline audit record, and `shasum -a 256 target/crl-baseline/nodetto-cli` matches its recorded digest.
- The "fix writes once" test in `apps/cli/src/lint-diagram.test.ts` is unchanged: its `expect(writes).toBe(1)` line is still present.
