# clm-06-route-arrange

## Continuation 2 2026-11-05 (clm-s732) - authoritative

Status at HEAD `29f8691135fb6098a9496495f4a417e93ce0625e`: `arrange-route.ts`,
`diagram-lint/metrics.ts`, the `bpmn/notation.ts` label changes,
`arrange-modes.ts`, `lint-metrics.ts` and their tests are committed, and their
plan gates passed. The plan has not been reviewed or accepted. "Nothing of this
plan has landed yet" in the s731 section below is out of date; do not rewrite
these modules.

- wave: 1; dependsOn: none. clm-02 is not a dependency: this plan only calls
  `applyCommands` and `Editor.apply`, whose results clm-02 keeps.
- Scope: close the gaps below against the design's Verification rows A2 to A5,
  "A3 metrics" and E2 (route part), fixing any defect the new tests reveal in
  owned files. No new scope.
- writePaths: the s731 list below, with `tmp/clm-s732/clm-06-route-arrange` as the
  evidence path. Manifest: `impl-plans/active/clm-s732-dispatch.json`.
- The s731 rules, tests and amended verification below stay binding, except that
  the "no ERD layered test here" note no longer applies, because clm-10 has landed.

### Non-goals

- No BPMN `layered` dispatch; clm-09 adds it, and until then the existing test
  stays exit 2. No registration in `commands.ts`, `help.ts` or `index.ts`.
- `bun run typecheck --noUncheckedIndexedAccess` is not a gate here (round 1
  disposition below). The modules owned here must still add no new strict
  diagnostics.
- Do not edit `arrange-layered.ts` or any file of clm-02 or clm-12.

### Gaps found by the coverage audit (file: situation -> expected)

`packages/core/src/arrange-route.test.ts`:

- G1 A2 regression: a `routing: "manual"` connector with non-empty
  `routingWaypoints` whose straight path is blocked by a widget. With
  `resetManual`, the resolved route crosses no obstacle clearance box and no
  element moves. No current test asserts clearance.
- G2 A3 generic path: on a state or freeform page, a label whose midpoint sits on
  a blocking element -> `labelPosition` is not 0.5 and its box at
  `connectorLabelBoxAt` overlaps nothing; another candidate blocked by an already
  placed label is skipped. Only the BPMN path is covered today.
- G3 A5 fallback: an element with all four sides used -> the self-loop takes the
  side with the fewest ends, in the fixed order on ties.
- G4 ERD labels: a relation with label text on a blocked midpoint -> `labelPosition`
  moves; a relation with no label text -> no write.
- G5 `labelBounds` as a placed label: flow A with `visual.labelBounds` over flow B's
  midpoint -> B moves away and A has no `labelPosition` write.

`packages/core/src/diagram-lint/metrics.test.ts`:

- G6 A3 decrease: a crafted page where `labelOverlaps` is at least 1; after
  applying `planRoute` it is lower.
- G7 ERD metrics: an ERD page with crossing relations and a label on a table ->
  both counts above 0, and a label inside a containing `frame` only -> 0.

`apps/cli/src/arrange-modes.test.ts`:

- G8 exclusions: breadboard and pcb pages -> exit 2 for both modes, and the
  message names the supported kinds. Only sequence is covered today.
- G9 ERD layered: ERD page with frames -> exit 0 and tables inside their frames;
  without frames -> exit 2.
- G10 flags: `--frames Stage1,Stage0` reverses the column order, `--direction TB`
  gives rows, and the unknown-frame error lists the column frames. Assert these
  explicitly if an existing test only checks the exit code.

`apps/cli/src/lint-metrics.test.ts`:

- G11 BPMN and ERD pages produce metric lines in page order.

Boa audit, recorded in the progress log: no regex `split` on documents and no
per-point destructuring in segment loops in `arrange-route.ts` and `metrics.ts`.
Fix any hit in those files.

### Pitfalls

- If a gap test fails, fix the owned module, not the expected value, unless the
  design says otherwise; quote the design row in the progress log.
- A real defect in `Editor.apply` belongs to clm-02: record it, do not edit it.
- Keep evidence under 300 files. One log per gate; do not write per-edit hash
  files (the s731 run produced 274). Record pre/post hashes in the progress log.

### Done criteria (mechanical)

