# nodetto-cli: connector routing and arranging follow-up

Status: DESIGNED, 2026-11-06. Revised the same day for the continuation (W1 to W5): see
"Overlap repair", "Nearest free position", "Fixture and acceptance tests", "Baseline binary and
timing", "Existing outputs that may change" and "Continuation plans". Where the two conflict, these
sections replace the `crl-07-wiring` plan text.

Baseline: `design-docs/specs/design-cli-layout-merge-lint.md` (groups A and E,
Determinism rules). Its decisions stay unless a section below names what it
revises: A2 reset fields, A3 label candidates, A4 self-loop reservation, A5 side
order and `lint --metrics` output. Owner decisions:
`design-docs/user-qa/connector-routing-arranging.md`. Each question has a default
that this design implements.

## Scope

Five additive changes, all in the shared TypeScript engine, so the Bun CLI and
the native CLI (Boa) behave the same. No Rust change is planned. No server, auth
or deployment code.

| Req | Change |
| --- | --- |
| R1 | `connect` applies `visual`, accepts routing shorthand, and follows a page default and a page convention |
| R2 | Routing written under `visual` reaches the resolver, so every consumer draws it |
| R3 | New `segmentOverlaps` metric, lane separation of routes, deterministic member ordering in `layered` |
| R4 | Wider label search with a label offset, used by `arrange` and `lint --fix`, with a report of what moved |
| R5 | Self-loops on unused sides, in a documented order, with a side freed when possible |

Out of scope: inspector controls for the new fields, changing the app's connect
tool, and changing the default routing of a `connect` on a page with no default
and no convention (it stays straight, per the backward-compatibility constraint).

## Evidence from reading the code at 1e8f43d

These come from reading the code. Commands could not run in the design step, so
plan crl-02 records measured baselines before any behavior change.

- `apps/cli/src/edit/operations/connect.ts`: `visual` is an allowed field in
  `OPERATION_FIELDS.connect` but neither branch reads it. This is the R1(b) drop.
- `packages/core/src/svg-export/connectors.ts`, `svg-export/document.ts` and
  `packages/ui-solid/src/shapes/ConnectorView.tsx` all draw from
  `resolveConnector`, and `renderPageSvg` builds its context with
  `createShapeContext`, which provides `elementsOnPage`. Canvas and export
  therefore already share one route computation for `semantic.routing`.
- `shapes/connector/resolve.ts` reads `routing` and `routingAvoidObstacles` only
  from `semantic`. `packages/io/src/jsonl/parse.ts` (`parseVisual`) moves keys
  that `VISUAL_KEY_ORDER` does not list into `visual.extensions`, and
  `validate.ts` only warns about them. An edge carrying
  `visual: {"routing":"orthogonal","routingAvoidObstacles":true}` is therefore
  stored but drawn straight. This is the R2 root cause this design addresses.
- `orthogonal-routing.ts` (`gridRoute`) only uses grid lines from the clearance
  boxes and the preferred route, and the middle channel defaults to the midpoint.
  Edges between the same columns share one channel, and detours around one box
  share one clearance line. These are the shared runs in R3.
- `arrange-layered.ts` stacks members by breadth-first rank only, with no
  ordering step. `arrange-route.ts` A3 tries 7 positions along the route only.
- `diagram-lint/metrics.ts` `properCrossing` counts a collinear overlap as a
  crossing, so separation also lowers `edgeCrossings`.

## Shared IR additions

New optional connector semantic fields in `ConnectorRoutingSemantic`, validated
by the shared routing validator (`registry/generic.ts`) and added to the
`keyOrder` of each connector type that lists `routing` (generic, UML, ERD, BPMN).
`sequence.message` does not list `routing` and does not get them.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `routingLane` | integer 0..8 | 0 | Separation index written by arranging. See "Lanes in the resolver". |
| `labelOffsetX`, `labelOffsetY` | finite number | 0 | Added to the label anchor after `labelPosition`. Arranging writes integers. Not used on `bpmn.*` connectors. |

