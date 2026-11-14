# slt-06-inspector-sections

- planId: slt-06-inspector-sections; wave 2; dependsOn: slt-01-settings-fields
- Design: section 7 and 3.1.1 (write rule) and 10 (`slt-06`) of
  `design-docs/specs/design-slide-transition-settings.md`.
- writePaths (all new): `packages/ui-solid/src/inspector/slide-transition-edits.ts`,
  `packages/ui-solid/src/inspector/slide-transition-edits.test.ts`,
  `packages/ui-solid/src/inspector/slide-animation-edits.ts`,
  `packages/ui-solid/src/inspector/slide-animation-edits.test.ts`,
  `packages/ui-solid/src/inspector/SlideTransitionSection.tsx`,
  `packages/ui-solid/src/inspector/SlideAnimationSection.tsx`, progress file,
  `tmp/slt-s856/slt-06-inspector-sections`, `target`
- artifactRoots: `target`.

## Intent and context

Add the inspector editing for per-slide and per-shape settings as pure
command-planning helpers plus two Solid sections. slt-07 mounts them in
`Inspector.tsx`. Patterns:
- `packages/ui-solid/src/inspector/slide-link-edits.ts` and
  `SlideLinkSection.tsx` (helpers return `Command[]`, the section applies
  one `editor.apply` only when non-empty and not read-only);
- `packages/core/src/page-guides.ts:addPageGuide` for
  `editor.buildElement(...)` + `createElement`;
- controls from `controls.tsx` (`Section`/`details`, `Field`,
  `SelectInput`, `NumberInput`, `Checkbox`) and existing classes only.

## Non-goals

- Do not edit `Inspector.tsx`, `index.ts`, CSS, or any core/ir file.
- No new theme tokens, colours or CSS.

## `slide-transition-edits.ts`

- `planSlideSettingsEdit(editor: Editor, pageId: PageId, patch:
  Partial<Record<keyof SlideSettings, SlideSettings[keyof SlideSettings] |
  null>>): Command[]`. `null` clears a key.
  - Steps: current = `readSlideSettings(editor.store.getPageElements(pageId))`;
    merge; normalise (drop `mode: "auto"`, `stagger: true` and null keys).
  - Carrier = the first `SLIDE_SETTINGS_TYPE` element in `(index, id)`
    order (the same rule as `readSlideSettings`).
  - Result non-empty and a carrier exists -> one `replaceVisual` with
    `animation.slide` replaced (keep other `animation` keys).
  - Result empty and a carrier exists -> one `deleteElements` of it.
  - Result non-empty and no carrier -> one `createElement` of
    `editor.buildElement(SLIDE_SETTINGS_TYPE, { page: pageId, semantic: {},
    visual: { animation: { slide } } })`. Pass `semantic: {}` explicitly so
    the result does not depend on the shape util that sibling plan slt-03
    registers in the same wave.
  - Otherwise `[]`. Compare canonically, so an unchanged value gives `[]`.
- `slideSettingsOf(editor, pageId): SlideSettings` (defaults applied for
  display).

## `slide-animation-edits.ts`

- `planAnimationEdit(elements: readonly Element[], patch): Command[]` ->
  one `replaceVisual` per element whose normalised per-shape keys change.
  - Normalise: drop `enter/exit/linked: "auto"` and null keys; keep
    `enterFrom`/`exitTo` as given.
  - Never read or write `animation.slide`. Remove `animation` when it ends
    up empty.
  - Skip `SLIDE_SETTINGS_TYPE` elements.
- `sharedAnimationValue(elements, key)`: the common value (`undefined`
  means auto/unset), or `"mixed"`.

## Sections

- `SlideTransitionSection({ editor, pageId })`, title "Slide transition".
  It shows on every page, including empty ones.
  - Mode SelectInput (Auto, Cut, Fade).
  - Duration (ms) `NumberInput` (`value` null when unset; min/max from
    `ANIMATION_LIMITS.slideDurationMs`).
  - Stagger Checkbox, enabled only in Auto.
  - A "Reset" button that clears all keys (`NumberInput` cannot commit a
    blank value).
- `SlideAnimationSection({ editor, elements })`, title "Slide animation".
  - Enter SelectInput, plus Enter from when the value is `slide-in`.
  - Exit SelectInput, plus Exit to when the value is `slide-out`.
  - Linked motion SelectInput.
  - Delay, Duration and Order NumberInputs with `ANIMATION_LIMITS`.
  - A "Reset" button.
  - Mixed values: prepend an option `{ value: "__mixed", label: "Mixed" }`
    and show it; choosing it commits nothing.
- Every control is `disabled={editor.readOnly}`. Each commit calls the
  helper and applies once (one undo step).
- Re-read state through `createEditorSignals(editor).rev()` as in
  `SlideLinkSection`.

## Tests

`slide-transition-edits.test.ts` (Editor from `@nodetto/core`):
- empty page, `{mode:"fade"}` -> exactly one `createElement`; after apply,
  `readSlideSettings` = `{mode:"fade"}`, and one undo removes it;
- carrier exists, `{durationMs: 900}` -> one `replaceVisual`;
- `{mode: "auto"}` on `{mode:"auto"}` -> `[]`;
- clear everything -> one `deleteElements`;
- two carriers -> the edit targets the first.

`slide-animation-edits.test.ts`:
- two shapes, `{enter:"fade-in"}` -> two `replaceVisual`, and one apply is
  one undo step;
- `{enter:"auto"}` on a shape with only `enter` -> visual without
  `animation`;
- `animation.slide` on a (malformed) shape is preserved;
- `sharedAnimationValue` -> the value or `"mixed"`.

## Verification (exit 0; logs in `tmp/slt-s856/slt-06-inspector-sections/`)

1. `bun test packages/ui-solid/src/inspector/slide-transition-edits.test.ts packages/ui-solid/src/inspector/slide-animation-edits.test.ts`
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn` on the six writePaths files
   (listed explicitly).
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-06-inspector-sections.log -- packages/ui-solid/src/inspector/slide-transition-edits.ts packages/ui-solid/src/inspector/slide-transition-edits.test.ts packages/ui-solid/src/inspector/slide-animation-edits.ts packages/ui-solid/src/inspector/slide-animation-edits.test.ts packages/ui-solid/src/inspector/SlideTransitionSection.tsx packages/ui-solid/src/inspector/SlideAnimationSection.tsx`

## Done criteria

- The helpers return exactly the specified command lists.
- The sections compile and use only existing controls and classes.
- Only writePaths changed.
