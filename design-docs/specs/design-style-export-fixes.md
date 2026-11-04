# Style clearing, raster glyph fallback and box-label vertical alignment

Status: DESIGNED, 2026-11-05.

Owner decisions: `design-docs/user-qa/style-export-fixes.md`. Each question has
a default that this design implements. A different answer changes only the
section named in that question.

Baseline: `design-docs/specs/design-cli-ai-drawing.md` (edit batches),
`design-docs/specs/design-text-layout-lint.md` (lint rules and export warning
format) and `design-docs/specs/native-hosts.md` (shared engine in Boa). Those
decisions stay as they are.

`design-docs/specs/export.md` sections 3.3 and 3.4 describe a font catalogue and
a vector PDF that the CLI does not have. The CLI facts in this document come from
the code at `29f8691` and take precedence for the CLI raster path: PNG goes
through `apps/cli/src/raster-backend.ts` or `apps/cli/native/src/render.rs`, and
PDF embeds that PNG.

## Overview

| Group | Adds |
| --- | --- |
| G1 | `edit update` follows the documented merge rules for `visual`: objects merge, arrays replace, null removes a key. `strokeDashArray: []` means solid. |
| G2 | Raster export loads a bounded fallback font list when the base fonts lack a glyph. Export warns and `lint` reports `glyph-missing` on any page kind for glyphs no font has. |
| G3 | `visual.style.verticalAlign` positions `node.generic` and `shape.geo` labels once requested through `edit` or the `boxLabelAlign` marker, and documents without the marker render unchanged. `edit add` and `update` reject unknown `visual.style` keys. |

All edit, lint and export logic runs in the shared TypeScript engine. Only font
loading and coverage lookups have separate Bun and Rust implementations.

## G1. Clearing values in `edit update`

### Root cause

- `apps/cli/src/edit/operations/elements.ts:116-125` pushes the raw `visual`
  patch as `updateVisual`.
- `mergeVisual` (`packages/core/src/commands.ts:405`) is a shallow top-level
  merge that keeps null. Two things follow from this:
  - The null or `[]` reaches document validation at
    `packages/ir/src/validate.ts:435-463`.
  - `visual: {style: {stroke: "#123456"}}` replaces the whole stored `style`,
    which contradicts the help text at `apps/cli/src/help.ts:251-252`.
- `deepMerge` (`apps/cli/src/edit/operation-input.ts:48`) returns the patch
  unchanged when the base is not an object. A nested null under a missing parent
  therefore survives, for example `style: {strokeDashArray: null}` on an element
  with no `style`.

### Behavior

Core `updateVisual` and `mergeVisual` do not change, because many app and core
callers depend on them. The change is in the CLI edit layer, in a new module
`apps/cli/src/edit/visual-patch.ts` called through one small hunk in `updateOne`.
It applies these steps to each selected element:

1. **Empty dash.** If `style.strokeDashArray` is an empty array, it becomes null.
   `style.dash` also becomes null unless the patch sets `dash` itself, so that
   `[]` means solid even when a preset is stored. `resolvedStrokeDashArray`
   prefers `strokeDashArray` and falls back to `dash`, so removing only the array
   would leave a preset dash visible. This rule applies to `update` only; `add`
   keeps its current rejection of `[]`.
2. **Lock controls.** If every patch key is `locked` or `hidden`, emit
   `updateVisual` as today, with null mapped to `false`. `permittedCommands`
   (`packages/core/src/editor/transaction.ts:57`) only lets this exact shape reach
   a locked element, so explicit unlocking keeps working.
3. **Everything else.** Emit `replaceVisual` with
   `deepMerge(element.visual, patch)`. Remove `style` when the merge leaves it
   empty. `replaceVisual` is already part of the derived-command pipeline
   (`transaction.ts:113-114`), and `planFrameTranslations` receives both the
   store and the draft. Frame carry must stay unchanged, which
   `apps/cli/src/edit-frame-carry.test.ts` verifies.

`deepMerge` changes so that an object patch over a non-object base merges against
an empty object, which strips nested nulls. This also fixes the same case for
`semantic`.

Validation still happens after the merge, in the existing commands and the batch
validation in `apps/cli/src/edit/apply-batch.ts`.

