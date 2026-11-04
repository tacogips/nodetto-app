# clm-06-route-arrange

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
