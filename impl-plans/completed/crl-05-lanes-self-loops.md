# crl-05-lanes-self-loops

- planId: crl-05-lanes-self-loops
- planPath: impl-plans/active/crl-05-lanes-self-loops.md
- progressPath: impl-plans/progress/crl-05-lanes-self-loops.md
- wave: 2
- dependsOn: crl-01-ir-resolver, crl-02-metric-fixture, crl-03-label-placement
- Design: `design-docs/specs/design-connector-routing-arranging.md`, sections "Lane search in `planRoute`", "R5" and "Existing outputs that may change"; baseline A2 to A5 in `design-docs/specs/design-cli-layout-merge-lint.md`.
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `packages/core/src/arrange-route.ts`
  - `packages/core/src/arrange-route.test.ts`
  - `packages/core/src/arrange-route-lanes.ts` (new)
  - `packages/core/src/arrange-route-lanes.test.ts` (new)
  - `packages/core/src/diagram-lint/metrics.test.ts`
  - `packages/core/src/arrange-layered-bpmn.test.ts`
  - `packages/core/src/arrange-layered-bpmn.depth-one.collapsed-pool.expected.json`
  - `packages/core/src/arrange-layered-bpmn.depth-one.pool-no-lanes-free-row.expected.json`
  - `packages/core/src/arrange-layered-bpmn.depth-one.subprocess-boundary.expected.json`
  - `packages/core/src/arrange-layered-bpmn.depth-one.two-pools-message-flow.expected.json`
  - `apps/cli/src/arrange-modes.test.ts`
  - `apps/cli/src/connector-arrange-route.test.ts` (new)
  - `apps/cli/src/native-parity/layout.test.ts`
  - `impl-plans/progress/crl-05-lanes-self-loops.md`
  - `tmp/crl-s749/crl-05-lanes-self-loops`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Edges between the same columns share one channel, and detours around one box share one clearance line, so
routes overlap. `planRoute` must write separating inputs, and the resolver draws them. Self-loops must take an
unused side. The label stage moves to `placeConnectorLabels`.

Route mode stores only inputs (baseline A2). Never write waypoints.

## Non-goals

- Do not edit `resolve.ts`, `metrics.ts`, `connector-label-placement.ts`, `arrange-layered.ts`, `arrange-modes.ts`, `commands.ts` or `index.ts`.
- Do not change the manual test: `routing: "manual"`, or a port set. Ports from an earlier arrange still count as manual.
- Do not move `erd.relation` self-relations or `sequence.message`.
- Do not skip the middle-gap between a shared loop's coordinates in spreading: the design reserves only the two coordinates.

## File-level changes

`arrange-route.ts`, `planRoute`:

- `resetFields` adds `routingLane`, `labelOffsetX`, `labelOffsetY`. Reset of BPMN `labelBounds` connectors keeps today's label rule.
- `RouteOptions.separation?: boolean`, default true. False: skip lanes and label search, leaving label fields as they are.
- Self-loop allocation (current lines 181-232) per "R5":
  - `sides` order becomes `top`, `right`, `bottom`, `left`.
  - Track ends per (node, side) with movability, not only counts. A movable end is an end of a movable, non-loop connector with a port written by this run. Inferred sides of non-port ends are fixed.
  - First unused side wins, counting earlier self-loops.
  - All four used: among sides whose ends are all movable, take the fewest ends, ties by side order. Reassign each of those ends to the adjacent side closer to its opposite center (`top` and `bottom` go to `left` or `right`; `left` and `right` go to `top` or `bottom`; a tie goes to the earlier side in side order). Then the loop takes the freed side.
  - No such side: the side with the fewest ends, ties by side order.
- A4 spreading: include self-loop positions as fixed coordinates in the group of their (node, side). A group with one movable end and a loop now goes through the fixed branch, so change the `group.length < 2` skip accordingly. A group with no loop behaves as today.
- After port commands: `planRouteLanes`, apply its patches to the draft and to `data`, then resolve final routes in the same context.
- Replace the A3 block (current lines 391-466) with `placeConnectorLabels`. Movable means `targets.has(id)`. Non-targets are held. Merge results into the semantic: remove all three fields, then set those present.
- Keep the final comparison with `equalSemantic` against the original and the command order.

`arrange-route-lanes.ts`:

