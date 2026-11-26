# fv-38-overlap-tree

- planId: fv-38-overlap-tree
- planPath: impl-plans/active/fv-38-overlap-tree.md
- progressPath: impl-plans/progress/fv-38-overlap-tree.md
- wave: 5
- dependsOn: fv-37-overlap-sweep
- Design: section 6.8 open block, 8 (open rule), 9.
- writePaths: `formal/Nodetto/Overlap/Tree.lean`, `formal/Nodetto/Overlap.lean`,
  `impl-plans/progress/fv-38-overlap-tree.md`, `tmp/fv-s942/fv-38-overlap-tree`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Attempt the two open statements `treeSearch_visits_overlaps` and
`overlappingPairs_visits_overlaps`. They may stay open (vectors cover the tree
branch); fv-50 then lists them.

## Changes

- `formal/Nodetto/Overlap/Tree.lean`: segment-tree invariants (node value = max over
  inserted, unexpired leaves of the subtree; `query` reaches exactly the leaves with
  `minY <= a.maxY` and `maxY >= a.minY`), and, if completed, the two theorems
  verbatim (`overlappingPairs_visits_overlaps` follows from both branch theorems).
- `formal/Nodetto/Overlap.lean`: add `import Nodetto.Overlap.Tree`.

## Pitfalls

- A box expired before it is processed is inserted later and never expired; the full
  overlap check filters it, so the theorem still holds (no well-formedness
  hypothesis). Do not add one.
- Never leave a declaration named like an open statement unless it is proved.

## Acceptance criteria

- Either the audit passes for both names, or the progress log states which are open
  with the last unproved lemma, and the build plus vector audit pass.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Overlap > ../tmp/fv-s942/fv-38-overlap-tree/build.log 2>&1`
2. `formal/scripts/audit --module Overlap --vectors > tmp/fv-s942/fv-38-overlap-tree/audit.log 2>&1`
3. For each proved name only: `formal/scripts/audit --module Overlap --theorem <name> > tmp/fv-s942/fv-38-overlap-tree/theorem-<name>.log 2>&1`
