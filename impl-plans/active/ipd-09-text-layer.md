# ipd-09-text-layer

- planId: ipd-09-text-layer
- planPath: impl-plans/active/ipd-09-text-layer.md
- progressPath: impl-plans/progress/ipd-09-text-layer.md
- dependsOn: ipd-01-ir-schema, ipd-02-text-measure, ipd-04-cli-edit-contracts, ipd-05-core-catalogue
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 1 (1.1-1.5) and D5.
- Evidence: `tmp/ipd-s772/ipd-09-text-layer/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/text-layout.ts`
  - `packages/core/src/svg-export/text-note.ts`
  - `packages/core/src/text-layer.test.ts`
  - `packages/ui-solid/src/shapes/TextNoteView.tsx`
  - `apps/cli/src/edit/typography-link.ts`
  - `apps/cli/src/edit/visual-patch.ts`
  - `apps/cli/src/text-layer-cli.test.ts`
  - `impl-plans/progress/ipd-09-text-layer.md`
  - `tmp/ipd-s772/ipd-09-text-layer`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-09-text-layer`
<!-- ownership:end -->

## Intent and context

D5 has two parts:

- **No precise text layer.** Text always has an implicit inset, wraps by a 0.55 em estimate, and has no ellipsis.
- **CLI typography updates are reverted.** A CLI `update` of `fontSize`/`fontWeight` on a `text.note` linked to a text style is silently reverted, because `planTextStyles` (`packages/core/src/text-styles.ts:263-268`, run from `editor/transaction.ts:128-132`) reapplies the linked style.

This plan:

1. makes `text.note` honor `visual.textMeasure: "proportional"` and `visual.textTruncate: "ellipsis"` in sizing, SVG export and canvas;
2. detaches the text-style link when the CLI sets typography;
3. normalizes the CLI `textAlign` aliases `left`, `center` and `right`.

The `text:layer` shape (`ipd-05`) creates such a note.

## Non-goals

- No change for notes without the new fields. Legacy wrap, inset and size are byte-identical.
- No change to `wrapTextLines` or `estimatedTextWidth`.
- No rich-text editing changes.
- No help text.

## File-level changes

`packages/core/src/text-layout.ts`:

- `measureTextNote(element, mode)`: when `textMeasureMode(element.visual) === "proportional"`, measure with `measureTextWidth` and wrap with `wrapMeasuredLines` (from `packages/core/src/text-measure.ts`), using `TextMeasureStyle` from `style.fontSize`, `fontWeight` and `letterSpacing`.
- With `textTruncate: "ellipsis"`:
  - `auto-width` measures one line, joined with spaces, and never truncates;
  - `auto-height` gives a height of one line plus padding.
- Export a helper used by the renderer and lint:

  `export function textNoteLines(element: Element): { readonly lines: readonly string[]; readonly truncated: boolean; readonly lineHeight: number; readonly fontSize: number }`

  It returns the exact lines the export draws. Legacy mode returns `wrapTextLines` lines and `truncated: false`.

`packages/core/src/svg-export/text-note.ts`: draw the lines from `textNoteLines`. With truncation, the single line is the truncated text.

- Rich-text marks apply to the visible graphemes.
- A mark range crossing the cut is clipped.
- The ellipsis glyph carries the style at the cut position.
- Legacy notes take the existing code path unchanged.

`packages/ui-solid/src/shapes/TextNoteView.tsx`:

- With `textTruncate`, the canvas uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
- With `textPadding`, use it as the padding. This already exists; verify it.
- With `textMeasure: "proportional"` and no truncation, keep browser wrapping. Record the known canvas-versus-export wrap difference in the progress log as a residual note.

`apps/cli/src/edit/typography-link.ts` replaces the `ipd-04` stub, keeping its signature.

`normalizeTypography(type, visual, existing, index)`:

1. Map `visual.style.textAlign` `left` -> `start`, `center` -> `middle`, `right` -> `end`. Other values pass to validation unchanged.
2. If the effective element has `visual.textStyle` (from `visual` or `existing`) and the patch sets any field in `TYPOGRAPHY_FIELDS` (`packages/core/src/text-styles.ts:14-26`), then:
   - return the visual with `textStyle: null`, so deepMerge deletes it;
   - return `detachedStyle: <style id>`.

   The caller (`add.ts`/`elements.ts`, wired by `ipd-04`) prints `warning: detached text style <styleId> from <elementId>` through the warnings channel, which `--quiet` collapses.

`apps/cli/src/edit/visual-patch.ts`: no logic change is expected. If the update path needs `textStyle: null` handled for deletion, make that minimal change here.

## Patterns to imitate

- `apps/cli/src/edit/visual-patch.ts:withBoxLabelAlign` (`:21-46`), the existing automatic unlink precedent.
- `packages/core/src/svg-export/text-note.ts` current line emission.

## Pitfalls

- `planTextResize` runs every transaction. The proportional measure must be deterministic and cheap: no per-call table copies.
- Do not change `TEXT_NOTE_PADDING_*` defaults.
- Detaching applies only when a typography field is set. Color-only edits do not detach; `color` is in `TYPOGRAPHY_FIELDS` only if the file says so, so follow that list exactly.
- `textAlign` aliases must not be accepted for any other field.

## Tests

New `packages/core/src/text-layer.test.ts`:

- A `text:layer`-style note with text `"Inbox"`, fontSize 17 -> after a transaction, width equals `measureTextWidth("Inbox", {fontSize:17}, "proportional")` (padding 0), and height equals `17 * 1.29`.
- `textTruncate` on a fixed 60-wide note with `"Direct messages and more"` -> the export SVG has one `<text>` whose content ends with `…`, and `textNoteLines(...).truncated` is true.
- A legacy note (no new fields) -> the SVG is identical to the output of the existing `svg-export` tests. Run them unchanged.
- Bold vs regular auto-width -> bold is wider.

New `apps/cli/src/text-layer-cli.test.ts`:

- `update` with `{"visual":{"style":{"fontSize":24,"fontWeight":700}}}` on a plain note -> the exported SVG has `font-size="24"` and `font-weight="700"`.
- The same update on a note linked to a typography resource -> the link is removed, the values are kept after the transaction, and stderr has the `detached text style` warning. With `--quiet`, the warning is collapsed per `warnings.ts` rules.
- `add` of `text:layer` with `"style":{"textAlign":"center"}` -> stored `middle`.
- `add` of `text:layer` with label `"Settings"` -> `textPadding` 0 and an auto width.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/text-layer.test.ts apps/cli/src/text-layer-cli.test.ts packages/core/src/text-layout.test.ts packages/core/src/text-styles.test.ts packages/core/src/svg-export.test.ts packages/core/src/text-layout-lint apps/cli/src/text-layout-export.test.ts packages/ui-solid/src/text-note-view.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.
4. Visual evidence:
   - A fixture with 17 pt regular/semibold/bold text layers, left/center/right alignment, a truncated label, and letter spacing 0.5.
   - Export `final/text.png` at `--scale 2` and inspect it.

## Done criteria

- Verification passes.
- `rg -n 'export function textNoteLines' packages/core/src/text-layout.ts` -> 1 match.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only (`textNoteLines`).
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
