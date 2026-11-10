# Slide area and Copy shapes from page

Status: design for implementation. It extends
`design-docs/specs/design-presentation.md`, which stays the baseline for the
slideshow. Everything there still holds unless this document changes it.
Scope: the public `nodetto-app` repository only (`packages/ir`, `packages/io`,
`packages/collab`, `packages/core`, `packages/ui-solid`, `apps/desktop`,
`apps/cli`, `docs/`, `README.md`). No server, auth or deployment code.

Owner decisions with a default already applied are in
`design-docs/user-qa/slide-area-copy-shapes.md`.

## 1. Goals and non-goals

Goals:

- (A) An explicit document slide size, with an optional slide origin per
  page. When the size is set, each slide is exactly that rect, and
  presentation clips to it.
- (A) A non-interactive slide-area overlay on the editor canvas, controlled
  by a "Show slide area" view preference.
- (A) Inspector controls for the slide size (a preset or a custom size) and
  for the page origin.
- (B) "Copy shapes from page..." in the desktop UI, plus
  `copyPageElements` on the editor facade and the
  `nodetto-cli pages copy-shapes` CLI command.

Non-goals:

- A "Fit to slide" / zoom-to-slide action (deferred, user-qa Q6).
- A keyboard shortcut for copy shapes.
- A slide size per page.
- Slide-size-aware SVG/PNG/PDF export.
- Changes to the slideshow keys or navigation.
- Copying page-level fields (name, mode, tokens, routing) with copy shapes.

## 2. Data model

### 2.1 IR (`packages/ir/src/types.ts`, `validate.ts`)

- New exported type `SlideSize { readonly width: number; readonly height: number }`.
- `Document` gets `readonly slideSize?: SlideSize`. Absent means "no explicit
  size", and the fallback in section 4.1 applies.
- `Page` gets `readonly slideOrigin?: { readonly x: number; readonly y: number }`.
  Absent means `(0, 0)`. The origin is only used while the document has a
  `slideSize`, but it is kept and round-tripped either way.
- Validation:
  - `slideSize` at path `slideSize` must be a plain object (else
    `type.object`). `width` and `height` must be finite numbers with
    `1 <= v <= 100000` (else `range.slideSize` at `slideSize.width` or
    `slideSize.height`).
  - `slideOrigin` at `pages[i].slideOrigin` must be a plain object (else
    `type.object`). `x` and `y` must be finite numbers with
    `|v| <= 1000000` (else `range.slideOrigin`).
  - Extra keys inside either object are errors (`type.unknown`), so the
    canonical form stays exact.
- No schema-version bump and no migration.

### 2.2 JSONL (`packages/io/src/jsonl/records.ts`, `parse.ts`)

- Append `"slideSize"` to `DOCUMENT_RECORD_KEYS` after `"title"`. Give
  `DOCUMENT_RECORD_ORDER` the child order `slideSize: { keys: ["width", "height"] }`.
- Append `"slideOrigin"` to `PAGE_RECORD_KEYS` after `"hiddenInPresentation"`.
  Give `PAGE_RECORD_ORDER` the child order `slideOrigin: { keys: ["x", "y"] }`.
- `parse.ts` copies each key only when it is present, in the same pattern as
  `hiddenInPresentation` (page) and `title` (document). `serialize.ts` does
  not change: `flatten` writes every present field.
- Byte-identical round trip: the reader never adds, defaults or normalizes
  either key. A file without them writes back byte-identically.
- Older readers already move unknown document and page keys into
  `extensions` and write them back, so older builds keep both fields.

### 2.3 Store (`packages/core/src/store.ts`)

- `DocumentMeta` gets `readonly slideSize?: SlideSize`. `loadDocument`
  copies it when present, and `getSnapshot` / document export emit it when
  present (the same conditional spread as `extensions`). This keeps
  `Editor` load/serialize lossless, which the CLI relies on (section 6.4).
- `StoreCommit` gets `readonly meta?: DocumentMeta`. A commit carrying it
  replaces the meta and reports `pagesChanged: true`. That field is already
  documented as "page list or document metadata".

## 3. Editing commands

### 3.1 New Command kind `updateDocument` (explicit exception)

No existing command changes document-level fields. `Store.meta` is set only
by `loadDocument`, and collab writes `meta` only when it seeds. A document
field that can be undone and shared live therefore needs one new kind:

```text
{ type: "updateDocument"; document: { slideSize?: SlideSize | null } }
```

