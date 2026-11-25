# car4-f3-loop-index

- planId: car4-f3-loop-index; wave 2; dependsOn: car4-f1a-capture-scene
- planPath: impl-plans/active/car4-f3-loop-index.md
- progressPath: impl-plans/progress/car4-f3-loop-index.md
- Finding: performance-capture-loop-normalization-pair-scans (R4-3, medium).
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-3, 22.3, 22.5.
- writePaths: `packages/core/src/capture/scene.ts`,
  `packages/core/src/capture/scene.test.ts`, `tmp/car4-r4/car4-f3-loop-index`,
  `impl-plans/progress/car4-f3-loop-index.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`normaliseToolLoops` (`scene.ts:95-133`) scans each depth bucket linearly for every
deeper loop: N separate rings cost N(N+1)/2 probes. Index each bucket so separate rings
are linear, never store more than a bounded number of entries, and never probe more
than today. f1a edits other parts of `scene.ts`; edit only `normaliseToolLoops` and its
private helpers.

Non-goals: no change to the keep rule, loop order, `buildCadCaptureModel`, NCS1 bytes.

## Changes (`scene.ts`)

- Per depth bucket with `n` loops and span `w` x `h`: grid
  `cols = clamp(round(sqrt(n * w / h)), 1, n)`, `rows = clamp(round(sqrt(n * h / w)),
  1, n)` (zero span -> 1 on that axis); one monotonic mapping
  `min(cells - 1, floor((x - min) / span * cells))` for insertion and query.
- Store each entry with its bucket position. A loop whose cell range covers at most
  `MAX_LOOP_CELLS = 16` cells is inserted into each cell; otherwise appended once to the
  bucket's oversized list. Fill in bucket order so every list is sorted by position.
- Query for a point: two-pointer merge of the oversized list and the point's single
  cell (none if outside bucket bounds) in ascending position; unchanged candidate test
  (bounds, then `containsPoint`); stop at the first containing loop.
- `stats` type becomes `{ ancestorProbes: number; indexEntries?: number }`:
  `ancestorProbes` counts candidates examined; `indexEntries` (when present) counts cell
  insertions plus oversized appends.

## Pitfalls

- Do not walk the oversized list first (step-3 probe: 4,002,000 probes on the mixed
  fixture versus 2,000 today).
- Keep the early `every depth === 0` return and output via `loops.filter` (order).
- Typed indexed reads; no `!` assertions on array reads.
- The existing perforated-plate test (`scene.test.ts:632`, probes between n and n+2)
  must pass unchanged.

## Tests (`scene.test.ts`, next to `:632`, oracle `oracleNormalise` at `:605`)

- Separate rings (outer square + one hole) N = 500, 1,000, 2,000, square layout and
  single row: per doubling `ancestorProbes` and `indexEntries` grow <= 2.5x (fails
  before: probes 125,250 / 500,500 / 2,001,000).
- Diagonal strips `[0, s, 1000, 1000 + s, 1000, 1000 + s + 0.005, 0, s + 0.005]`,
  `s = i * 0.01`, plus hole `[1, 1.001, 2, 2.001, 2, 2.004, 1, 1.004]` in the first, N =
  1,200 / 2,400 / 4,800: `indexEntries <= 17 * N`, `indexEntries + ancestorProbes` grows
  <= 2.5x per doubling, all loops retained in order.
- Mixed: square `[500, 0, 504, 0, 504, 4, 500, 4]` first, then N strips, N 0.02 mm
  square holes at `x = 500.01 + (i % 50) * 0.07`, `y = 0.01 + floor(i / 50) * 0.07`,
  N = 500 / 1,000 / 2,000: `ancestorProbes === N`; `indexEntries <= 17 * bucket size`.
- Every fixture: retained loops equal `oracleNormalise` (identity and order); NCS1 bytes
  from both via `writeCaptureScene` equal (imitate `:681`).

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/determinism.test.ts`

## Done criteria

- All bounds hold with recorded counts; oracle and bytes equal; perforated-plate test
  unchanged; progress log `done`.

Implementation complete: counters, oracle order and NCS1 parity pass; see
`impl-plans/progress/car4-f3-loop-index.md`. Formal review remains pending.