New optional page field `Page.connectorRouting`:

```json
{ "routing": "orthogonal", "routingAvoidObstacles": true }
```

- `routing` is `straight` or `orthogonal`. `manual` is rejected, because a default
  has no waypoints. `routingAvoidObstacles` is an optional boolean.
- The wire key is `connectorRouting`, added to `PAGE_RECORD_KEYS` after
  `sqlDialect`. An older build keeps it through the page `extensions` bag.
- Files that enumerate page fields and must carry it: `packages/ir/src/types.ts`,
  `packages/ir/src/validate.ts`, `packages/io/src/jsonl/parse.ts`,
  `packages/io/src/jsonl/records.ts`, `packages/core/src/commands.ts`
  (`updatePage` patch, validation, undo), `packages/core/src/editor/pages.ts`
  (page copy), `packages/core/src/editor/facade/page-editing.ts` and
  `packages/collab/src/ydoc.ts` (both directions).

Lists that name routing keys and must include `routingLane`:
`packages/io/src/bpmn/equivalence.ts` (with `labelOffsetX` and `labelOffsetY`
absent on BPMN, so only the lane), `packages/core/src/editor/bpmn.ts` (retained
keys), `packages/ui-solid/src/connector-routing.ts` (cleared on straighten), and
`resetFields` in `arrange-route.ts`, which also gets both label offset keys.

Without these fields, and without routing under `visual`, every route and label
position stays byte-identical to today.

## R1. `connect` routing

Operation fields added to `connect`: `routing` and `routingAvoidObstacles`.

`visual`:

- `connect` applies `visual` in both branches, using the same handling as `add`
  (`withBoxLabelAlign`, then `updateVisual`), and it gets the `visual.style` key
  check that `add` and `update` already have.
- For a connector, `routing` and `routingAvoidObstacles` found directly under
  `visual` move to `semantic` before the visual is applied. `add` of a connector
  type uses the same helper. `update` does not change.

Resolution, in `apps/cli/src/edit/connect-routing.ts` (new, CLI only):

1. `routing` comes from the first tier that has it: top-level field, then
   `semantic.routing`, then `visual.routing`, then `Page.connectorRouting`, then
   the page convention. No tier means the connector keeps what its type and
   `connectSmart` give it today.
2. `routingAvoidObstacles` comes from the explicit fields in the same order. If
   none is explicit, it comes from the tier that supplied `routing`.
3. Documented precedence: explicit field > page default > page convention >
   existing default.

Page convention:

- Peers are the page's existing connectors whose type lists `routing` in its
  `keyOrder`, read after earlier operations in the batch. No peers means no
  convention.
- A peer's key is its `routing` plus `routingAvoidObstacles !== false`. A convention
  exists only if every peer has the same key and that `routing` is stored as
  `orthogonal` or `straight`. An absent `routing` or `manual` on any peer means no
  convention, because manual routes are per-connector and absent already means the
  existing default.
- The new connector gets that `routing`. It gets `routingAvoidObstacles: false` when
  the peers have false, `true` when any peer stores true, and no field otherwise.

Type rule: if the created type does not list `routing` (`sequence.message`), an
explicit field is an `OperationError`, and the default and convention are skipped.

Page default operations:

- `{"op":"set-page-routing","id":<page>,"routing":"orthogonal","routingAvoidObstacles":true}`;
  `"routing":null` clears it.
- `add-page` accepts `connectorRouting` with the same shape.
- Invalid values are an `OperationError` naming the field. The field goes through
  `updatePage`, so undo and validation behave as for `sqlDialect`.

## R2. Export honors stored routing

- `resolve.ts` reads both fields through one helper: `semantic` first, then
  `visual`, then `visual.extensions`. `semantic` always wins. The helper is used
  only inside `computeConnector`, which is shared by export, canvas, lint metrics
  and text-layout lint. `svg-export` itself does not change, and `apps/desktop` and
  the canvas view need no route change.