### Behavior change: style patches merge

Partial `visual.style` patches now keep the other stored style keys, and the same
applies to other nested visual objects. This is the documented behavior and the
request asks for it. It changes results for any caller relying on the old
whole-object replacement. To replace a whole object, send null for its keys or
null for the object in an earlier operation.

### Required fields

`visual` and `visual.style` have no required keys, so required fields exist only
in `semantic` (for example `node.generic` `label`, through `checkString` in
`packages/ir/src/registry/generic.ts:142`).

When a semantic patch contains a null, `updateOne` runs the type's
`validateSemantic` on the merged value. An issue at the path of a nulled key, or
below it, throws:

```text
update cannot remove required field "label" of node.generic
```

Unknown element types skip this check. Removing an optional field needs no new
code.

## G2. Glyph fallback and missing-glyph reports

### Root cause

- Both raster backends load the short `FONT_FILES` list from
  `apps/cli/src/render-profile.ts`, and scan system fonts only if no listed file
  exists and no `--font-dir` is given.
- The only CJK face in that list on macOS is `Hiragino Sans GB.ttc`. The reported
  tofu fits a list where no face has U+246A onward, U+301C or U+FF5E. This is
  inferred and was not reproduced (see "Verification gaps").
- PDF embeds the PNG (`pngToPdf`, and `pdf` in `render.rs`), so PDF inherits every
  PNG result with no separate text path.
- The desktop app has no resvg, usvg or fontdb, so it is out of scope.

### Font sets

`render-profile.ts` gains `FALLBACK_FONT_FILES`, and `FONT_FILES` does not change.
`apps/cli/scripts/build-engine.ts` adds it to `render-profile.json` as
`fallbackFonts`, which keeps a single source for both backends.

Candidates, filtered by file existence at run time:

```text
/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc
/System/Library/Fonts/Supplemental/Arial Unicode.ttf
/System/Library/Fonts/Apple Symbols.ttf
/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc
C:\Windows\Fonts\msgothic.ttc
C:\Windows\Fonts\seguisym.ttf
```

The macOS paths must be confirmed on a Mac during implementation. The macOS
coverage test below fails if the list does not cover the required characters.

Fallback faces load only when the base set lacks a needed glyph, and they load
after the base faces. This has three effects:

- A document whose glyphs are all in the base set renders with exactly today's
  font set, so its raster output cannot change.
- Characters the base set covers keep their current face in documents that do
  need fallback, provided the usvg per-character fallback walks faces in load
  order. The implementer must confirm this (see "Verification gaps").
- The full system scan is never added to a path that does not already have it.

### Coverage contract

`CommandIo` gains one optional synchronous member, because `lint` is synchronous:

```ts
fontCoverage?(text: string, fontDir: string | undefined):
  | { readonly needsFallback: boolean; readonly missing: readonly number[] }
  | undefined;
```

- Only non-ASCII code points are checked. Default-ignorable characters are skipped
  (U+200B-200F, U+2028-202E, U+2060-206F, U+FE00-FE0F, U+FEFF, U+E0100-E01EF).
- ASCII-only text returns `{needsFallback: false, missing: []}` without opening
  a font.
- `needsFallback` means a checked code point is absent from base plus `--font-dir`.
- `missing` lists code points also absent from the fallback faces, sorted and
  unique. Fallback files load only when `needsFallback` is true.
- The result is `undefined` when no `FONT_FILES` entry exists and no `--font-dir`
  is given. That is the system-scan case, and scanning there can take tens of
  seconds. Export then behaves as today with no warning, and lint reports nothing.
- An unreadable or unparsable fallback or `--font-dir` face is skipped.

Implementations:

| Host | Module | Lookup |
| --- | --- | --- |
| Bun | new `apps/cli/src/font-coverage.ts`, wired in `apps/cli/src/local-io.ts` | Reads only the sfnt or TTC directory and the Unicode `cmap` subtables (formats 4 and 12) with ranged reads. Walks `--font-dir` recursively for ttf, otf, ttc and otc. |
| Native | `render::font_coverage` in `render.rs`, host `native.fontCoverage` in `engine.rs`, wired in `apps/cli/src/native-engine.ts` | Loads the same fontdb set as rendering and looks glyphs up through `skrifa`'s charmap. `skrifa` 0.44.0 is already locked through usvg's dependency tree, and it becomes a direct dependency of `nodetto-cli` at that version. The result crosses the host boundary as JSON. |

