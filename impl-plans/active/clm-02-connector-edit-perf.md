# clm-02-connector-edit-perf

## Continuation 2026-11-04 (clm-s731) - authoritative for the remaining work

This section supersedes the header fields below (wave, writePaths,
verification and evidence paths) for the clm-s731 run. The sections below it
are history: the IR fields, resolver changes, `pointAlongRoute`,
`connectorLabelBoxAt`, the same-side self-loop, the single-page fixture and
its Bun and native tests are landed at HEAD 4d82d91 and accepted. Do not
redo them.

- wave: 1; dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, "A7
  continuation: per-operation cost must be bounded by the edited page", E1
  "Mechanics" (engine part), contracts in "Continuation contracts" (clm-02
  block), Verification rows "A7 continuation" and E1 (engine).
- writePaths (clm-s731):
  - `packages/core/src/editor/transaction.ts`
  - `packages/core/src/editor/types.ts`
  - `packages/core/src/editor.ts`
  - `packages/core/src/store.ts`
  - `packages/core/src/constraints.ts`
  - `packages/core/src/frame-translation.ts`
  - `packages/core/src/frame-tree.ts`
  - `packages/core/src/auto-layout.ts`
  - `packages/core/src/text-layout.ts`
  - `packages/core/src/text-styles.ts`
  - `packages/core/src/color-tokens.ts`
  - `packages/core/src/number-tokens.ts`
  - `packages/core/src/aspect-ratio.ts`
  - `packages/core/src/auto-component-refresh.ts`
  - `packages/core/src/uml-ports.ts`
  - `packages/core/src/manual-route-preservation.ts`
  - `packages/core/src/bpmn/containment.ts`
  - `packages/core/src/breadboard/board-carry.ts`
  - `packages/core/src/pcb-board/follow.ts`
  - `packages/core/src/keep-members.test.ts` (new)
  - `packages/core/src/dirty-pages.test.ts` (new)
  - `apps/cli/src/edit/apply-batch.ts`
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.multi-page.expected.jsonl` (new)
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.mixed-multi-page.expected.jsonl` (new)
  - `apps/cli/src/edit-performance.test.ts`
  - `apps/cli/src/native-parity/edit-performance.test.ts`
  - `impl-plans/progress/clm-02-connector-edit-perf.md`
  - `tmp/clm-s731/clm-02-connector-edit-perf`
  - `target`
- sharedPaths: none; artifactRoots: `target`
- Read-only and never edited: `apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl`
  (its git hash must stay `341fcd8654fc18d560c8895df1a05617a6b8ac39`),
  `target/clm-baseline/nodetto-cli` (never delete; never `cargo clean`), and
  every file owned by another clm-s731 plan (notably `bpmn/notation.ts`,
  `arrange-*.ts`, `apps/cli/src/edit/batch.ts`, `operations/*.ts`).
- Only files the profile shows are needed are edited; an untouched writePath
  is fine. If the fix needs a file outside this list, stop and record an
  amendment request in the progress log; do not edit it.

### Part 1: multi-page fixtures and expected output (before any source change)

- Extend `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` with exported
  builders `obstacleRoutingMultiPage()`, `obstacleRoutingMixedMultiPage()` and
  `obstacleRoutingMixedSinglePage()` returning `{ document, operations }`
  like `obstacleRoutingBatch()`. `obstacleRoutingBatch()` output must stay
  byte-identical.
  - multiPage: the single-page document plus a second page `Grid`
    (`kind: "freeform"`) with 600 `node.generic` labelled `Widget000` to
    `Widget599` on a 30 x 20 grid (fixed integer x/y/width/height, ids
    deterministic), and 300 `edge.generic` between horizontal grid
    neighbours (`routing: "orthogonal"`, `routingAvoidObstacles: true`).
    Ops: the same 50 updates.
  - mixedMultiPage: the multiPage document, ops in fixed interleaved order:
    20 `move` of `state.node`, 3 `update` frame moves (`visual.x/y`), 50
    connector updates setting `routingAvoidObstacles: true`.
  - mixedSinglePage: the same mixed ops on the single-page document.