- Handler (`packages/core/src/commands.ts`): a `SlideSize` object sets the
  field and `null` removes the key. An invalid value fails with
  `CommandError` using the section 2.1 codes at `document.slideSize`. An
  omitted key keeps the previous value.
- Inverse: when the patch carries the key, the inverse is
  `{ type: "updateDocument", document: { slideSize: previous ?? null } }`.
- This is the only new kind. It must be stated in the final summary: the
  private `nodetto-cloud` sync Worker switches exhaustively over `Command`
  and needs one new case when it bumps this submodule. That repository is
  out of scope here. The alternative that adds no new kind is user-qa Q1.

### 3.2 `updatePage` gets `slideOrigin`

- The patch type gets `readonly slideOrigin?: { x: number; y: number } | null`.
  `null` removes the key. It is validated as in section 2.1, the inverse
  follows the `hiddenInPresentation` pattern, and omitting the key keeps
  the previous value.

### 3.3 How the UI edits

There are no new facade setters. The inspector calls the public
`editor.apply([...])` with one command, as `Layers.tsx` already does. It
applies nothing when the new value equals the current one. Each change is
one undo entry.

## 4. Core presentation additions (`packages/core/src/presentation/`)

All of these are pure TypeScript. They take structural inputs, so they do
not depend on the section 2 IR change landing first, and each has a
co-located test. The module's own `index.ts` exports them. The core barrel
already re-exports `./presentation/index.ts`, so `packages/core/src/index.ts`
does not change.

### 4.1 `slide-rect.ts`

```text
resolveSlideRect(store, registry, pageId, input: {
  slideSize?: SlideSize; slideOrigin?: { x; y }
}, isHidden?) -> SlideRect | null
SlideRect = { kind: "explicit" | "artboard" | "content"; x; y; width; height;
              frameId?: ElementId }
```

- When `slideSize` is given, the result is `explicit` with
  `x = slideOrigin?.x ?? 0`, `y = slideOrigin?.y ?? 0` and the size from
  `slideSize`. This holds even for an empty page. Frames are ignored.
- Otherwise it calls `slideSource(...)`, which is unchanged:
  - `artboard`: the frame's bounds from `viewBounds(store, [frameId], context)`,
    as `kind: "artboard"`.
  - `page`: the union bounds of the page's elements, as `kind: "content"`.
  - Missing bounds (an empty page, or a frame without bounds that falls back
    to content bounds that are also missing) give `null`.
- With no `slideSize`, presentation behavior stays exactly as it is today.
  The presentation controller (`packages/ui-solid/src/presentation/controller.ts`)
  keeps the existing path for those slides.

### 4.2 `slide-size.ts` (presets)

`SLIDE_SIZE_PRESETS` (in this order):

| id | label | size |
| --- | --- | --- |
| `16:9` | 16:9 | 1920 x 1080 (default when enabled) |
| `4:3` | 4:3 | 1024 x 768 |
| `16:10` | 16:10 | 1920 x 1200 |
| `a4-landscape` | A4 landscape | 1123 x 794 (A4 at 96 dpi, user-qa Q2) |

- `DEFAULT_SLIDE_SIZE` is the 16:9 entry.
- `slideSizePreset(size)` returns the matching preset id, or `"custom"` when
  no preset matches exactly.

### 4.3 `labels.ts`

`slideLabel(pagesInTabOrder, pageId)` returns:

- `"Hidden from presentation"` when the page is flagged.
- Otherwise `"Slide n / total"`. Here `n` is the page's 1-based index in
  `slideList(pages)` and `total` is that list's length.
- `null` for an unknown page.

## 5. Editor UI (`packages/ui-solid`)

### 5.1 Slide-area overlay

- Pure model, `packages/ui-solid/src/canvas/slide-area.ts`:
  `slideAreaModel({ rect: SlideRect | null, label: string | null, show: boolean })`
  returns `{ rect, label, dim: rect.kind === "explicit" } | null`. It
  returns `null` when `show` is false or `rect` is `null`.
- Component, `packages/ui-solid/src/canvas/SlideAreaOverlay.tsx`:
  - Mounted inside the existing `nodetto-overlay-layer` `<svg>` in
    `Canvas.tsx`. Page coordinates go through the same camera transform that
    `SelectionOutlines` uses, so the overlay scales with zoom.
  - It draws a dashed outline of the rect with
    `vector-effect: non-scaling-stroke`, and a small label above the rect's
    top-left corner at a constant screen size.
  - When `dim` is set, an even-odd path covers the visible viewport outside
    the rect at a low opacity (`rgba(0,0,0,0.06)`).
  - The root has `pointer-events: none` and the class `nodetto-slide-area`.
  - It recomputes from the editor revision signal and the current page.
