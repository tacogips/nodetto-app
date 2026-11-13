# slt-03-settings-plumbing

- planId: slt-03-settings-plumbing; wave 2; dependsOn: slt-01-settings-fields
- Design: sections 3.1.1 (carrier lifecycle, copy rules, export lists),
  3.4 and 10 (`slt-03`) of
  `design-docs/specs/design-slide-transition-settings.md`.
- writePaths: `packages/core/src/shapes/index.ts`,
  `packages/core/src/clipboard.ts`, `packages/core/src/editor/pages.ts`,
  `packages/core/src/editor/facade/core.ts`,
  `packages/io/src/drawio/export.ts`, `packages/io/src/d2/export.ts`, new
  `packages/core/src/slide-settings-carrier.test.ts`, new
  `packages/io/src/jsonl/slide-settings.test.ts`, new
  `packages/collab/src/slide-settings.test.ts`, new
  `packages/io/src/__fixtures__/slide-settings.jsonl`,
  `packages/io/src/jsonl/golden.test.ts` (one-entry change only);
  pre-authorised only if a
  check below proves it necessary: `packages/core/src/handoff.ts`,
  `packages/core/src/interface-tree.ts`,
  `packages/core/src/editor/dirty-pages.ts`, `packages/core/src/arrange.ts`,
  `packages/core/src/copy-page-elements.test.ts`,
  `packages/core/src/link-id-copy.test.ts`, `packages/core/src/pages.test.ts`,
  `apps/cli/src/edit/label-field.ts`; progress file, `tmp/slt-s856/slt-03-settings-plumbing`, `target`
- artifactRoots: `target`.

## Intent and context

Make the `presentation.slide` carrier (from slt-01) a real, durable,
artwork-free page element:
- never drawn, hit, selected by Select all, or exported as content;
- kept by Duplicate page, never transferred by paste or Copy shapes from
  page.

Also prove that settings survive deleting every shape and round-trip
through JSONL and Yjs. Precedent: `design.guide` in
`packages/core/src/page-guides.ts` and `packages/core/src/shapes/index.ts`.

## Non-goals

- No IR, command, planner, runner or inspector change. No io/collab
  production code except the two exporter skip lists.
- Do not change guide, token or comment behaviour, `topLevelIds` or the
  layer tree.

## File-level changes

1. `shapes/index.ts`: register `presentation.slide` exactly like the
   `design.guide` entry (`canResize: false`, `getBounds: () => null`,
   `hitTest: () => false`, `defaultSemantic: () => ({})`, `defaultVisual:
   () => ({})`).
2. `editor/facade/core.ts` `selectAll()`: filter out elements whose type is
   `SLIDE_SETTINGS_TYPE` (from `@nodetto/ir`) from
   `topLevelIds(this.store, this.pageId)`. Do not edit `group.ts`.
3. `clipboard.ts`:
   - add `readonly keepSlideCarrier?: boolean` to `PasteOptions`;
   - at the start of `planPaste`, unless `keepSlideCarrier`, drop payload
     elements of type `SLIDE_SETTINGS_TYPE` BEFORE ids are allocated, so the
     id order of every other element is unchanged.
   - Pitfall: also drop them from any per-payload iteration (mapping,
     references); build a filtered payload once and use it everywhere.
4. `editor/pages.ts` `planPageElementsCopy(editor, idSource, from, to,
   carrier: "keep" | "skip" = "skip")`:
   - `"skip"`: exclude carrier ids from the copied id list.
   - `"keep"`: include them and pass `keepSlideCarrier: true`.
   - In both modes never add a carrier to `linkIds` and never emit a source
     `updateVisual` for it (skip carriers in the linkId loop).
   - `planDuplicatePage` passes `"keep"`. `copyPageElements` in
     `editor/facade/page-editing.ts` is NOT edited (it gets the default).
5. `io/src/drawio/export.ts` `SILENT_TYPES` and the d2 list in
   `io/src/d2/export.ts` (near line 582): add `"presentation.slide"`.
6. Grep `rg -n '"design.guide"|"design.text-style"' packages/core/src` and
   inspect `handoff.ts`, `interface-tree.ts`, `editor/dirty-pages.ts` and
   `arrange.ts`. Edit one only if a test shows the carrier being treated as
   artwork there; record each decision in the progress log.

## Invariants

- Element-id consumption order is unchanged for documents without carriers
  (existing duplicate and copy tests pass unchanged).
- Phase 1 `linkId` behaviour is unchanged for artwork.
- Exports of documents without carriers are unchanged.

## Tests

`packages/core/src/slide-settings-carrier.test.ts` (Editor-based, pattern
`packages/core/src/copy-page-elements.test.ts`):
- carrier bounds are null and hitTest is false via `createDefaultRegistry()`;
- `selectAll()` on a page with a shape and a carrier selects only the
  shape;
- empty page: apply `createElement` of a carrier with `slide: { mode:
  "fade" }`, then `readSlideSettings(store.getPageElements(page))` returns
  it;
- add a shape, run `selectAll()` + delete, add a new shape: the settings
  are unchanged;
