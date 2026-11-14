# tsh-01a-ir

- planId: tsh-01a-ir
- planPath: impl-plans/active/tsh-01a-ir.md
- progressPath: impl-plans/progress/tsh-01a-ir.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-table-sheet.md`, sections 2, 3 and 11.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/ir/src/registry/table.ts` (new)
  - `packages/ir/src/registry/table.test.ts` (exists from 87365fb; extend it)
  - `packages/ir/src/semantics/table.ts` (fix only a defect a test exposes)
  - `packages/ir/src/semantics.ts`
  - `packages/ir/src/registry.ts`
  - `packages/ir/src/index.ts`
  - `packages/ir/src/registry.test.ts`
  - `packages/io/src/__fixtures__/table-sheet.jsonl` (new)
  - `packages/io/src/jsonl/golden.test.ts`
  - `packages/io/src/jsonl/table-sheet.test.ts` (new)
  - `packages/core/src/table-sheet/index.ts` (new)
  - `packages/core/src/index.ts` (one line only)
  - `impl-plans/progress/tsh-01a-ir.md`
  - `tmp/tsh-s780/tsh-01a-ir`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Make `table.sheet` a registered, validated IR element type with a golden
JSONL fixture. Also add the core barrel, so wave 2 can import the wave-1 core
modules through `@nodetto/core`.

Starting state at `87365fb`:

- `packages/ir/src/semantics/table.ts` is complete for design section 2.
- The plan commit's contract seed already re-exports that file through
  `semantics.ts` (`export * from "./semantics/table.ts"`) and `index.ts`.
- `registry/table.test.ts` has 2 primitive tests. Keep them.
- Session 776 progress: `impl-plans/progress/tsh-01-model.md` (history only).

## Non-goals

- No core layout, edit, coercion or grid code. Those belong to tsh-01b,
  tsh-01c and tsh-01d.
- Do not register the util in `packages/core/src/shapes/index.ts`. That
  belongs to tsh-08.
- No erd changes. No `Command` changes.

## File-level changes

1. `registry/table.ts`: `export const TABLE_SHEET: ElementTypeDefinition`.
   - Imitate `packages/ir/src/registry/erd.ts:ERD_TABLE` and use the
     helpers in `packages/ir/src/checks.ts` (`checkObject`, `checkArray`,
     `checkString`, `checkNumber`, `checkBoolean`, `checkEnum`).
   - `type "table.sheet"`, `category "node"`, `onReferenceDeleted "detach"`,
     `references: noReferences` (find its import in `erd.ts`).
   - keyOrder: keys `["columns","rows","headerRow","striped"]`.
     children: `columns` with keys `["id","name","type","width","align","options"]`,
     and `rows` with keys `["id","height","cells"]`. Do NOT declare `cells`,
     because its keys are column ids.
   - Codes, all with severity error (design section 3):
     - `id.duplicate`: separately for columns and for rows
     - `table.id`: an id that does not match `TABLE_SHEET_ID_PATTERN`
     - `table.noColumns`: `columns` is empty
     - `table.limit`: more than 100 columns or 1000 rows, a string value
       over 10000 code units, a name over 200, more than 100 options, or an
       option length outside 1..200. The message names the limit.
     - `table.size`: width not an integer in 24..2000, or height not an
       integer in 20..2000
     - `table.unknownColumn` at `${path}.rows[i].cells.${key}`
     - `table.cellEmpty`: a cell `{}`
     - `table.cellType`: via `tableSheetValueMatches`
     - `table.options`: options on a non-select column, or a duplicate or
       empty option
     - `table.cellFill`: not `^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`
   - Iterate cell keys with `Object.keys`, and look columns up through a
     `Map`, never through a plain object.
2. `semantics.ts`: import `TableSheetSemantic` and add
   `"table.sheet": TableSheetSemantic` to `SemanticByType`. The seed line
   `export * from "./semantics/table.ts"` already exists.
3. `registry.ts`: import `TABLE_SHEET` and add it to `DEFINITIONS` right
   after `ERD_TABLE`.
4. `index.ts`: export `TABLE_SHEET` only if other definitions such as
   `ERD_TABLE` are exported. The section 2 symbols are already exported by
   the seed. Do not duplicate them.
