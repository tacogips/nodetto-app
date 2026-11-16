# Document authoring: code and Markdown snippets, page frames, document export

Status: design for implementation (session 861). Scope: the public
`nodetto-app` repository only (`packages/ir`, `packages/io`,
`packages/collab`, `packages/core`, `packages/ui-solid`, `apps/desktop`,
`apps/cli`, `docs/`, `README.md`, `examples/`). No server, auth or deployment
code.

Owner decisions (a) to (f) from the workflow input are final. Questions
those decisions leave open are recorded with defaults in
`design-docs/user-qa/document-pages-snippets.md`. This design implements
each default.

Baselines that still hold unless this document changes them:
`design-presentation.md`, `design-slide-area-copy-shapes.md`,
`design-slide-link-animation.md`, `export.md`, `design-table-sheet.md` (the
precedent for adding an element type), `design-shape-lateral-consistency.md`
and `design-appearance.md`.

## 0. Goals and non-goals

Goals:

1. `text.code`: a code snippet element. It uses a pure-TS tokenizer ported
   from chilla (28 `SyntaxKind` values and their aliases) and light and dark
   token palettes.
2. `text.markdown`: a Markdown snippet element. It has a pure-TS parser and
   layout for the chilla flavor subset.
3. Page frames: an existing `frame` with an optional `FrameSemantic.page`.
   Each nodetto page has a flow direction, `Page.pageFlow`, edited through
   `updatePage`. The feature includes "Add page", re-layout as one undo
   step, and next/previous page-frame navigation.
4. The slideshow shows one slide per page frame.
5. Document export: a multi-page PDF and a Markdown document. Both are
   available in the desktop app, the web build and `nodetto-cli export`.

Non-goals:

- A syntect, Rust or WASM highlighter, or any new runtime npm dependency.
- These Markdown features render as literal text: math, raw HTML, images,
  footnotes, indented code blocks, lazy blockquote continuation, reference
  links and bare-URL autolinks (user-qa Q4).
- Vector PDF. PDF stays the existing raster pipeline (section 7.3), with an
  invisible text layer added for the snippet text.
- Changing the page size by dragging. Page frames still resize like any
  frame (section 5.1).
- A new core `Command` kind, a schema-version bump, version bumps or
  release work.

## 1. Baseline (checked at 774cc63)

- Element types: an `ElementTypeDefinition` goes in
  `packages/ir/src/registry/<family>.ts` and is aggregated in `DEFINITIONS`
  (`packages/ir/src/registry.ts:77-126`). Payloads go into `SemanticByType`
  (`packages/ir/src/semantics.ts:102-174`). The core `ShapeUtil` is
  registered in `packages/core/src/shapes/index.ts`. SVG dispatch is
  `renderShape` (`packages/core/src/svg-export/shapes.ts`, with `table.sheet`
  at :302). The canvas dispatches in `packages/ui-solid/src/shapes/ShapeView.tsx`
  and the inspector in `packages/ui-solid/src/Inspector.tsx` (:213, :296).
  Tools are in `packages/core/src/tools.ts` and the catalogue in
  `packages/core/src/shape-catalogue.ts`. The palette is
  `packages/ui-solid/src/shape-palette.ts`.
- The only text element is `text.note`. Deterministic text measurement
  lives in `packages/core/src/text-layout.ts` and
  `packages/core/src/text-measure.ts`:
  - `measureTextWidth(text, style, "proportional")` uses the
    font-independent Liberation Sans advance table.
  - `isWideCodePoint` comes from `wide-text-width.ts`.
  - It is pure TS, so canvas, Bun and the Boa native CLI compute the same
    geometry.
- `Editor.getText`/`setText` read and write the field returned by
  `editableFieldOf` (`packages/core/src/editor/facade/element-editing.ts:126`).
- `updatePage` patch (`packages/core/src/commands.ts:118-131`) already
  carries `hiddenInPresentation` and `slideOrigin` with `null` = remove.
  The page JSONL keys are `PAGE_RECORD_KEYS`/`PAGE_RECORD_ORDER`
  (`packages/io/src/jsonl/records.ts:33-66`), read in `parse.ts:231-236`.
  Collab writes page fields in `packages/collab/src/ydoc.ts:97-102` and reads
  them at :242-251. `planDuplicatePage` (`packages/core/src/editor/pages.ts:161-164`)
  copies page fields.
- Presentation: `slideList(pages): PageId[]`
  (`packages/core/src/presentation/slides.ts`). `PresentationState.slides`
  is `PageId[]` (`navigation.ts`). `renderSlide(editor, page)`
  (`packages/ui-solid/src/presentation/slide-render.ts`) clips by
  `exportPageSvgOf(page, { viewport })` when a document `slideSize` is set.
  `createPresentationController` (`controller.ts`) caches by page and
  revision.
- Export: `packages/core/src/svg-export/` (`renderPageSvg`,
  `renderSelectionSvg`, `renderArtboardSvg`; option `viewport` clips with
  `overflow="hidden"`). **PDF is raster today**:
  - app: `packages/ui-solid/src/pdf-export.ts` `pngToPdf` with pdf-lib.
  - Bun CLI: `apps/cli/src/raster-backend.ts` (resvg-js and pdf-lib).
  - native CLI: `apps/cli/native/src/render.rs` `pdf()` with pdf-writer,
    hard-coded to one page (:192), bridged by
    `apps/cli/src/native-engine.ts`.

  Each is one page holding one image. `pdfLayout`/`PDF_PAGE_SIZES` are in
  `packages/core/src/export-geometry.ts`. `export.md` describes a vector
  `svgToPdf`, but it was never implemented.
- CLI export (`apps/cli/src/export-command.ts`) uses `--output` (there is no
  `--out` flag), `--page`, `--element` and `--pdf-page`, and goes through
  the `RasterBackend` seam (:101-114). The desktop/web `ExportDialog`
  (`packages/ui-solid/src/ExportDialog.tsx`) and
  `apps/desktop/src/shell/export-handlers.ts` (`saveArtwork`, `saveZip`)
  save results. The stored ZIP writer `encodeStoredZip` already exists in
  `packages/core/src/zip.ts`. There is no separate web app: "web" means the
  desktop shell in a browser, which downloads files.
- Fallback exporters:
  - draw.io (`packages/io/src/drawio/export-page.ts`): a `text.note` vertex,
    `default:` labelled rect.
  - D2 (`packages/io/src/d2/export.ts`): `labelOf`/`shapeKind`, and
    `text.note` becomes the `text` shape.
  - Mermaid: drops types other than geo/generic nodes, `text.note` included.
  - HTML (`packages/core/src/interface-code.ts`): a generic `div` with
    `elementText` (`Editor.getText`).
- Appearance invariant (`design-appearance.md` section 2): document element
  paint is the same in every app or canvas theme, and exports take no
  appearance input. The canvas dark token values (`--nodetto-ink #e6e9ea`,
  `--nodetto-surface #1f2427`, and so on) are tabled in
  `design-appearance.md` section 4.1.

