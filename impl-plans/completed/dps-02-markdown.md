# dps-02-markdown

- planId: dps-02-markdown. Wave 1. dependsOn: none.
- Design: sections 4.2 and 4.3 of
  `design-docs/specs/design-document-pages-snippets.md`, plus user-qa Q4.
- writePaths:
  - New files:
    - `packages/core/src/markdown/ast.ts`
    - `packages/core/src/markdown/parse.ts`
    - `packages/core/src/markdown/inline.ts`
    - `packages/core/src/markdown/layout.ts`
    - `packages/core/src/markdown/index.ts`
    - `packages/core/src/markdown/parse.test.ts`
    - `packages/core/src/markdown/inline.test.ts`
    - `packages/core/src/markdown/layout.test.ts`
    - `packages/core/src/markdown/boa-safe.test.ts`
  - Logs and artifacts: `impl-plans/progress/dps-02-markdown.md`,
    `tmp/dps-s861/dps-02-markdown`, `target`.
- sharedPaths: `packages/core/src/index.ts`. Append exactly one line:
  `export * from "./markdown/index.ts";`.
- artifactRoots: `target`.

## Intent and context

This plan adds a dependency-free Markdown parser (chilla flavor subset) and
a deterministic layout. Later plans consume both:

- the `text.markdown` shape and its SVG renderer (dps-09);
- the canvas view (dps-10).

Fenced-code highlighting is injected, so this plan does not import the
syntax module.

## Non-goals

- These render as literal text: math, raw HTML, images, footnotes,
  indented code, lazy blockquote continuation, reference links and bare
  URL autolinks.
- No ShapeUtil, SVG emission or colours. The layout emits palette role
  names, not hex values.

## Contract

```ts
export type MdInline =
  | { kind: "text"; text: string } | { kind: "code"; text: string }
  | { kind: "emph" | "strong" | "strike"; children: MdInline[] }
  | { kind: "link"; href: string; children: MdInline[] } | { kind: "break" };
export type MdBlock =
  | { kind: "heading"; level: 1|2|3|4|5|6; inlines: MdInline[] }
  | { kind: "paragraph"; inlines: MdInline[] }
  | { kind: "code"; language: string; text: string }
  | { kind: "quote"; blocks: MdBlock[] }
  | { kind: "list"; ordered: boolean; start: number; items: { task?: boolean; blocks: MdBlock[] }[] }
  | { kind: "table"; align: ("left"|"center"|"right"|null)[]; header: MdInline[][]; rows: MdInline[][][] }
  | { kind: "rule" };
export function parseMarkdown(source: string): MdBlock[];
export interface MdCodeSegment { readonly text: string; readonly kind: string }
export type MdHighlighter = (code: string, language: string) => readonly (readonly MdCodeSegment[])[];
export interface MdRun { x; y; size: number; text: string; weight: 400 | 700; italic: boolean; mono: boolean; strike: boolean; underline: boolean; role: string; href?: string }
export interface MdBox { kind: "codePanel"|"inlineCode"|"quoteBar"|"rule"|"cell"|"headerCell"|"bullet"|"task"; x; y; width; height: number; checked?: boolean; level?: number }
export interface MdLayout { width: number; height: number; boxes: readonly MdBox[]; runs: readonly MdRun[] }
export function markdownLayout(blocks: readonly MdBlock[], width: number, options?: { highlight?: MdHighlighter }): MdLayout;
export const MARKDOWN_PADDING = 16; export const MARKDOWN_MIN_HEIGHT = 32;
```

- `role` is a key of the dps-01 `CodePalette`: `plain`, `comment` (quote
  text), `link`, or a segment kind for fenced code. Use plain strings and do
  not import the syntax module.
- The default highlighter returns one `plain` segment per line.

## Rules

- The parser follows design 4.2 exactly:
  - ATX headings, with optional closing `#`.
  - Setext: `===` gives h1 and `---` gives h2, only directly under a
    paragraph. Otherwise `---` is a rule.
  - Thematic break: 3 or more `*`, `-` or `_`, with spaces allowed.
  - Fences of backticks or tildes, 3 or more. The closing fence uses the
    same character and is at least as long. An unclosed fence runs to the
    end of input. The language is the first word of the info string.
  - Blockquote `>`, nestable.
  - Lists `-`, `*`, `+`, `N.` and `N)`. The start number is honoured.
  - Task items: `[ ]`, `[x]` or `[X]` followed by a space.
  - Nesting when indentation is at least the item's content offset.
  - GFM tables: a header row plus a delimiter row `|:--|:-:|--:|`. Rows run
    until a blank line. `\|` is escaped. Pad short rows and drop extra
    cells.
  - All lists are tight.
