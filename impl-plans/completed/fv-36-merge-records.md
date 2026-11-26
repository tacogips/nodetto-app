# fv-36-merge-records

- planId: fv-36-merge-records
- planPath: impl-plans/active/fv-36-merge-records.md
- progressPath: impl-plans/progress/fv-36-merge-records.md
- wave: 7
- dependsOn: fv-35-merge-value
- Design: sections 6.7, 8.
- writePaths: `formal/Nodetto/Merge/Records.lean`, `formal/Nodetto/Merge.lean`,
  `impl-plans/progress/fv-36-merge-records.md`, `tmp/fv-s942/fv-36-merge-records`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the five `mergeById` statements.

## Changes

- `formal/Nodetto/Merge/Records.lean`: `mergeById_unchanged_ours`,
  `mergeById_unchanged_theirs`, `mergeById_same_change`, `mergeById_symm`,
  `mergeById_conflict_iff`, verbatim.
- `formal/Nodetto/Merge.lean`: add `import Nodetto.Merge.Records`.

## Pitfalls

- Per-id lemma: `find (mergeById B L R).1 id` and the conflicts for `id` depend only on
  `(find B id, find L id, find R id)`; ids appear once in the result (deduplicated id
  list), and `find` is last-match.
- The both-added case uses base `some (.obj [])` (`recordBase`), and the value
  theorem for the flag.

## Acceptance criteria

- [x] The audit passes for the five names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Merge > ../tmp/fv-s942/fv-36-merge-records/build.log 2>&1`
2. `formal/scripts/audit --module Merge --theorem mergeById_unchanged_ours --theorem mergeById_unchanged_theirs --theorem mergeById_same_change --theorem mergeById_symm --theorem mergeById_conflict_iff > tmp/fv-s942/fv-36-merge-records/audit.log 2>&1`
