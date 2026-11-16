# dps-07-docs

- planId: dps-07-docs. Wave 1. dependsOn: none.
- Design: sections 3 to 7 and the user-qa defaults in
  `design-docs/specs/design-document-pages-snippets.md` and
  `design-docs/user-qa/document-pages-snippets.md`.
- writePaths: `docs/editing.md`, `docs/import-export.md`,
  `impl-plans/progress/dps-07-docs.md`, `tmp/dps-s861/dps-07-docs`,
  `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

Acceptance requires `docs/editing.md` and `docs/import-export.md` to
describe the new features. `docs/cli.md` and `README.md` belong to dps-17.
The behaviour is fixed by the accepted design, so these docs can be
written in wave 1. dps-17 re-checks them against the final UI labels.

## Non-goals

- No edits to `docs/cli.md`, `README.md`, examples or code.
- No screenshots or new images.

## Changes

1. `docs/editing.md`:
   - New section "Code and Markdown snippets":
     - creating snippets from the palette (Code snippet, Markdown snippet);
     - double-click editing (Tab inserts a tab, Escape cancels, Mod+Enter
       or a click outside commits);
     - inspector controls: language, line numbers, wrap lines, snippet
       theme Light or Dark;
     - the 28 languages: say "the languages listed in the inspector";
     - auto height, width resize;
     - the supported Markdown subset, and the literal-text items from
       user-qa Q4.
   - New section "Page frames and document flow":
     - presets and orientation;
     - "Add page" placement with the 48 px gap and the shift of later
       pages;
     - Page flow Vertical or Horizontal re-layout as one undo step;
     - PageDown and PageUp navigation;
     - the slideshow showing one slide per page frame, with the precedence
       over the slide size (user-qa Q6).
   - Match the existing headings style. Find the "Shapes, arrowheads and
     connector styles" section and place the new sections after it.
2. `docs/import-export.md`:
   - New section "Document export":
     - multi-page PDF (one page per page frame across pages in tab order,
       fallback one page per nodetto page; raster pages with a selectable
       Unicode text layer for snippets; 500-page limit);
     - Markdown export rules (verbatim Markdown, fenced code, `page-N-M.svg`
       group images, `<stem>.assets/`, and a ZIP in the app per user-qa Q3).
   - Fallback table for draw.io, D2, Mermaid and HTML (design 7.6).
   - Mention `nodetto-cli export --format pdf --document` and
     `--format markdown --output file.md`, linking to `cli.md` for details.

## Pitfalls

- Use names exactly as the design gives them: action labels "Add page",
  "Next page frame", "Previous page frame"; menu "Document as PDF...",
  "Document as Markdown (ZIP)...".
- No emojis. Do not promise vector PDF or features listed as non-goals.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-07-docs/)

1. `bun test apps/cli/src/cli-wiring.test.ts`, the existing docs-adjacent
   test. It must still pass and shows no regression from docs edits.
2. `sh -c 'grep -q "Page frames and document flow" docs/editing.md && grep -q "Code and Markdown snippets" docs/editing.md && grep -q "Document export" docs/import-export.md && grep -q -- "--document" docs/import-export.md'`

## Done criteria

- The sections exist with the content above.
- Both commands exit 0.
- The progress log records the sections added, the commands, the exit codes
  and the log paths.

## Coordination

No other wave-1 or wave-2 plan writes these files. Re-read before editing
and record hashes. No git state changes.