- Tests G1 to G11 exist and the manifest verification commands exit 0.
- `git status --short` shows only this plan's writePaths changed by this plan.

## Continuation 2026-11-04 (clm-s731) - authoritative

This section supersedes the header fields below (wave, dependsOn,
writePaths, evidence paths) and amends the Rules, Tests and Verification
below. Nothing of this plan has landed yet; implement the whole plan
(sections below) plus the E2 changes here.

- wave: 1; dependsOn: none. clm-02's connector fields, `pointAlongRoute`,
  `connectorLabelBoxAt` and the same-side self-loop, and clm-07's
  `planLayered`/`columnFrames`/`LAYERED_PAGE_KINDS` are landed at HEAD.
- Design additions: "Eligible pages" (revised), A2 targets (revised), A3
  score with `isLabelObstacle`, A3 metrics, E2 table, E2.2, continuation
  contracts (`ROUTE_PAGE_KINDS`, `bpmnFlowLabelBox`, `isLabelObstacle`),
  Verification row E2.
- writePaths (clm-s731):
  - `packages/core/src/arrange-route.ts` (new)
  - `packages/core/src/arrange-route.test.ts` (new)
  - `packages/core/src/diagram-lint/metrics.ts` (new)
  - `packages/core/src/diagram-lint/metrics.test.ts` (new)
  - `packages/core/src/bpmn/notation.ts`
  - `packages/core/src/bpmn/notation.test.ts`
  - `packages/core/src/bpmn/svg-export-bpmn.test.ts`
  - `apps/cli/src/arrange-modes.ts` (new)
  - `apps/cli/src/arrange-modes.test.ts` (new)
  - `apps/cli/src/lint-metrics.ts` (new)
  - `apps/cli/src/lint-metrics.test.ts` (new)
  - `impl-plans/progress/clm-06-route-arrange.md`
  - `tmp/clm-s731/clm-06-route-arrange`
  - `target`
- sharedPaths: none; artifactRoots: `target`
- sharedPathNotes: `packages/core/src/bpmn/notation.ts`: only the flow-label
  anchor precedence inside `bpmnFlowDecoration` and the new export
  `bpmnFlowLabelBox`; no other notation change.
- Evidence directory: `tmp/clm-s731/clm-06-route-arrange/` (replaces
  `tmp/clm-s725/...` everywhere below).

### Amended rules

- R2 (targets): `ROUTE_PAGE_KINDS = ["state", "flowchart", "freeform", "architecture", "uml", "erd", "bpmn"]`
  (own constant; do not derive from `LAYERED_PAGE_KINDS`). `sequence.message`
  is never a target. `erd.relation` and `bpmn.sequenceFlow`,
  `bpmn.messageFlow`, `bpmn.association`, `bpmn.dataAssociation` are targets.
- ERD: an end with `erdEndpointColumnIds(semantic[end]).length > 0` never gets
  `fromPort`/`toPort`/positions written and is not in any spreading group (it
  has no port). Table-level ends follow R4/R6. An ERD self relation: no
  ports, no A5. Label text = `connectorDecoration(element).label`; empty ->
  skip A3.
- BPMN: A5 same-side self-loop applies. Label text = `semantic.name`; label
  box = `bpmnFlowLabelBox` (below), never `connectorLabelBoxAt`. A flow with
  `visual.labelBounds` is manual for labels: never write its
  `labelPosition`; its box at `labelBounds` counts as a placed label.
- R7 score obstacles and R8 metrics: use `isLabelObstacle(element)` exported
  from `metrics.ts`: false for edges and for containing surfaces (`frame`,
  `group`, `bpmn.participant` unless `semantic.collapsed === true`,
  `bpmn.lane`, `bpmn.subProcess` with `semantic.expanded === true`,
  `bpmn.group`); true otherwise. `planRoute` and `pageMetrics` both use it.
