# crl-00 overview: connector routing and arranging

- Design (binding): `design-docs/specs/design-connector-routing-arranging.md`.
- Owner questions: `design-docs/user-qa/connector-routing-arranging.md`, Q1 to Q4. Implement
  each default.
- Baseline design: `design-docs/specs/design-cli-layout-merge-lint.md`.
- Manifest: `impl-plans/active/crl-s749-dispatch.json`.
- Evidence root: `tmp/crl-s749/<planId>/`.
- Base commit: `1e8f43d224d7b43e200eb2229e7be17b39ca033c`. No push, merge or base integration.
- This overview is not dispatched and has no write paths.

## Waves and ownership

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | crl-01-ir-resolver | IR fields, page field through every layer, resolver reads | - |
| 1 | crl-02-metric-fixture | `segmentOverlaps`, overlap function, acceptance fixture and baselines | - |
| 1 | crl-03-label-placement | Label candidate search and `planLabelFixes` | - |
| 2 | crl-04-connect | `connect` routing, `set-page-routing`, `add-page` field | crl-01 |
| 2 | crl-05-lanes-self-loops | Lane search, self-loop sides, label module call in `planRoute` | crl-01, crl-02, crl-03 |
| 2 | crl-06-layered-order | Member orderings and selection | crl-02 |
| 3 | crl-07-wiring | Index, `arrange`, `lint`, help, docs, acceptance, native parity, timing | crl-04, crl-05, crl-06 |

The table is the original order. Crl-01 to crl-06 are finished, and the manifest now lists them as
`acceptedDependencies`, with crl-07 as its only plan (see the Amendment section).

A file owned in two waves is edited only at that plan's wave:

- `packages/core/src/diagram-lint/metrics.test.ts`: crl-02, then crl-05 if a route expectation shifts.
- `apps/cli/src/arrange-modes.test.ts`: crl-05, then crl-07.
- `packages/core/src/arrange-route.ts`, `arrange-route-lanes.ts`, `arrange-layered-order.ts`,
  `arrange-layered.ts`, `connector-label-placement.ts`: their feature plan, then crl-07 for
  serial acceptance repair only.

Plan-level placement refinement of the design, with no behavior change: `selectLayeredOrder`
lives in `arrange-layered.ts` and the pure orderings in `arrange-layered-order.ts`, which avoids
an import cycle.

Plan-level selection refinement, two parts that together keep the baseline rule that a second
`layered` run is a no-op:

- Tie rule: in `selectLayeredOrder`, a candidate with no commands wins a metric tie before candidate
  order. The design's tie rule alone could move a page already arranged by `barycenter` back to `rank`.
- Shared evaluation basis: `evaluate` (crl-07) always uses `resetManual: true` on its draft, so the
  metric depends on layout only and not on ports or lanes stored by an earlier run. The user's
  `--reset-manual` still controls only the final `planRoute`.

Plan-level `lint --fix` refinement: label moves are planned on the in-memory post-wrap text from
`applyBatch`, not on a written file, and wrap and label operations go through one `runOperations`
call. No behavior change beyond one atomic write.

## Pinned contracts

```ts
// packages/ir/src/types.ts (crl-01), exported from @nodetto/ir
export interface PageConnectorRouting {
  readonly routing: "straight" | "orthogonal";
  readonly routingAvoidObstacles?: boolean;
}
Page.connectorRouting?: PageConnectorRouting

// packages/ir/src/semantics/connectors.ts (crl-01), exported from @nodetto/ir
export const MAX_ROUTING_LANE = 8;
ConnectorRoutingSemantic.routingLane?: number
ConnectorRoutingSemantic.labelOffsetX?: number
ConnectorRoutingSemantic.labelOffsetY?: number

// packages/core/src/editor/facade/page-editing.ts (crl-01)
setPageConnectorRouting(id: PageId, value: PageConnectorRouting | null): boolean;

// packages/core/src/diagram-lint/metrics.ts (crl-02)
export interface PageMetrics {
  readonly edgeCrossings: number;
  readonly labelOverlaps: number;
  readonly segmentOverlaps: number;
}
export function countRouteOverlaps(a: readonly Vec[], b: readonly Vec[]): number;

// apps/cli/src/__fixtures__/connector-arrange.ts (crl-02)
export const CONNECTOR_ARRANGE_STATE_PAGE = "States";
export const CONNECTOR_ARRANGE_ARCHITECTURE_PAGE = "Architecture";
export function connectorArrangeDocument(): string;

// packages/core/src/connector-label-placement.ts (crl-03)
export interface LabelFields {
  readonly labelPosition?: number;
  readonly labelOffsetX?: number;
  readonly labelOffsetY?: number;
}
export interface LabelPlacementEdge {
  readonly element: Element;            // text and type come from here
  readonly semantic: Record<string, unknown>; // current stored label fields
  readonly points: readonly Vec[];
  readonly movable: boolean;
}
export function placeConnectorLabels(input: {
  readonly edges: readonly LabelPlacementEdge[];
  readonly obstacles: readonly Box[];
}): ReadonlyMap<ElementId, LabelFields>;
export interface LabelMoveFix {
  readonly pageId: PageId;
  readonly elementId: ElementId;
  readonly ruleId: "label-collision";
  readonly field: "labelPosition";
  readonly before: LabelFields;
  readonly after: LabelFields;
}
export function planLabelFixes(document: Document, pageId: PageId): LabelMoveFix[];

// packages/core/src/arrange-route.ts (crl-05)
RouteOptions.separation?: boolean  // default true

// packages/core/src/arrange-layered.ts (crl-06)
LayeredOptions.memberOrder?: "rank" | "input" | "barycenter"  // default "rank"
export type LayeredEvaluate = (draft: Store) => PageMetrics;
export function selectLayeredOrder(
  store: Store,
  pageId: PageId,
  registry: ShapeUtilRegistry,
  options: LayeredOptions,
  evaluate: LayeredEvaluate,
): { commands: Command[]; placed: ReadonlySet<ElementId> } | { error: string };
```

