# schematic-07-io-kicad-diagonal-lookup

- planId: schematic-07-io-kicad-diagonal-lookup; wave 1; dependsOn: none
- design: section 8.3 diagonal segments (exact-arithmetic gate, range tree,
  per-segment box-vs-lattice choice, per-direction line hash, bound, global
  budget, `diagonalBudgetLimit`)
- progress log: impl-plans/progress/schematic-07-io-kicad-diagonal-lookup.md

## Intent

A pure, self-contained module that returns candidate (segment, point) pairs
for diagonal KiCad wire segments with counted, bounded work. Plan 15 wires it
into `importSchematic`; candidates are later confirmed by the unchanged
`onSegment`.

## Non-goals

No integration into schematic.ts, no orthogonal segments, no confirmation.

## writePaths

- packages/io/src/kicad/diagonal-lookup.ts (new)
- packages/io/src/kicad/diagonal-lookup.test.ts (new)
- impl-plans/progress/schematic-07-io-kicad-diagonal-lookup.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract (pinned)

```ts
export interface IntPoint { readonly x: number; readonly y: number } // integer 1e-4 mm units
export interface DiagonalSegment { readonly id: number; readonly a: IntPoint; readonly b: IntPoint }
export function diagonalBudgetLimit(segments: number, points: number): number;
// = 2*S*(2L+2)*(L+1) + 16*(P+S), L = ceil(log2(P+1))
export function diagonalCandidates(
  points: readonly IntPoint[], segments: readonly DiagonalSegment[],
  onCandidate: (segmentId: number, pointIndex: number) => void,
  stats: { diagonalWork: number }, budget?: number,
): { readonly exceeded: boolean };
```

## Behaviour (design 8.3)

- Returns immediately with zero work when `segments` is empty.
- Exact mode iff `8 * W * W < 2**53`, W = max |coordinate| over points and
  segment ends. Outside exact mode: box reporting only, no line filter.
- Merge-sort range tree over points (sorted by x; node lists sorted by y).
  Counting query per segment on its box grown by +-1 gives `B_s`.
- Exact mode per segment: cost `min(B_s, g_s + 7)`; choose lattice walk
  (points `a + t*(dxn,dyn)` in the grown box looked up in a coordinate hash,
  plus for g=1 the solutions of `dyn*x - dxn*y = c_a +- 1` via extended
  Euclid, at most 2 each) or box reporting with line pre-filter.
- Per direction: if summed chosen cost > P, switch the direction to a line
  hash (c per point, buckets sorted by x, binary search x range +-1).
- Count every node visit, binary-search step, reported point, lattice lookup
  and hash entry in `stats.diagonalWork`. When `budget` is set and the counter
  would exceed it, stop at once and return `{exceeded: true}`.

## Pitfalls

- The candidate set must be a superset of what `onSegment` accepts
  (cross `<= 1`, box +-1); when unsure, report.
- Never compute intercepts outside exact mode.
- Use iterative code; integer math only inside exact mode.

## Tests (diagonal-lookup.test.ts)

Oracle = brute force all (segment, point) pairs filtered by a local copy of
`onSegment` logic; candidates must contain every oracle pair.
- disjoint mixed directions: (0,10Ni)->(N,10Ni+i+1), N=2000: superset holds,
  `diagonalWork <= S*(2L+2)*(L+1) + 2N`.
- overlapping parallel: (0,10i)->(100N,100N+10i): line hash chosen,
  `diagonalWork <= P + S*(2L+2)*(L+1) + S*(L+1) + 2N`.
- overlapping mixed short lattice: (0,10i)->(100N,100N+11i+1):
  `diagonalWork < 1_000_000`.
- long-lattice G=N+1: (0,10i)->(G*N,10i+G*(N+i)) with
  `budget = diagonalBudgetLimit(S,P)`: `exceeded === true`,
  `diagonalWork <= budget + 1`.
- large-coordinate midpoint segment (1e9,1e9+3)->(1.1e9+6,1.1e9+5), point
  (1050000003,1050000004): reported (box mode).
- empty segments: zero work.
- `diagonalBudgetLimit(2000, 4000)` matches the formula (about 1.45M).

## Verification

- `bun test packages/io/src/kicad/diagonal-lookup.test.ts` exits 0.
- `bunx biome check packages/io/src/kicad/diagonal-lookup.ts packages/io/src/kicad/diagonal-lookup.test.ts` exits 0.

## Done criteria

All bullets pass with work counts asserted (no timing assertions).
