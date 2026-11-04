# clm-06-route-core

- planId: clm-06-route-core
- planPath: impl-plans/active/clm-06-route-core.md
- progressPath: impl-plans/progress/clm-06-route-core.md
- wave: 3
- dependsOn: clm-05-connector-fields, which provides the fields,
  `connectorLabelBoxAt`, `pointAlongRoute` and the same-side self-loop.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections A2
  (including the DR-01 reset rule), A3, A4 (including the DR-02 fixed-end
  allocation), A5 and "A3 metrics", plus the A2, A3 and A4/A5 rows of
  "Verification". Owner question Q6 (values written by arrange count as
  manual).
- writePaths:
  - `packages/core/src/arrange-route.ts` (new)
  - `packages/core/src/arrange-route.test.ts` (new)
  - `packages/core/src/diagram-lint/metrics.ts` (new)
  - `packages/core/src/diagram-lint/metrics.test.ts` (new)
  - `impl-plans/progress/clm-06-route-core.md`
  - `tmp/clm-s725/clm-06-route-core`
  - `target`
- artifactRoots: `target`

## Intent and context

This plan is the pure planner for `arrange --mode route`, and the route
stage of layered mode. It plans:

- the reset of manual settings;
- routing inputs;
- ports;
- port spreading;
- self-loop sides;
- label positions.

It also adds the metrics used by `lint --metrics`. Element positions never
change. The resolver draws the obstacle-avoiding route at render time.

Imitate the `{ commands }` style of `packages/core/src/arrange.ts:planArrangement`.
Use `updateSemantic` commands carrying the full merged semantic, the way
`manual-route-preservation.ts` does.

## Non-goals

- No CLI, no `packages/core/src/index.ts` edits (clm-09 adds the exports),
  and no resolver changes.
- Never move an element. Never touch connectors that are not targets.

## Contract (clm-09 depends on it)

```ts
export const ROUTE_PAGE_KINDS: readonly PageKind[]; // same list as LAYERED_PAGE_KINDS
export interface RouteOptions { readonly ids?: readonly string[] /* resolved connector ids */; readonly resetManual?: boolean }
export function planRouteArrangement(store: Store, pageId: string, registry: ShapeUtilRegistry, options: RouteOptions): { readonly commands: readonly Command[] };
export interface PageMetrics { readonly edgeCrossings: number; readonly labelOverlaps: number }
export function pageMetrics(store: Store, pageId: string, registry: ShapeUtilRegistry): PageMetrics;
```

- The planner builds its own draft `Store` copy and a shape context through
  `createShapeContext(draft, registry, 1)`. It applies its own intermediate
  commands to that draft, so routes reflect the new ports before labels are
  placed.
- It returns the commands that turn the input into the final state.

## Rules (implement exactly as the design says)

1. Targets: connectors on the page that have both ends attached, minus
   `erd.relation`, `sequence.message` and `bpmn.*`. With `ids`, only those.
   Use id order.
2. Reset (`resetManual`), for targets only:
   - set `routing: "orthogonal"`;
   - delete `routingWaypoints`, `routingBend`, `fromPort`, `toPort`,
     `fromPortPosition`, `toPortPosition` and `labelPosition`.
3. Manual test: `routing === "manual"`, or `fromPort` set, or `toPort` set.
   - Manual targets keep their routing, waypoints, bend, ports and port
     positions.
   - Non-manual targets get `routing: "orthogonal"`, lose
     `routingAvoidObstacles: false`, and get ports. If |dx| >= |dy| between
     the box centres, the ports are right and left by sign; otherwise bottom
     and top.
4. Self-loops (A5):
   - Take them in id order.
   - Choose the first side in the order right, top, bottom, left that no
     other connector end on the element uses, counting sides taken by
     earlier self-loops. Otherwise choose the side with the fewest ends.
   - Write `fromPort` and `toPort` set to that side, with positions 0.3 and
     0.7.
   - Manual self-loops are kept.
