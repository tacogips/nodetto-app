# fv-27-nmesh-armor

- planId: fv-27-nmesh-armor
- planPath: impl-plans/active/fv-27-nmesh-armor.md
- progressPath: impl-plans/progress/fv-27-nmesh-armor.md
- wave: 7
- dependsOn: fv-26-nmesh-indices
- Design: sections 6.3, 8.
- writePaths: `formal/Nodetto/Nmesh/Armor.lean`, `formal/Nodetto/Nmesh.lean`,
  `impl-plans/progress/fv-27-nmesh-armor.md`, `tmp/fv-s942/fv-27-nmesh-armor`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove `fromInline_toInline`: the base64 armour round-trips every non-empty byte list
within the length limit.

## Changes

- `formal/Nodetto/Nmesh/Armor.lean`: `fromInline_toInline`, verbatim.
- `formal/Nodetto/Nmesh.lean`: add `import Nodetto.Nmesh.Armor`.

## Pitfalls

- Prove per 3-byte block (and the 1- and 2-byte tails) that the four characters
  decode back with the accumulator returning to 0; then induct on blocks.
- Alphabet lookup is the inverse of the alphabet index for indices below 64.
- Padding count from `endsWith "=="`/`"="` must match the tail length.

## Acceptance criteria

- The audit passes for `fromInline_toInline`.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh > ../tmp/fv-s942/fv-27-nmesh-armor/build.log 2>&1`
2. `formal/scripts/audit --module Nmesh --theorem fromInline_toInline > tmp/fv-s942/fv-27-nmesh-armor/audit.log 2>&1`
