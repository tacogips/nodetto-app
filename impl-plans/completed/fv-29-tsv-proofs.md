# fv-29-tsv-proofs

- planId: fv-29-tsv-proofs
- planPath: impl-plans/active/fv-29-tsv-proofs.md
- progressPath: impl-plans/progress/fv-29-tsv-proofs.md
- wave: 4
- dependsOn: fv-13-tsv-model
- Design: sections 5 (D1), 6.4, 8.
- writePaths: `formal/Nodetto/Tsv/Theorems.lean`, `formal/Nodetto/Tsv.lean`,
  `impl-plans/progress/fv-29-tsv-proofs.md`, `tmp/fv-s942/fv-29-tsv-proofs`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent

Prove the true TSV round trip (rows with at least one field) and the three D1
counterexamples.

## Changes

- `formal/Nodetto/Tsv/Theorems.lean`: `parseTsv_serializeTsv`,
  `tsv_trailing_empty_row_lost`, `tsv_only_empty_row_lost`,
  `tsv_inner_empty_row_reads_as_empty_field`, verbatim. The last three by `decide` or
  `rfl` on the literals.
- `formal/Nodetto/Tsv.lean`: add `import Nodetto.Tsv.Theorems`.

## Pitfalls

- Generalise the parser state: prove that parsing `encodeField f ++ rest` from a
  state with an empty field and `quoted = false` appends `f` and continues with
  `rest` when `rest` is empty or starts with 9 or 10.
- A quoted field can be empty (`""`), and a field that is empty in a row of two or
  more is written unquoted; both must be covered.
- The last row never ends with a newline because no row is empty.

## Acceptance criteria

- [x] The audit passes for the four names (`audit-grid-final.log`, exit 0).

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Tsv > ../tmp/fv-s942/fv-29-tsv-proofs/build.log 2>&1`
2. `formal/scripts/audit --module Tsv --theorem parseTsv_serializeTsv --theorem tsv_trailing_empty_row_lost --theorem tsv_only_empty_row_lost --theorem tsv_inner_empty_row_reads_as_empty_field > tmp/fv-s942/fv-29-tsv-proofs/audit.log 2>&1`