Text is passed to the host whole, so the per-character scan of a large SVG runs in
Rust and never in Boa.

### Export flow (`export-command.ts`, PNG and PDF only)

1. After `snapSvgFrameToPixels`, call `io.fontCoverage?.(svg, fontDir)`. The SVG is
   the input because it is exactly what will render, including text from keys that
   `textFields` does not treat as display text. Embedded images are base64 and so
   ASCII.
2. Call `renderer.rasterize(svg, scale, fontDir, coverage?.needsFallback === true)`.
   The fourth parameter is a new boolean on `RasterBackend.rasterize`, and existing
   three-argument test backends stay assignable.
3. When `missing` is not empty, add one stderr line per element, in document order
   and without `collapseWarnings`, because the id must be named each time:

   ```text
   warning: glyph-missing <element-id>: no export font has U+246A, U+301C; add a font with --font-dir
   ```

   A line lists at most 16 code points, then `and N more`. Code points that no
   element contains go on a line naming the page:
   `warning: glyph-missing page <page-id>: ...`.

`--quiet` already filters the `warning: ` prefix. SVG and all other formats are
unchanged and do no coverage work.

### Attribution (new `apps/cli/src/glyph-coverage.ts`)

A pure function maps elements and a code-point set to rows of element id and code
points:

- It walks all string values in `semantic`, skipping `design.*` resource elements.
- For lint it also skips `visual.hidden` elements.
- Strings that fail `/[^\x00-\x7f]/.test` are skipped before any per-character
  work. It never uses regex `split`.

### Lint

- `glyph-missing` is a `warning` row per element, with the same code-point list and
  cap as the export warning.
- When `io.fontCoverage` is absent or returns `undefined`, there are no rows.
- `lint` gains `--font-dir <dir>` so its result can match an export that uses the
  same flag.

#### Page eligibility

Glyph coverage has its own eligibility, separate from notation lint:

- **Notation pages** are the result of the current filter at
  `apps/cli/src/commands.ts:291-296` (BPMN, breadboard and
  `TEXT_LAYOUT_LINT_PAGE_KINDS`). That filter and the rules that run on these pages
  stay as they are.
- **Glyph pages** are all of `document.pages`, because `export` can rasterize any
  page (`apps/cli/src/export-command.ts:216-222`).

`glyphRowsByPage(document, io, fontDir)` in `glyph-coverage.ts` returns a map of
page id to rows. It makes one coverage call over the non-ASCII semantic text of the
whole document, so ASCII-only documents open no font. It runs before the
`LINT_NO_PAGES` return at `commands.ts:297`.

Page selection at `commands.ts:297-307` becomes:

| Input | Selected pages |
| --- | --- |
| No `--page` | Notation pages, plus any other page that has glyph rows, in document order. |
| No `--page`, no notation pages, no glyph rows | Today's `LINT_NO_PAGES` failure. |
| `--page` resolving among notation pages | That page, as today. Notation pages take precedence when a query could match both. |
| `--page` that fails among notation pages, but resolves in `document.pages` to a page with glyph rows | That page. |
| `--page` in any other case | Today's error from `selectPage`. |

A non-notation page with no glyph rows is left out, so text and JSON output for
documents with no missing glyphs do not change. Existing failures for such documents
stay failures.

Report assembly at `commands.ts:336-367` changes in one way. The notation engine
dispatch runs only for notation pages, and every selected page then appends its glyph
rows. The final `else` branch at line 359 calls `lintTextLayoutPage`, so without this
guard it would run on ERD and other pages. No notation rule gains a page kind.
`glyph-missing` rows do not change the exit code, because they are warnings.

The hunk stays local to `lintCommand`: the option set, the selection block and the
report dispatch. The sibling branch may widen the notation filter (see
`LINT_NO_PAGES_MESSAGE` in `apps/cli/src/lint-diagram.ts:19`). That merges cleanly as
long as glyph eligibility does not read the filter's page kinds.