- `notation.ts`:
  - Anchor precedence in `bpmnFlowDecoration`: `visual.labelBounds` centre;
    else, when `semantic.labelPosition` is a finite number,
    `pointAlongRoute(points, clamp01(labelPosition))` (import from
    `../shapes/connector/route.ts`); else `polylineMidpoint(points)`. No
    `labelPosition` -> byte-identical primitives.
  - `export function bpmnFlowLabelBox(element: Element, points: readonly Vec[], anchor: Vec): Box | null`:
    null for empty `name`; lines = the same `wrapTextLines(name, 90, 11)`;
    `w` = widest line by `estimatedTextWidth` (`../text-layout.ts`) at font
    11; box `x = anchor.x - w / 2`, `y = anchor.y - 11 * 0.8`,
    `width = w`, `height = 11 * 0.8 + (n - 1) * 13 + 11 * 0.2`. Name the
    constants (font size 11, line height 13, ascent/descent ratios) once and
    use them in both `bpmnFlowDecoration` and the helper.
- `arrange-modes.ts`: route accepts `ROUTE_PAGE_KINDS`; layered accepts
  `LAYERED_PAGE_KINDS` imported from `arrange-layered.ts` (clm-10 adds `erd`
  there in parallel; do not test ERD layered here). `bpmn` with layered exits
  2 with the supported-kinds message until clm-09 adds the BPMN dispatch.
  sequence, breadboard, pcb -> exit 2 for both modes.

### Added tests

- `notation.test.ts`: `bpmn.sequenceFlow` named `Review order` on
  [(0,0),(200,0)]: no `labelPosition` -> text at x=100 (unchanged);
  `labelPosition` 0.2 -> x=40, 0.8 -> x=160; with `labelBounds` and
  `labelPosition` -> `labelBounds` centre wins. `bpmnFlowLabelBox` for
  `First row\nSecond row\nThird row\nFourth row` at y=100 -> y 91.2,
  height 50 (covers baselines 100, 113, 126, 139).
- `svg-export-bpmn.test.ts`: an existing BPMN fixture without
  `labelPosition` -> SVG byte-identical to the pre-change output (capture
  before editing); with `labelPosition: 0.2` the flow-label `<text>` x moves.
- `arrange-route.test.ts`: BPMN flow label whose midpoint sits on a task ->
  `labelPosition` written and the rendered anchor (`bpmnFlowDecoration`)
  equals `pointAlongRoute` at that value; the four-line label with a task at
  (80,130,40,12) under only the last line scores > 0 at that candidate; a
  label inside only its pool and lane scores 0 (no write when 0.5 wins); flow
  with `labelBounds` -> no `labelPosition` write; BPMN self-loop -> same-side
  ports; ERD: column-anchored ends get no ports and are not spread,
  table-level ends spread, self relation unchanged.
- `metrics.test.ts`: BPMN label inside pool and lane only -> `labelOverlaps`
  0; label over a task, a collapsed sub-process, another label or another
  route -> > 0; scoring box equals metrics box (`bpmnFlowLabelBox`).
- `arrange-modes.test.ts`: route on erd and bpmn pages -> exit 0; layered on
  bpmn -> exit 2 with supported kinds; sequence -> exit 2 for both.

### Amendment 2026-11-04 (integration-paths-outside-writePaths, round 1)

- Finding IR-CLM06-STRICT-DISPOSITION. The integration review gave a baseline
  disposition for `bun run typecheck --noUncheckedIndexedAccess`: exit 2, 99
  diagnostics (`tmp/clm-s731/clm-06-route-arrange/resume-gate-6.log`).
  - This command is not a clm-06 gate.
  - None of the diagnostics is in a clm-06 production module (`arrange-route.ts`,
    `diagram-lint/metrics.ts`, `bpmn/notation.ts`, `arrange-modes.ts`,
    `lint-metrics.ts`).
  - The hits in `bpmn/notation.test.ts` and `bpmn/svg-export-bpmn.test.ts` are
    in pre-existing test code. Treat them as baseline.
  - The one production-core hit (`diagram-lint/node-overlap.ts`) is now owned
    by clm-09.
- Do not block on this check. Record the disposition in the progress log,
  rerun the gates listed below, and return a non-blocked result for review.
- writePaths are unchanged.

### Amended verification (each must exit 0)