## 2. Syntax tokenizer (`packages/core/src/syntax/`)

A port of chilla `src/features/pr-diff/prDiffSyntax.ts`,
`prDiffSyntaxTypes.ts`, `prDiffSyntaxLanguages.ts` and
`prDiffSyntaxKeywords.ts`. Every file starts with a credit header:
`Ported from tacogips/chilla (MIT, same owner), src/features/pr-diff/<file>`.

| File | Exports |
| --- | --- |
| `types.ts` | `SYNTAX_KINDS` (exactly chilla's 28 `SyntaxKind` values, `plain` first), `SyntaxKind`, `SEGMENT_KINDS = plain, keyword, string, comment, number, punctuation, markup`, `SegmentKind`, `SyntaxSegment { text; kind }` |
| `languages.ts` | `SYNTAX_KIND_LABELS` (picker labels), chilla's alias table (extensions, file names and names), `resolveSyntaxKind(token): SyntaxKind \| null` (case-insensitive; accepts a canonical id, an alias, an extension with or without the dot, or a file name) |
| `keywords.ts` | per-kind keyword sets (ported) |
| `tokenize.ts` | `tokenizeCode(code, kind): SyntaxSegment[][]`, one segment array per source line (`\r\n` and `\r` normalised to line breaks for tokenizing only). It carries multi-line state (block comments, multi-line strings) across lines. Adjacent segments of the same kind are merged. Concatenating a line's segment texts returns that source line exactly. |
| `palette.ts` | `CODE_PALETTES.light` / `.dark` and `codePaletteFor(fill)` (section 2.1) |
| `index.ts` | `export *` |

Port rules:

- Behavior parity with chilla. A test runs a self-authored fixture snippet
  per kind and asserts the segment kinds at chosen offsets. A further test
  asserts that every alias resolves to a kind in `SYNTAX_KINDS` and that
  `SYNTAX_KINDS.length === 28`.
- Boa compatibility. The source must not use regex lookbehind, Unicode
  property escapes (`\p{..}`), named groups, the `d`/`v` flags or
  `String.prototype.replaceAll` with a regex. A test scans the module
  source and enforces this. The native parity test (section 10) runs it in
  Boa.
- Bounded work: the tokenizer is linear in input length. A pathological
  10,000-line input finishes within the existing CLI deadlines.

### 2.1 Palettes

The palettes are TS constants in core, not CSS variables. No CSS token is
added. Each palette has these fields:

- `background`, `border`, `gutter` and `lineNumber`;
- the seven segment colours `plain`, `keyword`, `string`, `comment`,
  `number`, `punctuation` and `markup`;
- `inlineCodeBackground`, `link`, `quoteBar`, `tableHeader` and `rule`,
  used by Markdown.

- `light` is anchored to the light canvas tokens: `background` = surface
  `#fffdf8`, `plain` = ink `#1d2a2e`, `comment`/`lineNumber` = muted
  `#596366`, `keyword`/`link` = accent `#335c67`, `border`/`rule` = line
  `#d8d2c3`, `tableHeader`/`inlineCodeBackground` = accent-soft `#dbe6e8`.
- `dark` is anchored to the dark values of the same tokens: surface
  `#1f2427`, ink `#e6e9ea`, muted `#a3adb1`, accent `#7fb3bf`, line
  `#3a4245`, accent-soft `#24393e`.
- `string`, `number`, `punctuation` and `markup` have no existing token.
  They are palette-local constants, one per palette. A test requires every
  foreground to reach at least 4.5:1 against its own `background` (the
  same contrast test style as `design-appearance.md` section 6).
- Palette choice follows the element's own panel fill, never the app or
  canvas theme (appearance invariant 1):
  - `codePaletteFor(fill)` returns `dark` when the WCAG relative luminance
    of the effective panel fill is below 0.18, and `light` otherwise.
  - The effective panel fill is `visual.style.fill ?? CODE_PALETTES.light.background`.
  - So an element paints identically and legibly on the light and the dark
    canvas, and exports are byte-identical between app and CLI.
  - The inspector "Snippet theme: Light / Dark" control (section 3.5) writes
    `visual.style.fill` to the light or dark `background` (user-qa Q1).

## 3. Code snippet element `text.code`

### 3.1 Semantic, key order, validation

New files `packages/ir/src/semantics/document.ts` (types and limits) and
`packages/ir/src/registry/document.ts` (definitions).

```ts
export interface TextCodeSemantic {
  readonly code: string;             // may be ""
  readonly language: string;         // canonical SyntaxKind id; "plain" by default
  readonly showLineNumbers?: boolean; // written only as true
  readonly wrap?: boolean;            // written only as true
}
```

- `keyOrder: { keys: ["code", "language", "showLineNumbers", "wrap"] }`,
  category `node` (connectors may attach, as with `table.sheet`),
  `onReferenceDeleted: "detach"`, `references: noReferences`.
- Validation uses the existing `check*` helpers and codes:
  - `code` is a string with at most 200,000 UTF-16 units. Over the limit is
    `text.limit`, an error.
  - `language` is a string matching `^[a-z0-9][a-z0-9_+#.-]{0,31}$`. A
    mismatch is a `type.*` error.
  - Booleans are checked with `checkBoolean`. Unknown keys raise
    `semantic.unknownField`.
- IR does not hold the kind list. A `language` that is well formed but
  unknown to the core tokenizer is preserved and renders as `plain`, which
  keeps forward compatibility. Input surfaces (the CLI, the facade and the
  inspector picker) normalise names and aliases through
  `resolveSyntaxKind` and reject unknown names. JSONL therefore always
  carries canonical ids from those surfaces.

### 3.2 Layout (`packages/core/src/code-snippet/layout.ts`)

`codeSnippetLayout(element)` is pure. Both the canvas and the SVG exporter
read only this layout. This single source is the parity guarantee.

- Font: the monospace stack already used by svg-export for code text,
  re-exported as `CODE_FONT_STACK`. `fontSize = visual.style.fontSize ?? 13`,
  `lineHeight = round(fontSize * 1.5)`, `advance = fontSize * 0.6`.
- A column is one grapheme. Wide code points (`isWideCodePoint`) take 2
  columns. A tab expands to the next multiple of 4 columns. The stored text
  is never changed; expansion applies to display only.
- `padding = 12`. With `showLineNumbers`, the gutter width is
  `(digits(lineCount) + 1) * advance + 8`. Numbers are right-aligned at
  `gutter - 8`, and a 1 px `border` rule is drawn at the gutter edge.
- `contentWidth = width - 2 * padding - gutter`, where
  `width = max(80, visual.width ?? 480)`.
  - With `wrap`, each source line breaks into visual lines of
    `floor(contentWidth / advance)` columns (at least 1). Segments are split
    at the break, with no word preference. Continuation lines get no line
    number.
  - Without `wrap`, lines are clipped by a clip path.
- Height hugs the content and is always derived:
  `2 * padding + max(1, visualLineCount) * lineHeight`. Stored
  `visual.height` is ignored and never written, the same as `table.sheet`
  and `erd.table`.
- The output is a list of visual lines. Each line has `y` (baseline),
  `number?` and runs `{ x, text, kind, columns }`, where `x` is
  `padding + gutter + column * advance`. The layout also carries the
  panel box, the gutter, the chosen palette and the clip box.

### 3.3 ShapeUtil (`packages/core/src/code-snippet/shape.ts`)

- `canResize: true`. `resize(element, box)` returns `{ x, y, width }` only.
  `getBounds` uses the derived height.
- `defaultSemantic()` returns `{ code: "", language: "plain" }`.
  `defaultVisual()` returns `{ x: 0, y: 0, width: 480 }`.
- Edge-midpoint ports are the default. `editableFieldOf` maps `text.code`
  to `code`, so `getText`, `setText` and the HTML/D2 fallbacks work.

### 3.4 Rendering

- SVG (`packages/core/src/svg-export/code-snippet.ts`,
  `renderCodeSnippet(element, box)`):
  - `<g class="nodetto-code">` holds the panel `rect` (fill = effective
    panel fill; stroke = `visual.style.stroke ?? palette.border`; radius 6)
    and a `clipPath`.
  - It emits one `<text xml:space="preserve" font-family=CODE_FONT_STACK>`
    per visual line, with one `<tspan fill=...>` per run. Comment runs get
    `font-style="italic"`. Text is escaped with the existing svg-export
    escaper.
  - Line numbers go in a separate `<text text-anchor="end">` with
    `palette.lineNumber`. `opacity` is honored.
- Canvas: `packages/ui-solid/src/shapes/CodeSnippetView.tsx`. It renders an
  inline `<svg>` built from the same layout, with Solid elements mirroring
  the export markup. Paint values are inline from the palette, with no CSS
  colour tokens.
- Glyph-exact equality between canvas and export is not a goal. Geometry
  and colours must match.

### 3.5 Editing and inspector

- Double-click opens `packages/ui-solid/src/snippet/SnippetTextEditor.tsx`,
  a plain `<textarea>` overlay over the panel. It uses the same font, size
  and padding, with `spellcheck=false` and `wrap=off` (or `soft` when
  `wrap`).
  - Tab inserts `\t`, and Shift+Tab is left to the browser.
  - Escape cancels. Blur or Mod+Enter commits one `updateSemantic` through
    `setText`, which is one undo entry. No commit happens when the text is
    unchanged.
  - Canvas key handling already skips editable targets.
  - The same component edits `text.markdown` (field `markdown`).
- Inspector `packages/ui-solid/src/inspector/CodeSnippetSection.tsx`:
  - a language `<select>` over `SYNTAX_KINDS` with `SYNTAX_KIND_LABELS`;
  - "Line numbers" and "Wrap lines" switches (`true` or remove the key);
  - "Snippet theme: Light / Dark", which writes `visual.style.fill`.

  Each change is one `editor.apply`.
- Copy/paste and duplicate use the generic element paths
  (`packages/core/src/clipboard.ts`, `editor/paste.ts`). The semantic is
  copied verbatim. Tests pin both.

## 4. Markdown snippet element `text.markdown`

### 4.1 Semantic and validation

`TextMarkdownSemantic { readonly markdown: string }`, with
`keyOrder: { keys: ["markdown"] }` and category `node`. The text is at most
200,000 UTF-16 units (`text.limit`). Defaults are `{ markdown: "" }`,
visual `{ x: 0, y: 0, width: 480 }`. `editableFieldOf` maps it to
`markdown`.

### 4.2 Parser (`packages/core/src/markdown/parse.ts`, `inline.ts`, `ast.ts`)

A pure, dependency-free parser. It is linear in input length (with bounded
delimiter matching) and Boa-safe under the same regex rules as section 2.

- Blocks:
  - ATX headings (`#` to `######` followed by a space or the end of line,
    with optional closing `#`s);
  - setext headings (`===` gives h1 and `---` gives h2 under a paragraph);
  - thematic breaks (three or more `*`, `-` or `_`, spaces allowed);
  - fenced code (three or more backticks or tildes, closed by the same
    character with at least the opening length, unclosed runs to the end;
    the info string's first word is the language);
  - blockquotes (`>`, nestable);
  - bullet lists (`-`, `*`, `+`), ordered lists (`N.` or `N)`, start number
    honored) and task items (`[ ]`, `[x]` or `[X]` after the marker);
  - nesting by indentation of at least the content offset;
  - GFM tables (header row plus a delimiter row with `:` alignment; rows
    run until a blank line; `\|` escapes; missing cells are blank and extra
    cells are dropped);
  - paragraphs.
- Inline:
  - backslash escapes and code spans;
  - `*`/`_` emphasis and `**`/`__` strong (simplified flanking rules:
    an opener is not followed by whitespace and a closer is not preceded
    by it; intraword `_` does not open);
  - `~~` strikethrough;
  - links `[text](url "title")` and autolinks `<scheme:...>`;
  - hard breaks (two trailing spaces or a backslash) and soft breaks
    (rendered as a space);
  - entities `&amp; &lt; &gt; &quot; &#N; &#xH;`.
- Literal text (the non-goals in section 0): `![alt](src)` stays literal,
  as do raw HTML, `$math$`, footnotes, indented code blocks and reference
  links.
- AST: `MdBlock` is one of `heading{level, inlines}`, `paragraph{inlines}`,
  `code{language, text}`, `quote{blocks}`,
  `list{ordered, start, items[{task?: boolean, blocks}]}`,
  `table{align[], header[], rows[][]}` or `rule`. `MdInline` is one of
  `text`, `code`, `emph`, `strong`, `strike`, `link{href, children}` or
  `break`.

### 4.3 Layout (`packages/core/src/markdown/layout.ts`)

`markdownLayout(ast, width, options)` is pure. Fenced-code highlighting is
injected as `options.highlight: (code, language) => SyntaxSegment[][]`, so
the layout module does not import the tokenizer. The shape passes
`(c, l) => tokenizeCode(c, resolveSyntaxKind(l) ?? "plain")`.

- Metrics:
  - Text: base font 14 (the sans stack), line height `round(size * 1.5)`.
    Headings h1 to h6 are 26/22/18/16/14/13, bold, with line height
    `round(size * 1.3)`.
  - Spacing: padding 16, block gap 10.
  - Lists: indent 22 per level. Bullets are drawn as circles or squares
    (r 2.5) and ordered markers as text `N.`. Task boxes are 12 px rects
    with a check path, with no glyph dependency.
  - Blockquote: a 3 px `quoteBar` rect, indent 14, `comment` colour.
  - Fenced code: a `background`-tinted panel (`inlineCodeBackground`) with
    padding 8, the mono font at 12, wrapped by columns as in section 3.2,
    and token colours.
  - Inline code: mono at `0.9 * size` with an `inlineCodeBackground` rect.
  - Rule: a 1 px `rule` line with 12 px margins.
- Measurement: `measureTextWidth(text, { fontSize, fontWeight }, "proportional")`.
  Italic uses the regular advances. Mono uses the section 3.2 column
  advance.
- Wrapping: greedy across styled runs at spaces. Words wider than a line
  break by grapheme.
- Tables:
  - Natural column width is the widest single-line cell plus 16.
  - When the sum exceeds the content width, columns scale proportionally,
    with a minimum of 48.
  - Cells wrap, the header is bold on `tableHeader`, and 1 px `rule`
    gridlines are drawn.
- Links use `link` colour and an underline.
  - Only `http:`, `https:` and `mailto:` hrefs become export anchors.
  - Other hrefs render as styled text without an anchor.
- Output: `{ height, boxes[], runs[] }`.
  - Box kinds are `codePanel`, `inlineCode`, `quoteBar`, `rule`, `cell`,
    `headerCell`, `bullet` and `task`.
  - A run is `{ x, y (baseline), text, size, weight, italic, mono, strike,
    underline, role, href? }`, where `role` is a palette key.
- The element height hugs `max(minHeight 32, layout.height)` and is always
  derived, as in section 3.2. `width = max(80, visual.width ?? 480)`.

### 4.4 Rendering and editing

- SVG (`packages/core/src/svg-export/markdown-snippet.ts`):
  - a panel `rect`, then the boxes, then one `<text>` per run, with
    `font-weight`, `font-style` and
    `text-decoration="underline|line-through"`;
  - an anchor run is wrapped in `<a href>` with the escaped URL;
  - colours from `codePaletteFor(effective fill)`.
- Canvas: `packages/ui-solid/src/shapes/MarkdownSnippetView.tsx` renders
  inline SVG from the same layout.
  - The shape parses once per semantic revision (memoised by the element
    object).
  - Links are not clickable on the canvas, where double-click edits.
- Editing uses `SnippetTextEditor` (section 3.5).
- Inspector `MarkdownSnippetSection.tsx` has only the snippet theme control.
- Copy/paste and duplicate behave as in section 3.5.

## 5. Page frames

### 5.1 Data model

`FrameSemantic` (`packages/ir/src/semantics/design.ts`) gets:

```ts
readonly page?: {
  readonly size: "a4" | "a5" | "letter" | "legal" | "slide-16-9" | "slide-4-3" | "custom";
  readonly orientation: "portrait" | "landscape";
};
```

- `FRAME` keyOrder (`packages/ir/src/registry/containers.ts`) appends
  `"page"`, with children `page: { keys: ["size", "orientation"] }`.
- Validation: `page` must be an object (`type.object`). `size` and
  `orientation` are required and checked with `checkEnum` (`field.missing`,
  `type.enum`). Unknown inner keys raise `semantic.unknownField`.
- A page frame is a `frame` with `semantic.page` defined and no frame
  parent. Frame membership is the existing derived contract:
  `frameParents(store, page, context)` in `packages/core/src/frame-tree.ts`
  (explicit `memberIds`, else geometric containment). The IR has no
  `parent` field. Frames carrying `page` that have a frame parent are
  preserved, but layout, the slideshow and export ignore them.
- The frame's `visual` box is the page size used by layout, the slideshow
  and export. `page.size` and `page.orientation` record intent. The
  inspector shows "Custom" when the box no longer matches the preset.
  Resizing a page frame is not blocked, and no side effects are added to
  the shared resize path.

Presets (`packages/core/src/page-frames/presets.ts`, at 96 dpi CSS px,
given as portrait width x height; landscape swaps them):

| id | label | portrait | default orientation |
| --- | --- | --- | --- |
| `a4` | A4 | 794 x 1123 | portrait |
| `a5` | A5 | 559 x 794 | portrait |
| `letter` | Letter | 816 x 1056 | portrait |
| `legal` | Legal | 816 x 1344 | portrait |
| `slide-16-9` | Slide 16:9 | 1080 x 1920 | landscape (1920 x 1080, equal to `SLIDE_SIZE_PRESETS` 16:9) |
| `slide-4-3` | Slide 4:3 | 768 x 1024 | landscape (1024 x 768) |

`pageFrameSize(size, orientation, current?)` returns the box size. `custom`
keeps `current`.

`Page` (`packages/ir/src/types.ts`) gets
`readonly pageFlow?: "vertical" | "horizontal"`. Absent means vertical.

- Validation: `checkEnum` at `pages[i].pageFlow`.
- JSONL: `PAGE_RECORD_KEYS` appends `"pageFlow"` after `"slideOrigin"`, and
  `parse.ts` copies it when present.
- Collab: `pageFields` and `pageFromY` accept only the two strings.
  `planDuplicatePage` copies the field.
- No migration and no version bump. Older readers keep the key in
  `extensions`.

### 5.2 Command (no new kind)

- The `updatePage` patch gets `pageFlow?: "vertical" | "horizontal" | null`.
  `null` removes the key.
- An invalid value fails with `CommandError` code `type.enum`, path
  `page.pageFlow`.
- The inverse follows the `hiddenInPresentation` pattern. The private sync
  Worker needs no change.

### 5.3 Core geometry and editing (`packages/core/src/page-frames/`)

| File | Exports |
| --- | --- |
| `presets.ts` | `PAGE_FRAME_PRESETS`, `pageFrameSize`, `pageFramePresetOf(box, page)` (preset id or `custom`, for display) |
| `order.ts` | `isPageFrame(element)`, `pageFramesInFlowOrder(store, pageId)`. Vertical sorts by `(y, x, id)` and horizontal by `(x, y, id)`, using `visual.x/y`. `pageFlowOf(page)`. |
| `plan.ts` | `PAGE_FRAME_GAP = 48`, `planAddPageFrame(...)`, `planReflowPageFrames(...)`. These are pure and return `Command[]`. |
| `navigation.ts` | `neighbourPageFrame(store, pageId, from, direction)` |
| `editing.ts` | `addPageFrame(editor, options)`, `setPageFlow(editor, pageId, flow)`, `goToPageFrame(editor, direction, viewport)` |

"Add page" (`addPageFrame(editor, { size?, orientation?, after? })`) returns
the new id, or `null` in a read-only document.

- Anchor: `after`, else the selected page frame (or the top-level page frame
  that contains the single selected element), else the last page frame in
  flow order.
- Size and orientation come from the options, else the anchor's
  `page` and box, else A4 portrait for vertical flow and `slide-16-9`
  landscape for horizontal flow.
- Position with an anchor `A`:
  - vertical: `(A.x, A.y + A.height + GAP)`;
  - horizontal: `(A.x + A.width + GAP, A.y)`.
- Every page frame after `A` in flow order shifts by `new.size + GAP` along
  the flow axis.
- Without an anchor: `(0, 0)` on an empty page. Otherwise below
  (vertical) or right of (horizontal) the union bounds of the page content,
  plus `GAP`.
- The new frame semantic is `{ name: "Page N", page, showTitle: false,
  clipContent: true }`, where N is the smallest positive integer not used
  by a `Page N` frame name on the page. Its visual is
  `{ x, y, width, height, style: { fill: "#ffffff" } }`.
- Moves carry each shifted frame's descendants, using the same move
  expansion that `nudgeSelection` applies to a selected frame. A test pins
  that a child moves with its frame.
- Everything is one `History.beginBatch`/`endBatch` batch, so it is one
  undo entry, and the new frame is selected.

Flow change (`setPageFlow(editor, pageId, flow)`):

- It does nothing when the effective flow is unchanged.
- Otherwise one batch:
  1. `updatePage { pageFlow: flow === "vertical" ? null : "horizontal" }`.
  2. Re-layout. Take the page frames in the **old** flow order. The first
     frame stays where it is. Each next frame is placed at
     `previous.end + GAP` on the new axis, aligned to the first frame on
     the cross axis. Descendants are carried.
- One undo step restores both the flow and the positions.

Navigation:

- `goToPageFrame(editor, "next" | "previous", viewport)` is stateless.
  It stores nothing in the document or the editor. It picks the reference
  frame from the **currently viewed** position first:
  1. The page frame that contains the viewport centre (in page
     coordinates). If several do, it takes the first in flow order.
  2. Otherwise, the selected page frame, or the page frame that contains
     the single selected element. This applies only when the viewport
     centre is in no page frame.
  3. Otherwise, the page frame whose centre is nearest the viewport centre,
     with ties broken by flow order.
- It fits the camera to the neighbour with the existing `fitBox`/camera
  setter path used by `zoomToSelection`. `fitBox` centres the target box,
  so after a successful move the viewport centre lies inside the neighbour.
  The next invocation therefore resolves from the neighbour through rule 1,
  never from a stale selection.
- It does not change the selection and applies no command, so there is no
  document mutation and no undo entry.
- At either end it returns `false` and leaves the camera unchanged.
- Manual camera movement takes effect immediately: the next invocation
  resolves from wherever the viewport centre now is. An initial selection
  matters only while the viewport centre is outside every page frame.
- Trace: frames A, B and C in flow order, A selected, camera on A. Next
  moves to B (reference A by rule 1). Next moves to C (reference B by
  rule 1, even though A is still selected). Previous moves back to B.

### 5.4 UI

- Actions `addPageFrame`, `nextPageFrame` and `previousPageFrame` go in
  `packages/ui-solid/src/shortcuts.ts` and the Toolbar or menu.
  - `nextPageFrame` is bound to PageDown and `previousPageFrame` to PageUp,
    on the canvas only and never while editing. Both keys are unbound
    today.
  - The navigation actions are enabled when the current page has at least
    one page frame. "Add page" is enabled in editable documents.
  - The palette gets a "Page" tile that runs `addPageFrame`.
- Inspector:
  - `packages/ui-solid/src/inspector/PageFrameSection.tsx` is shown for a
    frame. A "Page" switch adds A4 portrait, or the page-flow default, to a
    top-level frame, or removes `page`. It also has a size `<select>` (the
    presets plus Custom) and an orientation toggle that writes
    `semantic.page` and the visual box in one batch.
  - The page-level "Page flow" control (Vertical / Horizontal) is placed in
    the existing page section next to the presentation settings, and calls
    `setPageFlow`.

## 6. Slideshow with page frames

`packages/core/src/presentation/slides.ts`:

- New type `SlideRef = { readonly page: PageId; readonly frame?: ElementId }`.
- New function `expandSlides(store, pageIds): SlideRef[]`. For each page id
  (already filtered by `slideList`), it returns one ref per page frame in
  flow order, or `{ page }` when the page has no page frames.
- `slideList` keeps its signature.
- `startIndex(order, slides, from)` now takes `slides: readonly SlideRef[]`.
  It returns the index of the first ref of the `from` page. It keeps the
  existing hidden-page and unknown-page rules, applied to the pages of the
  refs.

`navigation.ts`: `PresentationState.slides` becomes `readonly SlideRef[]`.

- `currentSlide` returns a `SlideRef`.
- `reconcile` matches by `(page, frame)` equality and otherwise clamps the
  index, as today.
- Callers that need the page id use `currentSlide(state).page`.

`packages/ui-solid/src/presentation/slide-render.ts`:
`renderSlide(editor, ref)`.

- With `ref.frame`, the rect is the frame's bounds, and the SVG is
  `exportPageSvgOf(page, { viewport: rect })`, clipped like the slide area.
  This takes precedence over the document `slideSize`/`slideOrigin` and
  over the artboard rule.
- Without a frame, the current behaviour runs byte-for-byte unchanged.

`controller.ts`:

- The cache key becomes `(page, frame, revision)`.
- `size` is the frame rect size for frame slides.
- `onExit` receives `ref.page`.
- Transitions between two slides on the same nodetto page are cuts (no
  `planSlideTransition` call), because slide links pair elements across
  pages.
- A transition between slides on different pages calls the existing
  planner with the frame rects. `hiddenInPresentation` still hides a whole
  nodetto page.

`labels.ts`: `slideLabel` counts the expanded list.

- A page with `k > 1` slides shows `Slides n-m / total`.
- One slide shows `Slide n / total`.
- A hidden page keeps `Hidden from presentation`.

Documents without page frames get the same slide list, rendering and
counter as today. The existing presentation tests must pass unchanged
except for the type change.

## 7. Document export

### 7.1 Page sequence (`packages/core/src/document-export/sequence.ts`)

`documentPageSequence(store, registry)` returns `DocumentPageRef[]`, where
`DocumentPageRef = { pageId, frameId?, rect }`.

- Nodetto pages are taken in tab order (`listPages`). All pages are
  included. `hiddenInPresentation` is presentation-only.
- A page with page frames gives one ref per page frame in flow order, with
  `rect` = the frame bounds.
- A page without page frames gives one ref with `rect` = the content
  bounds plus `DEFAULT_EXPORT_PADDING` (16). An empty page gives no ref.
- The same function drives PDF and Markdown export, so both formats agree
  on order.

### 7.2 Markdown export (`packages/core/src/document-export/markdown.ts`)

`exportMarkdownDocument(store, registry, { assetDir, embed })` returns
`{ markdown, assets: { name, svg }[] }`.

- Membership uses `frameParents(store, pageId, context)` and
  `expandContainers` from `packages/core/src/frame-tree.ts`. It does not
  change them. Candidates for a ref with a frame `F` are:
  - (a) the direct members of `F`, meaning elements whose `frameParents`
    entry is `F`;
  - (b) top-level elements, meaning those with no `frameParents` entry,
    whose bounds centre lies inside the rect.

  A ref without a frame takes every top-level element as a candidate.
- Exclusions and deduplication, applied before sorting and grouping:
  1. Remove `F` itself and every page frame, so the page envelope is never
     its own member.
  2. Remove hidden elements and mask sources, as in svg-export.
  3. Collect the candidates into a `Set` keyed by id.
  4. Remove any candidate that lies inside another candidate's
     `expandContainers` expansion, for example a child of a selected group.
     A container member then stands for its contents exactly once.
- Members are sorted by `(top, left, id)`.
- Emission, in order:
  - `text.markdown` is emitted verbatim. Trailing newlines are trimmed.
  - `text.code` becomes a fenced block. The fence is backticks, with length
    `max(3, longest backtick run in code + 1)`. The info string is the
    language, or empty for `plain`.
  - A maximal run of other consecutive members becomes **one** group
    image: `renderSelectionSvg(store, registry, pageId, ids, { padding: 16,
    background: null })`.
    - Name: `page-<refIndex+1>-<groupIndex+1>.svg`, for example
      `page-2-1.svg`.
    - Reference: `![Diagram page-2-1](<assetDir>/page-2-1.svg)`, or a
      `data:image/svg+xml;base64,...` URI when `embed` is set.
- Blocks are joined by one blank line. Refs are joined by one blank line.
  No headings or separators are synthesised. The file ends with exactly
  one `\n`.
- Output is deterministic and byte-identical between app and CLI for the
  same document and options.

### 7.3 Multi-page PDF

PDF keeps the existing raster pipeline (user-qa Q2). One encoder contract
serves three hosts. The pure layout is
`packages/core/src/document-export/pdf-pages.ts`:

```text
PdfTextRun   = { x, y, size, text, font: "sans" | "sans-bold" | "mono" }   // px in the page SVG viewBox, baseline y
PdfPageSpec  = { width, height, layout: pdfLayout(width, height, { pageSize: "artwork", orientation, marginMm: 0 }), textRuns }
PdfTextLayer = { fonts: PdfType3Font[], pages: { fontNames: string[], content: string }[] }   // built once per PDF by buildPdfTextLayer(specs)
PdfType3Font = { name, firstChar: 1, lastChar, widths: number[], glyphProcs: { glyph, content }[], differences: string[], toUnicode: string }
```

- Per ref, the SVG is `exportPageSvgOf(pageId, { viewport: rect, background })`
  (the same clipping as the slideshow). It is rasterized at the PDF scale
  (default 2) by the host rasterizer and placed as one PDF page whose size
  is `rect * 0.75` pt (96 dpi). A4 794x1123 gives a 595.5x842.25 pt page.
- Text layer runs: `snippetTextRuns(store, registry, pageId, rect)`
  collects runs from the `text.code` and `text.markdown` layouts that
  intersect the rect. The run text is the exact source text of each laid-out
  run. Tabs are written as U+0009, and no character is dropped or
  substituted.
- Unicode-preserving encoding (section 7.3.1) uses no font file, no new
  dependency and no host-specific text logic. The text layer is also added
  to the existing single-page PDF exports, so a snippet in any PDF is
  selectable.

#### 7.3.1 Text-layer encoding contract

`buildPdfTextLayer(specs)` in `pdf-pages.ts` is pure. It turns the runs of
all pages into Type3 font descriptions and per-page content-stream text.
Every host serialises the result verbatim, so all three encoders produce
the same logical text.

- Code assignment:
  - Each distinct Unicode code point, iterated with `for...of` so a
    supplementary character is one unit, gets a 1-byte code in a Type3 font
    for its font class (`sans`, `sans-bold`, `mono`).
  - Codes run 1 to 255 in order of first appearance across the document.
    The 256th distinct code point of a class opens the next font of that
    class.
  - Font names are `NT<class initial><n>`, for example `NTm1`, `NTs2`,
    `NTb1`.
  - The result is deterministic for a given document.
- Type3 font dict, one per font:
  - `/Type /Font /Subtype /Type3`, `/FontMatrix [0.001 0 0 0.001 0 0]`,
    `/FontBBox [0 0 0 0]`, `/FirstChar 1`, `/LastChar n` and
    `/Widths [...]`;
  - `/Encoding << /Type /Encoding /Differences [1 /g1 /g2 ...] >>`;
  - `/CharProcs << /g1 ref ... >>`, where each glyph proc is the stream
    `<w> 0 d0`. It draws nothing, so render mode 3 and empty procs are
    both safe;
  - `/ToUnicode` pointing to the generated CMap stream.
- Widths (glyph space, 1000 per em) match the layout advance, so
  selection highlights align with the raster:
  - mono: 600, or 1200 for wide code points;
  - sans and sans-bold: the Liberation Sans regular or bold advance scaled
    to 1000 units, 1000 for wide code points, and `AVERAGE_GLYPH_WIDTH`
    times 1000 otherwise.
- ToUnicode CMap: the standard `CIDInit`/`begincmap` program with
  `/CMapName /Nodetto-<name>`, a `<01> <FF>` codespace range, and
  `beginbfchar` entries in groups of at most 100. Each entry maps
  `<code>` to the UTF-16BE hex of the code point, so a supplementary
  character maps to its surrogate pair, for example `<05> <D842DFB7>` for
  U+20BB7. Combining marks and ZWJ sequences keep every code point in
  source order.
- Page content per run:
  `BT 3 Tr /<font> <size_pt> Tf 1 0 0 1 <x_pt> <y_pt> Tm <hex codes> Tj ET`.
  - The coordinates come from the page `pdfLayout` mapping (px times 0.75,
    y flipped).
  - A run whose code points span several fonts is split into consecutive
    `Tf`/`Tj` pairs inside the same `BT ... ET`, which keeps reading order.
  - The page resources list the fonts the page uses.
- Hosts. Each serialises dicts, arrays and streams from the description
  and adds no text logic:
  - pdf-lib, in the app and Bun CLI: `context.obj`, `context.stream`
    (`flateStream` for the content), `context.register`,
    `page.node.setFontDictionary(PDFName.of(name), ref)` and
    `page.node.addContentStream(ref)`. These APIs were checked in pdf-lib
    1.17.1: `cjs/core/PDFContext.d.ts:42,73-76` and
    `cjs/core/structures/PDFPageLeaf.d.ts:30,34`.
  - pdf-writer 0.15 in the native CLI: generic indirect dictionaries and
    streams (`Pdf::indirect(..).dict()` and `Pdf::stream`) for the same
    objects, plus a resources `/Font` dict per page. The `dps-pdf-pages`
    plan must verify these calls against the crate before coding; the
    generic object writer avoids relying on typed Type3 helpers.
  - The image layer stays unchanged in every host.
- Feasibility: the contract needs only generic PDF objects that both
  existing libraries can write. No font is embedded or substituted, and
  no dependency is added. There is no remaining conflict with the
  constraints.
- Encoders:
  - App: `packages/ui-solid/src/pdf-export.ts` `pagesToPdf(pages, signal)`,
    using pdf-lib.
  - Bun CLI: `apps/cli/src/raster-backend.ts` `pagesToPdf`, using pdf-lib.
  - Native CLI: `apps/cli/native/src/render.rs` `pdf_pages(pngs, specs_json)`,
    using pdf-writer. It writes N page objects, each with an image XObject,
    an alpha SMask and the text layer. A new host function `pdfPages` is
    added in `engine.rs`, with its binding in
    `apps/cli/src/native-engine.ts`.
  - `pngToPdf` stays and becomes the one-page case of the same code path.
- Limits: each page uses the existing `rasterDimensions` limits and the
  14400 pt check in `pdfLayout`. A document of more than 500 refs is
  rejected with `Document has N pages; PDF export supports at most 500.`

### 7.4 CLI

Usage: `nodetto-cli export <doc> --format pdf --document --output <file.pdf> [--scale n] [--background #rrggbb|transparent]`.

- `--document` is a new flag. It conflicts with `--page`, `--element`,
  `--frames`, `--pdf-page`, `--orientation` and `--margin`, each a
  one-line error with exit 2. It is valid only with `pdf`.

Usage: `nodetto-cli export <doc> --format markdown --output <file.md>`.

- `markdown` is a new format value. `--output` is required.
- The command writes `<file.md>`. When assets exist it also writes
  `<stem>.assets/<name>.svg`, where `<stem>` is the file name without
  `.md`, and the Markdown references them with
  `assetDir = "<stem>.assets"`.
- Writes are atomic per file (`write-atomic.ts`). The assets directory is
  created when it is missing. Stale files in it are not removed.

Both print the existing `Wrote ...` summary on stderr. The flag name stays
`--output` (the intake's `--out` maps to it). The export help text and
`docs/cli.md` document both.

### 7.5 Desktop and web

`ExportDialog` gets a "Document" group:

- "Document as PDF..." uses the same background and scale controls. The
  pages are rasterized with the existing browser rasterizer, then passed to
  `pagesToPdf` and saved through `saveArtwork`.
- "Document as Markdown (ZIP)..." uses
  `exportMarkdownDocument(..., { assetDir: "<base>.assets" })`. It packs
  `<base>.md` and `<base>.assets/*.svg` with `encodeStoredZip` and saves
  through the existing `saveZip`. The desktop app and a plain browser
  (download) behave the same. No Tauri command is added (user-qa Q3).
- Desktop Export menu: the existing "Export..." entry opens the dialog, so
  no new native menu item is needed.

### 7.6 Fallbacks in other exporters

| Exporter | `text.code` | `text.markdown` |
| --- | --- | --- |
| draw.io | text vertex like `text.note` with `fontFamily=monospace`, value = code | text vertex like `text.note`, value = Markdown source |
| D2 | `text` shape, label = code (`labelOf`/`shapeKind`) | `text` shape, label = source |
| Mermaid | omitted (same as `text.note` and `table.sheet`) | omitted |
| HTML (`interface-code.ts`) | `<pre><code class="language-<id>">` escaped code | `<div style="white-space:pre-wrap">` escaped source |

Page frames export like any `frame` in these formats. `pageFlow` is
ignored there.

### 7.7 `export.md` amendment

`design-docs/specs/export.md` section 1 carries an amendment note, added
with this design. It lifts the "multi-page PDF" non-goal for document
export only, and points here.

## 8. CLI authoring

- `nodetto-cli edit` with the generic `add` operation already creates any
  registered type from an inline semantic:
  - `{"op":"add","type":"text.code","semantic":{"code":"...","language":"rust"}}`
  - frames with `semantic.page`

  For `text.code`, the add path normalises `language` through
  `resolveSyntaxKind` and fails on unknown names with the list of kinds.
- The existing page-update edit operation (`apps/cli/src/edit/operations/pages.ts`)
  accepts `pageFlow` (`vertical`, `horizontal` or `null`). It sets the
  field only. It does not re-layout, because the CLI positions frames
  explicitly.
- Shape catalogue (`shape-catalogue.ts`) gets tools `Tool.CodeSnippet`
  ("Code snippet", `text.code`) and `Tool.MarkdownSnippet` ("Markdown
  snippet", `text.markdown`) in the General category. They are visible to
  `nodetto-cli shapes|draw` and in `types` (`TYPICAL.architecture` and
  `GENERAL`).

## 9. Collaboration and repository boundary

- New element types and `FrameSemantic.page` sync through the generic
  semantic diff (`packages/collab/src/diff.ts`). `Page.pageFlow` needs the
  `ydoc.ts` field change in section 5.1.
- No `Command` kind is added, so the private sync Worker is unaffected.
- Server, auth and deployment code are out of scope.

## 10. Module ownership and plan split (input for impl-plans)

At most two waves, then one wiring plan. Dependencies follow real
contracts only. Each plan pre-authorises co-located `*.test.ts` files.

Wave 1 (no inter-plan dependencies):

| Plan | Owns |
| --- | --- |
| `dps-syntax` | `packages/core/src/syntax/*`, `packages/core/src/code-snippet/layout.ts` |
| `dps-markdown` | `packages/core/src/markdown/{ast,parse,inline,layout}.ts` (`SyntaxSegment` is a structural type, so it does not import syntax) |
| `dps-model` | `packages/ir/src/semantics/document.ts`, `registry/document.ts`, `semantics/design.ts` (`page`), `registry/containers.ts`, `types.ts`/`validate.ts` (`pageFlow`), `packages/io/src/jsonl/{records,parse}.ts`, `packages/collab/src/ydoc.ts`, `packages/core/src/commands.ts` (`pageFlow`), `packages/core/src/editor/pages.ts` (duplicate) |
| `dps-page-geometry` | `packages/core/src/page-frames/{presets,order,plan,navigation}.ts`, `packages/core/src/document-export/sequence.ts` (inputs are `Store` and `ShapeUtilRegistry` plus the `pageFlow`/`page` shapes declared locally as structural types, so it does not wait for `dps-model`) |
| `dps-pdf-pages` | `packages/core/src/document-export/pdf-pages.ts` (types and `buildPdfTextLayer`), `packages/core/src/document-export/pdf-text-extract.ts` (test-only extractor, section 11), `packages/ui-solid/src/pdf-export.ts`, `apps/cli/src/raster-backend.ts`, `apps/cli/src/native-engine.ts`, `apps/cli/native/src/{render,engine}.rs` |

Wave 2:

| Plan | Depends on | Owns |
| --- | --- | --- |
| `dps-code-shape` | syntax, model | `code-snippet/shape.ts`, `svg-export/code-snippet.ts`, code text runs |
| `dps-markdown-shape` | syntax, markdown, model | `markdown-snippet/shape.ts`, `svg-export/markdown-snippet.ts`, Markdown text runs |
| `dps-snippet-ui` | syntax, markdown, model | `CodeSnippetView.tsx`, `MarkdownSnippetView.tsx`, `snippet/SnippetTextEditor.tsx`, `CodeSnippetSection.tsx`, `MarkdownSnippetSection.tsx` |
| `dps-page-editing` | model, page-geometry | `page-frames/editing.ts`, presentation `slides.ts`/`navigation.ts`/`labels.ts`, `ui-solid/src/presentation/{controller,slide-render}.ts`, `PageFrameSection.tsx`, the page-flow control |
| `dps-document-export` | model, page-geometry, pdf-pages | `document-export/markdown.ts`, `document-export/pdf.ts` (assembly with injected text-run extractors), `apps/cli/src/export-command.ts` (`--document`, `markdown`) |

Final wiring plan `dps-wiring` owns the shared registration files:

- IR: `registry.ts` `DEFINITIONS`, `semantics.ts` `SemanticByType`,
  `packages/ir/src/index.ts`.
- Core: `packages/core/src/index.ts`, `shapes/index.ts`,
  `svg-export/shapes.ts` dispatch, `tools.ts`, `shape-catalogue.ts`,
  `editableFieldOf`, the text-run extractor registration.
- UI: `ShapeView.tsx`, `Inspector.tsx`, the double-click edit dispatch
  that mounts `SnippetTextEditor` (`interaction/pointer.ts` and
  `Canvas.tsx`), `shape-palette.ts`,
  `shortcuts.ts`/Toolbar actions, the `ExportDialog.tsx` Document group and
  `apps/desktop/src/shell/export-handlers.ts`.
- io fallbacks (section 7.6) and the golden fixture
  `packages/io/src/__fixtures__/document-pages.jsonl` (added to `GOLDEN`).
- CLI: `apps/cli/src/{help,types-command}.ts`, the edit `add`/pages
  normalisation.
- Docs and examples: `docs/{editing,import-export,cli}.md`, `README.md`,
  `examples/document/` (README, `paper.ops.json` with vertical A4 frames,
  Markdown, code and a small diagram; `deck.ops.json` with horizontal 16:9
  frames).

The plan step may move a file between wave-2 plans if it keeps these
contracts and the wave limit.

## 11. Verification

Unit tests (Bun, co-located):

- syntax:
  - 28 kinds, alias resolution, per-kind fixture segments;
  - line round trip (segments concatenate to the source line);
  - multi-line comment state;
  - Boa regex-feature scan;
  - palette contrast of at least 4.5:1;
  - `codePaletteFor` threshold.
- markdown parse and layout:
  - every listed construct, nested lists and tasks, table alignment and
    escapes;
  - the literal non-goals;
  - link scheme filtering;
  - wrap at the width and the height formula;
  - injected highlighter use.
- model:
  - validation of both types, `page` and `pageFlow`;
  - JSONL byte-identical round trip (golden fixture);
  - ydoc round trip of `pageFlow`;
  - the `updatePage` `pageFlow` set, clear and inverse;
  - duplicate page copies `pageFlow`;
  - clipboard keeps `frame.page`.
- page frames:
  - presets and orientation;
  - flow order;
  - add after selected, after last, empty page and non-empty page without
    frames;
  - later frames and descendants shift;
  - one undo restores everything;
  - reflow as one undo;
  - navigation:
    - frames A, B and C, with A selected and the camera on A: Next, Next,
      Previous reaches B, C, B, in both vertical and horizontal flow;
    - repeated Next at C and repeated Previous at A return `false` and
      leave the camera unchanged;
    - with the camera centre outside every frame and B selected, Next goes
      to C;
    - after a manual camera move onto C, Previous goes to B;
    - navigation applies no command (the history length is unchanged) and
      keeps the selection.
- presentation:
  - expansion and order;
  - frame clipping viewport and precedence over `slideSize`;
  - reconcile by ref;
  - same-page cut;
  - unchanged behaviour without page frames (existing tests);
  - labels.
- export:
  - SVG snapshots of both snippets (tspans per token, anchors, dark
    palette);
  - page sequence order across tabs;
  - Markdown output (verbatim, fences with backticks inside, group assets,
    data-URI mode, determinism);
  - Markdown membership:
    - A page frame that contains only one `text.markdown` and one
      `text.code` emits each snippet exactly once and zero SVG assets.
    - A mixed page (a Markdown snippet, then two shapes and a connector,
      then a code snippet) emits each snippet once and exactly one asset.
      That asset contains the shapes and is free of the snippet text and
      the page-frame rect.
    - A group member yields one asset without duplicating its children.
    - The existing `renderSelectionSvg` single-frame expansion test still
      passes unchanged.
  - PDF:
    - page count, MediaBox per page, and clipping to the frame;
    - the raster image is present on every page;
    - `buildPdfTextLayer` is deterministic (code assignment, widths,
      fonts split after 255 code points, CMap bfchar groups of at most
      100).
  - Exact Unicode extraction. The extractor
    `document-export/pdf-text-extract.ts` is self-authored and imported only
    by tests. It parses this design's own output (uncompressed objects and
    FlateDecode streams via `node:zlib`; pdf-lib saves with
    `useObjectStreams: false`), resolves the ToUnicode CMaps and decodes the
    `Tj` strings.
    - Test input: code `const label = "日本語"; // 𠮷 é\tend` and Markdown
      `# Ünïcode **太字** 😀`.
    - The extracted text must equal the run texts exactly for the app
      encoder (`packages/ui-solid/src/pdf-export.ts`, run under Bun with
      synthetic PNGs) and the Bun CLI encoder
      (`apps/cli/src/raster-backend.ts`).
    - The check covers single-page and multi-page output.
- Native PDF: the native-parity export topic runs the release binary.
  `export --format pdf --document` writes the same fixture, and the same
  extractor must return exactly the same Unicode text and page count as the
  Bun encoder.
- CLI:
  - `--document` conflicts;
  - `--format markdown` writes the `.md` and `.assets/`;
  - PDF page count;
  - `add` language normalisation and rejection;
  - SVG byte identity with `new Editor({ document }).exportPageSvgOf(...)`
    (the renderer the app uses) for a page with both snippets.
- Native parity: the `apps/cli/src/native-parity/` export topic gains the
  snippet SVG byte identity and the document PDF page count against the
  release binary.

Commands, each of which must exit 0:

```bash
bun test packages/core/src/syntax packages/core/src/markdown packages/core/src/page-frames packages/core/src/document-export
bun test packages/ir packages/io packages/collab packages/core packages/ui-solid apps/cli/src
bun run typecheck
CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml --check
mise run lint
mise run verify
mise run test-cli   # retry up to 3 attempts only on deadline timeouts; deadlines unchanged
```

## 12. Risks

- Font metrics: the layout uses Liberation Sans advances and 0.6 em mono
  advances. Real fonts differ, so text can sit slightly short or long of
  the computed wrap width. Geometry stays deterministic and identical
  across hosts, and every snippet is clipped to its panel.
- PDF text layer: selection boxes match the raster within the
  deterministic metric error of the layout. Some readers may treat an
  invisible Type3 text layer differently for copy order across runs. The
  extraction tests pin the logical text, not the appearance in any one
  reader.
- Chilla port fidelity: the source repository could not be read from this
  design sandbox. The `dps-syntax` plan must read the four chilla files
  directly and pin the 28 kinds and the alias table by test.
- Shared registration conflicts: mitigated by the single wiring plan.
- `test-cli` deadline flakiness: up to 3 attempts, with deadlines
  unchanged.
