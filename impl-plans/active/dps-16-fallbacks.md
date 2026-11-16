# dps-16-fallbacks

- planId: dps-16-fallbacks. Wave 2.
- dependsOn: dps-03-model.
- Design: section 7.6 of `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - Existing files: `packages/io/src/drawio/export-page.ts`,
    `packages/io/src/d2/export.ts`, `packages/core/src/interface-code.ts`.
  - New tests: `packages/io/src/snippet-fallbacks.test.ts`,
    `packages/core/src/interface-code-snippets.test.ts`.
  - Logs and artifacts: `impl-plans/progress/dps-16-fallbacks.md`,
    `tmp/dps-s861/dps-16-fallbacks`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

Lateral consistency requires defined fallbacks for the new types in
draw.io, D2, Mermaid and HTML exports. Plain text is acceptable. Page
frames export like any frame, and `pageFlow` is ignored.

## Non-goals

- No Mermaid code change. Mermaid already omits types other than
  geo/generic, the same as `text.note`. Only a test pins it.
- No Markdown rendering in HTML. No import support.

## Changes

- draw.io `export-page.ts`: add `case "text.code"` and
  `case "text.markdown"` next to `case "text.note"` (:300). Each emits the
  same text vertex style as `text.note` with
  `textToHtmlLabel(<source>)`. `text.code` also adds the
  `["fontFamily", "Courier New"]` style pair. Check how existing style
  pairs name the font, and use the draw.io key `fontFamily`.
- D2 `export.ts`:
  - `labelOf` returns `code` for `text.code` and `markdown` for
    `text.markdown`, using `stringField`.
  - `shapeKind` returns `"text"` for both, as for `text.note` (:225).
- HTML `interface-code.ts`:
  - `text.code` renders
    `<pre><code class="language-<language>">ESCAPED_CODE</code></pre>`.
    The class value is the stored language, escaped.
  - `text.markdown` renders `<div style="white-space:pre-wrap">ESCAPED</div>`.
  - Read the semantic directly with the existing `escapeText`. Do not rely
    on `Editor.getText`, because dps-17 adds the editable fields.
  - Place the branches next to the `text.note` handling (:425-441).

## Pitfalls

- Escape everything (`<`, `&`, quotes). Code containing `</pre>` must not
  break out.
- Do not change output for any existing type. The existing snapshot and
  golden tests must pass unchanged.

## Tests (input -> expected)

- draw.io: a page with `text.code` `{code:"a<b",language:"rust"}` exports a
  vertex whose value contains the escaped `a&lt;b` (per `textToHtmlLabel`)
  and a style containing `fontFamily`. `text.markdown` exports a text
  vertex.
- D2: both export as `shape: text` nodes with the source as label.
- Mermaid: a flowchart export of a page with only `text.code` contains no
  node for it and does not throw.
- HTML: code `</pre><script>` is escaped and the class is
  `language-rust`. Markdown is escaped inside a pre-wrap div.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-16-fallbacks/)

1. `bun test packages/io/src/snippet-fallbacks.test.ts packages/core/src/interface-code-snippets.test.ts packages/io/src/drawio packages/io/src/d2`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/io/src/drawio/export-page.ts packages/io/src/d2/export.ts packages/core/src/interface-code.ts packages/io/src/snippet-fallbacks.test.ts packages/core/src/interface-code-snippets.test.ts`

## Done criteria

- All four fallbacks behave as in the design.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.
