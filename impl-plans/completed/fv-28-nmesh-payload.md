# fv-28-nmesh-payload

- planId: fv-28-nmesh-payload
- planPath: impl-plans/active/fv-28-nmesh-payload.md
- progressPath: impl-plans/progress/fv-28-nmesh-payload.md
- wave: 8
- dependsOn: fv-27-nmesh-armor
- Design: section 6.3 open block, 8 (open rule), 9.
- writePaths: `formal/Nodetto/Nmesh/Payload.lean`, `formal/Nodetto/Nmesh.lean`,
  `impl-plans/progress/fv-28-nmesh-payload.md`, `tmp/fv-s942/fv-28-nmesh-payload`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Attempt the open statement `decodeNmesh_encodeNmesh` (whole-payload round trip for
canonical meshes). It may stay open: the design allows it, and fv-50 then lists it.

## Changes

- `formal/Nodetto/Nmesh/Payload.lean`: lemmas from canonical meshes to the decoder's
  checks (count bound, CRC little-endian round trip, groups, positions with
  `unzigzag_zigzag`, indices with `decodeIndices_encodeIndices`, no trailing bytes),
  and, if completed, the theorem `decodeNmesh_encodeNmesh` verbatim.
- `formal/Nodetto/Nmesh.lean`: add `import Nodetto.Nmesh.Payload`.

## Pitfalls

- Never leave an unfinished theorem: if the main theorem is not proved, the file
  contains only proved lemmas, and no declaration named `decodeNmesh_encodeNmesh`
  (the full audit treats a declaration with that name as a required proof).
- Do not weaken the statement (for example by adding hypotheses beyond hV, hT, hG).
- If the statement is false, follow the counterexample procedure.

## Acceptance criteria

- Either the audit passes for `decodeNmesh_encodeNmesh`, or the progress log states
  "open" with the last unproved lemma statement, and the build plus the vector audit
  pass.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh > ../tmp/fv-s942/fv-28-nmesh-payload/build.log 2>&1`
2. `formal/scripts/audit --module Nmesh --vectors > tmp/fv-s942/fv-28-nmesh-payload/audit.log 2>&1`
3. Only if proved: `formal/scripts/audit --module Nmesh --theorem decodeNmesh_encodeNmesh > tmp/fv-s942/fv-28-nmesh-payload/theorem.log 2>&1`
