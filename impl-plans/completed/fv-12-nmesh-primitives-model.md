# fv-12-nmesh-primitives-model

- planId: fv-12-nmesh-primitives-model
- planPath: impl-plans/active/fv-12-nmesh-primitives-model.md
- progressPath: impl-plans/progress/fv-12-nmesh-primitives-model.md
- wave: 3
- dependsOn: fv-01-scaffold, fv-02-audit, fv-04-stubs-a
- Design: sections 3 (B1, B4), 6.3 (primitive definitions).
- writePaths: `formal/Nodetto/Nmesh/Model.lean`, `formal/Nodetto/Nmesh.lean`,
  `impl-plans/progress/fv-12-nmesh-primitives-model.md`,
  `tmp/fv-s942/fv-12-nmesh-primitives-model`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

The byte-level layers of `packages/nmesh/src` that the codec model (fv-18) and the
layer proofs (fv-25..27) use: varint, zigzag, first-use indices, CRC-32 and base64
armour.

## Changes

- `formal/Nodetto/Nmesh/Model.lean`, `namespace Nodetto.Nmesh`, exactly the design
  6.3 names and types for `Bytes`, `NmeshError`, `writeVarint`, `readVarint`,
  `zigzag`, `unzigzag`, `firstUse` (binding definition, copy it), `encodeIndices`,
  `decodeIndices`, `crc32`, `toInline`, `fromInline`, plus
  `def NmeshError.code : NmeshError → String` returning the TS codes
  (`"nmesh.truncated"`, ..., `"nmesh.inline"`) and the per-code step
  `def indexStep (vertexCount used code : Nat) : Except NmeshError (Nat × Nat)`
  (returns `(vertex, used')`), which `decodeIndices` folds and fv-18 reuses.
  - `writeVarint`/`readVarint` mirror `encode.ts` `writeVarint` and `decode.ts`
    `readVarint` (five places, place-4 byte above 15 -> `range`, zero final group
    after a continuation -> `range`, end of input -> `truncated`).
  - `zigzag d = if d < 0 then 2*(-d) - 1 else 2*d` (as `Nat`); `unzigzag` mirrors decode.
  - `crc32` mirrors `crc32.ts` (table from polynomial `0xEDB88320`, init and final
    xor `0xFFFFFFFF`) on `Nat` with `^^^`, `>>>`, `&&&`.
  - `toInline`/`fromInline` mirror `armor.ts` over `List Nat` code units, including
    the prefix `nmesh1:`, the 1,048,576 limit, padding count and the `bits != 0` check.
- `formal/Nodetto/Nmesh.lean`: `import Nodetto.Nmesh.Model`.

## Pitfalls

- No vectors in this plan (fv-18 writes them); do not touch `Nmesh/Vectors.lean`.
- `readVarint` takes the bytes from `offset` to `end - 4` and returns the rest.
- Lean `example`: `crc32 (codes of "123456789") = 0xCBF43926` by `decide`/`rfl` (a
  small literal) as a sanity check.

## Acceptance criteria

- [x] `Nodetto.Nmesh` builds with the listed names; no forbidden token.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh > ../tmp/fv-s942/fv-12-nmesh-primitives-model/build.log 2>&1`
2. `! grep -rnwE 'sorry|admit|axiom|native_decide|unsafe|partial|opaque|implemented_by|extern|skipKernelTC' formal/Nodetto/Nmesh.lean formal/Nodetto/Nmesh/Model.lean`
