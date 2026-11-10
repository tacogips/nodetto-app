# Spreadsheet table (`table.sheet`): owner decisions

Design: `design-docs/specs/design-table-sheet.md`. Nothing here blocks the
work. The design implements each default below. A different answer changes
only the section named in the question.

## Q1. Date cell format (section 2, `coerce.ts`) - OPEN, default applied

- Default: ISO 8601 calendar date `YYYY-MM-DD`, stored as a string and
  displayed exactly as stored. No time, no time zone and no locale display.
- Alternative: locale display formats. These would make export output
  depend on the machine.

## Q2. Number display (section 4) - OPEN, default applied

- Default: `String(value)`, with no thousands grouping, fixed decimals or
  currency.
- Alternative: a per-column number format field. That would be a schema
  addition.

## Q3. Select pill colors (section 5) - OPEN, default applied

- Default: the color comes from the option index into a fixed 8-color
  palette, and no color is stored. Reordering options changes the colors.
- Alternative: a stored color per option, such as `options: [{name, color}]`.
  That changes the schema shape and should be decided before the first
  release.

## Q4. Multi-line cells (section 6) - OPEN, default applied

- Default: cells render on one line with an ellipsis, and the editor is
  single-line. Newlines from paste or the CLI are kept in the data and
  displayed as spaces.
- Alternative: wrapped text with auto row height, plus Alt+Enter in the
  editor.

## Q5. Size limits (section 3) - OPEN, default applied

- Default: 100 columns, 1000 rows and 10000 characters per cell, as the
  intake proposed. Widths run from 24 to 2000 px and heights from 20 to
  2000 px.

## Q6. Default name of a new column (section 6) - DECIDED (session 778 input)

- `insertColumn`, paste growth and CLI `--no-header` name a new column
  `Column N`. N is the smallest positive integer that no existing
  `Column N` header uses. The column has width 120 and type text unless
  another type is given.