- `validate.ts` keeps warning about the unknown visual key, which tells authors the
  supported place is `semantic`. `arrange --mode route` still writes `semantic`.
- A connector with `semantic.routing` absent and the visual key present is the only
  input whose drawing changes. This is the requested change.

Determinism: the route comes from the existing deterministic resolver. No random,
time or locale input is added.

## R3. Separation and ordering

### Metric

`PageMetrics` adds `segmentOverlaps`: the number of segment pairs, from two
different connectors on the page, that are collinear and share more than 1 unit of
length. `edgeCrossings` and `labelOverlaps` keep their meaning.

- Text: `metrics <page>: <n> edge crossing(s), <m> edge-label overlap(s), <k> overlapping segment pair(s)`.
- JSON: `segmentOverlaps` per page and in the summary.
- The overlap test is one exported function in `diagram-lint/metrics.ts`, also used
  by the lane search, using indexed loops and a bounding-box reject first.

### Lanes in the resolver

For a connector with `routingLane` k > 0 on the orthogonal branch:

- Obstacle clearance is `12 + 8k` per page obstacle. If that inflated box contains
  the route's start or end but the 12-unit box does not, the 12-unit box is used, so
  a neighbor is never dropped as "contains an endpoint".
- Port escape distance is `min(24 + 3k, 44)`, which stays short of a neighbor's
  12-unit clearance across the 60-unit `MEMBER_GAP`.
- Endpoint obstacles use a clearance below the escape distance, so a route can
  never be routed through its own node.

The middle channel is not part of the lane. It stays in the existing `routingBend`,
so bend dragging in the app keeps working.

### Lane search in `planRoute`

New module `packages/core/src/arrange-route-lanes.ts`. It runs after ports are
applied and before label placement.

1. Fixed routes are those of non-target connectors and manual targets.
2. Movable connectors are taken in stable order. A candidate k = 0 is the current
   semantic. If it has no overlap with fixed and earlier placed routes, it is kept.
3. Otherwise k = 1..8 are tried. Candidate k sets `routingLane: k` and, when the
   resolved route has a `bendAxis`, offsets the bend by `ceil(k/2) * 8` units, with
   odd k positive and even k negative, as a fraction of the span, clamped to 0..1
   and rounded to 4 decimals. The first candidate with zero overlaps wins. Otherwise
   the lowest count wins, and ties go to the lower k.
4. k = 0 writes neither field. A user `routingBend` is the base of the offset.

Candidates are resolved with `resolveConnector` on a copied element in the same
context. Obstacles are cached per context and only connector semantics change, so
page obstacles are not recomputed. The search is count-bounded at 9 evaluations per
connector. It uses no time budget.

`RouteOptions` adds `separation?: boolean` (default true). False skips lanes and
label search, for the ordering evaluation below.

### Overlap repair

The lane search compares a connector only with routes placed before it, and never revisits a placed
route. The recorded fixture result after layered and route is 3 overlapping segment pairs. Reading
the resolver shows two other limits of the 9 candidates: a lane can lengthen port escapes so that
facing stubs meet (escape reaches 44 per side, and `MEMBER_GAP` is 60), and clamped bends and equal
clearances at k = 7 and 8 can repeat a route. Which of these causes the 3 pairs has not been
measured, so the first step of plan crl-08 records the residual pairs with their ids and points.

A repair pass runs at the end of `planRouteLanes`, when `separation` is on:

1. Work from the current routes of all connectors on the page. Connectors in repair are those that
   are movable, have no stored `routingLane` above 0, and overlap any other current route. Take
   them in stable id order, and do up to 3 rounds.
2. The candidates for a connector, in order:
   - A. The lane candidates k = 1..8 from "Lane search", built from its stored semantic.
   - B. Port position shifts. For each end with a stored port, move its position halfway to the next
     occupied position on that side, or to the side's end, in the lower direction and then the
     higher. An absent position counts as 0.5. Occupied positions include every other connector end
     on that node side, including a self-loop's 0.3 and 0.7. Halfway moves keep the order of ends on
     the side. Order: `from` lower, `from` higher, `to` lower, `to` higher, each with lane k = 0, 1
     and 2. A shift that lands within 0.0001 of an occupied position is skipped. Positions round to 4
     decimals.
