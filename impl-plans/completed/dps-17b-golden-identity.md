# dps-17b-golden-identity

- planId: dps-17b-golden-identity (session 864, wave 1, dependsOn: none)
- Design: `design-docs/specs/design-document-pages-snippets.md` sections
  5.1, 10.2 and 11 ("model", "Markdown layout cache identity").
- Parent: `impl-plans/active/dps-17-wiring.md` Changes 2 and "Tests"
  (`document-snippets-wiring.test.ts`), session 863 addition 4.
- writePaths:
  - `packages/io/src/__fixtures__/document-pages.jsonl` (new)
  - `packages/io/src/jsonl/golden.test.ts`
  - `packages/core/src/document-snippets-wiring.test.ts` (new)
  - `packages/core/src/markdown-snippet/layout.ts` (only if the identity
    test fails)
  - `impl-plans/progress/dps-17b-golden-identity.md`
  - `tmp/dps-s864/dps-17b-golden-identity`
  - `target` (artifact root only)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

The golden coverage test fails because no fixture contains `text.code`
or `text.markdown` (`golden.test.ts:97-98`). The core wiring test and the
store identity test of design section 11 do not exist yet.

`dps-17f-cli-parity` consumes this fixture (path, page count and snippet
texts are a contract).

## Non-goals

- No changes to IR, serializer, parser or shape utils.
- No edit to `layout.ts` unless the identity test fails on the unchanged
  file.

## Changes

1. Fixture `document-pages.jsonl` (self-authored). Contract for dps-17f:
   - Page `p1` (vertical flow; omit `pageFlow` or set `"vertical"`):
     - two page frames (`frame` with
       `semantic.page = { size: "a4", orientation: "portrait" }`), stacked
       vertically with a gap;
     - frame 1 contains a `text.markdown` whose `markdown` is
       `"# Ünïcode **太字** 😀"`;
     - frame 2 contains a `text.code` with `language: "rust"`,
       `showLineNumbers: true` and code `'const label = "日本語"; // 𠮷 é\tend'`
       (a real tab), plus one `shape.geo` (rectangle with a label).
   - Page `p2` with `pageFlow: "horizontal"` and one frame with
     `page.size: "slide-16-9"` (landscape).
   - The resulting document PDF has exactly 3 pages.
   - Produce the bytes with the canonical serializer: build the document
     with `Editor` and the IR APIs in a throwaway script under
     `tmp/dps-s864/dps-17b-golden-identity/`, then write
     `serializeDocument(snapshot)` output. Never hand-type keys. Confirm
     that parse -> serialize is byte-identical before adding the fixture
     to `GOLDEN`. Use fixed ids (`p1`, `p2`, `f1`...) as the other golden
     files do.
   - Frame membership must follow the convention the existing frame
     fixtures use (check `slide-settings.jsonl` and `freeform.jsonl`), so
     the snippets are frame members.
2. `golden.test.ts`: append `"document-pages"` to `GOLDEN` (:20-41).
3. `document-snippets-wiring.test.ts` (Bun, real `Editor`, no mocks).
   Imitate `packages/core/src/document-export/pdf-document.test.ts`.
   - `validateDocument` (from `@nodetto/ir`) on a document holding both
     snippet types -> 0 errors.
   - The page SVG (`editor.exportPageSvgOf(pageId, ...)`) contains
     `nodetto-code` and `nodetto-markdown`.
   - `getText` and `setText` round trip on both snippets (the code and
     markdown fields).
   - Copy, paste and duplicate keep the snippet semantic. Use the
     editor's existing clipboard/duplicate API.
   - `Object.keys(PDF_TEXT_RUN_EXTRACTORS).sort()` equals
     `["text.code", "text.markdown"]`.
   - Store identity:
     - create a `text.markdown`, take `before = editor.store.get(id)` and
       `markdownSnippetLayout(before, ...)`;
     - after `updateSemantic` (longer markdown),
       `editor.store.get(id) !== before`, and the layout height is
       greater;
     - after `updateVisual` changing the fill to a dark colour, the object
       changes again and the layout palette differs from the light one.
     - Use the public editor methods behind commands.ts :638 and :679;
       find the exact facade names by reading the editor facade.

## Pitfalls

- The `\t` must be a real tab in the semantic, written by the serializer
  as `\t`.
- Do not add `document-pages` to any other fixture list (for example the
  native-parity SVG list). dps-17f owns that.
- If the identity test fails, change only the `markdown-snippet/layout.ts`
  cache key to the `(semantic.markdown, width, fill)` tuple (design 11).
  Record the failing output before the change.

## Test cases (input -> expected)

- `golden.test.ts` -> document-pages parses, reserializes byte-identically
  and survives a second parse. Coverage reports nothing missing.
- Wiring test -> each bullet above passes.

## Verification (exit 0; logs in `tmp/dps-s864/dps-17b-golden-identity/`)

1. `bun test packages/io/src/jsonl/golden.test.ts packages/core/src/document-snippets-wiring.test.ts`
   -> 0 fail.
2. `bun test packages/core/src/markdown-snippet` -> 0 fail (the cache is
   unchanged, or changed and still green).
3. `bun run typecheck` -> exit 0.
4. `bunx biome check --diagnostic-level=warn packages/io/src/jsonl/golden.test.ts packages/core/src/document-snippets-wiring.test.ts`
   (add `layout.ts` if it was edited) -> exit 0.

## Acceptance criteria

- `rg -n '"document-pages"' packages/io/src/jsonl/golden.test.ts` matches.
- The fixture contains `"type":"text.code"`, `"type":"text.markdown"`,
  `"pageFlow":"horizontal"` and two `"size":"a4"` frames.
- The progress log states whether `layout.ts` changed, with the identity
  test result.

## Progress

`impl-plans/progress/dps-17b-golden-identity.md`: sha256 before and after
each file, every command with its exit code and log path, and the fixture
generation script path. No git state changes.
