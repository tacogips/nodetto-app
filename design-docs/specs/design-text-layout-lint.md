# Text-layout lint for architecture, freeform and flowchart pages

Status: REVISED, 2026-10-30. The first version (DESIGNED, base a9728e6
"Release Nodetto 0.8.4") was implemented at 45cc69f. This revision applies
the owner decisions Q1 (page kinds) and Q2 (wide-character width) from
`design-docs/user-qa/text-layout-lint.md`. Q3 and Q4 stay at their documented
defaults. Re-validated 2026-10-30 (session 555): behavior unchanged. Only
the verification order under "Rollout constraints" was added. Revised
2026-10-30 (session 556): behavior unchanged. "Rollout constraints" now
defines the finishing plan structure (one combined core, CLI and test plan
plus one native parity plan), the rule that every gate command exits 0, and
the archival of all `tll` plans. The verification commands were brought in
line with that structure. A second session-556 pass replaced the
per-test `(pass)`/`(skip)` console checks, which bun's quiet agent mode
does not print, with summary-line and JUnit-report evidence ("Native
evidence format").

## Overview

Before this lint, `nodetto-cli lint` only checked `bpmn` and `breadboard`
pages, and `validate` and `edit` passed while text was visibly broken: label
lines were clipped, edge labels sat on top of each other, and notes ran into
the element below. The only way to catch these problems was to look at an
exported PNG.

This design adds a deterministic text-layout lint in `packages/core` with three
warning rules. The lint runs on `architecture`, `freeform` and `flowchart`
pages, from:

- `nodetto-cli lint`, next to BPMN and breadboard pages;
- `nodetto-cli export` (SVG, PNG or PDF of a whole page of one of those
  kinds), where the same findings print as `warning:` lines on stderr. The
  exported bytes do not change.

The lint uses the same layout functions and the same element boxes as the SVG
export. One measurement differs on purpose (Q2). When the lint checks whether
a rendered line fits, it counts East Asian Wide and Fullwidth graphemes at
1.0 em instead of the export's 0.55 em estimate. Export wrapping stays on the
estimate, so CJK text that the export draws on one line can still be clipped by
real fonts in a PNG. The lint reports that clipping. For text without wide
graphemes, a finding still means "the export draws this text clipped,
spilling or covered".

## Scope

In scope:

- Page kinds `architecture`, `freeform` and `flowchart`
  (`TEXT_LAYOUT_LINT_PAGE_KINDS`, Q1). The rules depend on element types, not
  on the page kind. All other kinds (`erd`, `uml`, `sequence`, `state`, `bpmn`,
  `breadboard`, `pcb`) keep their exact lint and export output.
- Rules `label-overflow`, `label-collision` and `note-overflow`, all at
  severity `warning`. The rule ids are unchanged.
- Wide-aware width (Q2) for the line-width checks of `label-overflow` and
  the new line-width and wide-wrapped-height checks of `note-overflow`. It
  lives in a lint-only helper module that no export code imports.
- CLI `lint` (text and `--format json`) and `export --format svg|png|pdf`
  without `--element`.
- Help text (`apps/cli/src/help.ts`), `docs/cli.md` and design docs.

Out of scope:

- Real-font measurement beyond the wide/narrow split. Wide Latin capitals,
  proportional glyphs and East Asian Ambiguous (`A`) characters stay at
  0.55 em, so their real-font clipping is not reported.
- Wide-aware measurement in `label-collision` and in the note proximity
  check. Edge label backdrops and note text bottoms are export geometry, and
  they stay on the export estimate.
- Wide-aware label height. A label's height finding stays on the export's
  wrapped line count.
- Any change to `wrapTextLines`, `label-layout.ts`, `node-label.ts`,
  `text-note.ts` or any other export geometry (Q2 decision: lint-side only).
- Desktop problems panel, lint configuration files, per-rule severity
  overrides, and an export `--strict` flag (Q4 default). Export has no
  `--strict` today and does not get one.
- Labels of `usecase.node`, `state.node`, BPMN, ERD, UML class and sequence
  elements. These have their own label layouts.
- `--element` exports, HTML, Mermaid, D2, draw.io and code exports (Q3
  default).
- Any change to `packages/io/src/bpmn`, and any change under
  `apps/cli/native/**`, `Cargo.toml` or `Cargo.lock`.

## Baseline facts this design relies on

| Fact | Where |
| --- | --- |
| `node.generic` label: `nodeLabelLayout(label, {...visual, width: box.width, height: box.height})`, text area `x+10 .. x+10+(width-20)`, clip rect of full box height, block top `max(0, (h - n*lh)/2)` | `svg-export/basic-shapes.ts:96-150`, `node-label.ts` |
| `shape.geo` label: `centredLabel` → `boxLabelLayout(label, box.width, visual, theme.fontSize)`, wrap width `box.width - 16`, block centred vertically, **not clipped** | `svg-export/paint.ts:236-275`, `label-layout.ts:53` |
| Edge label: `resolveConnector` → `connectorDecoration(element).label` → `connectorLabelLayout` → `connectorLabelBackdrop(layout, resolved.labelPoint)` (an opaque rect in the page colour); BPMN flows use their notation instead | `svg-export/connectors.ts:89-160`, `label-layout.ts:67-129` |
| `text.note`: `wrapTextLines(text, max(1, box.width - 2*paddingX), fontSize, letterSpacing)`; padding `visual.textPadding ?? 8 / 6`; font `style.fontSize ?? theme.fontSize (13)`; a line is drawn only while `top + lineHeight <= box.y + box.height + 0.01`; notes are not clipped horizontally | `svg-export/text-note.ts` |
| `wrapTextLines` breaks greedily by grapheme count `maxChars = max(1, floor(width / advance))` with `advance = max(0.1, fontSize * 0.55 + letterSpacing)`, so no line has more than `maxChars` graphemes | `text-layout.ts:58-96` |
| Graphemes come from the private `graphemes()` in `text-layout.ts` (`Intl.Segmenter("und", {granularity: "grapheme"})`). The native CLI provides `Intl.Segmenter` from Rust (`native.graphemes`) | `text-layout.ts:17-22`, `apps/cli/native/src/engine.rs:224` |
| Page export = `renderElementsSvg(store.getPageElements(pageId), registry, createShapeContext(store, registry, 1))`; it skips `visual.hidden`, `context.isHidden`, `context.isMaskSource` and `group`; box = `registry.getOrFallback(type).getBounds(element, context)`; connectors are painted in a layer *below* shapes. Page kind does not change rendering | `svg-export/document.ts:99-230, 513-525` |
| `Editor` builds `new Store(document)` and `createDefaultRegistry()` without normalising the document | `editor.ts:258-266` |
| The native CLI runs the TS command bundle in Boa; `render.rs` only rasterises SVG to PNG and PDF, so it needs no change | `apps/cli/native/src/render.rs` |
| New pages default to kind `freeform`. Golden fixtures `freeform.jsonl`, `flowchart.jsonl`, `free-lines.jsonl` and others have freeform or flowchart pages. The golden loops only run `validate`, `format` and `inspect`, so their outputs do not change | `editor/pages.ts:56`, `packages/io/src/__fixtures__`, `apps/cli/src/native-parity.test.ts:47-69` |

## Module: `packages/core/src/text-layout-lint/`

This module follows the shape of `bpmn/lint`:

- `rules.ts`: the three rules and the sweep prefilter;
- `engine.ts`: `lintTextLayoutPage`;
- `index.ts`: re-exports;
- `engine.test.ts` and `rules.test.ts`.

`packages/core/src/index.ts` exports:

```ts
export const TEXT_LAYOUT_LINT_RULE_IDS = ["label-overflow", "label-collision", "note-overflow"] as const;
export type TextLayoutLintRuleId = (typeof TEXT_LAYOUT_LINT_RULE_IDS)[number];
export const TEXT_LAYOUT_LINT_PAGE_KINDS: readonly PageKind[] = ["architecture", "freeform", "flowchart"];
export interface TextLayoutLintFinding {
  readonly elementId: ElementId;
  readonly ruleId: TextLayoutLintRuleId;
  readonly severity: "warning";
  readonly message: string;
}
export function lintTextLayoutPage(document: Document, pageId: PageId): readonly TextLayoutLintFinding[];
export function estimatedTextWidth(text: string, fontSize: number, letterSpacing?: number): number;
```

The index surface does not change in this revision, apart from the value of
`TEXT_LAYOUT_LINT_PAGE_KINDS`. The wide-aware helper is not exported from
`@nodetto/core`.

`lintTextLayoutPage` builds `new Store(document)`, `createDefaultRegistry()`,
`createShapeContext(store, registry, 1)` and the default SVG theme, exactly as
`Editor.exportPageSvg` does. It then walks `store.getPageElements(pageId)` in
page order and skips the same elements as `renderElementsSvg`: hidden,
`isHidden`, `isMaskSource`, `group`, and elements with a null box. It does not
model frame clipping (`clipOf`), so an element that a frame clips away entirely
can still be reported. It does not read the page kind. The callers gate on
`TEXT_LAYOUT_LINT_PAGE_KINDS`.

`text-layout.ts` exports `estimatedTextWidth(text, fontSize, letterSpacing = 0)`,
which returns `graphemes(text).length * glyphAdvance(fontSize, letterSpacing)`.
This revision also turns the private `graphemes` function into a named
export, so the wide-aware helper splits text exactly as `wrapTextLines` does.
The change only adds the `export` keyword, and `@nodetto/core`'s index does
not re-export the function. No renderer file changes. Export output is
byte-identical by construction.

Numbers in messages are rounded to one decimal (`Math.round(v * 10) / 10`,
printed with `String`). Comparisons use the renderer's tolerance `EPS = 0.01`.

### Wide-aware width helper: `packages/core/src/wide-text-width.ts`

This module is lint-only and sits next to `text-layout.ts`. It imports only
`AVERAGE_GLYPH_WIDTH` and `graphemes` from `text-layout.ts`. Only
`text-layout-lint/rules.ts` and the module's own test may import it.
`text-layout.ts`, `label-layout.ts`, `node-label.ts`, `svg-export/**` and every
other export path must not import it.

```ts
export const WIDE_GLYPH_WIDTH = 1;
export function isWideCodePoint(codePoint: number): boolean;
export function wideAwareTextWidth(text: string, fontSize: number, letterSpacing?: number): number;
export function wideAwareLineCount(line: string, maxWidth: number, fontSize: number, letterSpacing?: number): number;
```

Classification:

- The table is a module-private, sorted flat `readonly number[]` of inclusive
  `[start, end]` code point pairs. Its entries are every code point whose
  `East_Asian_Width` is `W` or `F` in Unicode 16.0.0 `EastAsianWidth.txt`,
  with adjacent ranges merged. A comment names the source file and version.
  `A` (Ambiguous), `H`, `Na` and `N` are narrow. The `W` set includes the
  emoji-presentation ranges, because the decision covers `W` as defined.
- `isWideCodePoint(cp)` returns `false` at once when `cp < 0x1100` (the
  first `W` range). Otherwise it does a binary search over the pairs. It uses
  no regular expressions and no Unicode property escapes.
- A grapheme is wide when the code point of its first code unit sequence
  (`grapheme.codePointAt(0)`) is wide. Combining marks, variation selectors
  and ZWJ tails never change the class.

Width:

- `narrow = max(0.1, fontSize * AVERAGE_GLYPH_WIDTH + letterSpacing)`, which
  is the export's `glyphAdvance`.
- `wide = max(0.1, fontSize * WIDE_GLYPH_WIDTH + letterSpacing)`.
- `wideAwareTextWidth(text)` counts the narrow and wide graphemes and
  returns `narrowCount * narrow + wideCount * wide`. It multiplies counts and
  does not sum per grapheme. For text with no wide grapheme, the result is
  therefore bit-identical to `estimatedTextWidth`, and every existing finding
  and message stays the same.
- `wideAwareLineCount(line, maxWidth)` breaks one already-wrapped export line
  greedily by grapheme, ignoring word boundaries. A grapheme goes on the
  current line when the line is empty or when the line's width with that
  grapheme added (computed from counts as above) is `<= maxWidth + EPS`.
  Otherwise it starts a new line. The function returns the number of lines,
  and at least 1 (an empty line counts as 1). For a line without wide
  graphemes from `wrapTextLines(text, maxWidth, ...)`, it returns 1, because
  such a line has at most `floor(maxWidth / narrow)` graphemes.

Cost: one segmentation per line (the same segmenter as export), one
`codePointAt` and at most `log2(table pairs)` comparisons per grapheme, and
linear work per line. Nothing is quadratic.

### Rule `label-overflow`

Subjects are `node.generic` and `shape.geo` elements with a non-empty label.
For each subject the rule computes the renderer's layout:

| Type | Layout call | Available width `A` | Available height `B` | Effect when it does not fit |
| --- | --- | --- | --- | --- |
| `node.generic` | `nodeLabelLayout(label, {...visual, width: box.width, height: box.height})` | `layout.width` (`box.width - 20`, min 0) | `box.height` | clipped by the clip rect |
| `shape.geo` | `boxLabelLayout(label, box.width, visual, DEFAULT_SVG_THEME.fontSize)` | `box.width - 16` | `box.height` | text spills outside the shape |

The box is the unrotated element box. The label rotates with the element, so
local space is exact.

The rule reports up to two findings per element, in this order:

1. **Width.** This applies to the first rendered line `i` (the export's own
   `layout.lines`) whose `line.trim() !== ""` and whose
   `W = wideAwareTextWidth(line, fontSize, letterSpacing) > A + EPS`.
   - Message (node): `Label line <i+1> of <n> is <W> wide but the text area is <A> wide at <fontSize>px; export clips it.`
   - For `shape.geo` the ending is `export draws it past the label padding.`
     (A geo label is not clipped. A line wider than `A` but narrower than
     `box.width` enters the 8-unit padding without leaving the shape.)
   - For a line without wide graphemes this happens only when `A` is
     narrower than one glyph, as before. For a line with wide graphemes it
     also happens when the export fits the line by the 0.55 estimate but
     the 1.0 em width does not fit. Example: `在庫照会サービス（試験運用中）`
     (15 graphemes) in a 140x60 node is one export line (`maxChars` 16 at
     13px). `W` is 195 against `A` 120, so the rule reports it. The
     15-grapheme `Payment gateway` in the same box measures 107.3 and is
     clean.
2. **Height.** Unchanged. It applies when `H = n * lineHeight > B + EPS`,
   using the export's line count `n`. The clipped count `k` is the number of
   lines `j` with `top + (j + 1) * lineHeight > B + EPS`. For a node,
   `top = layout.top`. For geo, `top = (B - H) / 2`, which is negative when the
   text spills.
   - Message (node): `Label needs <n> lines (<H> high) but the box is <B> high at <fontSize>px; export clips <k> lines.`
   - Message (geo): `Label needs <n> lines (<H> high) but the box is <B> high at <fontSize>px; the text spills outside the shape.`

If a label without wide graphemes fits after export wraps it, there is no
finding, because every wrapped line is at most `maxChars` graphemes and the
block height fits. If a label line is clipped or spills in the export
geometry, there is a finding. Tests pin both cases against `renderPageSvg`.

### Rule `label-collision`

Unchanged by this revision. It stays on export geometry.

Each **label item** is a visible edge-category element whose type does not
start with `bpmn.`, whose `resolveConnector` is non-null, and whose
`connectorDecoration(element).label !== ""`. Its box is
`connectorLabelBackdrop(connectorLabelLayout(label, visual), resolved.labelPoint)`.
That is the opaque rect export draws.

Each **body item** is a visible non-edge element with a box, except `frame`,
`group`, `draw.freehand` and `draw.path`. Frames are containers, and the boxes
of freehand and path elements are loose. Elements with a non-zero `rotation`
are not body items, because their page footprint is not their box.

The rule makes these findings, each on the label's edge id:

- **Label vs label:** two label backdrops intersect with width and height
  both `> EPS`. There is one finding per pair, on the edge later in page order
  (its backdrop is painted over the earlier label's text).
  Message: `Label box <w>x<h> overlaps the label of <otherEdgeId> by <ow>x<oh>.`
- **Label vs body:** a label backdrop intersects a body box with positive
  area. The edge's own endpoint elements are **not** excluded. Shapes paint
  above the connector layer, so a label under its own endpoint node is hidden.
  A body is skipped when its box contains every point of the edge's
  `resolved.points`. Such a body encloses the whole edge (a zone or boundary
  rectangle), so the overlap is intended.
  Message: `Label box <w>x<h> overlaps <type> <bodyId> by <ow>x<oh>.`

### Rule `note-overflow`

Subjects are visible `text.note` elements. The rule repeats the renderer's
values: `paddingX`, `paddingY`, `fontSize`, `lineHeight`, the
`wrapTextLines(...)` lines `n` with wrap width `A = max(1, box.width - 2*paddingX)`,
`freeHeight`, `verticalOffset`, and the drawn line count `d`. A line `j` is
drawn while `paddingY + verticalOffset + (j + 1) * lineHeight <= box.height + EPS`.

The rule makes these findings on the note's id:

1. **Clipped.** Unchanged. This applies when `d < n`.
   Message: `Text needs <n> lines (<paddingY*2 + n*lineHeight> high with padding) but the box is <box.height> high; export drops <n-d> lines.`
2. **Wide line (new, Q2).** This applies to the first drawn line `i < d` with
   `line.trim() !== ""` and
   `W = wideAwareTextWidth(line, fontSize, letterSpacing) > A + EPS`.
   Message: `Text line <i+1> of <n> is <W> wide but the text area is <A> wide at <fontSize>px; export draws it past the note padding.`
3. **Wide wrapped height (new, Q2).** This applies only when finding 1 does
   not (`d === n`). The wide-aware line count is
   `n' = sum of wideAwareLineCount(line, A, fontSize, letterSpacing)` over all
   `n` export lines. `freeHeight'` and `verticalOffset'` are the renderer's
   formulas with `n'` in place of `n`. The finding applies when
   `paddingY + verticalOffset' + n' * lineHeight > box.height + EPS`, which
   means the renderer's own rule would not draw all `n'` lines.
   Message: `Text needs <n'> lines with wide characters at 1 em (<paddingY*2 + n'*lineHeight> high with padding) but the box is <box.height> high; real fonts overflow it.`
   For text without wide graphemes, `n' === n`, so this finding never applies
   where finding 1 did not already.
4. **Into or too close to an element below.** Unchanged, on export geometry.
   The drawn text spans `textTop = box.y + paddingY + verticalOffset` to
   `textBottom = textTop + d * lineHeight`, with `d >= 1` and at least one
   non-empty drawn line.
   - A body item `b` (same body set as `label-collision`, excluding the note
     itself) is *below* when:
     - its x-range overlaps the note box with positive width;
     - `b.y > textTop + EPS`;
     - `b.y < textBottom + paddingY - EPS`.

     The note's own `paddingY` is the required clearance. An auto-height note
     placed flush above another element has a gap of exactly `paddingY`, so it
     is clean.
   - Message when `b.y < textBottom`: `Text runs <textBottom - b.y> into <type> <bodyId> below; keep <paddingY> clear.`
   - Message otherwise: `Text ends <b.y - textBottom> above <type> <bodyId>; keep <paddingY> clear.`

   Rotated notes are not checked for proximity. Findings 1 to 3 still apply
   to them, in local space.

Example for findings 2 and 3: a fixed 120x44 note with the text
`在庫照会サービスの再試行ポリシー` (16 graphemes, 13px, padding 8/6). The export
wraps it into two lines (14 and 2 graphemes) and draws both. Line 1 is 182
wide against `A` 104, which gives finding 2. With 1.0 em widths it needs
`n' = 3` lines (58.8 high with padding) in a box 44 high. The renderer's rule
would stop after the second line (`6 + 3 * 15.6 = 52.8 > 44`), which gives
finding 3.

### Spatial prefilter and determinism

Pair checks (label vs label, label vs body, note probe vs body) use a single
sort-and-sweep along x:

1. Collect items as `{ box, kind, order }`. A note probe uses
   `[box.x, textTop, box.width, textBottom + paddingY - textTop]`.
2. Sort them by `box.x`, then by `order` (the page index).
3. Keep an active list from which items whose right edge is `< current.x` are
   removed.
4. Test the y-overlap only against active items.

The cost is O(n log n + candidate pairs). No step uses regex splitting beyond
what `wrapTextLines` already does, and every label is laid out once. The
wide-aware checks add linear work per drawn line.

Output order:

1. elements in page order (the index of the finding's `elementId` in
   `getPageElements`);
2. then `TEXT_LAYOUT_LINT_RULE_IDS` order;
3. then `message` with `localeCompare`.

Exact duplicates are dropped, as `lintBpmnPage` does.

## CLI: `nodetto-cli lint`

`apps/cli/src/commands.ts` `lintCommand`:

- The page filter is `bpmn || breadboard || TEXT_LAYOUT_LINT_PAGE_KINDS.includes(kind)`,
  in document page order. Without `--page`, architecture, freeform and
  flowchart pages are linted alongside BPMN and breadboard pages. With
  `--page`, a page of any of those kinds resolves. Other kinds still fail
  through the existing `selectPage` message.
- `LINT_NO_PAGES` becomes
  `The document contains no BPMN, breadboard, architecture, freeform or flowchart pages.`
- In the report mapping, `page.kind === "bpmn"` goes to `lintBpmnPage`,
  `"breadboard"` to `lintBreadboardPage`, and every other selected page to
  `lintTextLayoutPage`, which returns `{elementId, severity, message, ruleId}`.
- `.bpmnlintrc` / `--config` discovery is unchanged. It is keyed on
  `hasBpmn`, so a run with no BPMN page never reads a config. `--config` is
  never applied to text-layout findings.
- Text output, the JSON shape (`input`, `pages[] {pageId, pageName, findings[] {elementId, severity, message, ruleId}}`,
  `summary`) and exit codes (0 clean or warnings only, 1 error findings, 2
  usage, parse or config) are unchanged. No new JSON field is added. Measured
  and available sizes are carried only in `message`. Text-layout findings
  are always `warning`, so they never make lint exit 1.
- A clean page of one of the three kinds gives empty stdout and exit 0
  (text). `--format json` still prints the report.

Known consequences (intended, Q1):

- A document whose only pages are freeform or flowchart pages no longer
  fails with `LINT_NO_PAGES`. It lints, with exit 0. An empty freeform page
  is clean.
- A document that mixes BPMN or breadboard pages with pages of the three
  kinds gets those pages in the lint report. Text output adds
  `page <name> (<id>)` headers when more than one page has findings, and the
  JSON `pages[]` gains entries. BPMN and breadboard findings and their order
  do not change.

## CLI: `nodetto-cli export`

`apps/cli/src/export-command.ts`, in the svg/png/pdf branch, after
`svg === null` is ruled out:

- When `elementId === undefined` and `page.kind` is in
  `TEXT_LAYOUT_LINT_PAGE_KINDS` (now architecture, freeform and flowchart),
  the layout warnings are `lintTextLayoutPage(loaded.document, page.id)`
  mapped to `warning: <ruleId> <elementId>: <message>\n`. This follows the
  `warning: <kind> <subject>: <message>` form of `warningLines`, so
  `grep 'warning: label-overflow'` works. Otherwise they are `""`. The code
  already reads the constant, so only the constant changes.
- Every later use of the document warnings in that branch includes the
  layout warnings: SVG to stdout, `Wrote <file>.`, the raster or PDF
  `Wrote ... (page ...)` line, and `Cannot export:` and `Cannot write`
  failures. The warnings precede the `Wrote` line, as the existing document
  warnings do.
- Exit code, stdout and the written bytes are unchanged. No `--strict` is
  added.

## Native CLI

The native host runs the same TypeScript command bundle in Boa, so lint and
export get the new behavior with no Rust change. `Intl.Segmenter` is the
native `graphemes` shim, and `String.prototype.codePointAt` is standard.
`apps/cli/native/src/engine.rs`, `render.rs` and `engine_tests.rs` stay
unchanged.

Performance relies on the O(n log n) sweep, on laying out each label only
once, and on the O(1)-fast-path / binary-search width lookup. The existing
dense parity case covers it.

## Help text and CLI docs

- `help.ts` overview line (:29) and `lint` (:479): `Lint BPMN, breadboard,
  architecture, freeform and flowchart pages ...`. The paragraph that starts
  `Architecture pages are checked for text layout` names all three kinds.
  It keeps the three rule descriptions and adds one sentence: East Asian wide
  and fullwidth characters (CJK, kana, hangul, fullwidth forms) are measured
  at 1 em, so the lint reports lines that real fonts clip even when export
  geometry fits. `findings match what export renders` becomes
  `findings match export geometry, except for that wide-character width`.
  The exit-code line is unchanged.
- `help.ts` `export` (:395): `SVG, PNG and PDF exports of a whole
  architecture, freeform or flowchart page print text-layout lint findings
  ...`. The rest is unchanged.
- `docs/cli.md` (:35-40): the same two facts. `lint` checks BPMN,
  breadboard, architecture, freeform and flowchart pages. Wide characters are
  measured at 1 em. Whole-page SVG, PNG and PDF exports of those three kinds
  print the findings as `warning:` lines.

## Test plan

All fixtures are self-authored and generic. They are built with `Editor` in
the TS fixture module `apps/cli/src/__fixtures__/text-layout.ts`. No golden
JSONL is added under `packages/io/src/__fixtures__`, so the per-fixture parity
loop does not grow.

Existing fixtures, unchanged. `textLayoutProblemDocument(kind)` and
`textLayoutCleanDocument()` default to an `architecture` page. Their content
has no wide graphemes, so `TEXT_LAYOUT_EXPECTED` and every existing message
stay the same:

- **clean:** a "Payment gateway" node 200x60, edges "HTTPS" and "gRPC" well
  apart, and two auto-height notes stacked flush.
- **wrapped-fits:** "Payment gateway authorisation service" in a node 140x80.
  It wraps to 3 lines, and there is no finding.
- **clipped:** the same label in a node 140x30, which gives a height finding,
  and "Payment gateway" in a node 24x60, which gives a width finding. Add a
  `shape.geo` rectangle with the same overflowing label.
- **collision:** two edges labelled "HTTPS" and "gRPC" whose route midpoints
  coincide, and one edge whose label lies on a third, unrelated node.
- **enclosing zone:** a "Private network" `shape.geo` rectangle that encloses
  a labelled edge and its endpoints. There is no collision finding.
- **notes:** a fixed-height "Retry policy" note too short for its text
  (clipped), and a note whose text runs into a note placed 4 units below its
  last line.

New fixture `textLayoutWideDocument(kind = "architecture")` with an exported
`TEXT_LAYOUT_WIDE_EXPECTED`:

- `node-wide`: `node.generic` 140x60, label `在庫照会サービス（試験運用中）`.
  It gets one `label-overflow` width finding:
  `Label line 1 of 1 is 195 wide but the text area is 120 wide at 13px; export clips it.`
- `node-ascii`: `node.generic` 140x60, label `Payment gateway` (the same
  grapheme count). It gets no finding.
- `geo-wide`: `shape.geo` rectangle 140x60 with the same CJK label. It gets
  one `label-overflow` width finding ending `export draws it past the label
  padding.`
- `note-wide`: fixed `text.note` 120x44 with `在庫照会サービスの再試行ポリシー`.
  It gets two `note-overflow` findings (wide line, wide wrapped height).

Elements are placed far apart, so there are no collision or proximity
findings. Exact numbers are pinned by the fixture test against the real lint.

Tests:

- `packages/core/src/wide-text-width.test.ts` (new):
  - `isWideCodePoint` is true for U+1100, U+3000, U+3001, U+3042, U+30A2,
    U+4E00, U+AC00, U+FF08, U+FF09, U+FFE0, U+1F600 and U+20000;
  - it is false for U+0041, U+00E9, U+2026 (Ambiguous), U+0410 and U+FF61
    (Halfwidth);
  - it is false just outside the ends of a few table ranges;
  - the table is sorted, its pairs are well-formed, and it has no overlap;
  - `wideAwareTextWidth` equals `estimatedTextWidth` (`toBe`) for ASCII,
    accented Latin and an emoji ZWJ sequence starting with a narrow code
    point;
  - `wideAwareTextWidth` returns 195 for the 15-grapheme CJK label at 13px,
    and `letterSpacing` applies per grapheme;
  - `wideAwareLineCount` returns 1 for the empty line and for an ASCII line
    from `wrapTextLines`, and the expected count for CJK lines.
- `packages/core/src/text-layout-lint/rules.test.ts`:
  - the existing cases are unchanged;
  - the four wide-fixture subjects above;
  - an agreement test: `renderPageSvg` of the wide fixture draws `node-wide`'s
    label as a single `<text>` line inside the text area (the export fits it),
    while the lint reports it;
  - the note wide-height finding respects `verticalAlign` `middle` and
    `bottom`.
- `engine.test.ts`: `TEXT_LAYOUT_LINT_PAGE_KINDS` equals
  `["architecture", "freeform", "flowchart"]`. The rest is unchanged.
- `apps/cli/src/text-layout-lint.test.ts`:
  - the freeform-not-lintable test becomes "freeform and flowchart pages are
    lintable and selectable". `lint` on the problem document as `freeform`
    and as `flowchart` gives the same findings as `architecture`, and
    `--page Notes` resolves a freeform page;
  - a `uml` page document fails with the new `LINT_NO_PAGES`, and `--page`
    on a `uml` page fails;
  - the wide fixture in text and JSON.
- `apps/cli/src/text-layout-export.test.ts`:
  - the byte-equality reference and the "no layout warnings" case switch
    from `freeform` to `uml`;
  - a new case: whole-page SVG export of the problem document as `freeform`
    and as `flowchart` prints the same `warning:` lines as `architecture`,
    with identical SVG bytes;
  - the wide fixture prints `warning: label-overflow node-wide:` and no
    `node-ascii` warning.
- `apps/cli/src/breadboard-commands.test.ts:141-160`: the no-page document
  becomes a `uml` page, and the two expected strings become the new
  `LINT_NO_PAGES`.
- `apps/cli/src/native-parity.test.ts`: append one new `nativeTest` block.
  Existing blocks and budgets are unchanged. It writes `wide.jsonl`,
  `problem-freeform.jsonl` and `problem-flowchart.jsonl` to a temp dir and
  runs `compare` for `lint`, `lint --format json` and `export --format svg`
  on each. It also runs `lint --page Architecture` on the flowchart file,
  since the fixture page name is kept. It asserts that native stderr for
  wide export contains `warning: label-overflow node-wide:` and not
  `node-ascii`, and that flowchart export stderr contains
  `warning: label-overflow node-clipped:`. Budget: 120000, with a comment
  giving the launch count. The block is named
  `native CLI matches text-layout lint on wide labels, freeform and flowchart pages`,
  so a filtered run (`-t`) and a JUnit report can prove that it ran and
  passed. See "Verification commands".

Existing `commands.test.ts`, `bpmn-commands.test.ts`,
`export-command.test.ts`, the golden-fixture parity loops and every
SVG/PNG/PDF export golden or snapshot test stay unchanged. This proves the
export bytes are unchanged. If another existing assertion on lint or export
stderr changes for a freeform or flowchart page, the change must be
recorded with its reason in the owning plan's progress log. Export byte
assertions must never change.

Boundary checks (verification commands, not tests). Each exits 0 on a
correct tree:

- `grep -rln "wide-text-width" packages apps --include='*.ts'` lists only
  `packages/core/src/text-layout-lint/rules.ts` and
  `packages/core/src/wide-text-width.test.ts`. The `'*.ts'` pattern is
  quoted, because zsh fails on an unquoted glob that matches nothing.
- `git diff --exit-code fd2083b -- packages/core/src/svg-export packages/core/src/text-layout.ts packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/core/src/wide-text-width.ts packages/core/src/index.ts packages/io apps/cli/native Cargo.toml Cargo.lock`
  prints nothing. `fd2083b` is the base of the finishing run. The renderer,
  `wrapTextLines`, the width helper, the core index, `packages/io`
  (including `packages/io/src/bpmn`) and the native host stay as they are.

Verification commands. Every command must exit 0 at the gate of the plan
that lists it. See "Rollout constraints" for which plan lists which
command.

- `bun test packages/core packages/io apps/cli/src`. This covers the core
  rules, the width helper, the export golden and snapshot tests and every
  CLI test. Without `NODETTO_CLI_TEST_BINARY`, only the `nativeTest` blocks
  skip. `BUN_OPTIONS=--jsx-runtime=classic` may be prefixed, as earlier
  runs did. The result is the same.
- `mise run lint-ts`
- `mise run check` (runs `bun run typecheck` and `cargo check --workspace`)
- `CARGO_TERM_QUIET=true mise run test-cli`. This builds the release binary
  and runs all of `bun test apps/cli/src` with `NODETTO_CLI_TEST_BINARY`
  set. It exits 0, and its log has a line ending in ` 0 fail` (the bun
  summary).

Native evidence format. Bun 1.4.4 runs in quiet agent mode in this
environment. A log redirected to a file has no per-test `(pass)` or
`(skip)` lines, only `(fail)` blocks and summary lines: ` <N> pass`,
` <N> skip` (only when N > 0) and ` <N> fail`. The s552 logs under
`tmp/text-layout-lint-s552/tll-09-core-rules/` confirm this, for example
`core-all-final.log`: ` 1452 pass`, ` 4 skip`, ` 0 fail`. No gate may
depend on per-test console lines, and no gate may depend on unsetting
agent environment variables. The native parity evidence uses only the
summary lines and a JUnit report. Every check below exits 0 on a correct
tree:

- Without the binary,
  `bun test apps/cli/src/native-parity.test.ts > parity-skip.log 2>&1` exits 0,
  and `grep -E '^ *[1-9][0-9]* skip$' parity-skip.log` exits 0. This shows
  that the skip summary is detected when native blocks skip. It is the
  baseline that gives the no-skip check below its meaning.
- With the binary set, the full
  `bun test apps/cli/src/native-parity.test.ts > parity-native.log 2>&1` exits 0;
  `test -z "$(grep -E '^ *[1-9][0-9]* skip$' parity-native.log)"` exits 0
  (no skips); and `grep -E '^ *[1-9][0-9]* pass$' parity-native.log` exits 0
  (non-zero tests ran).
- With the binary set, the filtered run
  `bun test apps/cli/src/native-parity.test.ts -t 'native CLI matches text-layout lint on wide labels' > parity-new.log 2>&1`
  exits 0, and `grep -Ex ' *1 pass' parity-new.log` exits 0. Exactly the
  new block ran and passed.
- With the binary set, the same filtered run with
  `--reporter=junit --reporter-outfile=parity-new.xml` exits 0, and
  `grep -F 'name="native CLI matches text-layout lint on wide labels, freeform and flowchart pages"' parity-new.xml`
  exits 0. This is the JUnit report evidence for the passing block. The
  `name` attribute of `<testcase>` is the standard JUnit form, and the
  block name has no XML-escaped characters. Each JUnit run is a separate
  invocation, so the summary checks never depend on how bun's console
  output behaves when a reporter is active.

Unrelated skips outside `native-parity.test.ts` (for example the 4 skips
under `packages/core`) are not counted, because every skip and pass check
reads a log of `native-parity.test.ts` alone.

## Rollout constraints

- Do not touch `packages/io/src/bpmn`, renderer files under
  `packages/core/src/svg-export/`, or `label-layout.ts`, `node-label.ts` and
  `text-note.ts` (read-only reuse). In `text-layout.ts`, the only changes are
  the additive `estimatedTextWidth` export (first version) and the `export`
  keyword on `graphemes` (this revision).
- No change under `apps/cli/native/**`, `Cargo.toml` or `Cargo.lock`. No
  new golden JSONL.
- No version bump, no release, local commits only (`gitPush=false`).
- Rule ids are stable public names. Renaming one is a breaking change for
  check scripts.
- State at the finishing run's base `fd2083b`. The wide-width helper
  (`wide-text-width.ts` and its test), the help text and `docs/cli.md`, and
  the core rule changes in `packages/core/src/text-layout-lint/` (page
  kinds, wide-aware findings, tests, and the CLI fixtures
  `textLayoutWideDocument` and `TEXT_LAYOUT_WIDE_EXPECTED`) are in the tree.
  The core rule changes have not been reviewed. Widening
  `TEXT_LAYOUT_LINT_PAGE_KINDS` already makes freeform and flowchart pages
  lintable, and `commands.ts` and `export-command.ts` already gate on that
  constant. What is left on the CLI side is `LINT_NO_PAGES` and the CLI
  tests. Three CLI tests still encode the architecture-only behavior and
  fail at the base:
  - `text-layout-lint.test.ts` "freeform pages are not lintable or
    selectable";
  - `text-layout-export.test.ts` "layout warnings exclude freeform,
    element, clean and semantic exports";
  - `breadboard-commands.test.ts` "lint reports the combined no-page
    message".
- Plan structure (mandatory). The finishing run has exactly two new plans.
  `tll-09` and `tll-10` are not reused as separate plans, and no plan lists
  a command that is informational, expected to fail, or owned by a later
  plan.
  1. `tll-12-core-cli-lint-export` (one plan, no dependencies). It owns:
     - an item-by-item review of the existing core rule changes
       (`rules.ts`, `engine.ts`, `index.ts`, `rules.test.ts`,
       `engine.test.ts`) against the "Rule `label-overflow`", "Rule
       `note-overflow`", "Spatial prefilter and determinism" and module
       sections. A mismatch is fixed in those files, and the review result
       is recorded in the plan's progress log;
     - the `LINT_NO_PAGES` change in `apps/cli/src/commands.ts`, plus a
       check that the lint page filter, report mapping and `--page`
       selection, and the export gate in `export-command.ts`, match "CLI:
       `nodetto-cli lint`" and "CLI: `nodetto-cli export`";
     - the CLI test updates listed under "Test plan" for
       `text-layout-lint.test.ts`, `text-layout-export.test.ts` and
       `breadboard-commands.test.ts`, and any fixture change they need in
       `apps/cli/src/__fixtures__/text-layout.ts`;
     - a check that `help.ts` and `docs/cli.md` match "Help text and CLI
       docs". They change only if they do not.

     Its gate is the two boundary checks,
     `bun test packages/core packages/io apps/cli/src`, `mise run lint-ts`
     and `mise run check`. Each exits 0 once this plan's own changes are in.
  2. `tll-13-native-parity` (depends on `tll-12`). It owns only the new
     `nativeTest` block in `apps/cli/src/native-parity.test.ts`. Its gate is
     `CARGO_TERM_QUIET=true mise run test-cli` (release build plus all of
     `bun test apps/cli/src` with the binary set, so the `tll-12` changes
     are covered too), the native evidence checks under "Verification
     commands" (summary lines and JUnit report, never per-test console
     lines) and `mise run lint-ts`. All exit 0 once `tll-12` and this
     plan's own block are in. A release build or toolchain failure is
     a blocker for this plan. It is not a reason to skip or weaken the
     gate.

  The dispatch manifest of the finishing run
  (`impl-plans/active/text-layout-lint-s556-dispatch.json`) lists only these
  two plans and only their gate commands.

  `export-command.test.ts`, `commands.test.ts` and `html-export.test.ts`
  export freeform and flowchart pages, but they assert stderr only with
  `toContain`, their elements have no layout findings, or the format is out
  of scope. They stay unchanged. The existing native parity blocks compare
  native stderr with TS stderr, and both run the same bundle, so they stay
  unchanged too.
- Plan archival after final verification follows `impl-plans/README.md`.
  Every `tll` plan, `tll-00` to `tll-13`, moves from `impl-plans/active/`
  to `impl-plans/completed/`. Each archived plan starts with a short status
  note:
  - `tll-00` to `tll-05`: the first version, implemented at 45cc69f;
  - `tll-06` to `tll-08`: the revision overview and accepted plans;
  - `tll-09`: implemented, then reviewed and accepted under `tll-12`;
  - `tll-10` and `tll-11`: superseded by `tll-12` and `tll-13`, and not
    executed as separate plans;
  - `tll-12` and `tll-13`: the finishing plans.

  Progress logs stay in `impl-plans/progress/`. The text-layout dispatch
  manifests (`text-layout-lint-s551`, `-s552`, `-s555` and `-s556`) stay in
  `active/` with their pre-archive `planPath` values, as every other
  historical manifest does. The README gets a Completed entry with a plan
  table for `tll-00` to `tll-13` and the final verification outcomes. The
  README's list of historical manifests in `active/` names the four
  text-layout manifests. After archival, no `tll-*.md` remains in
  `impl-plans/active/`.
