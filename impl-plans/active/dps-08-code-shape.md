# dps-08-code-shape

- planId: dps-08-code-shape. Wave 2.
- dependsOn: dps-01-syntax, dps-03-model, dps-05-pdf-text-layer.
- Design: sections 3.2 to 3.4 and 7.3 (text runs) of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - New files:
    - `packages/core/src/code-snippet/shape.ts`
    - `packages/core/src/code-snippet/text-runs.ts`
    - `packages/core/src/code-snippet/shape.test.ts`
    - `packages/core/src/code-snippet/text-runs.test.ts`
    - `packages/core/src/svg-export/code-snippet.ts`
    - `packages/core/src/svg-export/code-snippet.test.ts`
  - Logs and artifacts: `impl-plans/progress/dps-08-code-shape.md`,
    `tmp/dps-s861/dps-08-code-shape`, `target`.
- sharedPaths: none. `code-snippet/index.ts` belongs to dps-01 and is not
  edited. dps-17 imports the new files relatively.
- artifactRoots: `target`.

## Intent and context

This plan adds the core geometry, the SVG rendering and the PDF text runs
for `text.code` elements, built on `codeSnippetLayout` (dps-01). dps-17
registers the util in `shapes/index.ts`, dispatches `renderShape` and fills
`PDF_TEXT_RUN_EXTRACTORS`.

## Non-goals

- No edits to `shapes/index.ts`, `svg-export/shapes.ts`, `tools.ts`, IR
  registration or UI.

## Contract

```ts
export function codeSnippetInput(element: Element): CodeLayoutInput; // semantic + visual.width, visual.style.fontSize, visual.style.fill
export function defaultCodeSnippetSemantic(): TextCodeSemantic;       // { code: "", language: "plain" }
export const codeSnippetShapeUtil: ShapeUtil;                         // type "text.code"
export function codeSnippetTextRuns(element: Element, box: Box): PdfTextRun[];
export function renderCodeSnippet(element: Element, box: Box): string;
```

## Rules

- ShapeUtil (imitate `packages/core/src/table-sheet/shape.ts:28-60`):
  - `canResize: true`.
  - `getBounds` gives `{ x, y, width: layout.width, height: layout.height }`.
  - `hitTest` uses box containment.
  - `resize(element, box)` returns `{ visual: { x: box.x, y: box.y, width: Math.max(80, box.width) } }`
    and never sets height.
  - `defaultVisual()` gives `{ x: 0, y: 0, width: 480 }`.
  - Read the semantic defensively: a non-string `code` becomes `""` and a
    missing `language` becomes `"plain"`.
- SVG (imitate `packages/core/src/svg-export/table-sheet.ts`, and use
  `markup.ts` `tag`, `text`, `wrap` and `fmt` for escaping and number
  format):
  - `<g class="nodetto-code">`.
  - The panel is a `rect` with radius 6. Fill is `layout.panelFill`. Stroke
    is `visual.style.stroke ?? palette.border`, width 1. `opacity` from
    `visual.style.opacity` goes on the `g`.
  - A `clipPath` with a deterministic id derived from the element id
    (follow the table-sheet clip id scheme) clips the text area.
  - One `<text xml:space="preserve" font-family=CODE_FONT_STACK font-size=...>`
    per visual line, with one `<tspan x=.. fill=palette[kind]>` per run,
    and `font-style="italic"` for `comment`. Positions are `box` plus the
    layout offsets.
  - Line numbers go in a separate `<text text-anchor="end" fill=palette.lineNumber>`
    at `x = box.x + gutterWidth - 8`, with a 1px `border` line at the
    gutter edge.
- Text runs: one run per visual line, made by concatenating the runs'
  `source` in order. The font is `mono`, the size is `fontSize`,
  `x = box.x + firstRun.x` and `y = box.y + line.y`. Skip empty lines. Line
  numbers are never runs.

## Pitfalls

- SVG text must keep spaces and tabs. Use the layout's display `text`
  (tabs expanded) inside tspans, and `source` only for the PDF runs.
- Output must not depend on time, locale or the DOM, because app and CLI
  bytes must be equal.
- Do not hard-code light colours. Every colour comes from
  `codePaletteFor`, or from a style override.

## Tests (input -> expected)

- Bounds for code `"a\nb"` at width 300 give width 300 and height
  `2*12 + 2*20`. Resize to width 50 gives 80, and height is unchanged.
- Rust code `fn main() {}` renders a `<tspan` with the keyword colour of
  the light palette. With `fill:"#1f2427"` it uses the dark keyword colour
  and the dark panel fill.
- A comment run has `font-style="italic"`. `<` and `&` in code are escaped.
- `showLineNumbers` adds the line-number `<text` with the numbers 1..n.
- The same element rendered twice gives an identical string.
- Text runs for `"x\ty"` produce one run with text `"x\ty"` and font
  `mono`.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-08-code-shape/)

1. `bun test packages/core/src/code-snippet packages/core/src/svg-export/code-snippet.test.ts`
2. `bun run typecheck`, with the sibling-tolerance rule of dps-01.
3. `bunx biome check --diagnostic-level=warn packages/core/src/code-snippet packages/core/src/svg-export/code-snippet.ts packages/core/src/svg-export/code-snippet.test.ts`

## Done criteria

- The contract functions exist.
- All three commands exit 0.
- The progress log records the commands, exit codes and log paths.

## Coordination

Edit only your writePaths. Re-read before each edit and record hashes. No
git state changes.

## Implementation status

The shape, renderer, PDF runs, and focused tests are implemented. Focused
Bun tests, Biome, and the required workspace typecheck pass on the moving
shared tree; see `impl-plans/progress/dps-08-code-shape.md` for evidence.
Formal review and registration remain downstream.