- Capture expected output with the HEAD code before editing any source file:
  run Bun `runCli edit` on multiPage and mixedMultiPage and write the two
  `.expected.jsonl` files; record `git hash-object` of both. Cross-check with
  `target/clm-baseline/nodetto-cli edit <doc> --ops <ops> --output <file>` (or
  its stdout form) and `cmp` -> identical; record in the progress log.
- Baseline timings with `/usr/bin/time -p` on the current HEAD release build
  (`CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`) and on
  `target/clm-baseline/nodetto-cli` for all four ops sets (single, multiPage,
  mixedSingle, mixedMulti), written to
  `tmp/clm-s731/clm-02-connector-edit-perf/baseline-timing.log`. Run docs from
  `tmp/clm-s731/clm-02-connector-edit-perf/work/` (only .jsonl/.json data).

### Part 2: profile, then dirty-page planning

- Profile the multiPage and mixedMultiPage batches with Bun
  (`bun --cpu-prof`) and record the top self-time and total-time frames in
  the progress log. Confirm which of the design's listed sites dominate:
  `planDerivedCommands` full snapshot sort/copy and `beforeLayout` copy,
  `planConstraints` `frameParents` over every page, `planFrameTranslations`
  over every page, the BPMN/breadboard/PCB guards that scan `listElements`,
  token/style/layout planner scans, `applyBatch` per-op full maps.