An absent key in `LabelFields` means the field is removed from the semantic.

## Rules for every worker

- Read your plan and the named design section first. Do not widen scope. If a needed edit falls
  outside your `writePaths`, stop and record a blocker in your progress log.
- Before starting, record `git hash-object` of your plan file as the immutable intent snapshot.
  Other plans run at the same time on the same branch and working directory.
- Before each edit, read the file fresh. Record pre and post `git hash-object` per edit in your
  progress log. If the pre-edit hash differs from your last recorded post hash, someone else
  touched the file: re-read, keep their change, record the drift. Overlap left after a wave is
  repaired serially at reconciliation.
- Edit only your own progress log. Do not edit `impl-plans/README.md`, other plans or the
  `impl-plans/active` and `impl-plans/completed` listings.
- No state-changing git commands: no commit, stash, checkout, reset, branch or worktree.
  Read-only git commands are fine.
- No broad formatting. Run Biome only on your own files.
- Never run `cargo clean`. Never delete `target/crl-baseline`.
- Every fixture, id, label and comment is self-authored and neutral (`Idle`, `Running`, widgets,
  orders). Never mention external issue numbers, organizations, reporters or downstream products.
- No emojis. Cargo commands use `CARGO_TERM_QUIET=true`.
- Boa rules for shared-engine code: no regex `split` on whole documents, no per-point
  destructuring in hot geometry loops, and no `node:*` imports in shared-engine modules.
- Strict TypeScript. No unchecked index lookups in `packages/core`: use indexed loops with a
  guard for `undefined`. `noUncheckedIndexedAccess` safety is enforced by this discipline, because
  the repository has no `verify-cloud` task.
- Determinism: stable order is ascending element id by UTF-16 code unit. No time, randomness,
  locale or parse-order input. Written fractions are rounded to 4 decimals, offsets to integers.
- Existing default behavior changes only where the design says so. Never relax a test deadline.

## Verification rules

- Write each command's full output to `tmp/crl-s749/<planId>/final/<name>.log` and record its exit
  status in the progress log. Before repeating a gate, move `final/` to `attempt-<n>/`. An
  incomplete log is not a passing check.
- Native parity commands always set `NODETTO_CLI_TEST_BINARY` to a release binary built by the same
  command, so tests run instead of skipping. Record pass and skip counts. A skipped `nativeTest` is
  a failure.
- For a native deadline timeout, retry up to 3 attempts before it counts as a failure, and compare
  CPU time with `/usr/bin/time -p`.
- On a moving shared tree, a failure caused only by a sibling's unfinished file is recorded with the
  file name and rerun once that sibling finishes. It is not fixed by you.
- Workspace gates belong to reconciliation and integration review:
  `CARGO_TERM_QUIET=true mise run verify` and `CARGO_TERM_QUIET=true mise run test-cli`.

## Rebaseline rule

A golden or existing expectation changes only if the change is one the design lists under "Existing
outputs that may change". Record each one in the progress log with the requirement (R1 to R5) and a
one-line reason. `apps/cli/src/__fixtures__/obstacle-routing-batch.*` must not change.

## Progress logs

Each plan writes `impl-plans/progress/<planId>.md` with the intent snapshot hash, per-edit hashes,
baseline test counts, final counts, exit statuses, log paths, and any blocker or deviation.

## Done for the whole set

- All plans' done criteria are met.
- `mise run verify` and `mise run test-cli` exit 0 on the combined tree, with native parity running.
- crl-07 recorded fixture before and after metrics, native timing, and the CPU comparison against
  `target/crl-baseline/nodetto-cli`.
- Help and docs describe every new field, operation and metric.

## Amendment 2026-11-06 (blocked-wave-scope-or-contract, round 1)

crl-07 stopped before any edit on a reported mismatch between its `dependsOn` and `acceptedPlanIds`
for crl-05. The recorded dispatch item lists crl-05 as accepted, and wave 6 reports it successful.
The manifest now records crl-01 to crl-06 as `acceptedDependencies`, with `commit` null because their
work is uncommitted on the shared working tree over checkpoint
`d4843e58b679160142ac07225bcf4b4519f17433`. crl-07 has an empty `dependsOn`, and its write paths gain
the sibling test files for serial repair. Details are in `impl-plans/active/crl-07-wiring.md`. No
design change.