3. A candidate is rejected if it enters more non-endpoint obstacles than the connector's current
   route does. Its score is its overlap count against all other current routes. The first zero wins.
   Otherwise the lowest score wins, ties to the earlier candidate. A connector changes only when the
   score is strictly lower than its current one, and its whole patch is replaced.
4. A round with no change ends the pass. Each change lowers the page's total overlap count, so the
   result terminates and depends only on the input and id order.

Patches may now also hold `fromPortPosition` and `toPortPosition`. A patch with k = 0 writes no
lane or bend, so a position-only patch must still be returned. Self-loops and manual connectors are
never candidates, but they count as routes. The search is count-bounded at 20 evaluations per
connector per round and costs nothing on a page with no overlaps.

If the fixture still measures above 0 after A and B, add tier C: `routingBend` 0.1 to 0.9 at k = 0,
only for connectors whose route has a `bendAxis`. Do not add it before that measurement. If C also
leaves overlaps, record the pairs and report a blocker. The assertion and the fixture do not change.

Idempotence: the pass writes only to movable connectors. Ports written by the first run make the
connector manual, so a second `--mode route` plans no route change. `--reset-manual` recomputes the
same result. Selection in `layered` runs with `separation: false`, so it never runs this pass.

Manual connectors stay fixed. Coincident fixed ports are not moved without
`--reset-manual` (user-qa Q6 of the baseline), and `lint --metrics` reports them.
Ports written by an earlier arrange still count as manual, so a second
`--mode route` is a no-op and re-arranging after moving elements needs
`--reset-manual`.

### Member ordering in `layered`

