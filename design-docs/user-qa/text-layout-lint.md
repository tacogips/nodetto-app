# Text-layout lint: owner decisions

Design: `design-docs/specs/design-text-layout-lint.md`. Q1 and Q2 are
resolved, and the design implements the decisions. Q3 and Q4 are still open.
The design implements their defaults. A different answer changes only the
section named in the question.

## Q1. Page kinds beyond `architecture` (Scope) - RESOLVED 2026-10-30

The rules depend on element types, not on the page kind. `node.generic`,
`shape.geo`, `text.note` and generic edges also appear on freeform, flowchart
and UML pages.

- Former default: lint only `architecture` pages.
- Decision: lint `architecture`, `freeform` and `flowchart` pages
  (`TEXT_LAYOUT_LINT_PAGE_KINDS`).
  - `lint` without `--page` includes them alongside BPMN and breadboard pages.
  - `lint --page` accepts them.
  - Whole-page SVG, PNG and PDF exports of those kinds print the warnings.
  - Other kinds keep their exact output.
  - Documents with only freeform or flowchart pages no longer fail with "no
    lintable pages".
  - `LINT_NO_PAGES` names all five lintable kinds.

## Q2. Real-font width (Scope, rules `label-overflow`, `note-overflow`) - RESOLVED 2026-10-30

Export wraps by an estimated advance of 0.55 em per grapheme. resvg draws with
real fonts, so wide glyphs (CJK) can still be clipped in a PNG even though the
estimate fits.

- Former default: the lint uses the export estimate and does not report
  real-font clipping.
- Rejected alternative: change `wrapTextLines` itself. That would change
  export wrapping and golden output.
- Decision: wide-aware measurement on the lint side only.
  - The lint measures East Asian Wide (`W`) and Fullwidth (`F`) graphemes at
    1.0 em, and every other grapheme at 0.55 em. Wide graphemes include CJK
    ideographs, kana, hangul, and fullwidth forms and punctuation such as
    `（` `）` and `、`. Ambiguous (`A`) characters stay at 0.55 em.
  - `label-overflow` reports a rendered line whose wide-aware width exceeds
    the text area, with measured and available widths.
  - `note-overflow` reports a wide-aware line too wide for the note, and a
    note whose wide-aware wrapped height does not fit its box.
  - Export wrapping and geometry stay byte-identical.

## Q3. Warnings for `export --element` and other formats (CLI: export) - open, default kept

- Default: only whole-page SVG, PNG and PDF exports of an architecture,
  freeform or flowchart page print layout warnings.
- Alternative: for `--element`, print only the findings for elements inside
  the exported frame or selection.

## Q4. Severity configuration and export `--strict` (CLI: lint, export) - open, default kept

- Default: all three rules are fixed `warning` severity, no configuration is
  read, and export gets no `--strict`. Check scripts use
  `lint --format json` and filter by `ruleId`.
- Alternative: a config file entry to promote rules to `error` (lint exit 1),
  or `export --strict` exiting 3 on any warning, consistent with `validate`.