- one `undo` after the carrier `createElement` removes it, and
  `readSlideSettings` returns `undefined`;
- Duplicate page: the new page has exactly one carrier (new id, same
  `slide`, no `linkId`); the source carrier has no `linkId`;
- Copy shapes from page: the target page has no carrier;
- `planPaste` of a `copyElements` payload that includes a carrier id ->
  no carrier `createElement`, and other ids are allocated in the same order
  as with the carrier removed beforehand.

Golden coverage (required). `packages/io/src/jsonl/golden.test.ts`
"covers every registered element type at least once" (lines ~88-98)
fails as soon as slt-01 registers `presentation.slide`. Today only
`freeform.jsonl` contains `design.guide`.
- Create `packages/io/src/__fixtures__/slide-settings.jsonl`, a
  hand-authored canonical fixture:
  - a `document` record and one page (copy the record shapes from
    `freeform.jsonl`);
  - one `shape.geo` whose visual has `linkId` and `animation` (`enter:
    "slide-in"`, `enterFrom: "left"`, `exit: "undraw"`, `delayMs`,
    `durationMs`, `order`);
  - one `presentation.slide` carrier with `semantic: {}` and
    `visual.animation.slide` `{mode, durationMs, stagger}`.
- Append `"slide-settings"` to the `GOLDEN` array in `golden.test.ts`.
  This is the only allowed change in that file.
- Pitfall: golden files must reserialize byte for byte. Write the fixture
  in the serializer's canonical order (record keys as in the existing
  fixtures; `animation` right after `linkId`; animation keys `enter,
  enterFrom, exit, exitTo, linked, delayMs, durationMs, order, slide`;
  slide keys `mode, durationMs, stagger`) with the same trailing newline
  convention. Verify by serializing the parsed fixture and diffing.
- Do not edit `freeform.jsonl` or any other existing fixture (they are
  shared by drawio, collab and cli tests). Do not weaken or skip the
  coverage test.

`packages/io/src/jsonl/slide-settings.test.ts` (it may read the new
fixture instead of duplicating it; pattern
`packages/io/src/jsonl/link-id.test.ts`):
- parse -> serialize round trip of a document with a carrier and a shape
  with per-shape `animation` is identical, with canonical key order
  (`animation` after `linkId`; `slide` keys `mode`, `durationMs`,
  `stagger`);
- a document without them stays byte-identical to its fixture;
- drawio and d2 export of a document are identical with and without an
  added carrier.

`packages/collab/src/slide-settings.test.ts` (pattern
`packages/collab/src/link-id.test.ts`):
- two bound docs: carrier `createElement`, `replaceVisual`, then
  `deleteElements` each reach the second binding unchanged; one undo on
  the first restores both; per-shape `animation` round-trips.

## Verification (exit 0; logs in `tmp/slt-s856/slt-03-settings-plumbing/`)

1. `bun test packages/io packages/collab packages/core/src/slide-settings-carrier.test.ts packages/core/src/copy-page-elements.test.ts packages/core/src/link-id-copy.test.ts packages/core/src/pages.test.ts apps/cli/src/edit/label-field.test.ts`
   - `label-field.test.ts` iterates every `ELEMENT_TYPES` entry, which now
     includes `presentation.slide`. It must pass, with the carrier reported
     as having no text label. If it fails only because of the carrier, the
     pre-authorised fix is in `apps/cli/src/edit/label-field.ts` (add this
     file to the progress log as touched).
2. `bun run typecheck`
   - `bun test packages/io` includes `golden.test.ts`, so "golden file
     coverage" and the byte-for-byte check of `slide-settings` must pass.
3. `bunx biome check --diagnostic-level=warn packages/core/src/shapes/index.ts packages/core/src/clipboard.ts packages/core/src/editor/pages.ts packages/core/src/editor/facade/core.ts packages/io/src/drawio/export.ts packages/io/src/d2/export.ts packages/core/src/slide-settings-carrier.test.ts packages/io/src/jsonl/slide-settings.test.ts packages/collab/src/slide-settings.test.ts packages/io/src/jsonl/golden.test.ts`.
   Also list any pre-authorised file you edited.
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-03-settings-plumbing.log -- packages/core/src/shapes/index.ts packages/core/src/clipboard.ts packages/core/src/editor/pages.ts packages/core/src/editor/facade/core.ts packages/io/src/drawio/export.ts packages/io/src/d2/export.ts packages/core/src/slide-settings-carrier.test.ts packages/io/src/jsonl/slide-settings.test.ts packages/collab/src/slide-settings.test.ts packages/io/src/jsonl/golden.test.ts`.
   Append any pre-authorised `.ts` file you edited.

## Done criteria

- All tests above pass.
- `git diff --exit-code a9abe26 -- packages/core/src/editor/facade/page-editing.ts packages/core/src/group.ts packages/io/src/__fixtures__/freeform.jsonl` exits 0.
- `git diff a9abe26 -- packages/io/src/jsonl/golden.test.ts` shows only
  the added `"slide-settings"` entry (record it in the progress log).
- No file outside writePaths changed.