- Implement the design rule: per `editor.apply`, dirty pages = pages of
  elements created/updated/deleted by permitted commands, plus pages touched
  by page commands. Every derived planner considers only dirty pages and
  must produce exactly the same commands, in the same order, as today.
  Widen to the whole document (today's behavior) when: any page command is
  permitted; a changed element is `design.token` or `design.text-style`; a
  changed element is a component master read by `planAutoComponentRefresh`;
  or a changed element's id is referenced by an element on another page
  (registry `references(semantic)`).
- Allowed techniques: page-scoped iteration (`store.getPageElements`),
  page-scoped drafts or copy-on-write, per-batch memoization keyed by
  unchanged inputs, store diffs instead of full maps in `applyBatch`. Not
  allowed: changing planner order, changing command order within a page,
  skipping a planner on a dirty page, relaxing validation.
- Record each planner's trigger scope (same-page only or cross-page) as a
  table in the progress log.

### Part 3: `keepMembers` (E1 engine)

- `packages/core/src/editor/types.ts:ApplyOptions` gains
  `readonly keepMembers?: ReadonlySet<ElementId>`; `editor.ts` forwards it;
  `DerivedPlanInput` gains `readonly keepMembers: ReadonlySet<ElementId> | undefined`.
- `planFrameTranslations`: treat `keepMembers` like `placed` (pass the union).
- `planConstraints(before, after, registry, onlyIds?, keep?)`: never move an
  element in `keep`.
- `planBpmnTranslations(before, after, keep?)`, `planBreadboardTranslations(before, draft, keep?)`:
  skip ids in `keep`.
- `planBpmnMembership(before, after, reparent?)`: re-evaluate the parent of
  every id in `reparent` even if it did not move (same geometric rule).
- Pass `keepMembers` at both `planFrameTranslations`/`planConstraints` call
  sites in `planDerivedCommands`. `planReconciliation` is unchanged.
- Without the option, every output is byte-identical.

### Tests (input -> expected)

- `apps/cli/src/edit-performance.test.ts`: single-page test unchanged; new
  tests for multiPage and mixedMultiPage -> exit 0, output byte-identical to
  the new expected files, each under 10000 ms.
- `apps/cli/src/native-parity/edit-performance.test.ts`: the same two fixtures
  with `NODETTO_CLI_TEST_BINARY`, each under 10000 ms (spawn timeout 60000,
  test timeout 120000), output equal to the expected files. Existing
  deadlines unchanged.
- `packages/core/src/dirty-pages.test.ts`: a two-page document; an update on
  page 1 leaves page 2 elements identical and produces the same commands as
  the pre-change code for page 1 (compare against an expected command list
  captured before the change); each widening case (design.token change,
  design.text-style change, component master change, cross-page reference,
  add-page) still updates the dependent element on page 2.
- `packages/core/src/keep-members.test.ts`: per planner, with and without
  `keepMembers`: frame move and frame resize with a constrained child; pool
  move (lanes follow, tasks kept, tasks re-parented); lane height change
  (sibling lane members still carried); sub-process move; board move. Without
  the option, results equal the current behavior.

### Verification (each must exit 0)

1. `bun test apps/cli/src/edit-performance.test.ts apps/cli/src/edit/apply-batch.test.ts packages/core/src/dirty-pages.test.ts packages/core/src/keep-members.test.ts`
2. `bun test packages/core/src/frame-translation.test.ts packages/core/src/frame-tree.test.ts packages/core/src/frame-membership.test.ts packages/core/src/frame.test.ts packages/core/src/constraints.test.ts packages/core/src/auto-layout.test.ts packages/core/src/text-layout.test.ts packages/core/src/store-commands.test.ts packages/core/src/manual-route-preservation.test.ts packages/core/src/bpmn/containment.test.ts packages/core/src/bpmn/editor-bpmn.test.ts packages/core/src/breadboard/board.test.ts packages/core/src/breadboard/editor-breadboard.test.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/svg-export.test.ts packages/io/src/jsonl/golden.test.ts`
3. `bun test packages/core/src/editor.test.ts packages/core/src/editor-ux.test.ts apps/cli/src/commands.test.ts apps/cli/src/edit-frame-carry.test.ts`
4. `bun run typecheck`
5. `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/native-[123].log "$d/native.log"; CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli > "$d/native-build.log" 2>&1 || exit 1; for i in 1 2 3; do NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts > "$d/native-$i.log" 2>&1 && cp "$d/native-$i.log" "$d/native.log" && exit 0; done; exit 1' sh tmp/clm-s731/clm-02-connector-edit-perf/final`
6. `grep -E '^ *[1-9][0-9]* pass$' tmp/clm-s731/clm-02-connector-edit-perf/final/native.log` and `grep -E '^ *0 fail$' tmp/clm-s731/clm-02-connector-edit-perf/final/native.log`
7. `sh -c 'test "$(git hash-object apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl)" = 341fcd8654fc18d560c8895df1a05617a6b8ac39'`
8. `test -x target/clm-baseline/nodetto-cli`
9. `bunx biome check <every edited TS file of this plan>` (list them explicitly in the progress log and the command).
10. Manual timing (recorded, not a gate command): `/usr/bin/time -p target/release/nodetto-cli edit ...` for the four ops sets into `tmp/clm-s731/clm-02-connector-edit-perf/after-timing.log`; report user CPU for multiPage / single and mixedMulti / mixedSingle (target <= 1.5 each) and the ratio against the baseline binary.

### Done criteria

- Expected files captured before source edits, hashes recorded and unchanged
  at the end; profile evidence and the planner scope table recorded.
- Verification 1-9 exit 0; the manual ratios recorded. If a ratio exceeds 1.5,
  record it as an unmet target with the profile showing the remaining cost;
  do not mark the plan done.
- `git status --short` shows only clm-s731 writePaths of this plan changed by
  this plan.

---

- planId: clm-02-connector-edit-perf
- planPath: impl-plans/active/clm-02-connector-edit-perf.md
- progressPath: impl-plans/progress/clm-02-connector-edit-perf.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections
  "Shared IR additions (connector semantics)" and A7, plus the "IR fields"
  and A7 rows of "Verification".
- This plan merges the drafts clm-02-edit-perf and clm-05-connector-fields,
  which both edited `shapes/connector/resolve.ts`.
- writePaths:
  - `packages/ir/src/semantics/connectors.ts`
  - `packages/ir/src/registry/generic.ts`
  - `packages/ir/src/registry/uml.ts`
  - `packages/ir/src/registry/erd.ts`
  - `packages/ir/src/registry/bpmn.ts`
  - `packages/ir/src/connector-positions.test.ts` (new)
  - `packages/core/src/shapes/connector/resolve.ts`
  - `packages/core/src/shapes/connector/boundary.ts`
  - `packages/core/src/shapes/connector/route.ts`
  - `packages/core/src/shapes/connector/label-box.ts`
  - `packages/core/src/connector-positions.test.ts` (new)
  - `packages/core/src/orthogonal-routing.ts`
  - `packages/core/src/frame-translation.ts`
  - `packages/core/src/frame-tree.ts`
  - `packages/core/src/manual-route-preservation.ts`
  - `packages/core/src/editor/transaction.ts`
  - `apps/cli/src/edit/apply-batch.ts`
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` (new)
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl` (new)
  - `apps/cli/src/edit-performance.test.ts` (new)
  - `apps/cli/src/native-parity/edit-performance.test.ts` (new)
  - `impl-plans/progress/clm-02-connector-edit-perf.md`
  - `tmp/clm-s725/clm-02-connector-edit-perf`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Amendment 2026-11-04 (blocked-wave-scope-or-contract, round 1)

- Blocker: the baseline binary location
  `tmp/clm-s725/clm-02-connector-edit-perf/nodetto-cli-baseline` sat inside a
  source path. The shared-write protocol forbids binaries under source paths.
- Decision: the pre-change baseline binary goes to
  `target/clm-baseline/nodetto-cli`, inside the existing artifact root
  `target`. writePaths and artifactRoots do not change. Logs
  (`baseline-native.log`, `after-native.log`) stay as text files under
  `tmp/clm-s725/clm-02-connector-edit-perf/`.
- "Pre-change" means the current shared tree before any clm-02 source edit.
  That tree already contains the accepted clm-01, clm-03, clm-04 and clm-08
  changes, which is expected. Build the baseline first, before task 1's
  expected-output capture changes anything.
- Do not run `cargo clean` or delete `target/clm-baseline`. clm-09 reads it
  for the final timing comparison.
- Verification: the check `test -x tmp/clm-s725/clm-02-connector-edit-perf/nodetto-cli-baseline`
  is replaced by `test -x target/clm-baseline/nodetto-cli`.
- No design change.

## Intent and context

Part 1 (A7): an `edit` batch of about 50 `update` operations that set
`routingAvoidObstacles: true`, on a state page with about 20 states and 3
frames, takes more than two minutes natively. Fix it to take a few seconds,
with byte-identical output.

Part 2 (IR fields): add three optional connector fields and one resolver
case. clm-06 uses them for label placement, port spreading and self-loops.
Documents without the fields must render byte-identically.

Do Part 1's baseline (tasks 1 and 2) before any source change, including
Part 2's changes.

Context:

- Routes are never stored. `resolveConnector` (`shapes/connector/resolve.ts`)
  and `avoidOrthogonalObstacles` (`orthogonal-routing.ts`) compute them at
  render and bounds time. Their caches are keyed by a `ShapeContext`
  (`pageObstacles`, `resolvedRoutes`) or an element object (`routeCache`).
- Per operation, `planDerivedCommands` (`editor/transaction.ts`) copies the
  store and runs all planners. `planFrameTranslations` resolves frame
  membership, which includes connector routes, and
  `planManualRoutePreservation` creates a fresh shape context.
- `apps/cli/src/edit/apply-batch.ts:applyBatch` lists all elements after
  every operation and validates every changed element.
- The label anchor comes from `route.ts:withRoute` at 0.5 of the route
  length. Ports come from `boundary.ts:pinnedPort` at the side midpoints of
  `connectionPorts`. The state self-loop is the hard-coded case in
  `resolve.ts`, around lines 200-227.
- The routing validator is in `registry/generic.ts`, around lines 51-110.
  `keyOrder` lists containing `"routingBend"` are at `generic.ts:141`,
  `uml.ts:154,250,367,422`, `erd.ts:329` and `bpmn.ts:311,338,364,390`.
  Re-grep for `"routingBend"`; these line numbers are approximate.

## Non-goals

- No change to written output, error text, operation indexes, exit codes,
  all-or-nothing semantics or the concurrency re-apply.
- No new CLI flags, no arrange logic and no UI inspector controls.
  `packages/ui-solid/src/connector-routing.ts` and `connectionPorts` stay as
  they are.
- Do not edit `apps/cli/src/edit/batch.ts`, `edit/operations/*.ts` or
  `edit/report.ts` (clm-04 owns them), and do not edit shared files.
- No Rust. If the profile proves a host-side cost, stop and record a Step-5
  blocker.
- Never relax an existing deadline.

## Contract (clm-06 depends on it)

- `ConnectorRoutingSemantic` gains `labelPosition?: number`,
  `fromPortPosition?: number` and `toPortPosition?: number`.
- `label-box.ts` exports `connectorLabelBoxAt(element: Element, anchor: Vec): Box`:
  the `connectorLabelBox` layout at a given anchor. `connectorLabelBox`
  keeps its values and calls it.
- `route.ts` exports `pointAlongRoute(points: readonly Vec[], ratio: number): Vec`
  (the existing private `pointAlong`). `withRoute` gains an optional
  `labelRatio` (default 0.5). `resolveConnector` passes the clamped
  `labelPosition`.

## Tasks

1. Fixture generator `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`:
   - Export `obstacleRoutingBatch(): { document: string; operations: string }`.
     Build it with `new Editor()` and `createElement`, the way
     `apps/cli/src/__fixtures__/dense-relations.ts` does. The page kind is
     `state`.
   - 3 frames `Stage0` to `Stage2` with fixed integer geometry. 20
     `state.node` elements (`Idle`, `Running`, `Paused`, `Done`, then
     numbered names; one with `kind: "initial"`) placed inside the frames.
     50 `state.transition` elements between deterministic pairs (for
     example `i % 20` to `(i * 7 + 3) % 20`, skipping self-pairs), each with
     a `trigger`, `routing: "orthogonal"` and `routingAvoidObstacles: false`.
   - 50 `update` operations with `semantic: {routingAvoidObstacles: true}`.
     Use only `op`, `id` and `semantic`, so clm-04's field check accepts
     them.
   - All ids are fixed strings.
2. Baseline, before any other source change:
   - Run the edit with Bun and write the result to
     `obstacle-routing-batch.expected.jsonl`. Record its `git hash-object`.
   - `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`, then copy
     the binary to `target/clm-baseline/nodetto-cli` (inside the declared
     artifact root `target`; never under `tmp/`, which is a source path)
     and run
     `/usr/bin/time -p <baseline binary> edit <tmp doc> --ops <tmp ops>` into
     `baseline-native.log`. If it runs over 300 s, stop it and record
     "> 300 s". clm-09 reuses the baseline binary for the final comparison.
3. Profile with `bun --cpu-prof`, and temporary counters if needed (remove
   them afterwards). Record the top self-time functions and the work that
   repeats per operation in the progress log as "Confirmed root cause".
4. Fix only the confirmed cause, with a technique the design allows:
   - per-batch memoisation keyed by unchanged inputs (page obstacle geometry
     per store version, a resolved route per connector object);
   - skipping derived planners whose triggers the commands cannot meet;
   - avoiding per-operation full-document copies.
   A cache key must include everything the value depends on. Prefer
   `WeakMap` keyed by store or element objects, and never cache across
   documents.
5. IR fields:
   - In the shared validator, each field must be a finite number in [0, 1],
     otherwise it is an error at the path. A position without its port is a
     warning with code `semantic.portPositionWithoutPort`.
   - Add the three keys to every `keyOrder` that has `routingBend`, right
     after `routingBend`, unless an existing key-order test requires
     another position.
6. Resolver:
   - `pinnedPort(element, context, port, position?)`: when `position` is a
     finite number, shift the outward target along the side by
     `(position - 0.5) * sideLength` before `resolvedBoundary`. The side
     length is the unrotated box width for top/bottom and the height for
     left/right. Then apply the existing rotation.
   - Same-side self-loop: when `from === to`, both ports are set and equal,
     and the type is neither `erd.relation` nor `sequence.message`, the
     points are start (pinned at `fromPortPosition ?? 0.3`), start +
     normal*40, end + normal*40, end (pinned at `toPortPosition ?? 0.7`).
     This case comes before the generic orthogonal case and goes through
     `withRoute`. A self-loop without ports keeps today's loop.
   - Non-finite values are ignored at render time (validation reports
     them).
7. Tests: see below.
8. Final timing: `/usr/bin/time -p` with the new release binary, into
   `after-native.log`. Report the ratio against the baseline.

## Pitfalls

- Byte-identical means exact string equality with the expected file created
  in task 2. Never regenerate it after a change. Its hash must be the same
  at the end.
- The fixture does not use the new fields, so Part 2 must not change its
  output either.
- No regex `split` over the document, and no point destructuring in routing
  loops.
- `apps/cli/native/build.rs` bundles the shared TS engine. A sibling's
  broken file can break the native build: record drift and retry. Never
  edit that file.

## Tests (input -> expected)

- `apps/cli/src/edit-performance.test.ts` (Bun, through `runCli` with an
  in-memory io): output equals the expected file exactly, in under 10000 ms.
- `apps/cli/src/native-parity/edit-performance.test.ts`: spawn the binary
  from `NODETTO_CLI_TEST_BINARY` in a temp dir (spawn timeout 60000, test
  timeout 120000). Exit 0, the written file equals the expected file, wall
  time under 10000 ms, and stdout and stderr equal the Bun run (the
  `compare` pattern in `native-parity/harness.ts`).
- `packages/ir/src/connector-positions.test.ts`:
  - `labelPosition: 1.5` -> an error at `.labelPosition`.
  - `fromPortPosition: 0.2` without `fromPort` -> the warning code.
  - The fields on `state.transition`, `edge.generic`, `erd.relation` and a
    uml association -> no `semantic.unknownField`.
- `packages/core/src/connector-positions.test.ts`:
  - `labelPosition: 0.25` -> `labelPoint` at a quarter of the route.
  - No fields -> `labelPoint` equals `pointAlongRoute(points, 0.5)`.
  - `fromPort: "right"`, `fromPortPosition: 0.25` -> start y a quarter
    down the right side.
  - Self-transition with both ports `"bottom"` -> 4 points below the box,
    40 units out.
  - Self-transition without ports -> the same points as before.
  - `connectorLabelBoxAt(element, labelPoint)` equals `connectorLabelBox`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit-performance.test.ts apps/cli/src/edit/apply-batch.test.ts`.
2. `bun test packages/ir/src packages/core/src/connector-positions.test.ts packages/core/src/connector-endpoints.test.ts packages/core/src/connector-policy.test.ts packages/core/src/connector-outlines.test.ts`.
3. `bun test packages/core/src/frame-translation.test.ts packages/core/src/frame-tree.test.ts packages/core/src/frame-membership.test.ts packages/core/src/frame.test.ts packages/core/src/frame-selection.test.ts packages/core/src/orthogonal-routing.test.ts packages/core/src/manual-route-preservation.test.ts packages/core/src/svg-export.test.ts packages/io/src/jsonl/golden.test.ts`.
   Confirm each file exists first (`ls`). Drop a missing one and record it.
   No golden may change.
4. `bun run typecheck`.
5. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts`:
   more than 0 tests run, and all pass. Use up to 3 attempts on a deadline
   timeout.
6. `bunx biome check <owned TS files>`.

The full core suite runs in clm-09's `mise run verify`, because wave-1
siblings edit core files at the same time.

## Done criteria

- The progress log has the baseline timing, the confirmed root cause, the
  after CPU time and the ratio.
- The expected file's hash is unchanged since task 2.
- `grep -n "export function connectorLabelBoxAt" packages/core/src/shapes/connector/label-box.ts`
  and `grep -n "export function pointAlongRoute" packages/core/src/shapes/connector/route.ts`
  both match.
- Verification 1 to 6 exit 0, and their logs are recorded.
- `git status --short` shows only writePaths changed.
