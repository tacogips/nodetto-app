# fv-17-overlap-model

- planId: fv-17-overlap-model
- planPath: impl-plans/active/fv-17-overlap-model.md
- progressPath: impl-plans/progress/fv-17-overlap-model.md
- wave: 3
- dependsOn: fv-01-scaffold, fv-02-audit, fv-05-stubs-b
- Design: sections 3 (B6, B7), 6.8, 7 (overlap row).
- writePaths: `formal/Nodetto/Overlap/Model.lean`, `formal/Nodetto/Overlap/Vectors.lean`,
  `formal/Nodetto/Overlap.lean`, `formal/vectors/overlap.json`,
  `impl-plans/progress/fv-17-overlap-model.md`, `tmp/fv-s942/fv-17-overlap-model`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Model of `overlappingPairs` in `packages/core/src/cad/loops.ts:237` (no `stop`, no
`crowded`, `count` ignored): both sweep axes, the segment-tree branch and the branch
choice.

## Changes

- `formal/Nodetto/Overlap/Model.lean`, `namespace Nodetto.Overlap`: `Box`, `Axis`,
  `Branch`, `overlaps`, `bruteForce`, `norm` (binding definitions, copy them),
  `sweep`, `treeSearch`, `overlappingPairs`, and `overlapCount`.
  - Sort of `(index, min, max)` items by `(min, index)` lexicographically (B7), with
    your own insertion or merge sort.
  - `sweep boxes axis`: for each item in sorted order, scan later items until
    `b.min > a.max`, emitting `(a.i, b.i)` when `overlaps`.
  - `overlapCount`: mirrors the expiry loop on sorted ends.
  - Branch: `min alongX alongY <= boxes.length * 8` -> sweep on X when
    `alongX <= alongY`, else Y; otherwise `treeSearch`.
  - `treeSearch`: mirrors the X sweep with a Y max-segment-tree over `byMinY`
    leaves: expiry by `maxX < a.minX`, binary search `limit`, recursive `query`
    pruning `start >= limit` or subtree max `< a.minY`, leaf full-overlap check,
    `visit(other, index)`, then insert `a.maxY`. Represent the tree as a function or
    list of size `2 * size` with `-inf` as `none`.
- `formal/Nodetto/Overlap.lean`: `import Nodetto.Overlap.Model`.
- `formal/Nodetto/Overlap/Vectors.lean`: module `"overlap"`, sources
  `["packages/core/src/cad/loops.ts"]`. Cases `overlappingPairs {boxes:[[minX,minY,maxX,maxY]]}`
  -> `ok {tree, visits:[[i,j],...]}` in visit order. Required (design section 7): at
  least 20 axis-discriminating sweep cases with at least 5 X-wins, 5 Y-wins and 5
  ties (`alongX = alongY`); the generator checks `sweep boxes .x != sweep boxes .y`
  for each and fails (exit 1) when it cannot produce them. Also: empty input,
  single box, touching boxes, identical boxes, degenerate boxes (`min > max`),
  negative coordinates, and crowded grids (more than `8n` overlapping pairs on both
  axes) to take the tree branch (20+).
- `formal/vectors/overlap.json`: generated, committed.

## Pitfalls

- The tree is `size = next power of two >= n` leaves; padding leaves have no box.
- `visit` order in the tree branch is `(other, index)`, earlier box first.
- Do not encode the axis in vectors; it is checked through `visits`.

## Acceptance criteria

- [x] `Nodetto.Overlap` builds; vectors are fresh, 200+ cases, the discriminating and
  tree cases present.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Overlap > ../tmp/fv-s942/fv-17-overlap-model/build.log 2>&1`
2. `formal/scripts/audit --module Overlap --vectors > tmp/fv-s942/fv-17-overlap-model/audit.log 2>&1`
3. `grep -c '"tree":true' formal/vectors/overlap.json` prints at least 20.