1. `bun test packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.test.ts packages/core/src/bpmn/notation.test.ts packages/core/src/bpmn/svg-export-bpmn.test.ts packages/core/src/connector-positions.test.ts`
2. `bun test apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.test.ts`
3. `bun run typecheck`
4. `bunx biome check packages/core/src/arrange-route.ts packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.ts packages/core/src/diagram-lint/metrics.test.ts packages/core/src/bpmn/notation.ts packages/core/src/bpmn/notation.test.ts packages/core/src/bpmn/svg-export-bpmn.test.ts apps/cli/src/arrange-modes.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.ts apps/cli/src/lint-metrics.test.ts`
5. `grep -n "export function bpmnFlowLabelBox" packages/core/src/bpmn/notation.ts` and `grep -n "export function isLabelObstacle" packages/core/src/diagram-lint/metrics.ts`
6. Record the Bun wall time of the A7-fixture layered test in the progress log.

Remove `packages/core/src/arrange-layered.test.ts` from verification 1 below
(clm-10 owns and edits it in parallel). The "erd page -> exit 2" test below is
replaced by the added arrange-modes tests above.

---

- planId: clm-06-route-arrange
- planPath: impl-plans/active/clm-06-route-arrange.md
- progressPath: impl-plans/progress/clm-06-route-arrange.md
- wave: 2
- dependsOn:
  - clm-02-connector-edit-perf: the connector fields, `connectorLabelBoxAt`,
    `pointAlongRoute` and the same-side self-loop.
  - clm-07-layered-core: `planLayered`, `columnFrames` and
    `LAYERED_PAGE_KINDS`.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections "CLI
  surface", A1 (the route stage after placement), A2 to A5 and "A3 metrics",
  plus the A1, A2, A3 and A4/A5 rows of "Verification". Owner question Q6:
  values that arrange wrote count as manual.
- writePaths:
  - `packages/core/src/arrange-route.ts` (new)
  - `packages/core/src/arrange-route.test.ts` (new)
  - `packages/core/src/diagram-lint/metrics.ts` (new)
  - `packages/core/src/diagram-lint/metrics.test.ts` (new)
  - `apps/cli/src/arrange-modes.ts` (new)
  - `apps/cli/src/arrange-modes.test.ts` (new)
  - `apps/cli/src/lint-metrics.ts` (new)
  - `apps/cli/src/lint-metrics.test.ts` (new)
  - `impl-plans/progress/clm-06-route-arrange.md`
  - `tmp/clm-s725/clm-06-route-arrange`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan builds the pure route planner, which plans:

- the reset of manual settings;
- routing inputs and ports;
- port spreading;
- self-loop sides;
- label positions.

It also builds the metrics, and the two CLI modules that clm-09 dispatches
to:

- `arrange-modes.ts`: `arrange --mode layered|route`;
- `lint-metrics.ts`: `lint --metrics`.

Elements never move in route mode. The resolver draws the
obstacle-avoiding route at render time.

- Imitate the `{ commands }` style of
  `packages/core/src/arrange.ts:planArrangement`, and use `updateSemantic`
  commands that carry the full merged semantic, as
  `packages/core/src/manual-route-preservation.ts` does.
- The CLI flow to imitate is `apps/cli/src/commands.ts:arrangeCommand`
  (around lines 741-800): parse, `loadDocument`, `selectPage`, apply, then
  `--write`/`--check`/stdout. Import `parseArgs`, `loadDocument`,
  `selectPage`, `writeOutput`, `ok` and `fail` from `commands.ts`, as
  `diff-command.ts` does. Resolve `--frames` like the `ddl --frame`
  resolver in `commands.ts`, and `--ids` with `resolveId` from `ids.ts`.

## Non-goals

- Do not edit `commands.ts`, `help.ts`, `packages/core/src/index.ts`, the
  resolver files or `arrange-layered.ts`. Import new core symbols by
  relative path.
- Never move an element in route mode. Never touch connectors that are not
  targets.
- `tidy`, `overlaps` and `edit --arrange` are unchanged.

## Contract

```ts
// packages/core/src/arrange-route.ts
export const ROUTE_PAGE_KINDS: readonly PageKind[]; // same list as LAYERED_PAGE_KINDS
export interface RouteOptions { readonly targetIds?: readonly ElementId[]; readonly resetManual: boolean }
export function planRoute(store: Store, pageId: PageId, registry: ShapeUtilRegistry, options: RouteOptions): Command[];
// packages/core/src/diagram-lint/metrics.ts
export interface PageMetrics { readonly edgeCrossings: number; readonly labelOverlaps: number }
export function pageMetrics(store: Store, pageId: PageId, registry: ShapeUtilRegistry): PageMetrics;
// apps/cli/src/arrange-modes.ts
export function arrangeLayeredOrRoute(io: CommandIo, args: readonly string[]): CommandResult;
// apps/cli/src/lint-metrics.ts
export function lintMetrics(document: Document, pageIds: readonly PageId[]): Map<PageId, PageMetrics>;
export function formatMetricsLines(document: Document, metrics: ReadonlyMap<PageId, PageMetrics>): string;
```