- Inline rules:
  - Backslash escapes and code spans (equal backtick run lengths).
  - `**`/`__` strong and `*`/`_` emphasis. An opener is not followed by
    whitespace and a closer is not preceded by whitespace. Intraword `_`
    never opens.
  - `~~` strike.
  - `[text](url "title")`. The title is dropped.
  - `<scheme:...>` autolinks.
  - Hard breaks: two trailing spaces, or a backslash before the newline.
  - A soft break becomes a space.
  - Entities `&amp; &lt; &gt; &quot; &#N; &#xH;`.
  - `![alt](src)` stays literal text.
- Layout metrics (design 4.3):
  - Body text: size 14, line height `Math.round(size * 1.5)`.
  - Headings: sizes 26, 22, 18, 16, 14 and 13, weight 700, line height
    `Math.round(size * 1.3)`.
  - Spacing: padding 16, block gap 10.
  - Lists: indent 22 per level. A bullet box is r 2.5 (level 1 circle, then
    alternating). Ordered markers are a text run `N.`. A task box is 12px.
  - Blockquote: a quoteBar of width 3, indent 14, run role `comment`.
  - Fenced code: a codePanel box with inner padding 8. Mono size 12, line
    height 18. Column wrap uses advance `12 * 0.6` (wide characters count
    as 2).
  - Inline code: mono at `0.9 * size` with an inlineCode box.
  - Rule: 1px, with a 12px margin.
- Measurement:
  `measureTextWidth(text, { fontSize, fontWeight }, "proportional")` from
  `../text-measure.ts`. Italic uses the regular weight.
- Wrapping:
  - Greedy across styled runs at spaces.
  - An over-wide word breaks by grapheme (`graphemes` from
    `../text-layout.ts`).
- Tables:
  - Natural column width is the widest single-line cell plus 16.
  - If the total is over the content width, scale the columns
    proportionally with a minimum of 48.
  - Cells wrap. Header cells are bold `headerCell` boxes.
- Links:
  - `href` is set on the run only for `http:`, `https:` and `mailto:`
    (case-insensitive). The role is `link`, with underline.
  - Other schemes keep the link styling but have no `href`.
- `height = Math.max(MARKDOWN_MIN_HEIGHT, content + 2 * padding)`.

## Pitfalls

- Use the same Boa-safe regex rules as dps-01, enforced by
  `boa-safe.test.ts`.
- Delimiter matching must stay linear. Use a bounded delimiter stack, with
  no regex backtracking over the whole input. A 200 kB input of `*` and `_`
  must finish in under 1 s.
- `noUncheckedIndexedAccess` applies.
- Escape no XML here; that is the renderer's job.

## Tests (input -> expected)

- `# A #`: heading level 1 with text "A".
- `Para\n===`: h1. `Para\n---`: h2. `---` alone: rule.
- A fence of 4 backticks containing 3 backticks keeps the inner backticks
  in `text`. Info string `ts title` gives language `ts`. An unclosed fence
  runs to the end.
- `> a\n> > b`: a nested quote.
- `- [x] done\n  - [ ] sub`: a task item with `task: true` and a nested task
  item with `task: false`.
- `3. a\n4. b`: start 3.
- A table with `| a \| b | c |` and alignment `:-:` gives center and a cell
  text containing `|`.
- `**b** *i* ~~s~~ `code``: strong, emph, strike and code nodes.
- `snake_case_name` has no emphasis.
- `[x](javascript:alert(1))` lays out with no `href`.
  `[x](https://e.com)` has the `href`.
- `![a](b.png)`, `$x$`, `<b>hi</b>` and `[^1]` all come out as literal
  text.
- Layout at width 200 wraps a long paragraph into at least 2 lines. The
  height grows with the line count and is always at least 32.
- An injected highlighter's kinds appear as run roles inside a codePanel.
- A 200 kB pathological emphasis input completes in under 1 s.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-02-markdown/)

1. `bun test packages/core/src/markdown`
2. `bun run typecheck`. Sibling-only failures during the wave are recorded
   and re-run after the sibling lands.
3. `bunx biome check --diagnostic-level=warn packages/core/src/markdown`

## Done criteria

- The contract names are exported from `@nodetto/core`.
- All three commands exit 0.
- The progress log records the commands, exit codes, log paths and the
  index.ts hashes.

## Coordination

Same rules as dps-01. Re-read `packages/core/src/index.ts` before
appending, record its hashes, never revert sibling lines, and make no git
state changes.
