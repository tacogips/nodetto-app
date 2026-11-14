# breadboard-pcb-02-legend-clip

- planId: breadboard-pcb-02-legend-clip
- planPath: impl-plans/active/breadboard-pcb-02-legend-clip.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-breadboard-pcb.md 7.1 items 1, 2, 3 and
  5 (keepouts, cut/rejoin/filter clipping, box-vs-keepout test,
  determinism)
- progress log: impl-plans/progress/breadboard-pcb-02-legend-clip.md
- session: opus-luna-design-and-implement-review-loop-session-501; issue
  local-input:feat/breadboard-gerber@431bfdb
- Wave map: see impl-plans/active/breadboard-pcb-01-validator.md.

## Intent

Provide the pure silkscreen geometry that plan 03 calls from `pcb.ts`:

- clip a legend polyline to a rectangle and remove the parts inside pad
  keepout circles, using the design's cut, rejoin and filter rule
- test whether a text box is clear of all keepouts

It goes in a small focused module, so plan 03 can wire it in without
writing geometry inside `pcb.ts`.

## Repository context

- `PcbPoint` (`{ readonly x: number; readonly y: number }`) is exported from
  `packages/core/src/breadboard/gerber.ts`. Import the type from there and
  do not edit `gerber.ts`.
- `packages/core/src/breadboard/pcb.ts:Bounds` is the internal box shape
  `{minX, minY, maxX, maxY}`. This module defines its own exported
  `LegendRect` with the same field names, so plan 03 can pass `Bounds`
  values structurally.
- Stroke font: `packages/core/src/breadboard/pcb-font.ts:strokeText`. Its
  glyphs contain one-cell segments of 1/6 mm at height 1.0, for example
  glyph `2` from `[4,5]` to `[4,4]`. These must survive clipping when no cut
  touches them (review finding F1).

## Non-goals

- Do not edit `pcb.ts`, `gerber.ts`, `pcb-font.ts`, `geometry.ts` or
  `index.ts`.
- No general polygon clipping, no keepout shapes other than circles, and no
  stroke merging across different input polylines.

## writePaths

- packages/core/src/breadboard/pcb-legend.ts (new)
- packages/core/src/breadboard/pcb-legend.test.ts (new)
- impl-plans/progress/breadboard-pcb-02-legend-clip.md (new)

## sharedPaths

none

## Contract (pinned, used by plan 03)

```ts
export interface LegendRect { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }
export interface LegendKeepout { readonly x: number; readonly y: number; readonly radius: number }
export function clipLegendStroke(points: readonly PcbPoint[], rect: LegendRect,
  keepouts: readonly LegendKeepout[], minLength: number): readonly (readonly PcbPoint[])[];
export function boxClearOfKeepouts(box: LegendRect, keepouts: readonly LegendKeepout[]): boolean;
```

## File-level changes (pcb-legend.ts)

`clipLegendStroke` follows design 7.1 item 2 in this order:

1. Cut each segment `from -> to`, parameterised as `t` in [0, 1].
   - Intersect with `rect` using Liang-Barsky. Points on the rectangle
     border count as inside.
   - From the inside interval, subtract each circle's open interior
     interval, where the distance to the centre is less than the radius.
     Solve `a t^2 + b t + c = 0` with `a = |d|^2`. Use only `+ - * /` and
     `Math.sqrt`. A zero-length segment (`a === 0`) is kept whole if its
     point is inside the rectangle and outside every circle interior, and
     dropped otherwise.
   - The result is an ordered list of pieces `[t0, t1]`. A piece end is a
     cut end exactly when it is not t = 0 or t = 1 of the original segment.
     A piece end at t = 0 or 1 is an original vertex, which is never a cut
     end.
2. Rejoin pieces. A piece that ends at t = 1 of segment i and a piece that
   starts at t = 0 of segment i + 1 join into one stroke at the shared
   original vertex. Pieces never join across a gap.
3. Filter. A joined stroke with at least one cut end (its first or its last
   point) is dropped if its total length is under `minLength`. A joined
   stroke with no cut end is returned unchanged, whatever its length.
4. Emit original vertices as the same `PcbPoint` values, unchanged. Compute
   cut points as `from + t * (to - from)`. Do not round here; `GerberLayer`
   rounds to nm.