## G3. Box-label vertical alignment and unknown style keys

### Scope and default

`verticalAlign` already exists in the IR with the values top, middle and bottom,
in `packages/ir/src/types.ts:271`, `packages/ir/src/validate.ts:657` and
`packages/ir/src/keyOrder.ts:56`. The only IR addition is the opt-in marker described
below.

This work applies it to the two label-bearing box types, `node.generic` and
`shape.geo`, which are the same two types `labelOverflow` checks. Other types keep
their layouts: sequence participants share `centredLabel` but stay centered, and
`text.note` keeps its top default.

### Compatibility contract

Existing documents can already store `verticalAlign` on a box node, and today it has
no effect there. It gets there in these ways:

- `planTextStyles` copies every `TYPOGRAPHY_FIELDS` entry into `visual.style`
  (`packages/core/src/text-styles.ts:272`), and `DEFAULT_TYPOGRAPHY_STYLE` has
  `verticalAlign: "top"`.
- A detached text style keeps its copied fields (`text-styles.ts:255-263`).
- draw.io import writes top and bottom (`packages/io/src/drawio/import.ts:257`).
- An earlier `edit` could set the key.

The stored value alone cannot separate these from a new request, so a new request
also records a marker: `visual.style.boxLabelAlign: true`. The effective alignment is
defined once, in `packages/core/src/label-layout.ts`:

```ts
export function boxLabelVerticalAlign(visual: Visual): "top" | "middle" | "bottom" {
  return visual.style?.boxLabelAlign === true
    ? (visual.style.verticalAlign ?? "middle")
    : "middle";
}
```

A document with no marker therefore renders exactly as it does today, whatever it
stores. No migration runs, and stored values are neither rewritten nor discarded, so
draw.io export keeps writing them.

The marker lives in `style` so that it follows the existing style paths: component
refresh compares the whole `style` (`packages/core/src/component-refresh.ts:59`),
`planTextStyles` keeps non-typography keys (`text-styles.ts:271`), and element copies
carry it. It is additive for older builds, whose reader moves it to `extensions`.

Writing the marker is the edit layer's job, for `node.generic` and `shape.geo` only:

| Patch on `add` or `update` | Stored result |
| --- | --- |
| `style.verticalAlign` set to a value, unbound element | The value and `boxLabelAlign: true`. |
| `style.verticalAlign` set to a value, bound element, patch has no `textStyle` | The value and the marker, and `visual.textStyle` is removed. |
| `style.verticalAlign` set to a value, patch also sets `textStyle` | The link stays and the marker is written. The text style's value wins when `planTextStyles` runs. |
| `style.verticalAlign: null` | Both keys removed. |
| `style.boxLabelAlign: true`, without `verticalAlign` | The marker only. Used to follow a bound text style or a stored value. |
| `style.boxLabelAlign: null` | The marker removed, so the label is centered again. |

Removing the link in the second row matches what the app already does when a
typography field is edited on a bound element
(`packages/core/src/editor/style-text.ts:162-187`). Without it, `planTextStyles`
would overwrite the requested value. The other typography values stay materialized.

Other element types are unaffected, and `text.note` keeps its own handling of
`verticalAlign`, including its top default.

Resulting behavior:

| Element | Marker | Stored or resolved `verticalAlign` | Label |
| --- | --- | --- | --- |
| Legacy, bound to a text style | No | Any | Middle, bytes unchanged |
| Legacy, unbound or detached | No | Any | Middle, bytes unchanged |
| draw.io import | No | Top or bottom | Middle, as today (user-qa Q1) |
| New, unbound or newly detached | Yes | Top, middle or bottom | As requested |
| Bound, following a text style | Yes | The text style's value, re-materialized when the style changes | Follows the style |
| Any box | Yes | None | Middle |

To make a bound box follow a reusable style, use
`update {visual: {style: {boxLabelAlign: true}}}`. A later change to the style's
`verticalAlign` then moves the label through the existing `planTextStyles` flow. SVG,
PNG, PDF, canvas and lint all read `boxLabelVerticalAlign`, so they cannot disagree.

