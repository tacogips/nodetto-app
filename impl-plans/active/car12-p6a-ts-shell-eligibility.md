# car12-p6a-ts-shell-eligibility

- planId: car12-p6a-ts-shell-eligibility; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car12-p6a-ts-shell-eligibility.md
- Finding: `maintainability-capture-touching-shell-mesh-eligibility` (high),
  the TypeScript decoder and docs.
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-6 (fast path, and
  contact path C1-C6 with the Integer domain, Zero normals, Plane key,
  Patches, Matching and Attachment sub-steps), Fixtures and Tests. Follow the
  worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p6a-ts-shell-eligibility/`.

## Intent and context

`eligible()` (`packages/io/src/nmesh/capture-decoder.ts:37-122`) rejects any
edge with more than two triangles and any repeated vertex triple. Touching
closed shells are therefore display-only, and capture drops the whole cut.
Admit only welded contacts that can be proved safe. Keep every other
classification as today.

Non-goals:
- Do not import `@nodetto/core`.
- Do not change `decodeCaptureMeshWith`'s options or result shape, or the
  `onAllocate` call sites.
- No Rust changes (that is p6b), and no scene or worker tests (that is p6c).

## Changes (`packages/io/src/nmesh/capture-decoder.ts`)

- Fast path. When no undirected edge has three or more uses, run today's
  code unchanged, including the duplicate-triple rejection and the
  opposite-direction pairing.
- Contact path. Implement it as a separate function, for example
  `contactEligible(q, triangles)`. It runs only when some edge has three or
  more uses and returns false at the first failure:
  - C1: every edge's use count is even. Every edge's `(u, v)` and `(v, u)`
    counts are equal, which for two-use edges is today's opposite rule.
  - Zero normals: an integer normal
    `n = (b - a) x (c - a)` in `BigInt` that equals the zero vector returns
    false before any gcd.
  - Plane key: `n` divided by the gcd of its components, with the sign
    normalized so the first non-zero component is positive, plus the offset
    `n . a`. The side is `+1` when the sign was kept, `-1` when flipped.
    Use the `q` integers directly (`Int32Array`).
  - Patches: within one (key, side) group, union triangles across an edge
    that exactly two group triangles use in opposite directions. The
    boundary is the multiset of uncancelled directed edges.
  - Matching: same key, opposite side, and boundary exactly reversed. Use a
    sorted canonical string key; each patch matches at most once, in patch
    order.
    - A pair cancels only when every boundary edge has at least 4 input
      uses. A matched pair with a boundary edge of two uses -> false.
  - Attachment: after all cancellations, every boundary edge of every
    cancelled patch has exactly 2 remaining uses, one in each direction;
    otherwise false.
  - After cancellation, any vertex triple that still repeats -> false.
  - C3 shells: union remaining triangles across edges with exactly two
    remaining uses. An edge with four or more remaining uses is a contact
    edge.
  - C4: at every contact edge, each shell that uses it uses it exactly once
    in each direction. Every shell's signed volume (integer `BigInt` sum
    over its triangles) is non-zero, and all shells have the same sign.
  - C5: for every contact edge and every two shells using it, their integer
    axis-aligned boxes have disjoint interiors (on some axis
    `maxA <= minB` or `maxB <= minA`).
  - C6: today's emptiness test on the original triangle list.
- Extra allocations happen only on the contact path.
  `capture-decoder-budget.test.ts` must stay unedited and pass.

`docs/capture.md` (the closed-mesh paragraph near line 87) and
`docs/cad3d.md:39`: add one sentence each. A closed mesh may consist of
several closed shells, including shells that touch along an edge or a face
when their bounding boxes do not overlap; other touching shells stay
display-only.

Pitfalls:
- `BigInt` and the plane arithmetic only on the contact path; the fast path
  stays number-only.
- Do not treat an even count as sufficient: C1 checks direction balance.
- Do not cancel by identical vertex triples only. Crossed diagonals must
  cancel through boundary matching.
- Run Attachment after all cancellations, never per pair.

## Tests (`packages/io/src/nmesh/capture-decoder.test.ts`)

Build binary STL bytes in the test with a local 12-triangle outward box
helper that uses one shared corner order. Canonicalize them the way existing
tests in this file do (for example `readStl` and `canonicalize`). Call
`decodeCaptureMeshWith(data, { needTarget: true })`.
- Edge contact: box A x 0..10, y 0..10, z 0..5 and box B x 10..20,
  y 10..20, z 0..5 -> `booleanTarget` true (fails before).
- Face contact: B at x 10..20, y 0..10 -> true (fails before).
- Crossed-diagonal face contact: the same, with B's shared face split along
  the other diagonal and outward winding kept -> true (fails before).
- Separated: B at x 12..22 -> true.
- Open triangle: box A plus one extra triangle on an edge of A -> false.
- Unbalanced: the edge-contact mesh with one B triangle at the shared edge
  reversed -> false.
- Welded overlap: outward boxes [0,10]^2 x [0,5] and [0,6]^2 x [0,5]
  -> false.
- Double-sided fin: the edge-contact mesh plus a fin (10,10,0), (10,10,5),
  (13,7,5), (13,7,0). One side is 2 triangles; the other side uses the other
  diagonal and opposite winding -> false.
- Coincident shells: an outward unit cube, the same cube with every winding
  reversed, and a disjoint outward unit cube at x 2..3 -> false.

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts`
2. `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`
   - All nine fixtures give the stated booleans, and the budget tests pass
     unedited.
   - Also save a fail-before log
     (`tmp/car12-r12/car12-p6a-ts-shell-eligibility/fail-before.log`).

## Done criteria

- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`, with the fixture vertex and triangle counts recorded for
  p6b and p6c reuse.

## Implementation status

Implementation-phase criteria and focused gates are complete; see the plan-local
progress log. Independent review and serial integration remain downstream.