`LayeredOptions` adds `memberOrder?: "rank" | "input" | "barycenter"` (default
`rank`, which is today's order). New module
`packages/core/src/arrange-layered-order.ts`:

- `rank`: existing breadth-first order.
- `input`: members by their current position along the stack axis (y for LR, x for
  TB), ties by rank.
- `barycenter`: start from `rank`, and run 4 sweeps, alternating column order
  forward and backward. A member's key is the mean normalized stack index of its
  neighbors in other columns. Members with no such neighbor keep their current
  index. Sorting is stable, and ties keep the current order. Frame order is
  unchanged.

`selectLayeredOrder(store, pageId, registry, options, evaluate)` plans each
candidate on a draft store, runs `evaluate` (placement, then `planRoute` with
`separation: false`, then `pageMetrics`), and keeps the lowest `edgeCrossings`, then
`segmentOverlaps`, with ties to the earlier candidate in the order `rank`, `input`,
`barycenter`. A page where `rank` is not strictly beaten keeps today's placement.

This reduces crossings where a candidate is better, but it is not a general
guarantee that crossings stay at or below the input. The acceptance test measures
the fixture. BPMN layered placement (`planLayeredBpmn`) keeps its order and only
gets the route stage changes.

## R4. Label placement

New module `packages/core/src/connector-label-placement.ts`, exporting
`placeConnectorLabels` (used by `planRoute`) and `planLabelFixes(document, pageId)`
(used by `lint --fix`). The A3 stage moves here.

Candidates, in order, first score 0 wins, otherwise the lowest score, ties to the
earlier candidate:

1. The existing 7 positions: 0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9. Output that found a
   zero here stays identical.
2. The other 0.05 steps: 0.45, 0.55, 0.4, 0.6, 0.3, 0.7, 0.25, 0.75, 0.15, 0.85, 0.05, 0.95.
3. Not on `bpmn.*`: each of those 19 positions with these offsets, where w and h are
   the zero-offset label box size, rounded to integers, sorted as described below:
   - `(0,-h-4)`, `(0,h+4)`, `(-w-4,0)`, `(w+4,0)`, `(0,-2h-8)`, `(0,2h+8)`, `(-2w-8,0)`, `(2w+8,0)`
   - `(0,-h/2-2)`, `(0,h/2+2)`, `(-w/2-2,0)`, `(w/2+2,0)`, which place the box beside the route
   - `(-w-4,-h-4)`, `(w+4,-h-4)`, `(-w-4,h+4)`, `(w+4,h+4)`, the diagonals

### Nearest free position

Taking the first free offset in a fixed list can pass over a nearer free position. This is what
leaves labels away from their connector, because own-route distance plays no part in the choice.

The candidates in item 3 are sorted once per placement by their gap to the connector's own route,
ascending, with ties in the order listed. The gap is the shortest distance between the label box and
the route's segments, and 0 when they touch. A self-transition's route is its loop, so the same rule
keeps the label near the loop. The first free candidate in that order is therefore the nearest one.
If none is free, the lowest score wins and ties go to the nearest.

- Compare squared distances. Do not use `Math.hypot` or `Math.sqrt` for ordering, because engines
  may round them differently and a changed tie would break byte parity with the native CLI.
- Compute the gap with indexed loops over the route points, and sort only when items 1 and 2 hold no
  free candidate, so labels that find a zero early pay nothing.
- `planLabelFixes` uses the same candidate order, so `lint --fix` also picks the nearest free spot.
- A test-only export gives the gap and the candidate list, next to `scoreLabelPlacementForTest`. It
  is not exported from `packages/core/src/index.ts`.

The 2 label overlaps recorded after layered and route, which `lint --fix` also leaves, are expected
to clear through the new close candidates and the route changes from overlap repair. This has not
been measured. If they remain, extend item 3 with further rings around each position, in the same
sort order, and record the measurement that led to it.

Scoring is `labelOverlapScore`, so placement and `lint --metrics` agree. Labels are
placed in stable order, then labels still scoring above 0 get a second pass with all
other labels held. Boxes come from `resolvedLabelBox`. BPMN flows with
`visual.labelBounds` stay fixed and reserved. Results write `labelPosition` and the
offsets, with absent meaning the default.

"Free position" is defined as a candidate above. A label with no zero-score candidate
keeps its lowest-score position and stays visible in `lint --metrics`.

Hot-loop rule: routes and boxes are flattened into numeric arrays once per call, with
a bounding-box reject before `segmentOverlapsBox`, because that function allocates
per call.

Resolver: `withRoute` adds the offset to `labelPoint` for non-BPMN connectors, so all
consumers of `labelPoint` follow.

### `arrange` report

`arrange-modes.ts` compares the label fields before and after applying the plan. In
non-`--check` runs with moved labels it adds this stderr line:
`Moved <n> connector label(s): <id>, <id>...`. Stable order. Stdout and `--check`
exit codes do not change.

### `lint --fix`

- Applies to pages of `ROUTE_PAGE_KINDS`, within `--page`. `planLabelFixes` selects
  connectors with a score above 0, or with a `label-collision` finding on a text-layout
  page. Others are held. `lintDiagramPages` plans these after text wrapping, against the
  written document, and writes through `runOperations` `update`, where `null` removes a
  field.
- `TextWrapFix` joins a new `LabelMoveFix`
  `{pageId, elementId, ruleId:"label-collision", field:"labelPosition", before, after}`,
  where `before` and `after` hold the three label fields.
- Text: `fixed <id> label-collision: moved label`.
- `.bpmn` input keeps exiting 2. Which rules run on which page (baseline Q1) does not
  change. The findings list is computed after the fix, as today.

## R5. Self-loops

Revises A5 in `planRoute`:

- Side order: `top`, `right`, `bottom`, `left` (revises the baseline order, see user-qa
  Q1). The first side no other connector end and no earlier self-loop uses is taken.
- All four used: if some side has only movable ends, take the side with the fewest such
  ends, ties by side order, and reassign those ends to the adjacent side closer to each
  end's opposite center (horizontal neighbors for top and bottom, vertical for left and
  right). The self-loop takes the freed side.