A hand-written JSONL document must include the marker for `verticalAlign` to take
effect on a box node, because it cannot be told apart from a legacy document. Help and
docs state this (user-qa Q1).

IR additions, owned by the G3 layout plan:

- `packages/ir/src/types.ts`: `boxLabelAlign?: boolean` on `VisualStyle`.
- `packages/ir/src/keyOrder.ts`: the key after `verticalAlign` in
  `VISUAL_STYLE_KEY_ORDER`. It must be listed or the reader moves it to `extensions`.
  Being listed also makes it a valid key for the unknown-key check.
- `packages/ir/src/validate.ts`: optional boolean check next to `verticalAlign`.

Edit-layer writes go in `apps/cli/src/edit/visual-patch.ts`, used by `updateOne` and by
`addElement` (`apps/cli/src/edit/operations/add.ts:37`). `addShape` reaches
`addElement` with the resolved type, so shape presets need no separate hunk.

### Geometry

`alignedLabelTop(align, height, contentHeight, padding)` in `label-layout.ts`
returns the offset from the box top to the first line box:

- `top`: `padding`
- `bottom`: `padding + max(0, height - 2 * padding - contentHeight)`

This matches how notes clamp free space, and text that does not fit starts at the
top padding. Vertical padding equals each type's horizontal padding: 10 for
`node.generic` and `TEXT_NOTE_PADDING_X` (8) for `shape.geo`.

`middle` keeps each existing expression unchanged, so its floating-point results
and bytes stay identical.

| Surface | Change |
| --- | --- |
| `packages/core/src/node-label.ts` | `top` uses `alignedLabelTop` unless middle. `renderNode`, `NodeView` and lint already read `layout.top`, so no change is needed in `NodeView`. |
| `packages/core/src/svg-export/paint.ts`, `svg-export/basic-shapes.ts` | `centredLabel` gains an optional `verticalAlign` parameter, default middle. Only `renderGeo` passes `boxLabelVerticalAlign(visual)`. For top and bottom, the first center is `box.y + alignedLabelTop(...) + lineHeight / 2`. |
| `packages/ui-solid/src/shapes/GeoShapeView.tsx` | For top and bottom only, the label div gets inline `align-items: flex-start` and `padding-top: <alignedLabelTop>px`, so it uses the same number as SVG. Middle adds no style, so the DOM is unchanged. |
| `packages/core/src/text-layout-lint/rules.ts` `labelOverflow` | For top and bottom, the vertical check is `top + height > box.height + EPS`, with `top` from the layout or `alignedLabelTop`. Middle keeps today's condition, so existing findings do not change. Other lint geometry is horizontal, or belongs to notes and edge labels. |
| `packages/core/src/index.ts` | One export-list hunk for `boxLabelVerticalAlign` and `alignedLabelTop`. |

PNG and PDF inherit from SVG.

Not changed:

- The inspector's "Vertical align" control stays inside a `text.note`-only `Show`
  (`packages/ui-solid/src/inspector/StyleSection.tsx:894-895`), so it cannot
  misreport a box node. Exposing it for box nodes was not requested.
- The canvas text editor's position (`text-editor-alignment.ts`), code handoff, HTML
  bundle export, and Mermaid and D2 output.
- draw.io export already writes the key.

### Unknown `visual.style` keys

`apps/cli/src/edit/operation-fields.ts` gains `checkVisualStyleFields`, called from
`checkOperationFields`, so it runs before any operation is applied. It applies to
`add` and `update` when `visual.style` is an object.

- **Valid keys.** `VISUAL_STYLE_KEY_ORDER.keys` plus `extensions`, the bag that
  `warnUnknownFields` also allows. No second key list. The key order is already
  exported from `@nodetto/ir` (`packages/ir/src/index.ts:55`).
- **Null values.** A null value for an unknown key is also rejected. Parsed
  documents hold no inline unknown keys, because the reader moves them to
  `extensions`, so there is nothing for it to remove.
- **Document loading.** Documents that are only read or validated keep the existing
  warning path.

The existing `checkFields` matcher cannot suggest `verticalAlign` for either
example key: `textVerticalAlign` is at distance 4 and `valign` at distance 7. So
this check has its own case-insensitive ranking, and `checkFields` and its messages
stay unchanged. A candidate qualifies when any of these holds:

