# fv-46-merge-conformance

- planId: fv-46-merge-conformance
- planPath: impl-plans/active/fv-46-merge-conformance.md
- progressPath: impl-plans/progress/fv-46-merge-conformance.md
- wave: 4
- dependsOn: fv-03-merge-fix, fv-16-merge-model
- Design: sections 3 (B1, B5), 5 (D2), 7 (merge rules and surrogate cases).
- writePaths: `packages/core/src/document-merge.formal.test.ts`,
  `impl-plans/progress/fv-46-merge-conformance.md`, `tmp/fv-s942/fv-46-merge-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Tie the exported live helpers `mergeValue` and `mergeById` (fixed by fv-03) to the
Lean vectors, including key-order and lone-surrogate cases.

## Changes

- `packages/core/src/document-merge.formal.test.ts` (new): read the raw text of
  `formal/vectors/merge.json` and `JSON.parse` it (own `__proto__` members and lone
  surrogates survive). Typed guard.
  - `mergeValue` cases: `const c = { value: false }`; result
    `mergeValue(base, ours, theirs, c)` where an absent input is `undefined`; compare
    with `toEqual(out.ok.value)` (key-order-insensitive) and `c.value` with
    `out.ok.conflict`.
  - Re-run every `mergeValue` case with all object keys reversed, building the
    reversed inputs by `JSON.parse` of reversed JSON text (write a small recursive
    serializer that emits own keys in reverse order), and expect the same result.
  - `mergeById` cases: each vector record `[id, value]` has a `value` object whose
    `id` member equals `id` (fv-16 generates them so); pass the `value` objects as the
    record lists, call `mergeById("element", base, ours, theirs, conflicts)` with a
    fresh `conflicts` array, compare the result records per id (by their `id`
    member) with `toEqual`, and `conflicts` mapped to `[id, reason]` exactly and in
    order.

## Pitfalls

- Never build inputs with object spread or `result[key] =` (loses own `__proto__`).
- Distinct keys `"\ud800"` and `"\ud801"` must stay distinct: never normalise strings.
- The CLI `mergeDocumentVersions` is out of scope.

## Tests

- Every vector case matches, including the three surrogate cases.

## Acceptance criteria

- [x] The test passes; `document-merge.test.ts` still passes.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Merge.Model > ../tmp/fv-s942/fv-46-merge-conformance/build.log 2>&1`
2. `bun test packages/core/src/document-merge.formal.test.ts packages/core/src/document-merge.test.ts > tmp/fv-s942/fv-46-merge-conformance/test.log 2>&1`
3. `bunx biome check packages/core/src/document-merge.formal.test.ts`
