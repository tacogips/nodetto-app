# dps-17g-docs-examples

- planId: dps-17g-docs-examples (session 864, wave 1, dependsOn: none)
- Design: `design-docs/specs/design-document-pages-snippets.md` sections
  7.4, 8, 10 (docs and examples) and 10.2.
- Parent: `impl-plans/active/dps-17-wiring.md` Changes 6 (`help.ts`), 7
  and 8, and session 863 addition 5.
- writePaths:
  - `docs/cli.md`
  - `docs/editing.md`
  - `docs/import-export.md`
  - `README.md`
  - `examples/document/README.md` (new)
  - `examples/document/paper.ops.json` (new)
  - `examples/document/deck.ops.json` (new)
  - `apps/cli/src/document-examples.test.ts` (new)
  - `apps/cli/src/help.ts`
  - `apps/cli/src/cli-wiring.test.ts` (extension only)
  - `apps/cli/src/help-style-export.test.ts` (extension only)
  - `impl-plans/progress/dps-17g-docs-examples.md`
  - `tmp/dps-s864/dps-17g-docs-examples`
  - `target` (artifact root only)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

Users need docs and runnable examples for code snippets, Markdown
snippets, page frames with vertical and horizontal flow, the page-frame
slideshow, and document export (app and CLI). dps-07 already wrote the
feature sections in `docs/editing.md`; this plan corrects them against
the final UI labels and CLI.

`docs/cli.md` currently has no `set-page-flow` text. Follow the example
format of `examples/flowchart/README.md` and `request.ops.json` (`op`,
`page`, `type`, `ref`, `semantic`, `visual`).

## Changes

1. `help.ts`: the export usage must show `--format pdf --document`,
   `--format markdown --document --output <file.md>` and the shorthand
   `--format markdown --output <file.md>`. The edit help already mentions
   `set-page-flow` (:200); keep it. Edit only if a form is missing.
2. `docs/cli.md`:
   - the three export forms above, with assets in `<stem>.assets/`;
   - `set-page-flow` (vertical or horizontal);
   - a `text.code` add example with a canonical language, and a note that
     TypeScript resolves to `javascript`;
   - a `text.markdown` add example;
   - a page frame add with `semantic.page`.
3. `docs/import-export.md`: Document as PDF, Document as Markdown (ZIP),
   and the same CLI forms. Correct anything that contradicts design 7.4
   and 7.5.
4. `docs/editing.md`: correct any label that differs from the final UI:
   - "Code snippet", "Markdown snippet", "Page";
   - "Add page", "Next page frame" (PageDown), "Previous page frame"
     (PageUp);
   - page flow vertical and horizontal;
   - the slideshow presents page frames in flow order.
5. `README.md`: one short paragraph per feature (snippets, page frames
   and flow, slideshow, document export) in the app and CLI sections.
6. Examples (self-authored text, no copied content):
   - `paper.ops.json`: a vertical page with 2 A4 page frames, a Markdown
     title and abstract, a `text.code` (`language: "rust"` or
     `"javascript"`), and a small `shape.geo` x2 plus `edge.generic`
     diagram inside frame 2.
   - `deck.ops.json`: `set-page-flow` horizontal, then 3 `slide-16-9`
     frames, each with a `text.markdown` holding bullets.
   - `README.md`: seed JSONL (as in the flowchart README), then
     `nodetto-cli edit <file> --ops ...`, `validate`,
     `export --format pdf --document --output ...` and
     `export --format markdown --output ...`.
7. `document-examples.test.ts` (Bun, in-process). Imitate
   `apps/cli/src/iphone-kit-example.test.ts` and `edit/batch.ts`:
   - each example applied to a fresh seeded document with `edit --ops`
     (or `Batch`) -> no error, and `validateDocument` gives 0 errors;
   - paper -> 2 page frames with `page.size === "a4"`, one `text.code`,
     one `text.markdown` or more, and at least 2 `shape.geo`;
     `exportCommand ... --format pdf --document` gives 2 pages;
   - deck -> page `pageFlow === "horizontal"` and 3 frames with
     `page.size === "slide-16-9"`;
   - doc sync: the `--format markdown --document` and `set-page-flow`
     strings occur in `help.ts` output and in `docs/cli.md`.

## Non-goals

- No behaviour changes in CLI commands other than help text. No version
  bumps.
- Do not touch `apps/cli/src/document-wiring.test.ts` (dps-17f).

## Pitfalls

- Example language ids must be canonical (`javascript`, not `typescript`).
- Do not paste external text into examples.
- Extension-only rule for `cli-wiring.test.ts` and
  `help-style-export.test.ts`: edit only if the help change breaks an
  exact expectation, and only add the new text.

## Verification (exit 0; logs in `tmp/dps-s864/dps-17g-docs-examples/`)

1. `bun test apps/cli/src/document-examples.test.ts apps/cli/src/cli-wiring.test.ts apps/cli/src/help-style-export.test.ts`
   -> 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check --diagnostic-level=warn apps/cli/src/help.ts apps/cli/src/document-examples.test.ts examples/document/paper.ops.json examples/document/deck.ops.json`
   -> exit 0.

## Acceptance criteria

- `rg -n -- "--format markdown --document" apps/cli/src/help.ts docs/cli.md docs/import-export.md`
  matches in all three.
- `rg -n "set-page-flow" docs/cli.md` matches.
- `rg -ni "code snippet|markdown snippet|page frame|slideshow|document" README.md`
  matches for each feature.
- `examples/document/{README.md,paper.ops.json,deck.ops.json}` exist, and
  the test loads them.

## Progress

`impl-plans/progress/dps-17g-docs-examples.md`: sha256 before and after
each file, commands with exit codes and log paths, and the docs
corrections made. No git state changes.