- edit distance is 2 or less
- either name contains the other
- the unknown key is a subsequence of the candidate

Up to three candidates are shown, ordered by distance and then key order:

```text
unknown visual.style key "valign". Did you mean "verticalAlign"? Valid style keys: fill, ...
```

`connect` is left out because the request names only `add` and `update` (user-qa
Q2).

## Docs

- `apps/cli/src/help.ts` and `docs/cli.md`: `verticalAlign` for box nodes and the
  `boxLabelAlign` marker, removal of a bound box's text-style link, the null and `[]`
  rule, merge behavior of `visual`, unknown-key rejection, `glyph-missing` on any page
  kind, and `lint --font-dir`.
- Only small localized hunks, with no reformatting.

## Test plan

All fixtures are self-authored, with neutral labels such as `Idle` and `Running`.

**G1 (`apps/cli/src/edit/*.test.ts`, native parity):**

- A dashed `node.generic` becomes solid with null and with `[]`.
- `[]` also clears a stored `dash`, and an explicit `dash` in the same patch wins.
- Null under a missing `style` is accepted.
- Partial `style` patches keep other keys.
- Removing the last style key removes `style`.
- Other optional style, visual and semantic fields clear with null.
- Removing `node.generic` `label` gives the required-field error.
- A locked element can still be unlocked with `locked: false` and `locked: null`.
- `edit-frame-carry.test.ts` passes unchanged.

**G2:**

- `font-coverage` unit tests use a sfnt built in the test, with cmap formats 4 and
  12 and a TTC wrapper.
- Using plane 15 private-use code points such as U+F0000, on every OS:
  - export warns with the element id and code points
  - `lint` reports `glyph-missing` in text and JSON
  - both behave the same in Bun and native
- Using `--font-dir` with the built font, on every OS: the warning and the finding
  disappear for the code points it covers.
- Lint page eligibility, in text and JSON, in Bun and native (the native runs use the
  release binary through `NODETTO_CLI_TEST_BINARY`):
  - An ERD-only document with `node.generic` id `widget-label` holding U+F0000 exits 0
    and reports `glyph-missing` for `widget-label`.
  - An ERD-only document with no missing glyphs keeps today's `LINT_NO_PAGES` failure.
  - A mixed freeform and ERD document keeps the freeform notation findings and adds the
    ERD page's glyph row. An overflowing ERD label gets no `label-overflow`, which shows
    no notation engine ran there.
  - The ERD page of that document is absent from the JSON `pages` list when it has no
    glyph rows.
  - `--page` naming the ERD page reports its row when it has one, and gives today's
    error when it has none.
  - `--page` naming a notation page reports only that page.
- Existing `LINT_NO_PAGES` assertions pass unchanged
  (`apps/cli/src/breadboard-commands.test.ts:147,155`,
  `apps/cli/src/text-layout-lint.test.ts:121`).
- On macOS only (`skipIf` elsewhere): circled numbers 1 to 20, U+301C and U+FF5E
  report nothing missing, and the PNGs for two different characters such as U+246A
  and U+246B differ. Identical bytes would mean tofu.
- Injected `io.fontCoverage` tests:
  - `needsFallback` reaches `rasterize`
  - ASCII-only text passes `false`
  - `undefined` gives no warning and no fallback
- `export-determinism.test.ts` passes unchanged.

**G3:**

- Unit tests for `boxLabelVerticalAlign` and `alignedLabelTop`, including overflow.
- Legacy byte identity, SVG for both box types. These all produce bytes identical to
  a box with no `verticalAlign`, and no `boxLabelAlign` is written by loading or saving:
  - unbound storing top, middle or bottom, without the marker
  - bound to a text style storing top or bottom, without the marker
  - detached from a text style, keeping a copied value, without the marker
  - imported from draw.io with top or bottom alignment
- New alignment, SVG and `nodeLabelLayout` or `alignedLabelTop` values for both box
  types: `top` and `bottom` place the expected first and last lines, with padding 10
  for `node.generic` and 8 for `shape.geo`.