- Otherwise: the side with the fewest ends, ties by side order. The loop's positions 0.3
  and 0.7 are reserved as fixed coordinates in A4 spreading, so other ends do not land
  on them.
- Label: self-loops go through R4 like every other label.
- Manual self-loops and self-loops without arranging keep their existing geometry, and
  `erd.relation` self-relations keep theirs.

## Boa and performance

- Follow the baseline Boa rules: no regex `split` on whole documents, no per-point
  destructuring in hot loops, indexed access safe under `noUncheckedIndexedAccess`.
- Candidate counts are fixed above. Selection adds 3 placements and routes without
  separation. The final pass runs once.
- Existing deadlines are not relaxed. Manual check: release-binary `/usr/bin/time -p` of
  layered then route on the fixture, recorded in plan progress, target a few seconds.
- `mise run test-cli` and native deadline tests get a 3-attempt retry before a timeout
  counts as failure, and CPU time is compared with the pre-change binary.
- Overlap repair and label sorting add work only for connectors that still overlap and labels with
  no free on-route position. A candidate list has at most 19 + 19 x 16 = 323 entries.

### Baseline binary and timing

This replaces the `target/crl-baseline` steps in `crl-07-wiring`, including its verifications 5 and
9. No baseline source or binary goes under the repository working tree, because `bun test` paths act
as filters over a discovery tree that includes `target`.

1. Create a temporary directory outside the repository with `mktemp -d`.
2. Extract `git archive 1e8f43d` there, run `bun install --frozen-lockfile`, and run
   `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` with its `--manifest-path` and
   `--target-dir` also in that directory.
3. Record in the progress log the commit, tool versions, commands with exit codes, and the binary's
   sha256.

Measure 3 runs each of `/usr/bin/time -p`, on copies, with the baseline and current release binaries:

- `arrange --mode layered --write`, then `arrange --mode route --write`, on page `States`
- `lint --metrics` and `lint --fix`
- the batch and mixed fixtures of `apps/cli/src/native-parity/edit-performance.test.ts`

Record mean user seconds and the current to baseline ratio. The ratio is a record, not a gate:
current `arrange` does more work by design. Current layered then route above a few seconds in total
is a repair item, hot loops first. The gate is that existing deadline tests pass unrelaxed.

## Fixture and acceptance tests

`apps/cli/src/__fixtures__/connector-arrange.ts`, a deterministic generator with neutral
names:

- State page: 4 frames (`Stage0`..`Stage3`), 17 `state.node` (`Idle` initial, `Running`,
  `Paused`, `Done`, then `State4` onward) placed in frames in a fixed order, 43 labeled
  transitions between different states and 4 labeled self-transitions, generated by an
  index formula, with `routing: "orthogonal"`, `routingAvoidObstacles: true` and no ports.
- Architecture page: boxes A, C, B on one row, D below.

The generator is fixed before algorithm work, and plan crl-02 records its baseline
metrics. It is not changed later to make an acceptance test pass.

| Req | Test |
| --- | --- |
| R1 | Each tier and the precedence, `visual` applied, `sequence.message` rejection, set and clear of the page default, Bun and native parity |
| R2 | `semantic` and `visual` forms: SVG polyline equals `resolveConnector` points and no segment enters C; two runs byte-identical; reload through parse covers `visual.extensions`; native parity |
| R3 | Before and after metrics on the fixture: `segmentOverlaps` 0, `edgeCrossings` not above input; rerun of `route` is a no-op. `layered and route fixture metrics and repeatability` keeps its assertion |
| R3 repair | Self-authored scenes: an overlap the greedy pass leaves is cleared by repair with an earlier connector moving; a port shift keeps the order of ends and misses a self-loop's 0.3 and 0.7; an input with no overlaps gets no new patch; reversed input order gives the same patches |
| R4 | `labelOverlaps` 0 on the fixture after `arrange` and after `lint --fix`; moved ids reported |
| R4 nearest | Scene with on-route positions blocked: the chosen gap is the smallest among free candidates, and at most h + 8 when a free position sits beside the route. The same on a self-transition, measured to its loop. On the arranged fixture every label's gap is at most 1.5 x max(w, h) + 8, and the measured maximum is recorded |
| R5 | Each self-loop on the arranged fixture is on a side no other end uses, read from stored ports |
| Native | See the coverage below |

