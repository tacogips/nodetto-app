# fv-25-nmesh-varint

- planId: fv-25-nmesh-varint
- planPath: impl-plans/active/fv-25-nmesh-varint.md
- progressPath: impl-plans/progress/fv-25-nmesh-varint.md
- wave: 5
- dependsOn: fv-18-nmesh-codec-model
- Design: sections 6.3, 8.
- writePaths: `formal/Nodetto/Nmesh/Varint.lean`, `formal/Nodetto/Nmesh.lean`,
  `impl-plans/progress/fv-25-nmesh-varint.md`, `tmp/fv-s942/fv-25-nmesh-varint`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the varint and zigzag statements: round trip, canonical (overlong rejected),
truncation rejected, zigzag bijection.

## Changes

- `formal/Nodetto/Nmesh/Varint.lean` (`namespace Nodetto.Nmesh`, imports the Model):
  `writeVarint_bytes`, `readVarint_writeVarint`, `readVarint_canonical`,
  `readVarint_truncated`, `unzigzag_zigzag`, `zigzag_unzigzag`, verbatim.
- `formal/Nodetto/Nmesh.lean`: add `import Nodetto.Nmesh.Varint`.

## Pitfalls

- Structure the varint proofs by the number of groups (1 to 5): `v < 2^7`,
  `2^7 <= v < 2^14`, ...; place 4 accepts only final bytes `<= 15`, which is exactly
  `v < 2^32`.
- `readVarint_canonical` needs `hb` (bytes below 256): a continuation byte is
  `b % 128 + 128 = b` only when `b < 256`.
- `omega` handles the `Nat`/`Int` arithmetic of zigzag; no `decide` over ranges.

## Acceptance criteria

- [x] The audit passes for the six names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh > ../tmp/fv-s942/fv-25-nmesh-varint/build.log 2>&1`
2. `formal/scripts/audit --module Nmesh --theorem writeVarint_bytes --theorem readVarint_writeVarint --theorem readVarint_canonical --theorem readVarint_truncated --theorem unzigzag_zigzag --theorem zigzag_unzigzag > tmp/fv-s942/fv-25-nmesh-varint/audit.log 2>&1`
