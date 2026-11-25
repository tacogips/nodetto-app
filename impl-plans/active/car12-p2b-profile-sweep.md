# car12-p2b-profile-sweep

- planId: car12-p2b-profile-sweep; wave 2; dependsOn: car12-p2a-segment-sweep
- progressPath: impl-plans/progress/car12-p2b-profile-sweep.md
- Finding: `performance-sketch-profile-pair-scans` (high), the integration.
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-2, rule 3 and the
  `loops.test.ts` tests. Follow the worker rules in `car12-00-overview.md`.
  Evidence: `tmp/car12-r12/car12-p2b-profile-sweep/`.

## Intent and context

`intersection()` (`packages/core/src/cad/loops.ts:373-414`) passes no stop
callback, so on the crowded path `overlappingPairs` (`:233-370`) lists every
overlapping box pair. Use p2a's `provesDisjoint` to skip that listing when it
proves the segments disjoint. Keep the sparse sweep and the first-error
identity.

Non-goals:
- Do not touch the containment search, the depth pass, the forest fallback or
  `SWEEP_PAIRS_PER_BOX` (it stays 8).
- Do not edit `segment-sweep.ts`, `history.ts` or `pcb-outline.ts`.

## Changes (`packages/core/src/cad/loops.ts`)

- `overlappingPairs` gains an optional fifth parameter
  `crowded?: () => boolean`.
  - It is called once, exactly where the indexed path would begin (after the
    `Math.min(alongX, alongY) <= boxes.length * SWEEP_PAIRS_PER_BOX` check
    fails).
  - If it returns false, return immediately.
  - The containment call site passes nothing.
- `LoopStats` gains optional `segmentTests?: number`,
  `segmentFallbacks?: number` and
  `sweep?: { events: number; steps: number; tests: number; collapsed: number }`.
- `intersection()`:
  - Count every `segmentIntersection` call in `stats.segmentTests`, when
    present.
  - Pass a `crowded` callback that does three things:
    - increments `segmentFallbacks`;
    - runs `provesDisjoint(segments.length, endpoints, touches, sweepStats)`
      over the same sorted `segments`, with
      `endpoints(i)` = the segment's grid start and end coordinates and
      `touches = (i, j) => segmentIntersection(segments[i], segments[j])`
      (guard undefined);
    - adds the sweep counters into `stats.sweep` and adds `sweep.tests` into
      `stats.segmentPairs`.
  - The callback returns false (skip the listing) only when
    `provesDisjoint` returned true. Otherwise the existing indexed
    enumeration runs unchanged and picks the minimum sorted index, as today.

Pitfalls:
- Do not change the segment sort or the `first` selection.
- Count `segmentTests` in both paths, sparse and indexed.
- The sweep's own `touches` calls count as `segmentTests` too.
- `segmentPairs` keeps today's increments on the existing paths.

## Tests (`packages/core/src/cad/loops.test.ts`)

- "diagonal strips search disjointness subquadratically".
  - N closed four-line strips with corners (0,b), (100,100+b),
    (100,100+b+w) and (0,b+w), where b = i/64 mm and w = 1/256 mm, at
    N = 64, 128 and 256, built with `buildLoops`.
  - `W = segmentPairs + sweep.events + sweep.steps + sweep.tests`. Each
    doubling at most 2.5x both `W` and `segmentTests`.
  - The loops equal an oracle from the vertex lists: every strip in input
    order, depth 0, counter-clockwise.
  - Fails before (about 4x growth: 16,448 -> 65,664 -> 262,400).
- Crossing control.
  - The 256-strip fixture plus a closed three-line triangle whose edges
    cross strips 10 and 11 -> `cad.profile.intersect`.
  - `at` equals the ID that an in-test BigInt all-pairs oracle selects
    (segments sorted by `(minX, minY)` as `intersection()` does; minimum
    sorted index over intersecting pairs).
  - `segmentFallbacks === 1`.
- Crowded repeated-vertex control.
  - `buildProfileLoops(paths, undefined, stats)` with the 64 strips as
    closed `CadProfilePath` records, plus `{ id: "repeated-vertex",
    points: [200,0, 204,0, 204,0, 204,4, 200,4], closed: true }`.
  - Result: `cad.profile.intersect` with `at === "repeated-vertex"`,
    `segmentFallbacks === 1` and `sweep.collapsed === 1`.
  - Line entities would not work here: an equal-endpoint open line fails
    earlier with `cad.profile.empty`.
- Ordinary baseline.
  - Group the entities of
    `generateCadDocument({ features: 500, entitiesPerSketch: 18 })`
    (`packages/core/src/cad/testing/generate.ts`) by sketch, and call
    `buildLoops(entities, undefined, stats)` per sketch with one shared
    `stats`.
  - `segmentFallbacks === 0`, `sweep` absent or all zero, and
    `segmentTests` equal to the value measured before the change. Measure it
    first by adding only the counter. The audit expects 164,000; record the
    measured value and pin the literal.
- The existing doubling, two-row, tangent and nesting tests stay unedited.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts`
2. `bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/segment-sweep.test.ts packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/loop-forest.test.ts`
   - The new tests pass, and the strip series and the ordinary baseline are
     logged.
   - Also save a fail-before log of the strip test run before the
     integration (`tmp/car12-r12/car12-p2b-profile-sweep/fail-before.log`).

## Done criteria

- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`, with the measured switch evidence (`segmentPairs`,
  `segmentTests` and `segmentFallbacks` for the ordinary fixture and each
  strip size).

## Implementation status

- Done: crowded disjointness integration, exact work counters and regression controls.
- Focused Biome and tests pass; formal review and workspace integration remain downstream.
- Evidence and measured counts: `impl-plans/progress/car12-p2b-profile-sweep.md`.
