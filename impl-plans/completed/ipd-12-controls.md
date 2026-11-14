# ipd-12-controls

- planId: ipd-12-controls
- planPath: impl-plans/active/ipd-12-controls.md
- progressPath: impl-plans/progress/ipd-12-controls.md
- dependsOn: ipd-06-geo-strokes, ipd-07a-icon-shape (amendment 2026-11-10 operator round 3); accepted dependencies ipd-01-ir-schema, ipd-02-text-measure, ipd-03-icon-data
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 4 (4.1-4.6), D1, D2 and D3.
- Evidence: `tmp/ipd-s772/ipd-12-controls/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/svg-export/ui-control.ts`
  - `packages/core/src/ui-control-paint.ts`
  - `packages/core/src/ui-control-style.test.ts`
  - `packages/core/src/interface-code.ts`
  - `packages/core/src/interface-code-controls.test.ts`
  - `packages/ui-solid/src/shapes/UiControlView.tsx`
  - `packages/ui-solid/src/shapes/UiControlView.css`
  - `packages/ui-solid/src/inspector/UiControlSection.tsx`
  - `packages/ui-solid/src/ui-control-view.test.ts`
  - `impl-plans/progress/ipd-12-controls.md`
  - `tmp/ipd-s772/ipd-12-controls`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-12-controls`
<!-- ownership:end -->

## Intent and context

The root causes are at f59bef4:

- **D1.** Button labels are always centred (`packages/core/src/svg-export/ui-control.ts:135-140`). The canvas uses the browser's button centring (`UiControlView.tsx:12-20`).
- **D2.** Tabs and progress never call `styled()`. Colors are hard-coded `#f1f5f9`/`#d6ecef`/`#137e7e` in the SVG export (`ui-control.ts:15-81`), the canvas CSS (`UiControlView.css:39-111`) and the HTML handoff (`interface-code.ts:485-487`).
- **D3.** A label with `\n` is emitted as one `<text>`, and usvg collapses the newline.

This plan makes every control honor:

- alignment, padding, fill/stroke/stroke width, corner radius, font and color;
- the new `accentColor`/`selectedColor`;
- the tab `indicator`;
- multi-line labels and ellipsis truncation;
- leading/trailing icons and badges;

consistently in SVG export, canvas and HTML handoff.

## Non-goals

- No change to output for controls without new fields, except D1/D3 fixes that only apply when `textAlign` is set or the label contains `\n`.
- No per-option tab objects; the kit covers that (Decision 4.6).
- No new control kinds.

## File-level changes

`packages/core/src/svg-export/ui-control.ts`: restructure around a resolved paint object.

```
fill = style.fill ?? legacyDefault(kind)
stroke = style.stroke ?? legacy
strokeWidth = style.strokeWidth ?? legacy
radius = cornerRadius ?? 6
accent = style.accentColor ?? "#137e7e"
selected = style.selectedColor ?? (indicator === "underline" ? accent : color)
color = style.color ?? theme.ink
```

The legacy defaults are the current literals per kind, so unset styles render identically. Tabs keep the `#f1f5f9` background and the `#d6ecef` selected cell for `indicator` `cell` when `fill`/`accentColor` are unset.

Tabs by indicator:

- `cell`: as today, with colors from the resolved paint.
- `underline`: no cell fill. A 2-unit `accent` bar at the bottom of the selected option, full option width. Labels in `color`, the selected label in `selected`.
- `pill`: a rounded rect (radius = height/2, inset 2) in `accent` behind the selected option, with the selected label in `selected`.

Progress uses `accent`. Checkbox, radio and switch checked fills use `accent`.

Labels for button, input and select:

- Text anchor from `textAlign`. Defaults: button middle; input and select start.
- Padding `visual.textPadding` (button default 12, input 10).
- Content box = box minus padding, minus icon space (`iconSize` + 6 per present icon).
- Split the label on `\n`, one `<text>` per line, with the block vertically centred and line height `fontSize * (lineHeight ?? 1.2)`.
- `textTruncate: "ellipsis"` -> single line via `truncateToWidth(..., textMeasureMode(visual))`.
- The font family is always `style.fontFamily ?? theme.fontFamily`, on every line (D3).

Icons and badge:

- Leading and trailing icons use `findIcon` + `renderIconMarkup` at `iconSize` (default 20), vertically centred, colored with `color`.
- `badge`: an empty string -> an 8-unit dot at the top-right. Otherwise a capsule (height 18, min width 18, padding 5, `accent` fill, white 11-unit bold text) at the top-right corner, offset (-4, -4) from the box's top-right.

Strokes: when `rectStrokeParts` returns parts, paint the background through `rectStrokeMarkup` (clip id `nd-strokes-<id>`).

`packages/ui-solid/src/shapes/UiControlView.tsx` and `UiControlView.css`:

