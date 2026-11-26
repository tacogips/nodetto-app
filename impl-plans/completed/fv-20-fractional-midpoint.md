# fv-20-fractional-midpoint

- planId: fv-20-fractional-midpoint
- planPath: impl-plans/active/fv-20-fractional-midpoint.md
- progressPath: impl-plans/progress/fv-20-fractional-midpoint.md
- wave: 4
- dependsOn: fv-10-fractional-model
- Design: sections 6.1, 8.
- writePaths: `formal/Nodetto/Fractional/Midpoint.lean`, `formal/Nodetto/Fractional.lean`,
  `impl-plans/progress/fv-20-fractional-midpoint.md`, `tmp/fv-s942/fv-20-fractional-midpoint`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Lemma layer: the correctness of `midpoint`, which every `keyBetween`/`keyAfter`
theorem (fv-21) and the z-order key proofs (fv-24) build on. No design statement is
completed here.

## Changes

- `formal/Nodetto/Fractional/Midpoint.lean` (`namespace Nodetto.Fractional`, imports
  the Model) with lemmas, names at your choice, covering:
  - `randomDigitBetween low high rng` returns a digit `d` with `low < d < high` when
    `high - low > 1`, for every `rng`.
  - Validity of digits: every `DIGITS` entry is a code unit of `0-9A-Za-z`, the
    index lookup is the inverse of `DIGITS[i]`, and `List.lt` on digit lists follows
    digit order.
  - Main lemma (state it so that it supports both bounded and unbounded calls): for
    `lower` that is `[]` or a suffix of a valid key (no trailing `0` unless empty),
    `upper = some u` with `u` valid-tail and `lower < u`, or `upper = none`, every
    `rng`: `midpoint lower upper rng = .ok (k, rng')` with `lower < k`,
    `k < u` (when bounded) and `isFractionalKey k = true`.
  - The shared-prefix step: prepending a common prefix preserves the bounds.
- `formal/Nodetto/Fractional.lean`: add `import Nodetto.Fractional.Midpoint`.

## Pitfalls

- `lower` inside the recursion may start with `0` digits and may be empty; the
  padding rule `(lower[i] ?? "0")` matters in the shared-prefix loop.
- Validity of `k` needs "last digit is not `0`": the random digit is at least
  `low + 1 >= 1`, the truncation digit is `high >= 1`.
- No `decide` over key spaces; prove by induction on the termination measure.
- If a lemma you need is false (counterexample), follow the counterexample procedure.

## Acceptance criteria

- `Nodetto.Fractional` builds with the lemmas; no forbidden token; vectors unchanged.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Fractional > ../tmp/fv-s942/fv-20-fractional-midpoint/build.log 2>&1`
2. `formal/scripts/audit --module Fractional --vectors > tmp/fv-s942/fv-20-fractional-midpoint/audit.log 2>&1`
