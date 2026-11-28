# fv-03-merge-fix

- planId: fv-03-merge-fix
- planPath: impl-plans/active/fv-03-merge-fix.md
- progressPath: impl-plans/progress/fv-03-merge-fix.md
- wave: 1
- dependsOn: none
- Design: section 5 D2 (full decision text), B5, section 6.7 proof boundary, section 10
  "merge-fix" regressions; `design-cli-layout-merge-lint.md` B1.
- writePaths: `packages/core/src/document-merge.ts`, `packages/core/src/document-merge.test.ts`,
  `impl-plans/progress/fv-03-merge-fix.md`, `tmp/fv-s942/fv-03-merge-fix`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Merges and diffs must compare JSON values, not key order, and must treat every own
member (including `__proto__`) as data. Today `same` compares `JSON.stringify`
output (key-order sensitive), `canonicalValue` loses own `__proto__` members, and
both recursive merges read and write members through the prototype.

## Changes (all in `packages/core/src/document-merge.ts`)

- Add module-scope `function canonicalJson(value: unknown): string` per D2 (1):
  arrays element-wise with `undefined` elements as `null`; plain objects
  (`isPlainObject`) from `Object.keys` sorted with the existing
  `compareVersionStrings`, each member `JSON.stringify(key) + ":" + canonicalJson(v)`,
  members whose value is `undefined` omitted; anything else `JSON.stringify(value)`;
  top-level `undefined` returns a marker that no JSON text equals (for example
  `"\u0000undefined"`). No intermediate objects.
- `same(left, right)` becomes `canonicalJson(left) === canonicalJson(right)`.
- `mergeValue` (live) and `value` inside `mergeDocumentVersions` (CLI): read members
  with `Object.hasOwn(o, key) ? o[key] : undefined`; write result members with
  `Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true })`.
  Keys still come from `Object.keys` in today's order; conflict policies and the
  `added` propagation stay exactly as they are.
- Remove `canonicalValue`; `unknownKey` uses `JSON.stringify([r.kind])` combined with
  `canonicalJson(r.data)` (for example `` `${JSON.stringify(r.kind)}:${canonicalJson(r.data)}` ``)
  so unknown-record identity is key-order-insensitive as before.
- Add `export` to `mergeValue` and `mergeById` (named exports only; do not touch
  `packages/core/src/index.ts`).

## Pitfalls

- `diffDocuments` uses `same`; that is intended (D2). Do not change its structure.
- Do not unify the live and CLI routines (design 6.7 boundary).
- `canonicalJson` must not call `canonicalJson` on an object built with `result[key] =`.
- Keep `noUncheckedIndexedAccess`-safe reads; `isPlainObject` comes from `@nodetto/ir`
  as today.

## Tests (append to `packages/core/src/document-merge.test.ts`)

Fail before, pass after:
1. `mergeValue([{a:1,b:2}], [{b:2,a:1}], [{a:3,b:2}], c)` -> value deep-equals
   `[{a:3,b:2}]`, `c.value === false`; the same through `mergeDocuments` with the
   arrays as an element `semantic` field -> the element carries theirs, no conflict.
2. Inputs built with `JSON.parse`: base `{"x":1,"__proto__":1}`, ours
   `{"x":2,"__proto__":1}`, theirs `{"x":1,"__proto__":2}` -> result has own members
   `x: 2` and `__proto__: 2` (`Object.hasOwn` true, `Object.getPrototypeOf(result)`
   is `Object.prototype`), no conflict.
3. `diffDocuments` where `extensions` differ only in key order
   (`[{a:1,b:2}]` vs `[{b:2,a:1}]`) -> a non-null commit `c` with
   `isEmptyCommit(c) === true` (no change: the desktop session neither reloads
   nor commits). Assert both non-null and `isEmptyCommit`.
Guards (pass before and after):
4. `diffDocuments` where `extensions` are `JSON.parse('[{"__proto__":1}]')` vs
   `JSON.parse('[{"__proto__":2}]')` -> `null`. This is a real metadata edit and
   `null` is the full-reload signal (see the `diffDocuments` doc comment and
   `apps/desktop/src/file/session.ts`, which calls `loadDocument` on `null`), not
   equality.
5. Own-member edit `{a:1}` -> `{a:2}` is a change; both sides changing `a`
   differently -> conflict, ours kept.

## Acceptance criteria

- Tests 1-5 pass; every pre-existing test in `document-merge.test.ts` and
  `document-merge-versions.test.ts` passes unmodified.
- Test 3 asserts the empty, non-null commit (`isEmptyCommit`) and test 4 asserts
  `null`, so the key-order no-op and the full-reload outcome are checked
  separately.
- `mergeValue` and `mergeById` are exported; `canonicalValue` no longer exists.

## Verification (each must exit 0)

1. `bun test packages/core/src/document-merge.test.ts packages/core/src/document-merge-versions.test.ts > tmp/fv-s942/fv-03-merge-fix/test.log 2>&1`
2. `bunx biome check packages/core/src/document-merge.ts packages/core/src/document-merge.test.ts`
3. `! grep -n canonicalValue packages/core/src/document-merge.ts`
4. Log in the progress file that tests 1-3 failed before the change (run them first,
   save `tmp/fv-s942/fv-03-merge-fix/before.log` with a non-zero exit).
5. `test "$(grep -c 'isEmptyCommit(' packages/core/src/document-merge.test.ts)" -ge 2`
   (the key-order test now calls `isEmptyCommit` in addition to the existing line-90 check).

## Amendment 2026-11-26 (design review FV-DESIGN-D2-DIFF)

Remaining work: strengthen only test 3 in `packages/core/src/document-merge.test.ts`
(test "metadata equality ignores object key order but detects own prototype members")
to assert `not.toBeNull()` and `isEmptyCommit(commit) === true` on the key-order case.
Keep the `__proto__` null assertion and every other test. Do not touch
`document-merge.ts`; production behavior already returns an empty commit and null.
The existing `before.log` stays as the D2 fail-before evidence; record the new run in
`tmp/fv-s942/fv-03-merge-fix/test-amend.log` and hashes in the progress log.

## Implementation status

- [x] D2 implementation, named exports, and regression/guard tests complete.
- [x] Amendment 2026-11-26: test 3 asserts the empty, non-null commit.
- [x] Focused tests, Biome, strict focused TypeScript, and canonicalValue absence checks pass; evidence and hashes are recorded in the progress log.
- [ ] Independent review and integration verification are downstream workflow steps.
