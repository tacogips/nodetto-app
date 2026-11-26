# fv-13-tsv-model

- planId: fv-13-tsv-model
- planPath: impl-plans/active/fv-13-tsv-model.md
- progressPath: impl-plans/progress/fv-13-tsv-model.md
- wave: 3
- dependsOn: fv-01-scaffold, fv-02-audit, fv-04-stubs-a
- Design: sections 3 (B1), 5 (D1), 6.4, 7.
- writePaths: `formal/Nodetto/Tsv/Model.lean`, `formal/Nodetto/Tsv/Vectors.lean`,
  `formal/Nodetto/Tsv.lean`, `formal/vectors/tsv.json`,
  `impl-plans/progress/fv-13-tsv-model.md`, `tmp/fv-s942/fv-13-tsv-model`, `target`,
  `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Model of `packages/core/src/table-sheet/delimited.ts` `parse` (separator 9),
`parseTsv` and `serializeTsv` over UTF-16 code units.

## Changes

- `formal/Nodetto/Tsv/Model.lean`, `namespace Nodetto.Tsv`: `abbrev Text := List Nat`,
  `abbrev Grid := List (List Text)`, `parse (text : Text) (separator : Nat) : Grid`,
  `parseTsv (text : Text) : Grid := parse text 9`, `serializeTsv (grid : Grid) : Text`.
  - `parse` mirrors the loop state `(rows, row, field, quoted, ended)`: empty text ->
    `[]`; quote handling (doubled quote inside quotes, a quote opens only when the
    field is empty), separator, LF/CR with CRLF collapsed, and the final
    `if !ended` push. Write it as structural recursion over the remaining list.
  - `serializeTsv`: a field is quoted when it contains 9, 13, 10 or 34, or when it is
    empty and its row has exactly one field; inner quotes doubled; fields joined by
    9, rows by 10.
- `formal/Nodetto/Tsv.lean`: `import Nodetto.Tsv.Model`.
- `formal/Nodetto/Tsv/Vectors.lean`: module `"tsv"`, sources
  `["packages/core/src/table-sheet/delimited.ts"]`. Cases: `parseTsv {text}`,
  `serializeTsv {grid}`, `roundTrip {grid}` (output `parseTsv (serializeTsv grid)`).
  All outputs `ok`. Include: `[]`, `[[]]`, `[["a"],[]]`, `[[],["a"]]`, `[[""]]`,
  `[["",""]]`, fields with tab, quote, CR, LF, CRLF, a lone surrogate, text with a
  trailing newline, quoted fields followed by text, ragged rows.
- `formal/vectors/tsv.json`: generated, committed.

## Pitfalls

- JS `text[i]` is a code unit; `0x0d 0x0a` collapses only when CR is followed by LF.
- `"` opens a quoted field only when `field` is empty, also mid-row after a separator.

## Acceptance criteria

- [x] `Nodetto.Tsv` builds; vectors are fresh with 200+ cases, 20+ per fn.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Tsv > ../tmp/fv-s942/fv-13-tsv-model/build.log 2>&1`
2. `formal/scripts/audit --module Tsv --vectors > tmp/fv-s942/fv-13-tsv-model/audit.log 2>&1`
