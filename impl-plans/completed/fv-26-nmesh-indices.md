# fv-26-nmesh-indices

- planId: fv-26-nmesh-indices
- planPath: impl-plans/active/fv-26-nmesh-indices.md
- progressPath: impl-plans/progress/fv-26-nmesh-indices.md
- wave: 6
- dependsOn: fv-25-nmesh-varint
- Design: sections 6.3, 8.
- writePaths: `formal/Nodetto/Nmesh/Indices.lean`, `formal/Nodetto/Nmesh.lean`,
  `impl-plans/progress/fv-26-nmesh-indices.md`, `tmp/fv-s942/fv-26-nmesh-indices`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove that first-use index coding is a bijection between first-use triangle lists
and accepted code lists.

## Changes

- `formal/Nodetto/Nmesh/Indices.lean`: `decodeIndices_encodeIndices`,
  `encodeIndices_decodeIndices`, verbatim.
- `formal/Nodetto/Nmesh.lean`: add `import Nodetto.Nmesh.Indices`.

## Pitfalls

- Generalise over the running `used` count: state helper lemmas for
  `firstUse.go used` and for the fold of `indexStep` starting at `used`.
- The guard `code = 0 ∧ used = vertexCount` and the final `used = vertexCount` check
  both matter for the converse direction.

## Acceptance criteria

- The audit passes for the two names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh > ../tmp/fv-s942/fv-26-nmesh-indices/build.log 2>&1`
2. `formal/scripts/audit --module Nmesh --theorem decodeIndices_encodeIndices --theorem encodeIndices_decodeIndices > tmp/fv-s942/fv-26-nmesh-indices/audit.log 2>&1`
