# fv-21-fractional-keys

- planId: fv-21-fractional-keys
- planPath: impl-plans/active/fv-21-fractional-keys.md
- progressPath: impl-plans/progress/fv-21-fractional-keys.md
- wave: 5
- dependsOn: fv-20-fractional-midpoint
- Design: sections 6.1 (all ten statements), 8.
- writePaths: `formal/Nodetto/Fractional/KeyBetween.lean`, `formal/Nodetto/Fractional.lean`,
  `impl-plans/progress/fv-21-fractional-keys.md`, `tmp/fv-s942/fv-21-fractional-keys`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the ten Fractional statements of design 6.1, verbatim.

## Changes

- `formal/Nodetto/Fractional/KeyBetween.lean` (`namespace Nodetto.Fractional`, imports
  `Nodetto.Fractional.Midpoint`): theorems `keyBetween_between`, `keyBetween_below`,
  `keyBetween_above`, `keyBetween_unbounded`, `keyBetween_rejects_lower`,
  `keyBetween_rejects_upper`, `keyBetween_rejects_inverted`, `keyAfter_gt`,
  `keyAfter_valid`, `keyAfter_none_valid`, copied character for character from the
  design fenced block `lean Nodetto.Fractional`.
- `formal/Nodetto/Fractional.lean`: add `import Nodetto.Fractional.KeyBetween`.

## Pitfalls

- `keyAfter_gt` has no validity hypothesis: the foreign branch `s ++ [d]` is greater
  because `s` is a proper prefix (`List.lt` prefix lemma); the valid branch uses the
  midpoint lemma; `s = []` is not fractional and takes the foreign branch.
- `keyBetween_rejects_upper` holds for every `lo`, including an invalid one (then the
  lower check fails first; both are errors).
- Do not restate or weaken; the audit's signature check compares exactly.

## Acceptance criteria

- The audit passes for all ten names (signature, existence, axioms).

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Fractional > ../tmp/fv-s942/fv-21-fractional-keys/build.log 2>&1`
2. `formal/scripts/audit --module Fractional --theorem keyBetween_between --theorem keyBetween_below --theorem keyBetween_above --theorem keyBetween_unbounded --theorem keyBetween_rejects_lower --theorem keyBetween_rejects_upper --theorem keyBetween_rejects_inverted --theorem keyAfter_gt --theorem keyAfter_valid --theorem keyAfter_none_valid > tmp/fv-s942/fv-21-fractional-keys/audit.log 2>&1`
