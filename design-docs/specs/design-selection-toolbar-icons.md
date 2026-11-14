# Selection toolbar: icon buttons and text formatting (stb-s857)

Status: accepted for implementation on `feat/selection-toolbar-icons`.
Scope: `packages/ui-solid` floating selection toolbar only. No IR, core
command, shortcut table, context menu or main toolbar change.

## 1. Problem

`packages/ui-solid/src/SelectionToolbar.tsx` shows text buttons (Duplicate,
Delete, Comment, Straighten, Colors, Arrange, Properties). The toolbar must
become icon-only controls that explain themselves on hover and to assistive
technology, and must gain a Text disclosure for formatting the text of the
selected shapes.

The toolbar's layout rules are split between `SelectionToolbar.css` and the
desktop-only `apps/desktop/src/styles/panels.css` (container, `.nodetto-float-*`).
The hosted app (nodetto-cloud `apps/web`, read-only) has no copy of the
panels.css rules, so it renders the toolbar without them today.

## 2. Baseline kept unchanged

- Placement: `placeAbove` and its test in `SelectionToolbar.test.ts`.
- Hidden while the primary button is held on the host; pressing the canvas
  closes open disclosures.
- `disclosureKey`: Escape closes an open `<details>` and refocuses its summary.
  It is attached to the new Text disclosure too.
- `props.simple` hides Frame selection and the five boolean actions.
- Straighten shows only when `straightenConnector` is enabled; the six align
  actions show only when `alignLeft` is enabled.
- Every action button still runs `runAction(getAction(id), context)` and is
  disabled when `action.enabled(context)` is false.
- Colour swatches still write `fill` / `stroke` through `setSelectionStyle`.
- Properties still calls `props.onMore()`.
- design-appearance.md section 4.3: colour values in `SelectionToolbar.css`
  are `var(--existing-token, <desktop light literal>)`;
  `apps/desktop/src/styles/theme-tokens.test.ts` enforces it. Dark theme comes
  from the desktop dark token block, so no light-only value is ever used where
  a token is defined. No new custom property is introduced.

## 3. Components

### 3.1 `packages/ui-solid/src/text-format.ts` (new, DOM-free)

Pure functions over `VisualStyle` (from `@nodetto/ir`) returning
`StylePatch` (from `@nodetto/core`). No Solid, no DOM.

- `DEFAULT_FONT_SIZE = TEXT_NOTE_FONT_SIZE` (13, imported from
  `@nodetto/core`); the value text notes, node labels and the inspector's
  "Custom size" field fall back to.
- `FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72]`,
  so `MIN_FONT_SIZE = 8`, `MAX_FONT_SIZE = 72`. The list contains every
  inspector preset (10 to 32).