- Replace the hard-coded teal and selected-cell values with CSS custom properties set inline from the same resolved paint: `--nd-control-accent`, `--nd-control-selected`, `--nd-control-fill`. The CSS fallbacks are the legacy literals.
- Apply `text-align` and `justify-content` from `textAlign`, and padding from `textPadding`.
- Render `white-space: pre-line` for multi-line labels, and the ellipsis CSS for truncation.
- Render icons through `renderIconMarkup` in an inline `<svg>`, and the badge as a span.
- Put the paint resolution in an exported pure function in core so the canvas and export share it:
  - `export function resolveUiControlPaint(element: Element, theme: { ink: string; fontFamily: string }): UiControlPaint`
  - It lives in the new `packages/core/src/ui-control-paint.ts` and is exported from `packages/core/src/index.ts` (sharedPaths, append-only).

`packages/core/src/interface-code.ts`, HTML handoff: use `resolveUiControlPaint` for tab and progress colors, plus `text-align`, `padding`, multi-line (`white-space: pre-line`) and the badge. Icons are emitted as inline SVG from `renderIconMarkup`.

`packages/ui-solid/src/inspector/UiControlSection.tsx`: add fields for:

- indicator (tabs only);
- accent color;
- selected color (tabs);
- leading icon and trailing icon (text inputs with icon suggestions via `searchIcons`);
- icon size;
- badge.

## Patterns to imitate

- `packages/core/src/svg-export/paint.ts:styled` and `centredLabel` for paint and labels.
- `packages/core/src/svg-export/text-note.ts` for per-line emission.

## Pitfalls

- Do not drop `styled()` semantics such as opacity and effects for buttons, which currently use them. Check `ui-control.ts:82-150`.
- Legacy byte-identity: existing tests that render controls must pass unchanged. That includes `packages/core/src/svg-export.test.ts`, `interface-code.test.ts`, `html-bundle.test.ts`, `apps/cli/src/html-export.test.ts` and the design templates.
- An option label equal to `value` selects it. Keep the `value ?? options[0]` rule.
- Canvas and export must use the same text anchor rule. Test both.

## Tests: new `packages/core/src/ui-control-style.test.ts`

- **D1.** A button with `textAlign: "start"`, `textPadding: 16` -> `text-anchor="start"` and x = box.x + 16. `end` -> anchor end at the right minus 16.
- **D2.** Tabs with `fill: "#ffffff"`, `accentColor: "#e0531f"`, `indicator: "underline"` -> no `#d6ecef`, no `#137e7e`, and an underline rect of height 2 in `#e0531f` under the selected option. A pill -> a rounded rect with rx = (h-4)/2.
- **D3.** A button label `"Mark\nread"` -> two `<text>` elements, with the same `font-family` as a single-line label and no `monospace`.
- `leadingIcon: "bell"` -> icon markup present, and the label x shifted by 26.
- `badge: "3"` -> capsule plus text `3`. `badge: ""` -> circle r 4.
- `textTruncate` with a long label -> ends with `…`.
- Legacy tabs (no new fields) -> still contain `#f1f5f9`, `#d6ecef` and `#137e7e`.

New `packages/ui-solid/src/ui-control-view.test.ts`:

- A start-aligned button -> style `text-align: start`.
- Underline tabs -> the `--nd-control-accent` variable is set.

New `packages/core/src/interface-code-controls.test.ts`: HTML for underline tabs uses the accent color and contains no `#137e7e`.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/ui-control-style.test.ts packages/ui-solid/src/ui-control-view.test.ts packages/core/src/interface-code-controls.test.ts packages/core/src/svg-export.test.ts packages/core/src/interface-code.test.ts packages/core/src/html-bundle.test.ts packages/core/src/templates/design-templates.test.ts apps/cli/src/html-export.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.
4. Visual evidence:
   - A fixture with: start/center/end buttons; a two-line button; underline/pill/cell tabs in custom colors; a row-like button with leading icon, trailing chevron and badge; a checked switch in accent.
   - Export `final/controls.png` at `--scale 2`, inspect it, and record the notes.

## Done criteria

- Verification passes.
- `rg -n '#137e7e' packages/ui-solid/src/shapes/UiControlView.css` -> only in `var(...)` fallbacks.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, operator round 3, ipd-07a split)

Operator decision recorded in `impl-plans/active/ipd-s772-dispatch.json` `reviewContext.designDecisionsAndRationale`: `ipd-01-ir-schema` is accepted (its code is in the working tree; `bun test packages/ir packages/io/src/jsonl/golden.test.ts` -> 213 pass, 0 fail). The new root plan `ipd-07a-icon-shape` delivers the minimal `ui.icon` core shape util (`packages/core/src/shapes/ui-icon.ts`, `defaultSemantic: () => ({icon: "square"})`) and its `createDefaultRegistry` registration, so `apps/cli/src/edit/label-field.test.ts` passes before any wave-2 plan runs a broad `bun test packages apps/cli/src` gate.

Decision for this plan: dependsOn gains `ipd-07a-icon-shape` (ordering only). writePaths, sharedPaths, scope, tests and verification are unchanged. Do not create or edit `packages/core/src/shapes/ui-icon.ts` or `packages/core/src/shapes/index.ts`. If a broad gate still fails only in `apps/cli/src/edit/label-field.test.ts` for `ui.icon`, record a finding with status `owned_elsewhere` (owner `ipd-07a-icon-shape`) instead of editing that test.