The shared fixture must reach 0 for overlaps. A residual overlap may be accepted only on a specific
self-authored case that is proven geometrically unavoidable, with its own named test and a bound
documented in `docs/cli.md`. "No free position was found" is not a proof.

Native parity, each with `nativeTest`, `compare` or `compareFile`, and 0 skipped:

| Area | Requirement | Current state |
| --- | --- | --- |
| `connect` fields | Top-level `routing` and `routingAvoidObstacles`, `visual.routing`, and precedence | Partly in `connect-routing.test.ts` |
| `set-page-routing` | Set, and clear with `"routing":null` | Set only |
| `add-page` | `connectorRouting` | Missing |
| Page convention | Plain `connect` following uniform peers | Missing |
| Stored routing in export | Fixed-id document with `semantic` and `visual` forms, SVG compared | Missing: the current export runs on a page with no connectors |
| Layered and route | On the fixture | Present |
| `lint --metrics` | JSON and text, with `segmentOverlaps` | JSON only |
| `lint --fix` label moves | An arranged document with a label forced into overlap, asserting `moved label` in stdout | Not exercised: the current run starts from an arranged document, so it should move nothing |

End-to-end tests read `export --format svg` geometry, and accept `polyline`, or `line` for a 2-point
route:

- Page with A, C, B on one row and D below. A->B from a plain `connect` under a page default, and
  separately under a page convention, has no segment entering C's box.
- D->B stored as `orthogonal` with `routingAvoidObstacles`, in both the `semantic` and `visual` forms,
  has only horizontal and vertical segments.
- Fixture self-transitions: the R5 row, after layered then route.

The remaining items in the `crl-07-wiring` "Tests" section stay required and move to crl-09. Skip
any item an existing test already covers, and record which test covers it. One known gap: no test
yet covers a document with both wrap and label fixes making a single write.

Raster tests, if any are added, must not depend on a platform font. These tests assert
on SVG geometry and metrics.

## Existing outputs that may change

Only these, each justified by the request. Rebaselines name the requirement in the commit.

- `arrange-layered-bpmn.*.expected.json` and arrange tests: only `routingLane`,
  `routingBend`, port positions from overlap repair, label fields and self-loop sides, and only
  where overlaps or overlapping labels existed.
- `connector-label-placement.test.ts` and `arrange-route.test.ts`: which offset a blocked label
  gets, now the nearest free one. Tests of items 1 and 2 and BPMN candidates must not change.
- `lint-metrics.test.ts` and `metrics.test.ts`: new field and text.
- Connect tests on pages with uniform stored routing: convention.
- `obstacle-routing-batch` goldens run `edit`, not arrange, and must not change.

## Plan partition

Every plan sets `artifactRoots: ["target"]`. Verification per plan: targeted `bun test` plus
`bun run typecheck`. Final: `mise run verify`, `mise run test-cli`, manual native timing. CLI
code reaches new core exports only after wiring, so CLI-facing use of them is in crl-07.

