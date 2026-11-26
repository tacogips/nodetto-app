# fv-40-fractional-conformance

- planId: fv-40-fractional-conformance
- planPath: impl-plans/active/fv-40-fractional-conformance.md
- progressPath: impl-plans/progress/fv-40-fractional-conformance.md
- wave: 4
- dependsOn: fv-10-fractional-model
- Design: sections 3 (B2), 5 (D6, D7), 6.1, 7, 10 (fractional regressions).
- writePaths: `packages/core/src/fractional.ts`, `packages/core/src/fractional.test.ts`,
  `packages/core/src/fractional.formal.test.ts`,
  `impl-plans/progress/fv-40-fractional-conformance.md`,
  `tmp/fv-s942/fv-40-fractional-conformance`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Fix D6 (a `NaN` rng value yields an undefined digit) and D7 (the no-room descent
overflows the call stack on long valid keys), and tie `fractional.ts` to the Lean
vectors.

## Changes

- `packages/core/src/fractional.ts` `randomDigitBetween`: when
  `Math.floor(rng() * span)` is `NaN`, use offset 0; finite and infinite values keep
  the existing clamp.
- `packages/core/src/fractional.ts` `midpoint` (D7): replace the recursive no-room
  descent `DIGITS[low] + midpoint(lower.slice(1), null, rng)` with an iterative
  traversal once `upper` is `null`: walk positions `i` of `lower` (digit 0 past its
  end); while `BASE - low <= 1` keep the digit and advance; otherwise return the
  kept prefix plus `DIGITS[randomDigitBetween(low, BASE, rng)]`. Keep the
  shared-prefix step, the upper truncation step, the order check and digit selection
  exactly as they are; exactly one rng draw, at the final digit, as before. No key
  length limit. No other change.
- `packages/core/src/fractional.test.ts`: append the D6 and D7 regressions (below).
- `packages/core/src/fractional.formal.test.ts` (new): read
  `new URL("../../../formal/vectors/fractional.json", import.meta.url)` with
  `readFileSync`, validate with a typed guard (no `any`), and for each case call
  `isFractionalKey`, `keyBetween` or `keyAfter` with the rng
  `() => (i < draws.length ? draws[i++] / 2 ** 20 : 0)` (typed, index-safe). `ok`
  cases compare the value; `error` cases expect a thrown `RangeError`. Imitate
  `packages/core/src/fractional.test.ts` for imports.

## Tests

- `keyBetween("1", "3", () => NaN)` -> `"2"` (fails before: `undefined`).
- `keyAfter(null, () => NaN)` -> `"1"`, and `isFractionalKey` is true.
- `keyAfter("V", () => NaN)` -> `"W"`, valid and greater than `"V"`.
- `keyAfter("x!", () => NaN)` -> exactly `"x!1"`, greater than `"x!"` (validity not
  asserted; before the fix it is `"x!undefined"`).
- A fixed numeric rng (`() => 0.5`) gives the same keys as before for a few calls
  (record the pre-change values first).
- D7 (fails before with `RangeError: Maximum call stack size exceeded`): with
  `last = "z".repeat(32768)` and `lo = "y" + last`, `keyBetween(lo, "z", () => 0)`
  is exactly `lo + "1"`, `isFractionalKey` true, `lo < k` and `k < "z"`;
  `keyAfter(last, () => 0)` is exactly `last + "1"`, valid and `> last`.
- Every vector case matches.

## Pitfalls

- Do not change foreign-key behaviour (prefix kept) or `Math.random` default.
- The vector path is relative to `packages/core/src/`.

## Acceptance criteria

- All tests pass; existing fractional tests unchanged; the D6 tests failed before the
  fix (log `before.log`).
- The two D7 regressions failed before the iterative descent (log `before-d7.log`)
  and pass after it; the conformance test still matches the committed
  `formal/vectors/fractional.json`, and no Lean file changes.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Fractional.Model > ../tmp/fv-s942/fv-40-fractional-conformance/build.log 2>&1`
2. `bun test packages/core/src/fractional.formal.test.ts packages/core/src/fractional.test.ts > tmp/fv-s942/fv-40-fractional-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/fractional.ts packages/core/src/fractional.test.ts packages/core/src/fractional.formal.test.ts`
4. `test -s tmp/fv-s942/fv-40-fractional-conformance/before.log` (D6 tests run before the
   NaN fix, non-zero exit recorded in the progress log)
5. `test -s tmp/fv-s942/fv-40-fractional-conformance/before-d7.log` (D7 tests run before
   the iterative descent, stack-overflow failure and non-zero exit recorded)
6. `grep -q 'repeat(32768)' packages/core/src/fractional.test.ts`

Order of work: write the D6 and D7 tests first, run them and save the two
before-logs, then change `fractional.ts`, then add the conformance test. Before the
D7 change, record `keyBetween`/`keyAfter` outputs for a few short keys with
`() => 0.5` and `() => 0` and assert they are unchanged after it.

## Implementation progress

- [x] D6 and D7 fixes, regression evidence, vector conformance, and plan-local gates completed; see `impl-plans/progress/fv-40-fractional-conformance.md`.