- `planRouteLanes(edges, context)`, where `edges` is `{element, movable}[]` in stable order, returns `ReadonlyMap<ElementId, {routingLane?: number; routingBend?: number}>`.
- Fixed routes: non-movable edges with a route, including self-loops and manual connectors. A self-loop is never movable here.
- Per design: a candidate k = 0 is the current semantic. If `countRouteOverlaps` against fixed and placed routes is 0, keep it. Otherwise try k = 1..`MAX_ROUTING_LANE`. The first zero wins. Otherwise the lowest count, ties to the lower k.
- Bend for k > 0, when the k = 0 route has `bendAxis`: span is the start-to-end distance on that axis. If the span is at least 1, the bend is the base (`routingBend` or 0.5) plus `(k odd ? 1 : -1) * ceil(k / 2) * 8 / span`, clamped 0..1 and rounded to 4 decimals.
- Candidates: `resolveConnector({...element, semantic: candidate}, context, endpointReaderFor(type))`. A fresh object each time, so the element cache and route cache do not return stale results.
- Bound: at most 9 route evaluations per connector. No time checks.

## What a careless implementation gets wrong

- The search is in stable id order, and an edge compares only against fixed and earlier-placed edges. This is what makes one pass enough.
- `routingBend` from a user is the base of the offset. With k = 0 it stays as stored.
- k = 0 writes neither field: `routingLane: 0` must not appear.
- `separation: false` must still write ports and self-loop sides, because the ordering evaluation measures those.
- Do not rebuild the context per candidate. `routingObstacles` is cached per context, and that is the performance basis.
- A rerun must be a no-op: ports written by the first run make every connector manual, so no lanes or sides change, and labels recompute identically.
- `--ids` subset: non-targets stay fixed for both lanes and labels.
- The reassigned port's opposite end does not change. Only that end's side moves, then A4 spreads it.
- Existing tests that pin `fromPort` `top` for loops should still hold, because `right` was used in them. A loop on an unused element moves from right to top. Report it under the rebaseline rule (R5, user-qa Q1).
- BPMN goldens may shift only in `routingLane`, `routingBend`, label fields and loop sides. Any other difference is a defect, not a rebaseline.

## Tests

`packages/core/src/arrange-route-lanes.test.ts`:

- Three edges between two columns sharing a channel -> pairwise zero overlaps, lanes distinct, stable by id.
- Two edges detouring around one box -> zero overlaps.
- No overlap at all -> empty map entries, no `routingLane` written.
- A fixed manual route on the channel -> the movable edge avoids it, and the manual edge is unchanged.
- User `routingBend: 0.3` -> offset around 0.3.
- More overlaps than lanes -> lowest count, no throw.
- Shuffled input -> same result.

`packages/core/src/arrange-route.test.ts`:

- Unused element -> loop on `top`, positions 0.3 and 0.7.
- `top` used -> `right`.
- Two loops on one element -> distinct sides.
- All four used, `top` all movable with fewest -> those ends move to `left` or `right`, loop on `top`, and no other end on `top`.
- All four used with fixed ends on every side -> fewest side, and other ends avoid 0.3 and 0.7.
- `separation: false` -> ports present, `routingLane` and label fields absent.
- `--reset-manual` removes `routingLane` and the offsets.
- `planRoute` applied twice -> second returns no commands.

`apps/cli/src/connector-arrange-route.test.ts`, using `connectorArrangeDocument`, `Editor`, `planRoute` and `pageMetrics` (relative core imports, as `apps/cli/src/arrange-modes.test.ts` does for its helpers) on the unmoved `States` page:

- `segmentOverlaps` and `labelOverlaps` are each strictly below the input baseline when that baseline is above 0, and 0 otherwise. Record both numbers in the progress log. The zero target is asserted in crl-07 after layered.
- Each self-loop on a side that no other end uses, or the fixed fallback with a recorded reason.
- Two runs byte-identical.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-route-lanes.test.ts packages/core/src/arrange-route.test.ts apps/cli/src/connector-arrange-route.test.ts` -> 0 fail.
2. `bun test packages/core/src/arrange-layered-bpmn.test.ts packages/core/src/diagram-lint/metrics.test.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.test.ts` -> 0 fail. Rebaselines recorded.
3. `bun run typecheck`.
4. `bunx biome check packages/core/src/arrange-route.ts packages/core/src/arrange-route.test.ts packages/core/src/arrange-route-lanes.ts packages/core/src/arrange-route-lanes.test.ts apps/cli/src/connector-arrange-route.test.ts`.
5. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/layout.test.ts'` -> 0 fail, 0 skip. Retry up to 3 attempts on a deadline timeout.

## Done criteria

- Verification 1-5 exit 0 with logs recorded.
- `grep -n "placeConnectorLabels" packages/core/src/arrange-route.ts` matches, and `grep -c "0.35, 0.65" packages/core/src/arrange-route.ts` prints 0.
- `git diff --stat apps/cli/src/__fixtures__` shows no change to `obstacle-routing-batch` files.
- Progress log complete, including route-only fixture numbers.
