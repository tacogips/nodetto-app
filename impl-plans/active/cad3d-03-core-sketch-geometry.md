# M3 cad3d-03-core-sketch-geometry

- dependsOn: M1 (CAD semantic types)
- Design: sections 6.2, 6.3 (frames, outward sign), 6.6
- writePaths (all new): `packages/core/src/cad/vec.ts`,
  `packages/core/src/cad/frames.ts`, `packages/core/src/cad/tessellate.ts`,
  `packages/core/src/cad/loops.ts`, `packages/core/src/cad/triangulate.ts`,
  `packages/core/src/cad/index.ts`, matching `*.test.ts` files,
  `packages/core/src/cad/determinism.test.ts`; plus one export line in
  `packages/core/src/index.ts`

## Intent

The kernel-free 2D and frame mathematics, deterministic on every JavaScript
engine.

## Contract

```ts
// frames.ts
export interface CadFrame { readonly o: Vec3; readonly u: Vec3; readonly v: Vec3; readonly n: Vec3 }
export function baseFrame(base: "xy" | "yz" | "zx", offset?: number): CadFrame;
export function extrudeSpan(e: CadExtrudeSemantic): { t0: number; t1: number };
export function faceFrame(parent: CadFrame, span: { t0: number; t1: number },
  role: "start" | "end" | "side", line?: { a: CadXY; b: CadXY }): CadFrame;
export function toWorld(frame: CadFrame, p: CadXY, t?: number): Vec3;
/** +1: outward is +n of the face frame; -1: outward is -n. */
export function capOutwardSign(span: { t0: number; t1: number }, role: "start" | "end"): 1 | -1;
export function sideOutwardSign(loop: CadLoop, entity: ElementId): 1 | -1 | 0; // 0: entity not in loop
// tessellate.ts
export const CAD_CHORD_TOLERANCE_MM = 0.01;
export const CAD_MAX_BISECTION_DEPTH = 6;
export function tessellateCircle(c: CadXY, r: number): number[]; // flat x,y ccw
export function tessellateArc(a: CadXY, m: CadXY, b: CadXY): number[] | null; // null when collinear
// loops.ts
export interface CadLoop { readonly points: readonly number[]; // flat, ccw, closed implicitly
  readonly sources: readonly ElementId[]; // entity id per edge
  readonly reversed: readonly boolean[]; // per edge: stored direction opposes the ccw traversal
  readonly members: readonly ElementId[]; readonly depth: number }
export type LoopError = "cad.profile.open" | "cad.profile.branch"
  | "cad.profile.intersect" | "cad.profile.empty" | "cad.limit";
export function buildLoops(entities: readonly Element[], pick?: readonly ElementId[]):
  { loops: readonly CadLoop[] } | { error: LoopError; at?: ElementId };
// triangulate.ts
export function triangulateSimplePolygon(points: readonly number[]): number[]; // index triples, ccw
```

## Behavior

- `faceFrame`: `start` and `end` reuse the parent frame at `t0` / `t1`;
  `side` has origin `toWorld(parent, a, t0)`, `u` the unit vector of `b - a`
  mapped to world, `v = n` of the parent, `n = u x v`.
- Tool outward sign (the tool factor of design 6.3; the operation factor
  is applied in M4): `capOutwardSign` is `sign(t1 - t0)` for `end`
  and its negation for `start`. `sideOutwardSign` is +1 when the edge of
  that entity is not reversed and the loop depth is even; each of
  "reversed" and "odd depth" flips it once. (For an un-reversed edge of a
  counter-clockwise outer loop, `u x n_parent` points to the right of the
  direction of travel, which is outside the material.)
- Tessellation: recursive chord bisection as in design 6.3; a circle starts
  from `c + (r,0)`, `c + (0,r)`, `c - (r,0)`, `c - (0,r)`; depth is the
  smallest value with sagitta `r - sqrt(r*r - (chord/2)^2) <=` tolerance,
  capped at 6; implement iteratively (explicit stack), points snapped with
  `roundNm` from `@nodetto/ir`. An arc's centre and radius come from the
  three points by the perpendicular bisector formula; orientation follows
  `a -> m -> b`.
- `buildLoops`: ignore `construction` entities; index end points in a `Map`
  keyed by `x + "," + y` (grid values are exact); a point with degree other
  than 2 is `open` (1) or `branch` (3+); walk each chain once; orient every
  loop counter-clockwise by signed area; reject zero area as `empty`;
  segment intersection test between loops and inside one loop using exact
  orientation signs with a bounding box prefilter; nesting depth by point in
  polygon of one vertex; `pick` keeps loops containing a listed entity;
  more than 20,000 vertices in a loop is `cad.limit`.
- `triangulateSimplePolygon`: ear clipping with a convex fast path (fan).

## Pitfalls

- Under `packages/core/src/cad` the only allowed `Math` members are
  `sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`, `trunc`, `sign`,
  and the `**` operator is forbidden (overview rule). An allow-list, not a
  deny-list: `acos`, `cbrt`, `hypot`, `pow` and any future member fail.
- `noUncheckedIndexedAccess`: read flat arrays through checked helpers.

## Tests

- Frames: `xy` frame maps (1,2) to (1,2,0); `end` face of a 5 mm extrude on
  `xy` maps (1,2) to (1,2,5); side frame of line (0,0)-(10,0) has `n` =
  (0,-1,0) for an `xy` sketch extruded along +Z.
- Tessellation: r = 1.6 gives 32 points, r = 50 gives 256; all points within
  1e-6 of the radius; arc through (10,0),(0,10),(-10,0) starts and ends on
  the stored points exactly; collinear arc returns null.
- Loops: rectangle of four lines in shuffled order with mixed directions
  gives one ccw loop with four sources; rectangle with two circles gives
  depths 0,1,1; an open chain, a T junction, two crossing rectangles and a
  figure-eight give the four error codes; `pick` selects one loop;
  `reversed` is true exactly for the lines stored against the traversal.
- Outward sign, checked against geometry rather than against the formula:
  for a rectangle drawn with mixed line directions and a rectangular hole,
  for every line take the side face frame of M3, step 1e-3 mm from the
  edge midpoint along `sign * n` and assert the 2D point is outside the
  material (outside the outer loop, or inside the hole); caps: for
  distance +5, -5 and symmetric 6, a point 1e-3 beyond the cap along
  `sign * n` has t outside the span.
- Triangulation: convex n-gon gives n-2 triangles; an L shape and a comb
  with 200 teeth give n-2 triangles whose areas sum to the polygon area.
- `determinism.test.ts`: reads every non-test `.ts` under
  `packages/core/src/cad`, collects every `Math.<member>` and fails on any
  member outside the allow-list and on any `**` token; hashes
  the tessellation of three fixed circles against literal expected values.

## Acceptance criteria

- Contract exported through `packages/core/src/cad/index.ts`; tests pass.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad'`
2. `sh -c 'bunx biome check packages/core/src/cad && bun test packages/core/src/cad/loops.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m3; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m3/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m3/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/determinism.test.ts'`