`arrangeLayeredOrRoute` receives the same `args` that `arrangeCommand`
receives. clm-09 calls it when `--mode` is `layered` or `route`.

## Rules (design, implement exactly)

1. `planRoute` builds a draft `Store` copy with a shape context
   (`createShapeContext(draft, registry, 1)`) and applies its intermediate
   commands to the draft, so routes reflect the new ports before labels are
   placed. It returns the commands from the input to the final state.
2. Targets: connectors on the page with both ends attached, except
   `erd.relation`, `sequence.message` and `bpmn.*`. With `targetIds`, only
   those. In id order.
3. Reset (`resetManual`), targets only: set `routing: "orthogonal"`, and
   delete `routingWaypoints`, `routingBend`, `fromPort`, `toPort`,
   `fromPortPosition`, `toPortPosition` and `labelPosition`.
4. Manual means `routing === "manual"`, or `fromPort` set, or `toPort` set.
   - Manual targets keep routing, waypoints, bend, ports and positions.
   - Non-manual targets get `routing: "orthogonal"`, lose
     `routingAvoidObstacles: false`, and get ports: right/left by sign when
     |dx| >= |dy| between box centres, otherwise bottom/top.
5. Self-loops (A5), in id order: the first side in right, top, bottom,
   left that no other connector end on the element uses, counting sides
   taken by earlier self-loops. Otherwise the side with the fewest ends.
   Write both ports with that side, and positions 0.3 and 0.7. Manual
   self-loops are kept.
6. Spreading (A4):
   - Group every connector end that has a port on the page (targets and
     non-targets) by element and side. Self-loop ends are excluded.
   - Order the ends by the opposite centre projected on the side axis, then
     connector id, then from-end first.
   - Fixed ends are manual or non-target ends. They reserve their stored
     position, or 0.5.
   - No fixed ends: position `(k+1)/(m+1)`, and nothing written when m = 1.
   - With fixed ends: the gap allocation in design A4 steps 1-5, including
     the 0.0001 collision rule. Every movable end is written.
   - Round with `Math.round(x * 10000) / 10000`.
7. Labels (A3), for each target with a non-empty label (the text
   `connectorDecoration` shows), in id order:
   - Resolve the route once on the draft.
   - Try 0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9 with `pointAlongRoute` and
     `connectorLabelBoxAt`.
   - Score: overlaps with labels already placed, with boxes of non-edge,
     non-frame, non-group elements, and with other connectors' segments.
   - The first score of 0 wins, else the lowest, with ties to the earlier
     candidate.
   - Write the field only when it is not 0.5. Delete it at 0.5.
8. Metrics:
   - `edgeCrossings`: proper intersections between the resolved polylines
     of each unordered pair of distinct connectors. Points within 1 unit of
     any endpoint of either connector are excluded. A collinear
     overlapping segment pair counts once.
   - `labelOverlaps`: label box against another label box, an element box
     or another connector's segment.
   - The predicate lives in `metrics.ts`, and `planRoute` imports it, so
     scoring and metrics agree.
9. Omit commands whose resulting semantic equals the current one, so a
   rerun is idempotent.
10. `arrangeLayeredOrRoute`:
    - Options `--mode`, `--direction`, `--page`, `--frames`, `--ids`; flags
      `--reset-manual`, `--write`, `--check`.
    - Exit 2 (usage) for `--frames` without layered, `--ids` without route,
      or an ineligible page kind (the message names the supported kinds).
    - `--frames`: comma-separated and trimmed. Resolve against
      `columnFrames` by exact id, then exact `semantic.name`, then a unique
      id prefix of at least 6 characters. An unknown, ambiguous, duplicate
      or non-column value exits 2 and lists the column frames (short id,
      name, full id).
    - `--ids`: each value is a unique prefix of a connector on the selected
      page; anything else exits 2.
    - layered: `planLayered` (an error exits 2 with its message), then
      `editor.apply(commands, { placed })`, then `planRoute` on the result
      for every connector with the same `resetManual`, then apply.
    - route: `planRoute`, then apply.
    - `--check` exits 1 when either stage changes anything. `--write` and
      stdout behave as in `arrangeCommand`.
