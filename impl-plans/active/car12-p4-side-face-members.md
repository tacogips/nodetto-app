# car12-p4-side-face-members

- planId: car12-p4-side-face-members; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car12-p4-side-face-members.md
- Finding: `performance-cad-side-face-member-rescans` (medium).
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-4. Follow the
  worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p4-side-face-members/`.

## Intent and context

`createCadGeometry().sketch` (`packages/core/src/cad/history.ts:470-474`)
runs `tool.loops.some(loop => loop.members.includes(line.id))` for every
side-face sketch, so the work is M x S. Make it linear with a lazy per-tool
set that is built only after repeated scans.

Non-goals:
- Do not reuse or alter the profile member index (`:526-536`).
- Do not touch `loops.ts`.
- Error codes, frames and the cap-face path are unchanged.

## Changes (`packages/core/src/cad/history.ts`)

- `cadGeometryWork` gains `sideMemberVisits: 0` and
  `sideMemberIndexBuilds: 0`.
- Inside `createCadGeometry`, add a lazily created
  `Map<ExtrudeGeometry, { budget: number; scanned: number; members?: Set<ElementId> }>`.
  It is allocated on the first side query only.
- In `sketch`, only on the `role === "side"` path, after the line lookup and
  type check:
  - On a tool's first side query, create its entry with
    `budget = 4 * memberTotal` (the sum of `loop.members.length` over
    `tool.loops`).
  - If `members` exists, do one `has` (1 visit).
  - Otherwise, scan as today, counting each comparison in `scanned` and in
    `sideMemberVisits`.
  - Once `scanned >= budget`, the next query first builds `members` from
    `tool.loops`. That costs `memberTotal` visits and increments
    `sideMemberIndexBuilds`. Then it answers with `has`.
- The result is unchanged: membership is over the extrusion's selected
  `tool.loops` only, so omitted-loop lines still give
  `cad.reference.missing`.

Pitfalls:
- The cap and base paths must allocate nothing: no map creation and no
  entry.
- Do not build the set on the first query.
- Do not key by sketch ID. Two extrusions of one sketch can select
  different loops.

## Tests (`packages/core/src/cad/history.test.ts`)

Reset the two counters before each measurement.

- Repeated: a closed M-line profile, extruded, then S sketches on the side
  of its last member. M = S = 256, 512 and 1024. `sideMemberVisits` grows
  at most 2.5x per doubling. Fails before (about 4x).
- Distinct: S = M sketches, one per side. Same bound.
- Omitted: a 4-line rectangle plus a disjoint M-line loop. The extrusion
  selects only the rectangle, and S sketches reference lines of the M-line
  loop.
  - Each gives `cad.reference.missing` with that line's ID.
  - Same bound.
- Frames for repeated and distinct sides equal the expected
  `faceFrame(tool.frame, tool.span, "side", line)` result for each line.
  Compare with the same function used by the code under test, through the
  public geometry path, or with literal frames for a small M.
- Ordinary: checking
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` through
  the existing check path -> `sideMemberIndexBuilds === 0`. Log
  `sideMemberVisits` and the maximum `scanned / memberTotal`.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts`
2. `bun test packages/core/src/cad/history.test.ts`
   - The new tests pass, and the series is logged.
   - Also save a fail-before log
     (`tmp/car12-r12/car12-p4-side-face-members/fail-before.log`).

## Done criteria

- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.

## Implementation-phase completion

- Implemented and verified the lazy per-tool membership index, exact budget,
  frame and omitted-loop behavior, ordinary fast path, and focused gates.
- Formal review, integration verification and workflow finalization remain
  downstream; see the plan-local progress record for evidence.
