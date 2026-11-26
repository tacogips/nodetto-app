# fv-04-stubs-a

- planId: fv-04-stubs-a
- planPath: impl-plans/active/fv-04-stubs-a.md
- progressPath: impl-plans/progress/fv-04-stubs-a.md
- wave: 2
- dependsOn: fv-01-scaffold
- Design: section 2 (stub plans).
- writePaths: `formal/Nodetto/Fractional/Vectors.lean`, `formal/Nodetto/ZOrder/Vectors.lean`,
  `formal/Nodetto/Nmesh/Vectors.lean`, `formal/Nodetto/Tsv/Vectors.lean`,
  `impl-plans/progress/fv-04-stubs-a.md`, `tmp/fv-s942/fv-04-stubs-a`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Make every declared exe root exist so no gate depends on how Lake treats a missing
root. The owning model plan replaces each stub later.

## Changes

Each of the four files contains exactly one declaration, `def main : IO Unit := pure ()`,
and nothing else (no import, no namespace).

## Pitfalls

- Do not add vector logic, imports or comments; the full audit must fail on a stub
  (empty output), which is intended.

## Acceptance criteria

- [x] The four exes build.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build vectors-fractional vectors-z-order vectors-nmesh vectors-tsv > ../tmp/fv-s942/fv-04-stubs-a/build.log 2>&1`
