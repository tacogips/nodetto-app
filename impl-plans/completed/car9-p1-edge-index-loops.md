# car9-p1-edge-index-loops

- planId: car9-p1-edge-index-loops; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car9-p1-edge-index-loops.md
- Finding: performance-cad-containment-perimeter-rescans (high), depth pass.
- Design: `design-docs/specs/design-ai-capture.md` 27.1 R9-1. Follow
  `impl-plans/active/car9-00-overview.md` worker rules. Evidence:
  `tmp/car9-r9/car9-p1-edge-index-loops/`.

## Intent and context

`contains` (`packages/core/src/cad/loops.ts:342-360`) walks every edge of the
enclosing profile for each point query from the depth pass
(`loops.ts:486-499`, inside `buildProfileLoops`). H holes in a plate of P = H + 3
edges cost H(H+3) edge reads. This runs in Boa (native CLI) and in the webview.
Add an internal edge Y-interval index and query it from `contains`. p2 reuses the
module in `scene.ts`, so its exports are a contract (overview).

Non-goals: no change to `overlappingPairs`, `intersection`, `segmentIntersection`,
`makeProfile`, `walk`, the first-error rule, `CadLoop`, the signatures and results
of `buildLoops`/`buildProfileLoops`, `LoopStats.segmentPairs`/`containmentPairs`,
`pcb-outline.ts` or any caller. Do not touch `scene.ts` (p2). Do not re-export the
new module from `packages/core/src/cad/index.ts` or `packages/core/src/index.ts`.

## Changes

New `packages/core/src/cad/edge-y-index.ts` (imports nothing):
- `export interface EdgeIndexStats { builds: number; visits: number; inspections: number }`
- `export interface EdgeYIndex` (opaque fields: sorted edge ids, sorted `lo`
  values, per-edge `hi`, tree of max `hi`; typed arrays allowed).
- `export function buildEdgeYIndex(points: ArrayLike<number>, stats?: EdgeIndexStats): EdgeYIndex`
  - n = points.length / 2; edge e from vertex `(e + n - 1) % n` to vertex e;
    `lo = min(ay, by)`, `hi = max(ay, by)`; keep horizontal edges; sort by `(lo, e)`;
    complete binary tree (array layout) whose nodes hold the max `hi` below them.
  - `stats.builds += n` once per call.
- `export function forEachEdgeAtY(index: EdgeYIndex, y: number, visit: (edge: number) => void, stats?: EdgeIndexStats): void`
  - `limit` = number of leaves with `lo <= y` (upper-bound binary search).
  - Descend from the root; `stats.visits += 1` per node entered (pruned included);
    skip a node whose leaf range starts at or after `limit` or whose max `hi < y`.
  - At each reached leaf (`lo <= y <= hi`, closed) call `visit(e)` once and
    `stats.inspections += 1`.
- Imitate the tree style of `loops.ts:overlappingPairs` (round-8 max tree, array
  layout, guarded reads).

`packages/core/src/cad/loops.ts`:
- `interface LoopStats` gains `edges?: EdgeIndexStats` (optional; existing literals
  `{ segmentPairs, containmentPairs }` must still type-check).
- In `buildProfileLoops`, keep an array `indexes: (EdgeYIndex | undefined)[]`
  parallel to `profiles`; build lazily on the first query of a profile, passing
  `stats?.edges`.
- `contains(profile, x, y, index-getter or index, edges stats)`: keep the bounds
  early exit FIRST (so rejected profiles never build); then for each edge from
  `forEachEdgeAtY` read `ax, ay` (vertex `(e + n - 1) % n`) and `bx, by` (vertex e)
  with `coordinate(grid, ...)` and apply the unchanged predicate:
  `ay > y !== by > y`, then `gridCross(bx - ax, by - ay, x - ax, y - ay) > 0 === by > ay`
  toggles `inside`.

Pitfalls:
- Do not change the predicate, the use of `grid` (integer nanometres) or `bounds`.
  The closed stab is a superset; the exact test still filters. Parity is XOR, so
  order does not matter; never early-exit.
- Never build an index per query or per pair; never build before the bounds check.
- Wrap-around: edge 0 uses the last vertex as `a`, exactly as the old loop.
- Guard indexed reads (`?? 0`, `?? Number.NEGATIVE_INFINITY`); recursion depth < 30
  or an explicit stack.

## Tests (`packages/core/src/cad/loops.test.ts`, append; existing tests untouched)

New test "a detailed rim with many holes queries the perimeter through one edge
index", with the file's `line` and `circle` helpers:
- Fixture for H in 256, 512, 1024: `line("rim-<i>", [256*i/H, y_i], [256*(i+1)/H, y_(i+1)])`
  for i < H with `y_i = i % 2 === 0 ? 512 : 513` (use the same expression for shared
  endpoints); `line("right", [256, y_H], [256, 0])`, `line("bottom", [256, 0], [0, 0])`,
  `line("left", [0, 0], [0, 512])`; `circle("hole-<k>", [2.5 + 3*(k%64), 2.5 + 3*Math.floor(k/64)], 1)`.
- `stats = { segmentPairs: 0, containmentPairs: 0, edges: { builds: 0, visits: 0, inspections: 0 } }`;
  `buildLoops(entities, undefined, stats)` -> `loops` with H + 1 entries, exactly one
  at depth 0 whose members contain `rim-0`, and H at depth 1.
- `edges.builds`, `edges.visits`, `edges.inspections` each > 0;
  `edges.builds <= sum(loop.points.length / 2)`; `edges.inspections <= 4 * H`.
- Per doubling `builds + visits + inspections` <= previous * 2.5. Log the series.
- Fail-before: on unmodified `loops.ts` the counters stay 0, so the `> 0` assertion
  fails. Record that log.

## Verification (exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/pcb-outline.test.ts`
   - evidence: the new test passes; existing loops tests (touching contours,
     first-error identity, nesting, round-8 two-row and single-row) and
     `pcb-outline.test.ts` pass unedited; counter series and ratios in the progress
     log; complete log under the evidence root.

## Done criteria

- `edge-y-index.ts` exports exactly the four contract symbols; not re-exported.
- `contains` reads only edges returned by `forEachEdgeAtY`; one build per profile max.
- Pre-fix failing log and post-fix passing log exist; command 1 exits 0.
- `git diff --name-only` for this plan's edits stays inside its writePaths.
- Progress log reads `done` with hashes, commands, exit codes and log paths.