5. Spreading (A4):
   - Group by element and side. Use all connector ends with a port on the
     page (targets and non-targets), and exclude self-loop ends.
   - Order ends by the opposite centre projected on the side axis, then by
     connector id, from-end first.
   - Fixed ends are manual or non-target ends. They reserve their stored
     position, or 0.5 when none is stored.
   - With no fixed ends: position `(k+1)/(m+1)`. Write nothing when m = 1.
   - With fixed ends: gap allocation, exactly per design A4 steps 1-5,
     including the 0.0001 collision rule. Every movable end is written.
   - Rounding: `Math.round(x * 10000) / 10000`.
6. Labels (A3):
   - For each target with a non-empty label (the text `connectorDecoration`
     shows), in id order, resolve the route once on the draft.
   - Try the candidates 0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9, using
     `pointAlongRoute` and `connectorLabelBoxAt`.
   - Score: overlaps with labels already placed, plus overlaps with boxes of
     non-edge, non-frame, non-group elements (endpoints included), plus
     intersections with route segments of other connectors.
   - Take the first candidate that scores 0, else the lowest score, with
     ties going to the earliest candidate.
   - Write the field only when the result is not 0.5. Delete it when the
     result is 0.5.
7. Metrics (`metrics.ts`):
   - `edgeCrossings`: for each unordered pair of distinct connectors, count
     the proper intersections of their resolved polylines. Exclude points
     within 1 unit of any endpoint of either connector. A collinear
     overlapping segment pair counts once.
   - `labelOverlaps`: pairs of a label box against another label box, an
     element box, or another connector's segment. Use the same predicate as
     rule 6, so the label scoring and the metric agree.
   - The planner imports the overlap predicate from `metrics.ts`.
8. Omit commands whose resulting semantic equals the current one. That makes
   a rerun idempotent.

## Pitfalls

- After a reset, the target must go through rule 3 as non-manual. A
  previous `routing: "manual"` must not survive (DR-01).
- A fixed end must never share a coordinate with a movable end (DR-02).
  Test with a fixed value of 0.6667.
- Route geometry for scoring comes from the draft after the port and
  self-loop commands are applied, not from the input.
- Use indexed loops for segment intersection, with no destructuring.
  Complexity is O(E^2 * S^2) over about 50 edges, which is fine. Time it in
  the clm-09 native test.
- Sort everything by id. Never rely on store iteration order.

## Tests (input -> expected)

`arrange-route.test.ts`:
- No element `visual` changes in any test (compare every node's `visual`
  before and after).
- A manual connector with waypoints whose straight path is blocked by a
  widget box:
  - without reset, its routing, waypoints and resolved points are
    unchanged;
  - with `resetManual`, `routing` is orthogonal, there are no waypoints,
    and the resolved route does not cross the widget's clearance box.
- `ids: [a]` -> only `a` changes.
- Two edges leaving the right side of `Idle` -> positions 0.3333 and 0.6667,
  ordered by target y.
- A fixed manual end at 0.6667 plus one movable end -> the movable end gets
  `Math.round(0.6667/2*10000)/10000`, which is at least 0.0001 from 0.6667,
  and the manual end is unchanged.
- A fixed end with no stored position (0.5) -> movable ends avoid 0.5.
- `ids` naming one of three edges on a side -> the other two are unchanged,
  and only the named edge's end is written, avoiding their coordinates.
- Rounding collision -> the nudged value is distinct.
- A self-loop on a node whose right side is used -> it takes `top`. With
  all four sides used -> the side with the fewest ends.
- A label whose midpoint sits on a blocking element -> the chosen
  `labelPosition` is not 0.5, and the label box does not overlap.
- Rerun on the result -> no commands.

`metrics.test.ts`:
- Two crossing edges -> `edgeCrossings` 1.
- Edges that share an endpoint -> 0.
- A label on an element -> `labelOverlaps` at least 1. After planning ->
  fewer.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.test.ts packages/core/src/connector-positions.test.ts`.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/arrange-route.ts packages/core/src/arrange-route.test.ts packages/core/src/diagram-lint/metrics.ts packages/core/src/diagram-lint/metrics.test.ts`.

## Done criteria

- The contract exists and the tests above pass.
- `git diff --stat` shows only writePaths.
