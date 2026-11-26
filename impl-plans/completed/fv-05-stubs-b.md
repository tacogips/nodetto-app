# fv-05-stubs-b

- planId: fv-05-stubs-b
- planPath: impl-plans/active/fv-05-stubs-b.md
- progressPath: impl-plans/progress/fv-05-stubs-b.md
- wave: 2
- dependsOn: fv-01-scaffold
- Design: section 2 (stub plans).
- writePaths: `formal/Nodetto/Rotate/Vectors.lean`, `formal/Nodetto/Undo/Vectors.lean`,
  `formal/Nodetto/Merge/Vectors.lean`, `formal/Nodetto/Overlap/Vectors.lean`,
  `impl-plans/progress/fv-05-stubs-b.md`, `tmp/fv-s942/fv-05-stubs-b`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Same as fv-04-stubs-a for the other four modules.

## Changes

Each of the four files contains exactly `def main : IO Unit := pure ()` and nothing
else.

## Pitfalls

- No imports, namespaces, comments or vector logic.

## Acceptance criteria

- [x] The four exes build.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build vectors-rotate vectors-undo vectors-merge vectors-overlap > ../tmp/fv-s942/fv-05-stubs-b/build.log 2>&1`