- Edit writes, in Bun and native:
  - `add` and `update` with `verticalAlign` on an unbound box write the marker and move
    the label.
  - `update` with `bottom` on a bound box removes the link, keeps the other typography
    values and renders at the bottom.
  - `boxLabelAlign: true` on a box bound to a style whose value is `bottom` renders at
    the bottom, and changing the style moves the label.
  - `verticalAlign: null` removes both keys and returns to middle.
  - A `text.note` gets no marker, keeps its top default and keeps its text-style link.
- `labelOverflow` uses the effective alignment: it flags clipped top and bottom labels
  with the marker, and results without the marker do not change.
- `GeoShapeView` inline style through a pure helper in `packages/ui-solid/src/shapes`
  with a `.test.ts`, matching `bpmn-primitive.test.ts` and the other view tests
  there.
- Unknown keys: `textVerticalAlign` and `valign` both suggest `verticalAlign`,
  `extensions` is accepted, and `add` with a `shape` preset is covered.
- Existing golden fixtures pass without regeneration.

**Final:** `mise run verify` and `mise run test-cli`, with a 3-attempt retry for
native deadline timeouts, comparing CPU time through `/usr/bin/time -p` against the
pre-change binary. Time the native CLI on a realistic document with CJK labels for
both export and lint. Run `cargo fmt` with
`--manifest-path apps/cli/native/Cargo.toml` after Rust changes.

## Verification gaps

Design-time checks were static only. Running the CLI needed approval that this
session did not have, and listing `/System/Library/Fonts` and reading the cargo
registry were blocked. So:

- G1 and G2 root causes come from reading code and were not reproduced.
- The fallback font paths and their coverage are unconfirmed.
- The usvg and resvg-js per-character fallback, including its face order, is
  unconfirmed. The first G2 implementation step must confirm it with the macOS PNG
  test. If it does not hold, stop and report rather than building a text-run
  splitter, which this design does not include.

## Rollout constraints

- Everything is additive except the requested behavior changes: rejected unknown
  style keys, and deep-merged `visual` patches in `update`.
- No document migration and no schema version change. Documents without
  `boxLabelAlign` render byte-identically.
- Editing `verticalAlign` on a bound box removes that element's text-style link, as the
  app already does for typography edits.
- A sibling branch from the same base changes edit selectors and lint wiring. Expect
  conflicts in `apps/cli/src/edit/operations/elements.ts` and
  `apps/cli/src/commands.ts`, and keep those hunks to a few lines.
- `lintDiagramPages` is not called from `commands.ts` at this base. If the sibling
  wires it in, keep `glyph-missing` in the report assembly so it runs for both.

## Plan partition

Wave 1, with no dependencies between plans:

| Plan | Scope | Files |
| --- | --- | --- |
| G1 and unknown keys | Edit layer | `apps/cli/src/edit/visual-patch.ts`, `operation-input.ts`, `operation-fields.ts`, `operations/elements.ts`, tests |
| G2 | Fonts, coverage, export, lint | `render-profile.ts`, `raster-backend.ts`, `font-coverage.ts`, `glyph-coverage.ts`, `local-io.ts`, `native-engine.ts`, `export-command.ts`, `commands.ts`, `scripts/build-engine.ts`, `native/src/render.rs`, `native/src/engine.rs`, `native/Cargo.toml`, `Cargo.lock`, tests |
| G3 layout | IR marker, core and canvas | `packages/ir/src/types.ts`, `keyOrder.ts`, `validate.ts`, `label-layout.ts`, `node-label.ts`, `svg-export/paint.ts`, `svg-export/basic-shapes.ts`, `text-layout-lint/rules.ts`, `core/src/index.ts`, `GeoShapeView.tsx`, tests |

Wave 2, one plan that depends on the G1 plan (`visual-patch.ts`) and the G3 layout plan
(the marker in the IR and `boxLabelVerticalAlign`):

- Edit-layer marker writes and link removal: `apps/cli/src/edit/visual-patch.ts`,
  `operations/add.ts`, and the edit-write tests.
- Shared wiring: `apps/cli/src/help.ts`, `docs/cli.md` and any `README.md` hunk.
- The final verification.
