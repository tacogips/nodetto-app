# sef-07-glyph-export-lint

- planId: sef-07-glyph-export-lint
- planPath: impl-plans/active/sef-07-glyph-export-lint.md
- progressPath: impl-plans/progress/sef-07-glyph-export-lint.md
- wave: 2
- dependsOn: sef-01-edit-visual-merge (timed by the CPU comparison), sef-03-font-coverage-host, sef-04-glyph-attribution
- Design: `design-docs/specs/design-style-export-fixes.md`, sections "Export flow" and "Lint" with "Page eligibility".
- Worker rules and pinned contracts: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/export-command.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/glyph-commands.test.ts` (new)
  - `apps/cli/src/native-parity/glyph.test.ts` (new)
  - `apps/cli/src/__fixtures__/test-font.ts`
  - `impl-plans/progress/sef-07-glyph-export-lint.md`
  - `tmp/sef-s733/sef-07-glyph-export-lint`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

With the coverage host (sef-03) and attribution (sef-04) in place, PNG and PDF export must load fallback fonts when needed and warn about uncovered glyphs,
and `lint` must report `glyph-missing` on any page kind. An ERD-only document can export tofu, and today `lint` rejects it at `apps/cli/src/commands.ts:297`.

## Non-goals

- Do not change the notation filter's page kinds (`commands.ts:291-296`) or give any notation rule a new page kind.
- SVG and other formats do no coverage work and are byte-unchanged.
- Keep the `lintCommand` hunks local: a sibling branch edits this file and may widen the notation filter. `lint-diagram.ts` is not touched.
- `apps/cli/src/__fixtures__/test-font.ts` is edited only if fontdb or resvg refuses the fixture font.

## File-level changes

`apps/cli/src/export-command.ts`, PNG and PDF path, after `snapSvgFrameToPixels` (line 389):

- `const coverage = io.fontCoverage?.(svg, fontDirOption)`.
- Pass `coverage?.needsFallback === true` as the fourth `rasterize` argument.
- When `coverage?.missing` is not empty, call `attributeMissingGlyphs` and append to the warnings: one line per row,
  `warning: glyph-missing <element-id>: <glyphMissingMessage(codePoints)>`, in order, without `collapseWarnings`. If `unattributed` is not empty, add
  `warning: glyph-missing page <page-id>: <glyphMissingMessage(unattributed)>`.
- Elements to attribute: for `--element` on a frame or group, or no `--element`, all elements of the selected page. For `--element` on anything else, only that element.
- `warnings` must be reassignable, or use a second variable. It must reach both the success output and the `Cannot export` failure output, before `Wrote ...`.

`apps/cli/src/commands.ts`, `lintCommand`:

- Add `"--font-dir"` to `LINT_OPTIONS` (line 95).
- After loading the document and before line 297: `const glyphRows = glyphRowsByPage(document, (text) => io.fontCoverage?.(text, fontDir))`.
- Selection (lines 297-307), per the design's table:
  - No `--page`: notation pages plus other pages that have rows, in `document.pages` order. If that is empty, return `LINT_NO_PAGES`.
  - `--page`: the first error is `LINT_NO_PAGES` when the notation page list is empty, and otherwise the `selectPage(document, query, pages, LINT_NO_PAGES)` message. `selectPage` ignores its `noneMessage` argument when a query is present (`apps/cli/src/commands.ts:203-207`), so it cannot produce this on its own.
  - `--page` fallback: when the notation lookup fails or there are no notation pages, resolve the query against `document.pages`. Use that page only if it has rows; otherwise return the first error. So an ERD-only or UML-only document with `--page` and no matching page that has rows still returns `LINT_NO_PAGES`.
- Report assembly (lines 336-367): the notation dispatch runs only when the page is a notation page (a `Set` of ids); others start with `[]`. Then append rows with `severity: "warning"`, `ruleId: "glyph-missing"`, `message: glyphMissingMessage(row.codePoints)`.

## What a careless implementation gets wrong

- The final `else` at line 359 calls `lintTextLayoutPage`. Without the guard it runs on ERD pages and adds unrelated findings.
- Adding a non-notation page with no rows changes the JSON `pages` list for existing documents. Leave it out.
- `io.fontCoverage` absent (test fakes) must give today's exact behavior, including `LINT_NO_PAGES`. Existing assertions at `apps/cli/src/breadboard-commands.test.ts:147,155` and `apps/cli/src/text-layout-lint.test.ts:121` must pass unchanged.
- `hasBpmn` config discovery reads `selectedPages`; a glyph-only page must not trigger it.
- Pass the original option value for `--font-dir`. Both hosts resolve it.
- Do not put `node:` imports in these modules.
- Warnings use the prefix `warning: ` so `--quiet` filters them.
- Warning output order must be deterministic: `compare` asserts Bun and native stderr are equal.

## Tests

`apps/cli/src/glyph-commands.test.ts`, with an in-process fake `io.fontCoverage` and a recording `RasterBackend` (as `apps/cli/src/export-command.test.ts:48` does):

- `needsFallback` true -> `rasterize` receives `true`; false -> `false`; no `fontCoverage` or `undefined` -> `false` and no warning.
- `missing` with an element's code point -> PNG and PDF stderr line with id and code points; SVG -> no coverage call, no line.
- Code point in no element -> `glyph-missing page` line.
- `--element` on one node when another node holds the code point -> only that node is named.
- Two elements -> two uncollapsed lines.
- `--quiet` path through `applyQuiet` -> lines removed.
- Lint, fake coverage with U+F0000 missing:
  - ERD-only with `node.generic` id `widget-label` -> exit 0; text and JSON include `glyph-missing` for `widget-label`.
  - ERD-only with no missing glyphs -> today's `LINT_NO_PAGES` failure.
  - Mixed freeform and ERD -> freeform findings unchanged, ERD row added. An overflowing ERD label gets no `label-overflow`.
  - Mixed with no row on ERD -> ERD absent from JSON `pages`.
  - Mixed document, `--page` naming ERD with a row -> reported. Without a row -> the `selectPage` message, as today when notation pages exist.
  - `--page` naming the freeform page -> only that page.
  - ERD-only with a row, `--page` naming that page -> reported.
  - ERD-only with no rows, `--page` naming that page -> `LINT_NO_PAGES`.
  - UML-only holding rows on its page, `--page missing` -> `LINT_NO_PAGES`.
  - No `.bpmnlintrc` read for a glyph-only ERD selection.

`apps/cli/src/native-parity/glyph.test.ts`, with `nativeTest`, real fonts, and `compare`:

- Label U+F0000: `export --format png` -> equal stderr naming id and `U+F0000`; PDF the same; `lint` and `lint --format json` -> equal, with `glyph-missing`.
- ERD-only with U+F0000 -> `lint` equal, exit 0.
- `buildTestFont([0xF0000])` in a temp dir, `--font-dir` on export and lint -> no warning or finding, equal.
- macOS only: labels with circled numbers 1 to 20 and U+301C, U+FF5E -> no `glyph-missing`; PNGs of U+246A and U+246B differ, per runtime.
- ASCII document -> no warnings and stdout equal.

## CPU comparison

Before running timing, build the baseline without touching the working tree:

1. `git archive 29f8691135fb6098a9496495f4a417e93ce0625e` into `target/sef-baseline/src`.
2. `bun install --frozen-lockfile` there, then `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path target/sef-baseline/src/Cargo.toml --target-dir target/sef-baseline/build`.
3. Copy the binary to `target/sef-baseline/nodetto-cli`. Never delete it.

Write a self-authored document with 300 `node.generic` nodes with CJK labels under `tmp/sef-s733/sef-07-glyph-export-lint/`. Record `/usr/bin/time -p` user time for baseline and new binary, 3 runs each, and report the ratio, for:

- `lint`
- `export --format png`
- `edit` with one batch holding one `where`-based `update` of `visual.style.stroke` across all 300 nodes, with `expect: 300`. Take the `where` form from `apps/cli/src/edit/selectors.test.ts` and the edit help. It must be valid on both binaries. `edit` writes in place, so each timed run uses a fresh copy of the document. This times the `deepMerge` and `replaceVisual` path from sef-01.

A larger cost is reported with numbers. There is no pass or fail threshold for these numbers, and no deadline is relaxed.

## Verification (each must exit 0)

1. `bun test apps/cli/src/glyph-commands.test.ts` -> new cases pass.
2. `bun test apps/cli/src/commands.test.ts apps/cli/src/export-command.test.ts apps/cli/src/export-determinism.test.ts apps/cli/src/text-layout-lint.test.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/bpmn-commands.test.ts apps/cli/src/lint-diagram.test.ts` -> 0 fail.
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/export-command.ts apps/cli/src/commands.ts apps/cli/src/glyph-commands.test.ts apps/cli/src/native-parity/glyph.test.ts`.
5. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/glyph.test.ts apps/cli/src/native-parity/text-layout.test.ts apps/cli/src/native-parity/export.test.ts'` -> 0 fail, 0 skip, with the 3-attempt retry only for deadline timeouts.
6. `test -x target/sef-baseline/nodetto-cli`.

## Done criteria

- Verification 1-6 exit 0 with logs recorded.
- `impl-plans/progress/sef-07-glyph-export-lint.md` has baseline and new-binary user times and ratios for `lint`, `export --format png` and the `edit` update batch.
- `grep -n "glyph-missing" apps/cli/src/export-command.ts apps/cli/src/commands.ts` matches both files.
- `git diff apps/cli/src/commands.ts` leaves the filter at lines 291-296 with the same page kinds.
- Progress log complete.