5. `registry.test.ts`: add `"table.sheet"` to the expected sorted type list.
6. `__fixtures__/table-sheet.jsonl`: one document, one freeform page and
   one `table.sheet` element. It covers:
   - all five column types
   - a select with options `Todo`, `Doing`, `Done`, and a column with `align`
   - a cell with `bold`, `align` and `fill` (`#ffeeaa`)
   - a text value containing `\n`
   - a row with `height: 40`, and a row with `cells: {}`
   - `headerRow: false` and `striped: true`
   Produce the canonical bytes by running
   `serializeDocument(parseDocument(text))` once in a scratch script under
   `tmp/tsh-s780/tsh-01a-ir/`. Imitate the other fixtures for
   document/page records.
7. `golden.test.ts`: append `"table-sheet"` to `GOLDEN`.
8. `jsonl/table-sheet.test.ts`: the tests below.
9. LAST, after steps 1-8 pass:
   - `packages/core/src/table-sheet/index.ts` with exactly these ten lines,
     in this order: `export * from "./layout.ts";`, `./paint.ts`,
     `./shape.ts`, `./types.ts`, `./edits.ts`, `./apply.ts`,
     `./delimited.ts`, `./coerce.ts`, `./columns.ts`, `./grid.ts`.
   - In `packages/core/src/index.ts`, add one line
     `export * from "./table-sheet/index.ts";` next to
     `export * from "./bpmn/index.ts";`.
   - These lines do not resolve until tsh-01b/c/d land. That is expected.
     Record it. None of this plan's tests load core.

## Invariants

- Existing registry and erd tests still pass. Validation output for other
  types is unchanged.
- The fixture produces no `semantic.unknownField` warnings, including for
  cell keys.

## Tests (input -> expected)

- `registry/table.test.ts`. Use `expectValid` and `codes` from
  `./test-helpers.ts`. Build payloads from a local helper: a 3x3 with ids
  c1..c3 and r1..r3. Do not import core.
  - the 3x3 helper, and a payload holding every type -> valid
  - duplicate column id -> `id.duplicate`; duplicate row id -> `id.duplicate`
  - `__proto__` column id -> `table.id`; `columns: []` -> `table.noColumns`
  - 100 columns -> valid; 101 -> `table.limit`
  - 1000 rows -> valid; 1001 -> `table.limit`
  - text of 10000 units -> valid; 10001 -> `table.limit`
  - name of 201 -> `table.limit`; 101 options -> `table.limit`
  - width 23, 2001 or 24.5 -> `table.size`; height 19 -> `table.size`
  - cell key `zz` -> `table.unknownColumn`; cell `{}` -> `table.cellEmpty`
  - number `"5"`, checkbox `1`, select `"Nope"` or date `2023-02-29` ->
    `table.cellType`; date `2024-02-29` -> valid
  - options on a text column -> `table.options`; duplicate option ->
    `table.options`; fill `red` -> `table.cellFill`
- `jsonl/table-sheet.test.ts`:
  - the fixture parse -> serialize is byte-identical
  - `validateDocument` gives no errors and no `semantic.unknownField`
  - cell keys written in reverse order -> canonical sorted output

## Verification (each exits 0 and shows at least 1 test with 0 failures; logs under `tmp/tsh-s780/tsh-01a-ir/final/`)

1. `bun test ./packages/ir/src/registry/table.test.ts ./packages/ir/src/registry.test.ts ./packages/ir/src/registry/erd.test.ts` -> `ir.log`
2. `bun test ./packages/io/src/jsonl/table-sheet.test.ts ./packages/io/src/jsonl/golden.test.ts` -> `io.log`
3. `bun test ./packages/core/src/semantic-field-audit.test.ts` -> `audit.log`
   (an existing test; it imports `./shapes/index.ts`, not the barrel)

Static checks (tsh-00): `bunx biome check` on every owned source file,
then `bun run typecheck`. Before tsh-01b/c/d land, typecheck errors
confined to `packages/core/src/table-sheet/index.ts` are expected and
recorded.

## Done criteria

- `TABLE_SHEET` is in `DEFINITIONS`, the fixture is in `GOLDEN`, and
  verifications 1-3 exited 0.
- `git diff -- packages/core/src/index.ts` adds exactly one line, and the
  barrel has the ten lines.
- `git diff --stat -- packages/ir/src/registry/erd.ts packages/core/src/commands.ts`
  is empty.
- The progress log has the intent hash, per-edit hashes and command results.