- Never exported or hit-tested:
  - Export, thumbnail and presentation rendering all go through the core
    renderers (`renderPageSvg`, `renderArtboardSvg` and the
    `exportPageSvgOf` path). They never read the DOM, so the overlay cannot
    appear there.
  - Hit-testing is core geometry over store elements, and the overlay is not
    an element. `pointer-events: none` also stops DOM targeting.
  - A test asserts that `renderPageSvg` for a document with `slideSize`
    contains no `nodetto-slide-area`.
- `NodettoCanvasProps` gets the optional prop `readonly showSlideArea?: boolean`,
  next to `showGrid`.
  - Omitted (`undefined`) means automatic: the overlay is shown iff
    `editor.store.getMeta().slideSize !== undefined`.
  - `true` or `false` forces it on or off.
  - Because the prop is optional, the existing `App.tsx` `NodettoCanvas`
    callers (lines 687, 855, 926) keep typechecking unchanged through
    wave 2. Only the wiring plan passes the persisted value (section 7).
  - The pure model takes the resolved boolean:
    `show = props.showSlideArea ?? (slideSize !== undefined)`. A small
    exported helper, `effectiveShowSlideArea(pref, slideSize)` in
    `slide-area.ts`, computes it, and both Canvas and the desktop menu
    checkbox use it.

### 5.2 Presentation clipping (`packages/ui-solid/src/presentation/controller.ts`)

The controller owns slide rendering and fitting. `PresentationView.tsx`
only calls `controller.slide()` and `controller.layout(viewport)` (lines
45-53) and does not change. The change goes into
`createPresentationController.slide()`, which keeps its per-page/revision
cache and its data-URL encoding.

When `editor.store.getMeta().slideSize` is set:

- The rect comes from
  `resolveSlideRect(editor.store, editor.registry, page, { slideSize, slideOrigin: page.slideOrigin })`
  and has kind `explicit`.
- The SVG comes from `editor.exportPageSvgOf(page, { viewport: rect })`.
  The existing `SvgExportOptions.viewport` already means "exact page-space
  viewport; ignores padding and clips overflow", so a nonzero or negative
  origin and overflowing content are clipped to the rect. Frames are
  ignored.
- The result `size` is always `{ width: rect.width, height: rect.height }`,
  never `svgSize(svg)`. This holds even when the render is `null` (an
  empty page), in which case `src` is `null`.
- `layout(viewport)` therefore fits the explicit dimensions through the
  unchanged `fitSlide(slide().size ?? viewport, viewport)`. An empty
  explicit slide shows the white backing at the slide aspect ratio, not the
  viewport aspect ratio.
- The cache key `(page, editor.revision)` already covers slide size and
  origin edits, because both are commits that bump the revision.

When no slide size is set, the existing artboard / `exportPageSvgOf(page, { padding: 0 })` / `svgSize`
path runs byte-for-byte unchanged, and so do navigation and export.

### 5.3 Presentation settings (`packages/ui-solid/src/inspector/PresentationSection.tsx`, new)

- This section appears where `PageSection` appears (no selection). It has
  two parts:
  - Document "Slide size": a select with "None (fit content)", the four
    presets and "Custom". Picking "Custom" keeps the current size, or uses
    the default size when there is none, and shows W/H number inputs, which
    are clamped and validated as in section 2.1. "None" applies
    `slideSize: null`.
  - Page "Slide origin X/Y": number inputs. They are shown only when a slide
    size is set. "Reset" applies `slideOrigin: null`.
- Every change is one `editor.apply` with the section 3 command.

### 5.4 Copy shapes picker

- Pure options builder, `packages/ui-solid/src/copy-shapes-options.ts`:
  `copyShapesOptions(pagesInTabOrder, targetId)` returns these entries, in
  order:
  1. `{ key: "prev", label: "Previous page (<name>)", pageId | null, disabled }`
  2. `{ key: "next", label: "Next page (<name>)", ... }`
  3. one `{ key: pageId, label: name }` per other page, in tab order,
     excluding the target
  - `defaultCopyShapesOption` is "prev" when it is enabled. Otherwise it is
    the first enabled entry, or `null` when the document has one page.
- Dialog, `packages/ui-solid/src/CopyShapesDialog.tsx`: a small modal with a
  listbox, Copy/Cancel and Enter/Esc. On confirm it calls
  `editor.copyPageElements(sourceId, targetId)`.