11. `lintMetrics` computes `pageMetrics` for each given page that has
    connectors. `formatMetricsLines` prints
    `metrics <page name>: <n> edge crossing(s), <m> edge-label overlap(s)`
    per page, in page order.

## Pitfalls

- After a reset, the target must go through rule 4 as non-manual. A
  previous `routing: "manual"` must not survive.
- A fixed end never shares a coordinate with a movable end. Test with a
  fixed value of 0.6667.
- Score against the draft after the port and self-loop commands, not
  against the input.
- Use indexed loops with no destructuring for segment intersection. About
  50 edges at O(E^2 * S^2) is acceptable. Time it (see Verification 5).
- Sort everything by id. Never rely on store iteration order.

## Tests (input -> expected)

`arrange-route.test.ts`:
- No element `visual` changes in any route test.
- A manual connector with waypoints whose straight path is blocked by a
  widget box:
  - without reset, its routing, waypoints and resolved points are
    unchanged;
  - with reset, it is orthogonal with no waypoints, and the resolved route
    does not cross the widget's clearance box.
- `targetIds: [a]` -> only `a` changes.
- Two edges leaving the right side of `Idle` -> 0.3333 and 0.6667, in
  target-y order.
- A fixed manual end at 0.6667 plus one movable end -> the movable end gets
  `Math.round(0.6667/2*10000)/10000`, which lies in (0, 0.6667) and at
  least 0.0001 from 0.6667. The manual end is unchanged.
- A fixed end with no stored position -> movable ends avoid 0.5.
- `targetIds` naming one of three edges on a side -> the other two are
  unchanged, and the named end avoids their coordinates.
- A rounding collision -> a distinct nudged value.
- A self-loop whose right side is used -> `top`. All sides used -> the side
  with the fewest ends.
- A label whose midpoint sits on a blocking element -> `labelPosition` is
  not 0.5, and the box does not overlap.
- Rerun on the result -> no commands.

`metrics.test.ts`:
- Two crossing edges -> `edgeCrossings` 1. A shared endpoint -> 0.
- A label on an element -> `labelOverlaps` >= 1. After `planRoute` -> fewer.

`arrange-modes.test.ts`: in-memory `CommandIo`, calling
`arrangeLayeredOrRoute` directly.
- State page, frames `Stage0`/`Stage1`, states `Idle`/`Running`/`Done`:
  - layered puts columns in traversal order with members inside;
  - `--check` after `--write` -> exit 0.
- `--frames Stage1,Stage0` -> reversed. Unknown frame -> exit 2 with the
  candidate list.
- `--direction TB` -> rows.
- route -> no element moves, orthogonal plus ports. `--ids <one>` limits
  the change. The reset regression as in `arrange-route.test.ts`.
- erd page -> exit 2. `--frames` with route -> exit 2. A non-connector
  `--ids` -> exit 2.
- The clm-02 A7 fixture document with layered -> completes in Bun in under
  10000 ms.

`lint-metrics.test.ts`: two crossing edges -> the line shows
`1 edge crossing(s)`. A page without connectors -> no line.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.test.ts packages/core/src/arrange-layered.test.ts packages/core/src/connector-positions.test.ts`.
2. `bun test apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.test.ts`.
3. `bun run typecheck`.
4. `bunx biome check packages/core/src/arrange-route.ts packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.ts packages/core/src/diagram-lint/metrics.test.ts apps/cli/src/arrange-modes.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.ts apps/cli/src/lint-metrics.test.ts`.
5. Record the Bun wall time of the A7 fixture layered test from
   verification 2 in the progress log. The native timing runs in clm-09.

## Done criteria

- The contract symbols exist, and verification 1 to 4 exit 0 with logs
  under `tmp/clm-s725/clm-06-route-arrange/`.
- `git status --short` shows only writePaths changed.
