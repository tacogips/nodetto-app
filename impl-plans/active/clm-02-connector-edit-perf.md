# clm-02-connector-edit-perf

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
     the binary to `tmp/clm-s725/clm-02-connector-edit-perf/nodetto-cli-baseline`
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