- Page tab context menu (`PageTabs.tsx`): the menuitem "Copy shapes from
  page..." calls an `onCopyShapesFrom(targetId)` prop. The host opens the
  dialog. The item is disabled when the document has one page.

## 6. Copy shapes core and CLI

### 6.1 Shared helper (`packages/core/src/editor/pages.ts`)

- Extract `planPageElementsCopy(editor, idSource, fromPageId, toPageId): PastePlan`.
  It contains exactly the current body of `planDuplicatePage`:
  `copyElements(store, every element id of fromPageId)`, then
  `planPaste(payload, { page: toPageId, idSource, nextIndex: () => editor.nextIndex(toPageId), offset: {x:0,y:0} })`.
- `planDuplicatePage` calls it with the new page id. Its command list, id
  consumption order and output are unchanged, and the existing duplicate
  tests guard this.
- Remapping (connector endpoints, group/frame membership, parent links,
  asset references kept as references) is exactly what `planPaste` already
  does. Binary assets are not copied.
- Because `nextIndex(toPageId)` is above the current maximum, the pasted
  elements land on top of the target's existing content.

### 6.2 Facade (`packages/core/src/editor/facade/page-editing.ts`)

- `adjacentPageId(id, direction: "prev" | "next"): PageId | null` is the tab
  neighbor in `comparePageOrder`. Hidden pages count. It returns `null` at
  the edges and for an unknown id. It is written with indexed access that
  checks `undefined` (`noUncheckedIndexedAccess`).
- `copyPageElements(fromPageId, toPageId, applyOptions?): ElementId[] | null`:
  - It returns `null` and applies nothing when either id is unknown or
    `from === to`.
  - It returns `[]` and applies nothing (no undo entry) when the source is
    empty.
  - Otherwise it makes one `apply(plan.commands)`, which is one undo step.
    It switches to the target page when that page is not current, selects
    `plan.ids` and returns them.
  - Undoing it removes exactly the pasted elements, so the target page is
    restored exactly.

### 6.3 Errors surfaced to callers

The UI never offers an invalid source: prev/next are disabled at the edges
and the target is excluded. The facade's `null` is a defensive no-op.

### 6.4 CLI: `nodetto-cli pages copy-shapes`

```text
nodetto-cli pages copy-shapes <doc.jsonl> --from <page|prev|next> --to <page>
                              [--dry-run] [--format text|json]
```

- In `pagesCommand`, `args[0] === "copy-shapes"` dispatches to
  `pagesCopyShapesCommand` in the new `apps/cli/src/pages-copy-shapes.ts`.
  Every other form is unchanged.
- `--to` resolves through `resolvePageQuery` (full id, short id or name;
  ambiguity is an error).
- `--from` is one of:
  - `prev` or `next`, resolved with `editor.adjacentPageId(to, ...)`. The
    keywords win over a page that has that name; this is documented.
  - Any other value, resolved through `resolvePageQuery`.
- Errors exit non-zero with the message followed by "Nothing was written.":
  - a missing or extra option
  - an unresolved page
  - "Page "<to>" has no previous page." or the matching "no next page"
    message
  - the source equal to the target
- Run:
  1. `new Editor({ document })` and `copyPageElements(from, to)`.
  2. Serialize `editor.getSnapshot()` with `serializeDocument`.
  3. Write the file with `io.writeText`, unless `--dry-run` is given.
  4. Print `Copied N elements from "<from name>" to "<to name>".` In JSON
     the output is `{ from, to, copied: [ids], written: boolean }`.
- An empty source exits 0 with `Copied 0 ...` and writes nothing.

## 7. Desktop wiring

- Preference:
  - `apps/desktop/src/settings/preferences.ts` gets
    `showSlideArea?: boolean`. Absent means automatic: shown when the
    document has a `slideSize`.
  - The effective value is `effectiveShowSlideArea(preference, slideSize)`
    (landed in `packages/ui-solid/src/canvas/slide-area.ts`).
    `App.tsx` passes `showSlideArea={preference}` to the `NodettoCanvas`
    (the app mounts exactly one); an unset preference passes `undefined`,
    which means automatic.
  - The desktop app has no menu bar, so the "View menu" checkbox is a
    "Slide area" toggle in `ZoomControls`, next to the existing "Grid"
    toggle. It shows the effective value; toggling it stores `!effective`.
  - It is never written to the document or to Yjs.
