# fv-30-rotate-proofs

- planId: fv-30-rotate-proofs
- planPath: impl-plans/active/fv-30-rotate-proofs.md
- progressPath: impl-plans/progress/fv-30-rotate-proofs.md
- wave: 4
- dependsOn: fv-14-rotate-model
- Design: sections 5 (D4), 6.5, 8.
- writePaths: `formal/Nodetto/Rotate/Theorems.lean`, `formal/Nodetto/Rotate.lean`,
  `impl-plans/progress/fv-30-rotate-proofs.md`, `tmp/fv-s942/fv-30-rotate-proofs`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the six rotation statements: the anchor is snapped (fixed when on the
lattice), every pin lands on the lattice, opposite turns and four turns restore the
part when the anchor is on the lattice.

## Changes

- `formal/Nodetto/Rotate/Theorems.lean`: `rotate_anchor_snapped`,
  `rotate_anchor_fixed`, `rotate_pins_on_lattice`, `rotate_cw_ccw`, `rotate_ccw_cw`,
  `rotate_four`, verbatim.
- `formal/Nodetto/Rotate.lean`: add `import Nodetto.Rotate.Theorems`.

## Pitfalls

- Key lemma: `anchor g p = p.xy + f(p.turns)` where `f` depends only on `g` and turns;
  then the new position is `snap(anchor) - f(turns')`.
- `snap` is idempotent and is the identity on multiples of 20 (`Int.fdiv` lemmas,
  `omega` where possible).
- `rotateVec` maps multiples of 20 to multiples of 20 componentwise.
- `Fin 4` arithmetic: `(t + 1) + 3 = t`; use `decide` only on the four values of `Fin 4`.

## Acceptance criteria

- [x] The audit passes for the six names.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Rotate > ../tmp/fv-s942/fv-30-rotate-proofs/build.log 2>&1`
2. `formal/scripts/audit --module Rotate --theorem rotate_anchor_snapped --theorem rotate_anchor_fixed --theorem rotate_pins_on_lattice --theorem rotate_cw_ccw --theorem rotate_ccw_cw --theorem rotate_four > tmp/fv-s942/fv-30-rotate-proofs/audit.log 2>&1`