Result: a polyline that no cut touches is returned as one stroke whose
points deep-equal the input. If a polyline is entirely inside a keepout or
outside the rectangle, the result is `[]`.

`boxClearOfKeepouts` returns true when every keepout's centre is at least
its radius from the box. The distance is measured to the closest point of
the box, by clamping the centre into the box. The comparison is `>=`.

Pitfalls:

- Tangent or degenerate cases: a discriminant of 0 or below removes nothing.
- Intervals from several circles overlap. Merge them before subtracting.
- Points exactly on a circle boundary stay. The open interior is removed,
  so a stroke end on the boundary has ink exactly at the clearance, which
  the validator accepts within 1e-5.
- Do not use `Math.hypot`, `Math.atan2`, `Math.sin` or `Math.cos`. These
  values feed emitted coordinates, so engine-dependent rounding would break
  the TS/native byte parity (design 7.1 item 5).
- `noUncheckedIndexedAccess`: iterate segments with `points.forEach((point,
  index) => { const next = points[index + 1]; if (!next) return; ... })`,
  as `pcb.ts:segments` does. No `[0]` or `[1]` tuple indexing.

## Tests (pcb-legend.test.ts), input -> expected

- `strokeText("25", 66.04, 45.72, 1)` strokes, a far-away keepout, and a
  large rect -> each stroke returned as one stroke equal to the input
  (`toEqual`). Explicitly include a glyph that has a 1/6 mm segment (`2`,
  `5`).
- the same strokes with `minLength` 0.18 -> still unchanged (the filter
  ignores uncut strokes)
- horizontal segment (0,0) to (10,0), keepout at (5,0) with r = 1 -> two
  strokes, [(0,0),(4,0)] and [(6,0),(10,0)]
- polyline (0,0) -> (5,0) -> (5,5), keepout at (5,0) with r = 1 -> two
  strokes; the corner vertex is removed and both pieces have a cut end
- polyline whose vertex lies in no keepout, with a cut only on the first
  segment -> the remainder of the first segment joins the second segment
  into one stroke
- a cut piece of length 0.1 next to a keepout, with minLength 0.18 ->
  dropped; the same piece with minLength 0.05 -> kept
- a segment partly outside rect (x from -1 to 2, rect minX 0) -> starts at
  x = 0, which is a cut end
- a segment fully inside a keepout -> `[]`
- two overlapping keepouts -> one gap, not two
- a tangent keepout (the distance to the segment equals the radius) ->
  unchanged
- `boxClearOfKeepouts`: a box whose nearest corner is at distance r + 0.01
  -> true; at r - 0.01 -> false; a centre inside the box -> false

## Invariants

- The module only imports types from `./gerber.ts`; `node:` and DOM imports
  are not allowed.
- No file outside writePaths is changed.

## Acceptance criteria

- Pinned names and signatures match exactly. All listed tests pass.

## Verification (record exit codes in the progress log)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/breadboard/pcb-legend.test.ts`
   must exit 0.
2. `bunx biome check packages/core/src/breadboard/pcb-legend.ts packages/core/src/breadboard/pcb-legend.test.ts --diagnostic-level=warn`
   must exit 0.
3. `bun run typecheck` must exit 0. Record sibling-only failures as drift.
4. Create
   `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/tsconfig.nuia.json`,
   the same as in plan 01. Run `bunx tsc -p` on it and filter the output for
   `pcb-legend`. The filtered output must be empty.
5. `grep -nE "Math\.(hypot|sin|cos|atan2|tan)" packages/core/src/breadboard/pcb-legend.ts`
   must print nothing.

## Per-worker protocol

Same as plan 01:

- read each file fresh before you edit it, and record its sha256 before and
  after
- write an intent snapshot first
- on drift, stop and record it
- run no state-changing git commands
- keep scratch only under `tmp/breadboard-pcb-s501/breadboard-pcb-02-legend-clip/`,
  and never put `*.test.ts` files under `tmp/`
- edit only your own progress log

## Done criteria (mechanical)

- `pcb-legend.ts` exports exactly `LegendRect`, `LegendKeepout`,
  `clipLegendStroke` and `boxClearOfKeepouts`.
- Verification steps 1-5 are recorded with the expected results.