- `textFormatState(style: VisualStyle | undefined): TextFormatState`
  - `fontSize`: `style.fontSize ?? DEFAULT_FONT_SIZE`.
  - `bold`: `(style.fontWeight ?? 400) >= 600`.
  - `italic`: `style.fontStyle === "italic"`.
  - `underline` / `strikethrough`: `textDecoration` contains `underline` /
    `line-through`.
  - `textAlign`: `style.textAlign ?? null` (null means default; no button
    pressed).
  - `verticalAlign`: `style.verticalAlign ?? "top"` (the inspector's default).
- `stepFontSize(current, direction: -1 | 1): number | null`: the largest step
  strictly below (`-1`) or the smallest step strictly above (`+1`) `current`;
  `null` when none exists (at or beyond a bound). Non-step values (15) move to
  the neighbouring step (14 / 16). The UI disables the button on `null`.
- `fontSizePatch(style, direction): StylePatch | null` -> `{ fontSize: n }`.
- `boldPatch(style)`: bold -> `{ fontWeight: null }`, else `{ fontWeight: 700 }`.
- `italicPatch(style)`: italic -> `{ fontStyle: null }`, else
  `{ fontStyle: "italic" }`.
- `decorationPatch(style, "underline" | "line-through")`: flips that flag and
  writes the combination: both -> `"underline line-through"`, one -> that one,
  none -> `null` (clears; never writes `"none"`).
- `textAlignPatch(style, value)`: `style.textAlign === value` -> `null`, else
  `value` (inspector behaviour).
- `verticalAlignPatch(style, value)`: `style.verticalAlign === value` -> `null`,
  else `value`. Clicking the implicit default `top` while unset writes `top`
  explicitly; that is visually identical and acceptable.
- `supportsVerticalAlign(leaves)`: `leaves.length > 0` and every leaf type is
  `text.note` (same rule as `StyleSection.tsx`).

Tests: `packages/ui-solid/src/text-format.test.ts` covers state from an empty
and a full style, every patch in both directions, decoration combination,
stepping across bounds and from non-step values, and
`DEFAULT_FONT_SIZE === 13`.

### 3.2 `packages/ui-solid/src/ToolbarIcon.tsx` (new)

- `TOOLBAR_ICONS`: a `const` record from toolbar control key to Lucide name.
  It is the only place the toolbar names icons; `ToolbarIconKey = keyof typeof
  TOOLBAR_ICONS`. Names (all verified present in
  `packages/core/src/icons/lucide-data.generated.ts`):

  | key | icon | key | icon |
  | --- | --- | --- | --- |
  | duplicate | copy | booleanUnion | squares-unite |
  | delete | trash-2 | booleanSubtract | squares-subtract |
  | comment | message-square-plus | booleanIntersect | squares-intersect |
  | straightenConnector | minus | booleanExclude | squares-exclude |
  | colors | palette | flattenBoolean | layers-2 |
  | text | type | alignLeft | align-start-vertical |
  | arrange | layers | alignHCenter | align-center-vertical |
  | properties | sliders-horizontal | alignRight | align-end-vertical |
  | bringToFront | bring-to-front | alignTop | align-start-horizontal |
  | sendToBack | send-to-back | alignVCenter | align-center-horizontal |
  | frameSelection | frame | alignBottom | align-end-horizontal |
  | group | group | bold | bold |
  | ungroup | ungroup | italic | italic |
  | fontSmaller | a-arrow-down | underline | underline |
  | fontLarger | a-arrow-up | strikethrough | strikethrough |
  | textAlignStart | text-align-start | verticalTop | align-vertical-justify-start |
  | textAlignMiddle | text-align-center | verticalMiddle | align-vertical-justify-center |
  | textAlignEnd | text-align-end | verticalBottom | align-vertical-justify-end |

- `ToolbarIcon(props: { name: ToolbarIconKey })`: an `aria-hidden` 16 x 16
  `<svg>` whose `innerHTML` is `renderIconMarkup(findIcon(...) ?? { path: "" },
  box 0..16, { stroke: "currentColor", strokeWidth: 2, fill: "none",
  viewBox: 24 })`, the IconPicker pattern. `currentColor` makes it follow the
  button ink in both themes and the disabled ink.
- Test `ToolbarIcon.test.ts`: every `TOOLBAR_ICONS` value resolves through
  `findIcon`. Because `SelectionToolbar.tsx` only accepts `ToolbarIconKey`,
  this covers every icon the toolbar uses.

### 3.3 `SelectionToolbar.tsx` changes

- `button(id: ActionId, icon: ToolbarIconKey)` renders
  `<button class="nodetto-float-button">` with `<ToolbarIcon>` as its only
  child, `title` and `aria-label` both `actionTitle(action)`, `disabled` as
  today. `ARRANGE_BUTTONS` keeps the ids and drops the labels.
- Summaries contain only `<ToolbarIcon>` and carry `title` / `aria-label`:
  "Colors", "Text", "Arrange". Properties: "Edit selection properties"
  (no action exists, so no shortcut).
- Text disclosure (between Colors and Arrange, shown whenever the toolbar is):
  - `leaves = leafElements(store, selection)` (as `Inspector.tsx`), first leaf
    style feeds `textFormatState`, recomputed on `signals.rev()` /
    `signals.selection()`.
  - Size row: smaller button, an `<output aria-label="Font size">` showing the
    current size number, larger button; a button whose step is `null` is
    disabled. Title / aria-label "Smaller text" / "Larger text".
  - Style row: Bold, Italic, Underline, Strikethrough toggles with
    `aria-pressed`.
  - Align row: Align text left / centre / right with `aria-pressed`
    (`textAlign === value`), titles noting "click again for default".
  - Vertical row only when `supportsVerticalAlign(leaves)`: Top / Middle /
    Bottom with `aria-pressed` against `state.verticalAlign`.
  - Every click: `editor.setSelectionStyle(patch)`; one command batch and one
    undo step over every leaf reached through groups. No new Command kind.
- Text controls add no read-only handling of their own; they behave exactly
  like the existing colour swatches, which also call `setSelectionStyle`
  directly.

### 3.4 CSS

`SelectionToolbar.css` becomes self-contained. Every rule is scoped under
`.nodetto-selection-toolbar` and uses existing tokens with section 4.3
fallbacks:

- Container: the positioning, flex, gap, padding, border, background,
  shadow (`var(--app-shadow-medium, rgba(29, 42, 46, 0.12))`), `will-change`
  and `user-select` currently in panels.css.
- `.nodetto-float-group` and its last-child rule.
- `.nodetto-float-button` and `> summary`: 26 x 26 px, `display: inline-flex`
  centred, `padding: 0`, transparent border, `color: var(--nodetto-ink, ...)`,
  hover `var(--nodetto-accent-soft, ...)`, `[aria-pressed="true"]` uses the
  accent-soft background plus `var(--nodetto-accent, ...)` border,
  `:disabled` uses `var(--app-disabled-soft-ink, #a8a8a8)` and
  `cursor: default`, `:focus-visible` outline `var(--nodetto-accent, ...)`.
- Swatch row/swatch/stroke/none rules scoped under the toolbar, copied from
  panels.css values.
- Text disclosure body: rows (`flex`, `gap: 2px`) and the size output
  (min-width, centred, tabular numbers, `font-size: 0.74rem`).

`apps/desktop/src/styles/panels.css`: delete the "Floating selection toolbar"
container rule and the `.nodetto-float-group`, `.nodetto-float-colours`,
`.nodetto-float-button` rules (only `SelectionToolbar.tsx` uses those classes,
per `git grep`). The global `.nodetto-swatch*` rules stay (shared with the
inspector). `buttons.css` / `square-chrome.css` group the toolbar inside
`:where(...)` selectors with zero specificity, so the scoped toolbar rules win
without edits there.

Styled tooltips are not added; the native `title` satisfies the requirement.

## 4. Docs

`docs/editing.md` (around line 399, "Straighten on the selection toolbar"):
describe the toolbar as icons with hover names and add one paragraph for the
Text disclosure (size steps, bold, italic, underline, strikethrough,
alignment, vertical alignment for text notes, one undo step per click).

## 5. Plans

| plan | files (writePaths) | depends on |
| --- | --- | --- |
| stb-text-format | `packages/ui-solid/src/text-format.ts`, `text-format.test.ts` | none |
| stb-toolbar-icon | `packages/ui-solid/src/ToolbarIcon.tsx`, `ToolbarIcon.test.ts` | none |
| stb-toolbar-wiring | `SelectionToolbar.tsx`, `SelectionToolbar.css`, `SelectionToolbar.test.ts`, `apps/desktop/src/styles/panels.css`, `docs/editing.md`, `packages/ui-solid/src/index.ts` (only if exports are needed) | both |

All use `artifactRoots: ["target"]`.

## 6. Verification

- Plan 1: `bun test packages/ui-solid/src/text-format.test.ts`;
  `bun run typecheck`.
- Plan 2: `bun test packages/ui-solid/src/ToolbarIcon.test.ts`;
  `bun run typecheck`.
- Plan 3: `bun run typecheck`;
  `bun test packages/ui-solid/src/SelectionToolbar.test.ts packages/ui-solid/src/text-format.test.ts packages/ui-solid/src/ToolbarIcon.test.ts apps/desktop/src/styles/theme-tokens.test.ts`;
  `bun .agents/scripts/strict-index-gate.ts`; `mise run lint`;
  `mise run verify` (up to 3 attempts for deadline tests under load; deadlines
  never relaxed).

## 7. Acceptance

1. No visible label text in toolbar buttons or summaries (only icons and the
   numeric font size value).
2. Every button / summary has `title` equal to `aria-label`; action buttons
   use `actionTitle`; toggles expose `aria-pressed`.
3. `ToolbarIcon.test.ts` fails if any `TOOLBAR_ICONS` name is missing.
4. Text controls write through `setSelectionStyle` with the patches in 3.1;
   vertical alignment only for all-`text.note` selections.
5. Section 2 behaviour unchanged; `placeAbove` test passes.
6. `theme-tokens.test.ts` passes; no new custom property.
7. Section 6 commands exit 0.