| Wave | Plan | Owns |
| --- | --- | --- |
| 1 | crl-01 IR and resolver | `packages/ir` types, validate, registries; `packages/io` parse, records, BPMN equivalence; `packages/collab/src/ydoc.ts`; core `commands.ts`, `editor/pages.ts`, `editor/facade/page-editing.ts`, `editor/bpmn.ts`; `shapes/connector/resolve.ts`, `route.ts`; `packages/ui-solid/src/connector-routing.ts`; adjacent tests |
| 1 | crl-02 Metric and fixture | `diagram-lint/metrics.ts`, `apps/cli/src/lint-metrics.ts`, `apps/cli/src/__fixtures__/connector-arrange.ts`, adjacent tests, recorded baseline |
| 1 | crl-03 Label placement | `packages/core/src/connector-label-placement.ts` and test |
| 2 | crl-04 Connect | `apps/cli/src/edit/operations/{connect,add,pages}.ts`, `edit/connect-routing.ts`, `edit/operation-fields.ts`, `edit/batch.ts`, adjacent tests, `native-parity/connect-routing.test.ts` |
| 2 | crl-05 Lanes and self-loops | `packages/core/src/arrange-route.ts`, `arrange-route-lanes.ts`, tests and BPMN goldens as justified |
| 2 | crl-06 Layered ordering | `packages/core/src/arrange-layered.ts`, `arrange-layered-order.ts`, tests |
| Final | crl-07 Wiring | `apps/cli/src/commands.ts`, `help.ts`, `arrange-modes.ts`, `lint-diagram.ts`, `docs/cli.md`, `README.md`, `packages/core/src/index.ts`, `native-parity/connector-arrange.test.ts`, fixture acceptance tests |

Contracts between waves: the field names and helpers named in this document. crl-06 takes its
`evaluate` as a parameter, so it does not depend on crl-05.

## Continuation plans

crl-01 to crl-06 are committed, and CLI wiring, help and docs from crl-07 are in. crl-07's remaining
work moves to the plans below. They do not restructure crl-01 to crl-06. They change them only as W1
and W2 need.

| Wave | Plan | Work | Depends on |
| --- | --- | --- | --- |
| 1 | crl-08 Repair and labels (W1, W2) | `packages/core/src/arrange-route-lanes.ts`, `arrange-route.ts` (patch merge), `connector-label-placement.ts`, their tests, `apps/cli/src/connector-arrange.test.ts` (additions only), `connector-arrange-route.test.ts`, `arrange-modes.test.ts`, BPMN goldens as justified | - |
| 2 | crl-09 Parity and end-to-end (W3, W4) | `apps/cli/src/native-parity/connect-routing.test.ts`, `connector-arrange.test.ts`, `edit-performance.test.ts` (read only for its fixtures), `lint-diagram.test.ts`, a new `apps/cli/src/connector-routing-e2e.test.ts`, baseline and timing record; for a defect a test exposes, the crl-08 core modules, `shapes/connector/resolve.ts` and `orthogonal-routing.ts` | crl-08: its routes and labels are what parity and timings measure |
| Final | crl-10 Finish (W5) | `apps/cli/src/help.ts`, `commands.ts`, `docs/cli.md`, `README.md`, `packages/core/src/index.ts`, `impl-plans/README.md`, plan archive, gates on the merged tree, and gate-required semantic conflict fixes | crl-09 |

- Every plan sets `artifactRoots: ["target"]`. Logs go under `tmp/crl-s753/<planId>/`, and no file
  there may match a Bun test name pattern.
- Help and docs (crl-10): the repair behavior, the nearest free position, and removal of any text
  that offers a fixture bound.
- Archive: all crl plans and manifests end in `impl-plans/completed/`. crl-10 moves `crl-00..07` and
  `crl-s749-dispatch.json`. The workflow's `plan-archive` node moves the plans of this run, because
  workers never move a plan in the run, and the crl-10 record says so. The request names manifests,
  so this differs from the manifests other features keep in `active/`, and `impl-plans/README.md`
  says so. Progress
  logs stay in `impl-plans/progress/`, as that README requires. `crl-07-wiring.md` gets a closing
  note naming crl-08 to crl-10 and this document as replacing its open items and its
  `target/crl-baseline` steps.
- Final gates: `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify` and
  `CARGO_TERM_QUIET=true mise run test-cli`, with a 3-attempt retry on native deadline timeouts only.
  A test pinning old behavior changes only where the new behavior is requested, with the reason
  recorded. This covers conflicts with element conversion, participant shapes, ERD frame scope,
  sequence self-messages and file save stability.
- No push, merge or base-branch integration.