- `App.tsx` passes `showSlideArea` to `NodettoCanvas`, hosts
  `CopyShapesDialog`, and wires `PageTabs.onCopyShapesFrom`. The design's
  "Edit/Page menu" entry is a "Copy shapes from page..." button in the
  `FileActions` header next to Present; it opens the dialog for the current
  page and is disabled with one page or a read-only editor.
- `Inspector.tsx` mounts `PresentationSection` directly after `PageSection`
  in the no-selection block.
- `packages/ui-solid/src/index.ts` exports `CopyShapesDialog`,
  `PresentationSection` and `effectiveShowSlideArea`. `packages/core/src/index.ts`
  needs no edit: it already re-exports `presentation/index.ts` (slide rect,
  presets, labels), and `copyPageElements`/`adjacentPageId` are `Editor`
  methods. The CLI needs no `commands.ts` edit: `pages-command.ts`
  dispatches `copy-shapes` (landed in sac-05); only `help.ts` is updated.
- There is no thumbnail renderer in this repository; the overlay's
  absence is asserted for core SVG export (`renderPageSvg`) and for the
  presentation controller's slide `src`.
- Docs:
  - `docs/editing.md`, Presentation section: slide size and presets, the
    page origin, the slide area overlay and its toggle, clipping, and copy
    shapes from page.
  - `docs/cli.md`: the `pages copy-shapes` command.
  - `apps/cli/src/help.ts`: `pages` usage.
  - The README feature bullet, if one lists presentation.

## 8. Plan decomposition (`sac-*`)

Each plan has `artifactRoots ["target", "apps/desktop/dist"]`. Its tests sit
next to the files it touches.

| Wave | Plan | Owns (writePaths) | Depends on |
| --- | --- | --- | --- |
| 1 | `sac-01-slide-data` | `packages/ir/src/{types,validate}.ts`, `packages/io/src/jsonl/{records,parse}.ts`, `packages/core/src/{store,commands}.ts`; new tests `packages/ir/src/slide-area.test.ts`, `packages/io/src/jsonl/slide-area.test.ts`, `packages/core/src/slide-area-commands.test.ts` | none |
| 1 | `sac-02-copy-shapes-core` | `packages/core/src/editor/pages.ts`, `packages/core/src/editor/facade/page-editing.ts`; new test `packages/core/src/copy-page-elements.test.ts` | none |
| 1 | `sac-03-slide-rect-core` | new `packages/core/src/presentation/{slide-rect,slide-size,labels}.ts` and tests, `packages/core/src/presentation/index.ts` | none |
| 2 | `sac-04-slide-collab-duplicate` | `packages/collab/src/{ydoc,binding}.ts`, `packages/core/src/editor/pages.ts` (the duplicate copies `slideOrigin` when present); new tests `packages/collab/src/slide-area.test.ts`, `packages/core/src/duplicate-slide-origin.test.ts` | 01, 02 |
| 2 | `sac-05-cli-copy-shapes` | `apps/cli/src/pages-command.ts`, new `apps/cli/src/pages-copy-shapes.ts`, `apps/cli/src/pages-command.test.ts` | 02 |
| 2 | `sac-06-slide-area-overlay` | new `packages/ui-solid/src/canvas/{slide-area.ts,SlideAreaOverlay.tsx,slide-area.test.ts}`, `packages/ui-solid/src/Canvas.tsx` (optional prop + mount only), its CSS, `packages/ui-solid/src/presentation/controller.ts`, `packages/ui-solid/src/presentation/controller.test.ts`, new `packages/ui-solid/src/presentation/slide-clip.test.ts`. `PresentationView.tsx` is not edited | 01, 03 |
| 2 | `sac-07-settings-and-picker-ui` | new `packages/ui-solid/src/inspector/PresentationSection.tsx`, `packages/ui-solid/src/copy-shapes-options.ts`, `packages/ui-solid/src/CopyShapesDialog.tsx` (+ CSS) and tests, `packages/ui-solid/src/PageTabs.tsx` | 01, 02, 03 |
| 3 | `sac-08-wiring` | `apps/desktop/src/App.tsx`, `apps/desktop/src/settings/preferences.ts` (+ test), the desktop menu files, `packages/ui-solid/src/Inspector.tsx`, `packages/ui-solid/src/index.ts`, `apps/cli/src/help.ts`, `docs/editing.md`, `docs/cli.md`, `README.md` | 04-07 |

