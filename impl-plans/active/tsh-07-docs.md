# tsh-07-docs

- planId: tsh-07-docs
- planPath: impl-plans/active/tsh-07-docs.md
- progressPath: impl-plans/progress/tsh-07-docs.md
- wave: 2
- dependsOn: tsh-01a-ir
- Design: `design-docs/specs/design-table-sheet.md` sections 2-9; `design-docs/user-qa/table-sheet.md`.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `docs/editing.md`
  - `docs/cli.md`
  - `docs/import-export.md`
  - `apps/cli/src/table-docs.test.ts` (new)
  - `impl-plans/progress/tsh-07-docs.md`
  - `tmp/tsh-s780/tsh-07-docs`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan writes the user documentation for the spreadsheet table, plus a
small drift test that keeps the documented limits and command names in
line with the code constants. README.md and the design spec status line
belong to tsh-08.

## Non-goals

- No README edits and no help.ts edits.
- No design spec edits.
- No screenshots. `docs/images/` is untouched.

## File-level changes

1. `docs/editing.md`: add a new section `## Spreadsheet tables`. Place it
   after `## Logical ERD references` or at a fitting place, and keep the
   other sections unchanged. It covers:
   - The payload shape: columns, rows, cells keyed by column id,
     `headerRow` and `striped`, with a short JSON example using neutral
     data (Widget/Todo).
   - The column types and their stored value forms. Dates are ISO
     `YYYY-MM-DD`.
   - Default alignments and the per-cell overrides (bold, align, fill hex).
   - The limits table (1-100 columns, 0-1000 rows, 10000 chars, name 200,
     options 100 x 200, widths 24-2000, heights 20-2000) and the
     validation issue codes.
   - Bounds come from the data, and the selection handles do not resize.
   - Editing keys:
     - click to select a cell, Shift-click and Shift+arrow to extend
     - double-click, Enter, F2 or typing to edit
     - Enter, Tab, Shift+Tab and Escape inside the editor
     - arrows, Delete and Escape outside it
   - Copy, cut and paste as TSV: copy preserves stored text exactly, and
     paste grows the table and coerces values to the column types.
   - New columns, from Add column, paste growth or CLI `--no-header`, are
     named `Column N`, where N is the smallest positive number no column
     uses yet. They are text columns of width 120 (tsh-00 rule).
   - Column and row border dragging; a double-click on a column border
     resets it to 120. Every edit is one undo step.
   - Inspector controls, and the toolbox "Sheet" entry that creates the
     default 3x3 table.
   - That the table differs from the ERD `Table` tool (`erd.table`).
2. `docs/cli.md`:
   - Add example lines to the top example block for `table create` and
     `table set`.
   - Add a subsection `### Spreadsheet tables` documenting `table create`
     flags, CSV/TSV rules, `table set`, the `set-cells` edit op JSON shape,
     inline `add` with `type:"table.sheet"`, `lint`/`validate` issue codes,
     and `export` support.
   - Also document `nodetto-cli draw <doc> table.sheet` and
     `nodetto-cli shapes table`. The shape id is `table.sheet` (tsh-00
     refinement 5), not `table:sheet`.
   - Match the flag names in `impl-plans/active/tsh-06-cli.md` exactly.
3. `docs/import-export.md`: one short paragraph. SVG, PNG and PDF export
   render `table.sheet` like the canvas, but text truncation uses estimated
   widths. Code handoff, draw.io, Mermaid and D2 do not export tables.
4. `apps/cli/src/table-docs.test.ts`: a drift test. Imitate
   `packages/core/src/bpmn/docs-example.test.ts`, which reads docs from
   disk in a test (`node:fs` is allowed in tests). It asserts:
   - `docs/editing.md` contains each `TABLE_SHEET_LIMITS` number, formatted
     as written in the doc, so the numbers are imported, not hard-coded.
   - `docs/editing.md` contains every issue code `table.id`,
     `table.noColumns`, `table.limit`, `table.size`,
     `table.unknownColumn`, `table.cellEmpty`, `table.cellType`,
     `table.options` and `table.cellFill`.
   - `docs/cli.md` contains `nodetto-cli table create`,
     `nodetto-cli table set`, `"op":"set-cells"`, `--csv`, `--tsv`,
     `--data` and `--no-header`.

## Pitfalls

- Write in plain English, without emojis, matching the existing doc tone.
- Do not document behavior beyond the design, for example formulas or
  sorting.
- The limits come from `TABLE_SHEET_LIMITS`. If the committed IR values differ
  from the design, record a blocker instead of changing the docs to match.

## Verification (exit 0; test commands show at least 1 test, 0 fail)

1. `bun test ./apps/cli/src/table-docs.test.ts` -> `docs.log`
Static checks (tsh-00; must exit 0, but they are not test commands):
`bun run typecheck` -> `typecheck.log`, and `bunx biome check apps/cli/src/table-docs.test.ts --diagnostic-level=warn` -> `biome.log`

## Done criteria

- The three docs are updated, and the drift test passes.
- Logs are under `tmp/tsh-s780/tsh-07-docs/final/`, with the progress log
  complete.
- `git diff --stat -- docs/` lists only the three files.
