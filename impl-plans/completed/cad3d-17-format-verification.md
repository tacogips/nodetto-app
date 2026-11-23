# M17 cad3d-17-format-verification

- dependsOn: M16 (`generateCadDocument`, CLI `merge` on CAD documents)
- Design: sections 7.2, 7.4, 7.5, 14
- writePaths (all new): `packages/io/src/jsonl/cad-format.test.ts`,
  `packages/core/src/cad/merge.test.ts`,
  `apps/cli/src/cad-merge-git.test.ts`,
  `apps/desktop/scripts/cad-format-bench.ts`; existing:
  `apps/desktop/package.json` (script `bench:cad-format`),
  `design-docs/specs/design-cad3d.md` (measured numbers in 7.2 only)

## Intent

Turn the format claims of the design into tests and recorded measurements.
No production code changes are expected; a failing claim is fixed in the
production code of the owning milestone and reported.

## Tests

`cad-format.test.ts` (uses `generateCadDocument` from `@nodetto/core`):

- Lossless: `parse(serialize(doc))` deep-equals `doc` for the generated
  document and for `__fixtures__/cad3d.jsonl`; `serialize(parse(text))` is
  byte identical.
- Deterministic: serialising the same document built in two different
  element insertion orders gives identical bytes; numbers such as 0.1,
  1e-6 and 1234.567891 print the same after `roundNm`.
- Minimal churn (line diff computed in the test by comparing line sets):
  radius edit changes exactly 1 line; feature reorder changes exactly 1
  line; adding a circle adds exactly 1 line and changes none; deleting a
  sketch that has n entities and k extrudes using it removes exactly
  n + 1 lines and changes exactly k lines (each dependant extrude loses
  its `sketch` key); deleting a sketch nothing depends on removes n + 1
  lines and changes none.
- Unknown data: an unknown `cad.future` element and an unknown field on a
  `cad.extrude` survive a round trip unchanged.
- Size: `generateCadDocument` mints ids with the production id function
  (26-character ULIDs), so sizes are realistic. The 10,000 record document
  averages at most 260 bytes per record and is under 2.6 MB (spike
  measurements of single records: 196 to 254 bytes); write the measured
  numbers to `tmp/cad3d/m17/format.json` and into design section 7.2.
- Speed: parse plus validate under 1,000 ms and serialize under 1,000 ms
  for the 10,000 record document in Bun.

`merge.test.ts` (uses `mergeDocumentVersions`,
`packages/core/src/document-merge.ts`):

- Ours edits a circle radius, theirs edits an extrude distance: clean,
  both present.
- Ours edits `distance`, theirs edits `op` of the same extrude: clean.
- Both edit the same radius differently: one conflict at
  `semantic.r`, ours kept.
- Delete versus modify (design 7.4, `document-merge.ts:379-405`), each
  with the documents built by real `deleteElements` commands so referrers
  are rewritten as in production:
  - theirs deletes a sketch (and so its entities, and the `sketch` key of
    its extrude), ours changes that extrude's `distance`: clean; the
    extrude has the new distance and no `sketch`; `analyzeCadPage` reports
    `cad.reference.missing`;
  - theirs deletes a sketch, ours adds a circle to it: the sketch is
    restored from ours with one `deleted-in-theirs` conflict and the new
    circle is kept;
  - ours deletes a sketch, theirs adds a circle to it: the circle is
    dropped with one `deleted-in-ours` conflict;
  - in all three the result passes `validateDocument` and contains no
    reference to a missing record.
- Both add different entities to one sketch: clean, both present.
- Both add a feature at the same history position: both present, order
  deterministic (index then id).
- Ours adds a 2D shape on a freeform page, theirs adds CAD features:
  clean and rule R holds.
- The merged documents always pass `validateDocument`.

`cad-merge-git.test.ts` (pattern of `apps/cli/src/merge-git.test.ts`, real
git in a temporary directory, merge driver configured as documented at
`design-docs/specs/design-cli-layout-merge-lint.md:798-806`):

- Disjoint CAD field edits on two branches: `git merge` exits 0 and the
  file contains both edits.
- The same field edited differently: `git merge` exits non-zero and the
  summary names one conflict.
- Without the driver (plain text merge), edits to two different records
  merge cleanly, showing that one record per line is enough for git.

`cad-format-bench.ts`: prints size, parse, serialize and `gzip` size for
1,000, 10,000 and 20,000 records; run once and paste the table into design
section 7.2 if it differs from the estimates there.

## Acceptance criteria

- Every bullet of design sections 7.2, 7.4 and 7.5 that states a property
  of the JSONL representation is asserted by a test named in this plan or
  in M12 (NMESH) or M15 (collaboration).
- Measured numbers recorded under `tmp/cad3d/m17/` and in the design.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/io/src/jsonl/cad-format.test.ts packages/core/src/cad/merge.test.ts apps/cli/src/cad-merge-git.test.ts'`
2. `sh -c 'bunx biome check packages/io/src/jsonl/cad-format.test.ts packages/core/src/cad/merge.test.ts apps/cli/src/cad-merge-git.test.ts apps/desktop/scripts/cad-format-bench.ts && bun test packages/io/src/jsonl/cad-format.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m17; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m17/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m17/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/merge.test.ts'`

## Progress

Implemented. Format tests cover lossless and canonical JSONL, forward
compatibility, record churn, size and speed. Merge tests cover field edits,
conflicts, delete/reference integrity, distinct additions and history ties.
The Git tests exercise the real CLI driver and plain Git. Measurements for
1,000, 10,000 and 20,000 CAD records are in design section 7.2 and
`tmp/cad3d/m17/format.json`.

The one-line reorder test applies the core `reorder` command with a
fractional key for a single feature. The general CLI `edit` operation
`order` can rewrite sibling indices. Moving the bracket fixture's extrusion
to the back rewrote seven sibling records and left the extrusion's key
unchanged (`tmp/cad3d/m17/cli-order.log`). Plain Git merged two separated CAD
record edits in the test. Use the structured driver for field-level merging
when overlapping text hunks would conflict.
