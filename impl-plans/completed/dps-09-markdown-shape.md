# dps-09-markdown-shape

- planId: dps-09-markdown-shape. Wave 2.
- dependsOn: dps-01-syntax, dps-02-markdown, dps-03-model,
  dps-05-pdf-text-layer.
- Design: sections 4.3, 4.4 and 7.3 (text runs) of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - New files:
    - `packages/core/src/markdown-snippet/layout.ts`
    - `packages/core/src/markdown-snippet/shape.ts`
    - `packages/core/src/markdown-snippet/text-runs.ts`
    - `packages/core/src/markdown-snippet/index.ts`
    - `packages/core/src/markdown-snippet/shape.test.ts`
    - `packages/core/src/markdown-snippet/text-runs.test.ts`
    - `packages/core/src/svg-export/markdown-snippet.ts`
    - `packages/core/src/svg-export/markdown-snippet.test.ts`
  - Logs and artifacts: `impl-plans/progress/dps-09-markdown-shape.md`,
    `tmp/dps-s861/dps-09-markdown-shape`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

This plan adds the core geometry, the SVG rendering and the PDF text runs
for `text.markdown`, built on `parseMarkdown` and `markdownLayout` (dps-02)
and the palettes and tokenizer (dps-01).

`markdown-snippet/index.ts` is created here. dps-17 adds its line to
`packages/core/src/index.ts`, because the canvas view (dps-10) uses the
dps-02 layout directly and does not need these exports.

## Non-goals

- No registration, dispatch or UI.
- No edits to `packages/core/src/index.ts`.

## Contract

```ts
export function markdownSnippetLayout(element: Element): { layout: MdLayout; width: number; height: number; mode: "light"|"dark"; palette: CodePalette; panelFill: string };
export const markdownHighlighter: MdHighlighter; // (c, l) => tokenizeCode(c, resolveSyntaxKind(l) ?? "plain")
export function defaultMarkdownSnippetSemantic(): TextMarkdownSemantic; // { markdown: "" }
export const markdownSnippetShapeUtil: ShapeUtil;                       // type "text.markdown"
export function markdownSnippetTextRuns(element: Element, box: Box): PdfTextRun[];
export function renderMarkdownSnippet(element: Element, box: Box): string;
```

## Rules

- Layout:
  - `width = Math.max(80, visual.width ?? 480)`.
  - Parse and lay out at `width` with `markdownHighlighter`.
  - `height = layout.height`, which is always derived.
  - Cache by element object identity in a module `WeakMap`, so canvas and
    export do not re-parse unchanged elements.
  - Palette from `codePaletteFor(visual.style?.fill)`.
- ShapeUtil: the same pattern as dps-08. Resize changes width only, and
  `defaultVisual` is `{ x:0, y:0, width:480 }`.
- SVG:
  - `<g class="nodetto-markdown">`, with the panel `rect` (radius 6,
    `panelFill`, stroke `visual.style.stroke ?? palette.border`).
  - Boxes are drawn in this order: codePanel, inlineCode, cell and
    headerCell, quoteBar, rule, bullet, task (with a check path when
    `checked`).
  - Box colours:
    - codePanel and inlineCode: `inlineCodeBackground`;
    - headerCell: `tableHeader`;
    - cell: no fill, with a `rule` stroke;
    - quoteBar: `quoteBar`;
    - rule: `rule`;
    - bullet and task: `plain`.
  - Each run is a `<text>` with `font-family` (the theme sans stack, or
    `CODE_FONT_STACK` when `mono`), `font-size`, `font-weight="700"` only
    when bold, `font-style="italic"`, `text-decoration` (`underline`,
    `line-through`, or both space-separated), and
    `fill = palette[role] ?? palette.plain`.
  - A run with `href` is wrapped in `<a href="...">` with the escaped
    attribute.
  - Use the `markup.ts` helpers, and imitate the dps-08 renderer and
    `svg-export/table-sheet.ts`.
- Text runs: one `PdfTextRun` per layout run. The font is `mono` when
  mono, else `sans-bold` when weight 700, else `sans`. Use the run text
  verbatim. Bullets and task boxes are not text. Ordered markers are text
  runs and are included.

## Pitfalls

- Never emit `href` for schemes other than http, https and mailto. The
  layout already filters them; keep it that way.
- Keep the output deterministic. No `Math.random` and no Date.

## Tests (input -> expected)

- `# Title\n\nSome *text*` at width 300: the height equals the layout
  height, `font-weight="700"` is present for the title, and `font-style`
  is italic for "text".
- A fenced block with language `ts` contains the keyword colour tspan or
  text fill of the light palette. With dark fill, it uses the dark colours.
- `[a](https://e.com)` yields `<a href="https://e.com">`.
  `[a](javascript:x)` has no `<a`.
- A table yields headerCell rects. `- [x] t` yields a task rect plus a check
  path.
- Text runs of `**太字** 😀` contain `sans-bold` and `sans` runs whose
  texts join to `太字 😀`, with spaces preserved per layout.
- Rendering is idempotent and the cache returns the same layout object for
  the same element.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-09-markdown-shape/)

1. `bun test packages/core/src/markdown-snippet packages/core/src/svg-export/markdown-snippet.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/markdown-snippet packages/core/src/svg-export/markdown-snippet.ts packages/core/src/svg-export/markdown-snippet.test.ts`

## Done criteria

- The contract exists.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.
