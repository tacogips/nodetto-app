# stb-03-toolbar-wiring

- planId: stb-03-toolbar-wiring; wave 2; dependsOn: stb-01-text-format, stb-02-toolbar-icon
- Design: sections 2, 3.3, 3.4, 4, 6 and 7 of
  `design-docs/specs/design-selection-toolbar-icons.md`.
- writePaths: `packages/ui-solid/src/SelectionToolbar.tsx`,
  `packages/ui-solid/src/SelectionToolbar.css`,
  `packages/ui-solid/src/SelectionToolbar.test.ts`,
  `apps/desktop/src/styles/panels.css`, `docs/editing.md`,
  `impl-plans/progress/stb-03-toolbar-wiring.md`,
  `tmp/stb-s857/stb-03-toolbar-wiring`, `target`. artifactRoots: `target`.

## Intent and context

Turn every toolbar button and summary into an icon-only control with
`title` equal to `aria-label`. Add the Text disclosure. Make
`SelectionToolbar.css` self-contained so the hosted app (which only loads
ui-solid CSS) styles the toolbar. This plan uses stb-01 (`text-format.ts`)
and stb-02 (`ToolbarIcon.tsx`) unchanged.

## Non-goals and files not to touch

- Do not edit `text-format.ts`, `ToolbarIcon.tsx` or their tests. If they
  are wrong, record a blocker.
- Do not edit `shortcuts.ts` (actions, labels, shortcut table),
  `ContextMenu.tsx`, the main toolbar, `buttons.css`, `square-chrome.css`,
  `inspector.css`, `IconPicker.tsx`, `index.ts`, core or IR.
- Do not add a styled tooltip, a new Command kind or a new CSS custom
  property.

## SelectionToolbar.tsx

- `button(id: ActionId, icon: ToolbarIconKey)`: the only child is
  `<ToolbarIcon name={icon} />`. Set `title={actionTitle(action)}` and the
  same `aria-label`. Keep `disabled` and `onClick` exactly as they are now.
  `ARRANGE_BUTTONS` becomes `{ id: ActionId; icon: ToolbarIconKey }[]`.
- Keep the order, the `<Show>` guards (Straighten on
  `straightenConnector` enabled, `props.simple` for frameSelection and the
  booleans, align when `alignLeft` is enabled), `disclosureKey`, the
  pressed and pointer effect, `measure`, `anchor`, `placeAbove`,
  `FILL_PALETTE` / `STROKE_PALETTE` and the swatch titles.
- Summaries: `<summary class="nodetto-float-button" title=X aria-label=X>`
  wrapping `<ToolbarIcon>`, with X being "Colors", "Text" or "Arrange".
  Properties gets title and aria-label "Edit selection properties" and the
  `properties` icon.
- Text disclosure, placed between Colors and Arrange with
  `onKeyDown={disclosureKey}` and body class
  `nodetto-selection-disclosure-body nodetto-float-text`:
  - `leaves` is a `createMemo` that reads `signals.rev()` and
    `signals.selection()` and calls
    `leafElements(editor().store, editor().selection.ids())`. Copy the
    selection argument pattern from `Inspector.tsx:149`.
  - `textStyle = () => leaves()[0]?.visual.style` and
    `state = () => textFormatState(textStyle())`.
  - Write path: `apply(patch)` calls `editor().setSelectionStyle(patch)`
    and nothing else.
  - Size row: a fontSmaller button, then
    `<output class="nodetto-float-size" aria-label="Font size">{state().fontSize}</output>`,
    then a fontLarger button. Each button is disabled when
    `fontSizePatch(...)` is null. Title and aria-label are "Smaller text"
    and "Larger text".
  - Style row: Bold, Italic, Underline and Strikethrough toggles with
    `aria-pressed={String(state().bold)}` and so on, calling
    `boldPatch`, `italicPatch` and `decorationPatch(style, "underline")` /
    `decorationPatch(style, "line-through")`. Titles and labels are
    "Bold", "Italic", "Underline" and "Strikethrough".
  - Align row: textAlignStart, textAlignMiddle and textAlignEnd, pressed
    when `state().textAlign === value`. Titles are "Align text left (click
    again for default)", "Center text (click again for default)" and
    "Align text right (click again for default)".
  - Vertical row inside `<Show when={supportsVerticalAlign(leaves())}>`:
    top, middle and bottom, pressed when `state().verticalAlign === value`,
    calling `verticalAlignPatch`. Titles are "Align text top", "Align text
    middle" and "Align text bottom".
  - Every text control has `type="button"`,
    `class="nodetto-float-button"` and the icon as its only child.
- Update the header comment: Text controls and colour swatches write
  through `setSelectionStyle`.