Continuation (2026-11-11, session 830): sac-01..sac-07 landed at ee4c04c.
The session 826 progress gate treated wave-2 plans listed in
`sac-08-wiring.dependsOn` as missing dependencies. The continuation manifest
`impl-plans/active/sac-s830-dispatch.json` (taskId `sac-s830`, evidence root
`tmp/sac-s830`) lists only `sac-08-wiring` in `plans` and sac-01..sac-07 in
`acceptedDependencies`; the design itself is unchanged.

The collab update (04) is in wave 2 because it needs only the IR and store
fields. Without it, in-app editing still works locally; only cloud live
sync of the new fields depends on it.

## 9. Verification

- Per plan: `bun run typecheck && mise run lint-ts && bun test <the plan's test files>`.
- `sac-01` tests:
  - Validation of both fields: good values, non-object, non-finite, out of
    range, extra key.
  - JSONL round trip with each field.
  - A file without the fields is byte-identical, and the existing golden
    suites (`bun test packages/io/src/jsonl`) pass.
  - The `updateDocument` and `updatePage` `slideOrigin` set, clear and exact
    undo.
  - `Editor` load then snapshot keeps `slideSize`.
- `sac-02` tests:
  - Every element is copied with fresh ids. Connector endpoints and group
    and frame membership are remapped. Coordinates are equal.
  - The copied elements' z-index is above the existing content.
  - One undo restores the target page exactly.
  - `from === to` and unknown ids give `null`.
  - `adjacentPageId` at the first and last page gives `null`.
  - The existing duplicate tests still pass (`bun test packages/core/src`
    with the duplicate test files).
- `sac-03` tests: the explicit rect with and without an origin, the fallback
  frame, the fallback content bounds, and an empty page with and without a
  size. Also presets and `slideSizePreset`, and labels with hidden pages.
- `sac-04` tests: the Yjs round trip of `slideSize` (meta) and `slideOrigin`
  (page). A document without them leaves no meta key. Duplicate copies the
  origin.
- `sac-05` tests: copy-shapes with `--from prev` writes the file, and the
  elements appear on `--to`. Also an error at the first page, `--dry-run`
  writing nothing, and source equal to target. If `mise run test-cli` is
  used, it may be retried up to 3 times.
- `sac-06` tests: `bun test packages/ui-solid/src/canvas/slide-area.test.ts packages/ui-solid/src/presentation/controller.test.ts packages/ui-solid/src/presentation/slide-clip.test.ts`.
  - `slide-area.test.ts`:
    - The model gives the resolved rect and label, and `dim` only when the
      size is explicit.
    - `effectiveShowSlideArea(undefined, size)` is `true`, and
      `effectiveShowSlideArea(undefined, undefined)` is `false`.
    - An explicit `false` hides the overlay (the model returns `null`) even
      with a size, and an explicit `true` shows the fallback rect without a
      size.
    - `renderPageSvg` contains no `nodetto-slide-area`.
  - `slide-clip.test.ts`, which drives `createPresentationController` with
    a real `Editor`:
    - With `slideSize` 1920x1080 and page `slideOrigin` (100, -50),
      `slide().size` equals 1920x1080. The decoded SVG `viewBox` is
      `100 -50 1920 1080`. A shape fully outside the rect is clipped (the
      root SVG has the viewport size), and `layout()` equals
      `fitSlide({1920,1080}, viewport)`.
    - An empty page with `slideSize` gives `src === null`, `size` equal to
      the slide size, and `layout()` with the slide aspect ratio.
    - An unset size gives the same `src` and `size` as before (artboard and
      content-bounds cases). The existing `controller.test.ts` still passes
      unchanged.
  - Typecheck passes with `App.tsx` untouched.
- `sac-07` tests: the options order, "prev" as the default, prev disabled on
  the first page, and the target excluded. Also mapping preset selections to
  commands.
- `sac-08` tests: the `showSlideArea` preference parse and default, and an
  added assertion in `slide-clip.test.ts` that the presentation slide `src`
  (explicit and unset size) contains no `nodetto-slide-area`.
- Final: `mise run verify` and `bun run build`.

## 10. Risks

- Sync Worker: `updateDocument` needs a case in the private Worker. This is
  stated explicitly, and the alternative is user-qa Q1.
- Mixed-version collab clients: an older client never writes the `meta` keys
  after seeding, so it does not remove `slideSize`. An older client's
  `syncPageToY` can drop `slideOrigin` when it edits that page. This is
  accepted, as for `hiddenInPresentation`.
- Duplicate page regression: guarded by the byte-identical extraction and
  the existing tests.
- The overlay leaking into exports is prevented by design: it is DOM-only
  and outside the core renderers. A test guards it.
