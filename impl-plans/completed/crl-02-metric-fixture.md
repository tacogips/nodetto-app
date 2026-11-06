# crl-02-metric-fixture

- planId: crl-02-metric-fixture
- planPath: impl-plans/active/crl-02-metric-fixture.md
- progressPath: impl-plans/progress/crl-02-metric-fixture.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-connector-routing-arranging.md`, sections "Metric" and "Fixture and acceptance tests".
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `packages/core/src/diagram-lint/metrics.ts`
  - `packages/core/src/diagram-lint/metrics.test.ts`
  - `apps/cli/src/lint-metrics.ts`
  - `apps/cli/src/lint-metrics.test.ts`
  - `apps/cli/src/__fixtures__/connector-arrange.ts` (new)
  - `apps/cli/src/__fixtures__/connector-arrange.test.ts` (new)
  - `impl-plans/progress/crl-02-metric-fixture.md`
  - `tmp/crl-s749/crl-02-metric-fixture`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`lint --metrics` needs an overlap count, and the lane search (crl-05) and ordering (crl-06) need the same
test. The fixture is fixed here, before algorithm work, so acceptance is not tuned to the algorithm. The
design step could not run commands, so this plan records the first measured baselines.

## Non-goals

- Do not edit `apps/cli/src/commands.ts`. Its JSON summary reduce gets the new field in crl-07.
- Do not change `edgeCrossings` or `labelOverlaps` counting. Keep `properCrossing` as it is.
- Do not touch `packages/core/src/index.ts`: `PageMetrics` and `pageMetrics` are already exported.
- Do not arrange the fixture here.

## File-level changes

`packages/core/src/diagram-lint/metrics.ts`:

- `PageMetrics` gains `segmentOverlaps`.
- `export function countRouteOverlaps(a, b)`: the number of segment pairs, one from each route, that are
  collinear and share more than 1 unit of length. A pair sharing only a point or at most 1 unit does not
  count. Works for any direction, not just axis-aligned. Use indexed loops, no destructuring, no
  allocation per segment pair, and a whole-route bounding-box reject first, then a per-pair reject.
- `pageMetrics`: sum `countRouteOverlaps` for each pair of different connectors, in the existing `i`/`j`
  loop. Zero-length segments never count.

`apps/cli/src/lint-metrics.ts`, `formatMetricsLines`: exact text
`metrics <page>: <n> edge crossing(s), <m> edge-label overlap(s), <k> overlapping segment pair(s)`.

`apps/cli/src/__fixtures__/connector-arrange.ts`, imitating `apps/cli/src/__fixtures__/obstacle-routing-batch.ts:obstacleRoutingBatch`
(deterministic `idSource`, `rng`, `buildElement`):

- `connectorArrangeDocument(): string` returns serialized JSONL with these two pages.
- `States` (kind `state`):
  - 4 `frame` ids `frame-0`..`frame-3`, names `Stage0`..`Stage3`, visual x `i * 520`, y 0, width 420, height 1100.
  - 17 `state.node` ids `state-00`..`state-16`. Names: `Idle` (kind `initial`), `Running`, `Paused`, `Done`,
    then `State4` onward. Frame index `i % 4`, row `floor(i / 4)`. Visual x `frame * 520 + 60`, y `row * 130 + 70`, width 150, height 60.
  - 43 `state.transition` ids `edge-00`..`edge-42`: `from = i % 17`, `to = (i * 7 + 3) % 17`; if equal, `to = (to + 1) % 17`. `trigger` `event00`.. .
  - 4 self-transitions ids `loop-0`..`loop-3` on `state-02`, `state-05`, `state-09`, `state-13`. `trigger` `loop0`.. .
  - All transitions: `routing: "orthogonal"`, `routingAvoidObstacles: true`, no ports.
- `Architecture` (kind `architecture`): `node.generic` ids `box-a`, `box-c`, `box-b` labeled `A`, `C`, `B` at x 0, 300, 600, y 0, width 120, height 60, and `box-d` labeled `D` at x 300, y 200. No connectors.
- When run as a script (`import.meta.main`), writes the document to stdout. crl-07 timing uses this.

Do not change the generator after this plan, to make an acceptance test pass. If a later plan finds it invalid,
that is a recorded blocker.

## What a careless implementation gets wrong

- `segmentIntersection` already handles collinear overlap for crossings, but returns a point, not a length. Do
  not reuse it for the 1-unit rule.
- Same-edge pairs never count.
- A near-collinear pair with a floating error must count: use the same `1e-9` style tolerance as `cross` checks.
- Keep `pageMetrics` output deterministic: sums only.
- The fixture imports only from `@nodetto/*`, and it must validate with no error-level issue.

## Tests

`packages/core/src/diagram-lint/metrics.test.ts`, `countRouteOverlaps`:

- Two horizontal routes on one y sharing 50 units -> 1.
- Sharing exactly 1 unit -> 0; sharing 1.5 -> 1.
- Touching at one point -> 0.
- Parallel 2 units apart -> 0.
- Perpendicular crossing -> 0.
- Collinear diagonal sharing length -> 1.
- Multi-segment routes with two shared runs -> 2.
- Zero-length segment -> 0.
- `pageMetrics` on two edges sharing a run -> `segmentOverlaps` 1, with existing fields unchanged in meaning.

`apps/cli/src/lint-metrics.test.ts`: update the expected map and text to include the new field.

`apps/cli/src/__fixtures__/connector-arrange.test.ts`:

- Two calls -> byte-identical.
- `validateDocument` -> no errors.
- Counts: 4 frames, 17 states, 47 transitions, 4 self-transitions, every state inside its frame.
- `pageMetrics` on `States` -> equals the measured input baseline, pinned as numbers in the test after you measure
  them.

Record the baseline (`edgeCrossings`, `labelOverlaps`, `segmentOverlaps`) in the progress log.

## Verification (each must exit 0)

1. `bun test packages/core/src/diagram-lint/metrics.test.ts apps/cli/src/lint-metrics.test.ts apps/cli/src/__fixtures__/connector-arrange.test.ts` -> 0 fail.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/diagram-lint/metrics.ts packages/core/src/diagram-lint/metrics.test.ts apps/cli/src/lint-metrics.ts apps/cli/src/lint-metrics.test.ts apps/cli/src/__fixtures__/connector-arrange.ts apps/cli/src/__fixtures__/connector-arrange.test.ts`.

## Done criteria

- Verification 1-3 exit 0 with logs recorded.
- `grep -n "export function countRouteOverlaps" packages/core/src/diagram-lint/metrics.ts` matches.
- The progress log holds the three baseline numbers.
- `git diff --stat apps/cli/src/commands.ts packages/core/src/index.ts` is empty.