- Pitfall: `leaves()[0]` is possibly undefined under
  noUncheckedIndexedAccess. Use `?.`. Do not render action label text
  anywhere. The numeric size is the only text.

## SelectionToolbar.css (design 3.4)

Every rule is under `.nodetto-selection-toolbar`. Colours are only
`var(--existing-token, <light literal from apps/desktop/src/styles/base.css>)`.
Copy the values from the panels.css rules you delete. The shadow is
`var(--app-shadow-medium, rgba(29, 42, 46, 0.12))` and disabled is
`var(--app-disabled-soft-ink, #a8a8a8)`. Include:

- The container (position, flex and wrap, gap, padding, border,
  background, radius, shadow, will-change, user-select), merged with the
  existing max-width and radius rule.
- `.nodetto-float-group` and its last-child rule.
- Buttons and summaries: 26px width and height, inline-flex centred,
  padding 0, transparent border, background, ink colour,
  `cursor: pointer`, `list-style: none` and
  `summary::-webkit-details-marker { display: none }`.
- Hover (not disabled), `[aria-pressed="true"]` (accent-soft background
  and accent border), `:disabled`, and `:focus-visible` (an accent
  outline).
- `.nodetto-float-text` rows, `.nodetto-float-size` (min-width, centred,
  `font-variant-numeric: tabular-nums`, `font-size: 0.74rem`), and the
  existing colours column rule.
- The swatch rules scoped under the toolbar.
- Remove the old 24px text `summary` sizing.

Check: `apps/desktop/src/styles/theme-tokens.test.ts` (case 6) must still
pass.

## apps/desktop/src/styles/panels.css

Delete only the `/* Floating selection toolbar */` container rule and the
`.nodetto-float-group`, `.nodetto-float-group:last-child`,
`.nodetto-float-colours` and `.nodetto-float-button*` rules (about lines
261-319). Keep every `.nodetto-swatch*` rule. Before deleting, confirm with
`git grep -n "nodetto-float-" -- apps packages` that only
SelectionToolbar files use these classes, and record the output.

## docs/editing.md

Near line 399 ("**Straighten** on the selection toolbar"), say the
toolbar shows icons whose names appear on hover. Add one short paragraph
for the Text disclosure: smaller and larger size with the current size,
bold, italic, underline, strikethrough, left/centre/right alignment (click
again for default), top/middle/bottom for text notes, one undo step per
click, applied through groups. No emojis.

## SelectionToolbar.test.ts

Keep the `placeAbove` test unchanged. Export `ARRANGE_BUTTONS` from
`SelectionToolbar.tsx`, then add one test:

- `ARRANGE_BUTTONS` lists the six align ids in order (alignLeft,
  alignHCenter, alignRight, alignTop, alignVCenter, alignBottom).
- `getAction(id)` does not throw for each id.
- Each `icon` is an own key of `TOOLBAR_ICONS`.
- `findIcon(TOOLBAR_ICONS[icon])` is defined.

Import only from `SelectionToolbar.tsx`, `ToolbarIcon.tsx`, `shortcuts.ts`
and `@nodetto/core`. Do not render anything.

## Verification (run serially; each must exit 0; logs in tmp/stb-s857/stb-03-toolbar-wiring/)

1. `bun run typecheck`
2. `bun test packages/ui-solid/src/SelectionToolbar.test.ts packages/ui-solid/src/text-format.test.ts packages/ui-solid/src/ToolbarIcon.test.ts apps/desktop/src/styles/theme-tokens.test.ts`
   must show 0 failures.
3. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref b07fd34c8b9c5c621274551497b3461f36a69a27 --out target/strict-index/baseline.log`
   This is the only plan in its wave, so the capture is serial.
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/stb-03-toolbar-wiring.log -- packages/ui-solid/src/SelectionToolbar.tsx packages/ui-solid/src/SelectionToolbar.test.ts packages/ui-solid/src/text-format.ts packages/ui-solid/src/text-format.test.ts packages/ui-solid/src/ToolbarIcon.tsx packages/ui-solid/src/ToolbarIcon.test.ts`
5. `mise run lint`
6. `mise run verify`. Allow up to 3 attempts only for timing deadline
   failures under load, and record each attempt's log. Never relax a
   deadline.

## Done criteria

- `git grep -n "nodetto-float-" apps/desktop/src/styles/panels.css` shows
  nothing.
- No text node child besides the size `<output>` in toolbar buttons or
  summaries (reviewer inspection of `SelectionToolbar.tsx`).
- Commands 1-6 exit 0.
- The progress log `impl-plans/progress/stb-03-toolbar-wiring.md` records
  per-file changes, pre and post `git hash-object`, command exit codes and
  log paths, and the gate log path.
