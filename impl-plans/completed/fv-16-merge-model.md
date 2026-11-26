# fv-16-merge-model

- planId: fv-16-merge-model
- planPath: impl-plans/active/fv-16-merge-model.md
- progressPath: impl-plans/progress/fv-16-merge-model.md
- wave: 3
- dependsOn: fv-01-scaffold, fv-02-audit, fv-05-stubs-b
- Design: sections 3 (B1, B5), 5 (D2), 6.7, 7 (string and surrogate rules).
- writePaths: `formal/Nodetto/Merge/Model.lean`, `formal/Nodetto/Merge/Vectors.lean`,
  `formal/Nodetto/Merge.lean`, `formal/vectors/merge.json`,
  `impl-plans/progress/fv-16-merge-model.md`, `tmp/fv-s942/fv-16-merge-model`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Model of the live merge helpers `mergeValue` and `mergeById` in
`packages/core/src/document-merge.ts` as fixed by D2 (fv-03), with semantic `same`.
The CLI routines are out of scope (design 6.7 boundary).

## Changes

- `formal/Nodetto/Merge/Model.lean`, `namespace Nodetto.Merge`: exactly the design 6.7
  names and types: `J`, `canon`, `same`, `mergeValue`, `getPath`, `diffPaths`,
  `FieldConflict`, `Reason`, `Conflict`, `mergeById`, `find`, `recordBase`, plus helpers
  `lookupFirst (fs : List (String × J)) (k : String) : Option J` and
  `keysUnion (a b : List (String × J)) : List String` (first-occurrence union).
  - `canon`: objects keep the first occurrence of each key, sort keys by any strict
    total order you can prove things about (for example lexicographic on
    `String.toList` with `Char` order), recurse into values and arrays.
  - `same a b := decide (Option.map canon a = Option.map canon b)` (derive
    `DecidableEq J`, or write a `beq` with a correctness lemma kept in this file).
  - `mergeValue` mirrors the fixed TS: the three `same` checks in order; object
    branch when all three are `some (.obj _)`, over the first-occurrence union of
    base, ours, theirs keys, omitting `none` results, conflict flag OR-ed; else
    `(ours, true)`.
  - `mergeById`: maps with last-match `find`, ids in first-occurrence order of ours,
    theirs, base; the TS branches (both absent skip; added both: `mergeValue (some (.obj []))`
    when not `same`; deleted locally; deleted remotely; both present) with
    `Reason.bothChanged`/`deletedLocally`/`deletedRemotely`.
  - `getPath`, `diffPaths`, `FieldConflict`, `recordBase`: copy the binding definitions.
  - Recursion over the nested `J`: structural or `termination_by sizeOf`; no `partial`.
- `formal/Nodetto/Merge.lean`: `import Nodetto.Merge.Model`.
- `formal/Nodetto/Merge/Vectors.lean`: module `"merge"`, sources
  `["packages/core/src/document-merge.ts"]`. Every string (keys, string values, ids)
  is E-encoded in the model and emitted with `Nodetto.Json.ofE`.
  - `mergeValue {base, ours, theirs}` (absent = JSON `null` at the top is not the same
    as undefined: encode undefined as the member being omitted, i.e. `in` objects
    with only the present fields) -> `ok {value, conflict}` (`value` omitted when
    `none`).
  - `mergeById {base, ours, theirs}` (records `[[id, value]]`, where every `value` is
    an object whose `"id"` member is the string `id`, as TS records are) ->
    `ok {records:[[id, value]], conflicts:[[id, reason]]}` with reasons
    `both-changed`, `deleted-locally`, `deleted-remotely`, in result order.
  - Include: nested objects, arrays (atomic), key-reordered objects, own keys
    `__proto__`, `constructor`, `toString`, both-added records, deletes both ways,
    and the three required surrogate cases (a), (b), (c) of design section 7.
- `formal/vectors/merge.json`: generated, committed.

## Pitfalls

- `null` (JSON) and absent (`none`) differ; keep them distinct in the vector format.
- Do not sort the merged result's keys: the TS result keeps union order; the test
  compares with `toEqual`, which ignores key order.

## Acceptance criteria

- [x] `Nodetto.Merge` builds; vectors are fresh, 200+ cases, 20+ per fn, surrogate cases
  present (grep for `\ud800` in the file).

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Merge > ../tmp/fv-s942/fv-16-merge-model/build.log 2>&1`
2. `formal/scripts/audit --module Merge --vectors > tmp/fv-s942/fv-16-merge-model/audit.log 2>&1`
3. `grep -c 'ud800' formal/vectors/merge.json` prints at least 3.
