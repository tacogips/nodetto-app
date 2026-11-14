# tll-04-cli-export

- planId: tll-04-cli-export
- planPath: impl-plans/active/tll-04-cli-export.md
- wave: 2
- dependsOn: tll-01-core-lint
- Design: `design-docs/specs/design-text-layout-lint.md`, section "CLI:
  nodetto-cli export", plus "Test plan" (CLI export part).
  `design-docs/specs/export.md` section 5 covers the cross-reference.
- Read `impl-plans/active/tll-00-overview.md` first.

## Intent and context

When an SVG, PNG or PDF export renders a whole `architecture` page,
`nodetto-cli export` prints the text-layout findings for that page on
stderr. Each finding is one `warning: <ruleId> <elementId>: <message>` line,
placed after the document warnings and before the `Wrote ...` line.

Stdout, the written bytes and the exit code do not change. Export has no
`--strict`, and none is added.

## Non-goals

- No warnings for `--element` exports or for HTML, Mermaid, D2, draw.io or
  code exports.
- No new options. No change to rendering, rasterization, scale fitting or
  any existing message text.
- Do not touch `commands.ts` (tll-03), `help.ts` (tll-02),
  `native-parity.test.ts` (tll-05), the fixture builder (tll-01) or
  `export-command.test.ts`. Its assertions must pass unchanged.

## writePaths

- apps/cli/src/export-command.ts
- apps/cli/src/text-layout-export.test.ts (new)
- impl-plans/progress/tll-04-cli-export.md
- tmp/text-layout-lint-s551/tll-04-cli-export

sharedPaths: none.

## File-level changes

### `apps/cli/src/export-command.ts`

1. Add `lintTextLayoutPage` and `TEXT_LAYOUT_LINT_PAGE_KINDS` to the
   existing `@nodetto/core` import.
2. In the svg/png/pdf path, add a `warnings` string after
   `if (svg === null) return fail(\`Page "${page.name}" has no visible content to export.\`);`
   (about :322):
   - `loaded.warnings`, plus
   - when `elementId === undefined && TEXT_LAYOUT_LINT_PAGE_KINDS.includes(page.kind)`,
     the joined lines `warning: ${f.ruleId} ${f.elementId}: ${f.message}\n`
     for `f` of `lintTextLayoutPage(loaded.document, page.id)`.
3. Below that point, replace each `loaded.warnings` with `warnings`:
   - SVG stdout `ok(svg, ...)`;
   - SVG write failure `fail(...)`;
   - SVG `Wrote <file>.`;
   - `Cannot export:`;
   - `Cannot write`;
   - the final `Wrote <target> (page ...)`.

   Leave everything above that point unchanged. That covers drawio,
   mermaid, d2, code, html and the attachment-failure message.

## Pitfalls

- Compute the lint from `loaded.document`, the same parsed document the
  editor renders. Do not re-read the file.
- The order is document warnings, then layout warnings, then `Wrote`.
- An `--element` export must not lint. An element export may still imply a
  page, so check `elementId === undefined`, not `pageQuery`.
- Do not change the return type, exit codes or the `note` scale text.
- Do not make the lint conditional on format inside the raster block. It is
  computed once, for svg, png and pdf alike.

## Tests to add: `apps/cli/src/text-layout-export.test.ts`

- Imitate `apps/cli/src/export-command.test.ts:fixture()`: an in-memory
  `CommandIo` with `readText`, `writeText` and `writeBytes` maps, and a fake
  `RasterBackend` that records the SVG it is given and returns fixed bytes.
- Call `exportCommand(io, args, backend)` directly.
- Use the `./__fixtures__/text-layout.ts` builders and
  `lintTextLayoutPage` / `parseDocument` to build the expected lines.

Cases:

- Problem document, `export doc.jsonl --format svg --page Architecture`:
  - exit 0;
  - stdout equals
    `new Editor({ document: parseDocument(source) })` + `setCurrentPage("page-architecture")` +
    `exportPageSvg({ padding: 16, background: null })`;
  - stderr equals the concatenated expected lines (8 lines, in
    `TEXT_LAYOUT_EXPECTED` order).
- Same with `--output out.svg`:
  - exit 0, stdout `""`;
  - the written text equals the stdout SVG above;
  - stderr is the 8 warning lines followed by `Wrote out.svg.\n`.
- `--format png --output out.png` and `--format pdf --output out.pdf` with
  the fake backend:
  - exit 0;
  - stderr starts with the 8 warning lines and ends with the existing
    `Wrote out.png (page "Architecture", ...).\n` text;
  - the SVG handed to `rasterize` is byte-equal to the SVG the backend
    received for the same document built with kind `freeform`. Use
    `textLayoutProblemDocument("freeform")`.
- Freeform variant, svg -> exit 0, and stderr contains no `warning: label-`
  and no `warning: note-overflow`.
- Problem document, `--element node-clipped --format svg` -> exit 0, and
  stderr has no `warning: label-overflow`.
- Clean document, svg to stdout -> stderr `""`.
- Problem document, `--format mermaid` or `--format d2` -> stderr has no
  text-layout warning lines. Use whichever format the page supports or
  fails on. Assert only the absence of `warning: label-` and
  `warning: note-overflow`.

## Verification (each must exit 0; logs under the scratch root)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/text-layout-export.test.ts apps/cli/src/export-command.test.ts apps/cli/src/html-export.test.ts > tmp/text-layout-lint-s551/tll-04-cli-export/focused.log 2>&1; echo "exit=$?"`.
   Evidence: 0 fail, and the existing export tests are unchanged.
2. `bunx biome check apps/cli/src/export-command.ts apps/cli/src/text-layout-export.test.ts > tmp/text-layout-lint-s551/tll-04-cli-export/biome.log 2>&1; echo "exit=$?"`.
3. Shared-input gate (tll-03 is a same-wave sibling):
   `bunx tsc -p tsconfig.json --noEmit > tmp/text-layout-lint-s551/tll-04-cli-export/tsc.log 2>&1; echo "exit=$?"`.
4. Shared-input gate:
   `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src > tmp/text-layout-lint-s551/tll-04-cli-export/cli-all.log 2>&1; echo "exit=$?"`.
   Evidence: 0 fail.

## Done criteria

- Commands 1-4 meet their evidence, or a gate is recorded as `pending-join`
  with its owner.
- `grep -c "loaded.warnings" apps/cli/src/export-command.ts`:
  - the count drops only by the replaced svg/png/pdf uses;
  - the drawio, mermaid, d2 and code uses remain;
  - record the before and after counts in the progress log.
- The progress log has hashes, the intent snapshot and `STATUS: done` as
  the last line.
