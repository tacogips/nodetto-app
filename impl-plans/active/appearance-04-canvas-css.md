# appearance-04-canvas-css

- planId: appearance-04-canvas-css
- planPath: impl-plans/active/appearance-04-canvas-css.md
- wave: 1
- dependsOn: none (styles the class pinned by plan 02; no file overlap)
- design: `design-docs/specs/design-appearance.md` sections 2 (invariants
  1, 2, 4), 5.2, 5.3, 5.5
- progress log: `impl-plans/progress/appearance-04-canvas-css.md`
- scratch: `tmp/canvas-theme-s539/appearance-04-canvas-css/`

## Intent and context

Make the canvas background, dot grid, rulers and editing overlays follow a
canvas mode (`.nodetto-canvas` versus `.nodetto-canvas.nodetto-canvas-dark`)
that does not depend on the chrome theme. Also pin document element
default paint to the light palette, so a dark chrome theme never recolours
elements. Read `appearance-00-overview.md` first.

## Non-goals

- No TSX changes. `Canvas.tsx` emits the class in plan 02.
  `CanvasRulers.tsx` is unchanged.
- No changes to element default rules (`.nodetto-geo`, `.nodetto-node`,
  ERD, UML, sequence, marker rules), other than what the pin covers by
  inheritance.
- Do not pin the overlay layer, the slot layer, rulers or the PCB layers
  panel.
- Do not edit any file other than the two CSS files.

## writePaths

- apps/desktop/src/styles/canvas.css
- apps/desktop/src/styles/canvas-gestures.css
- impl-plans/progress/appearance-04-canvas-css.md (new)

## File-level changes

### `canvas.css`: token blocks

1. In the existing `.nodetto-canvas { ... }` rule, or in a new rule placed
   directly before it, declare the light canvas set with the exact values
   from design 5.2: `--nodetto-canvas-bg: #f6f4ee`,
   `--nodetto-canvas-grid: #e3ded1`, `--nodetto-canvas-ruler-surface:
   #fffdf8`, `--nodetto-canvas-ruler-line: #d8d2c3`,
   `--nodetto-canvas-ruler-text: #596366`, `--nodetto-canvas-overlay:
   #335c67`, `--nodetto-canvas-handle-fill: #fffdf8`. Also declare these
   fixed tokens, with the same value in both sets:
   `--nodetto-canvas-crop-line: #f8fafc`, `--nodetto-canvas-crop-handle:
   #f97316`, `--nodetto-canvas-crop-mask: rgb(15 23 42 / 45%)`,
   `--nodetto-canvas-gradient-line: #0f172a`, `--nodetto-canvas-shadow:
   rgb(0 0 0 / 18%)`.
2. Add `.nodetto-canvas.nodetto-canvas-dark { ... }` with the same names
   and the dark values: `#15191b`, `#343c40`, `#1f2427`, `#3a4245`,
   `#a3adb1`, `#5fb4c7`, `#1f2427`. The fixed tokens repeat their light
   values.
3. `.nodetto-canvas` `background-color` and `background-image` use
   `--nodetto-canvas-bg` and `--nodetto-canvas-grid` instead of
   `--nodetto-canvas` and `--nodetto-grid`.

### `canvas.css`: document paint pin (design 5.3, DR-1)

Add one rule with the selector
`.nodetto-backdrop-layer, .nodetto-shape-layer, .nodetto-connector-layer,
.nodetto-text-editor`. It declares these literal light values:
`--nodetto-ink: #1d2a2e`, `--nodetto-muted: #596366`, `--nodetto-line:
#d8d2c3`, `--nodetto-surface: #fffdf8`, `--nodetto-accent: #335c67`,
`--nodetto-accent-soft: #dbe6e8`, plus `color: var(--nodetto-ink)` and
`color-scheme: light`.

- Place it after the `.nodetto-layer` rule. Specificity is one class.
  Check that `.nodetto-text-editor` in `apps/desktop/src/inspector.css`
  (loaded later, through `main.tsx`) sets `color: var(--nodetto-ink)`. It
  does, and it resolves against the pinned tokens, so the pin still holds.
  Record this check.
- Pitfall: these must be literals. `var(--nodetto-ink)` at the custom
  property level would resolve to the dark chrome value.

### Overlay rules switched to canvas tokens

Replace `--nodetto-accent` with `--nodetto-canvas-overlay` and
`--nodetto-surface` with `--nodetto-canvas-handle-fill` in these rules (line
numbers at HEAD 28c9ded):

- `canvas.css`: `.nodetto-canvas.nodetto-image-drop-active` (19),
  `.nodetto-connector.nodetto-selected line/polyline` (117),
  `.nodetto-pending-connection` (146), `.nodetto-marquee` (370-371),
  `.nodetto-selection-outline` (378), `.nodetto-handle` (384-385),
  `.nodetto-crop-handle` fill (404), `.nodetto-gradient-geometry-handle`
  fill (425). Check the `.nodetto-gradient-stop-handle` rule at 416 as
  well: switch any `--nodetto-accent`/`--nodetto-surface` use it has.
- `canvas-gestures.css`: `.nodetto-snap-guide` (32),
  `.nodetto-persistent-guide-label` (58), `.nodetto-ruler-draft` (96),
  `.nodetto-hover-target` (102-103), `.nodetto-endpoint-handle`
  (109-110), `.nodetto-connect-handle` (117-118).

Rulers in `canvas-gestures.css` (73-90): use `--nodetto-canvas-ruler-surface`
inside the existing `color-mix(... 92%, transparent)`,
`--nodetto-canvas-ruler-line` for the stroke, and
`--nodetto-canvas-ruler-text` for tick lines and text.

Literals: `.nodetto-crop-outline` and `.nodetto-gradient-axis` (`#f8fafc`
-> crop-line), `.nodetto-crop-mask` (-> crop-mask), crop and gradient
handle stroke `#f97316` (-> crop-handle), gradient geometry stroke
`#0f172a` (-> gradient-line), and the image-drop error shadow (->
`--nodetto-canvas-shadow`).

Leave `.nodetto-image-drop-overlay`/`-error` border, background and text,
and the image-drop error button colour, on chrome tokens. They are chrome
popups and follow the theme.

Pitfall: `.nodetto-connector.nodetto-selected` lives inside the pinned
connector layer. Because it now names `--nodetto-canvas-overlay`, which
the pin does not re-declare, the selection colour follows the canvas mode.
That is intended.

## Checks

- Literal placement:
  `grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b" apps/desktop/src/styles/canvas.css apps/desktop/src/styles/canvas-gestures.css > tmp/canvas-theme-s539/appearance-04-canvas-css/literals.log; echo "exit=$?"`.
  Every match must be inside the light canvas block, the dark canvas block
  or the pin block. Record the block line ranges and the match lines.
  `canvas-gestures.css` must have no match.
- Overlay sweep: `grep -nE "var\(--nodetto-(accent|surface)\)" apps/desktop/src/styles/canvas-gestures.css`
  prints nothing. In `canvas.css`, the remaining matches are only element
  default rules and the image-drop chrome popups. List them.
- Light parity: the light canvas values equal the HEAD values of the
  tokens they replace (`--nodetto-canvas`, `--nodetto-grid`,
  `--nodetto-surface`, `--nodetto-line`, `--nodetto-muted`,
  `--nodetto-accent` from `base.css`). Record the comparison.
- Contrast (scratch script `tmp/canvas-theme-s539/appearance-04-canvas-css/contrast.ts`):
  overlay on bg at 3 or more, and ruler text on ruler surface at 4.5 or
  more, for both sets. Expected about 6.66/7.45 and 6.07/6.84.
- `bun test apps/desktop/src/style.test.ts > tmp/canvas-theme-s539/appearance-04-canvas-css/style-test.log 2>&1; echo "exit=$?"`
  -> exit 0. This test guards element defaults with `:not([fill])`; the
  plan must not break it. It inlines the whole `style.css` tree, including
  plan 03's files. Overview protocol rule 8 applies: the result counts only
  once plan 03's progress log ends with `STATUS: done`. Otherwise, record
  it as `pending-join`; reconciliation reruns it.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid/src/canvas-rulers.test.ts > tmp/canvas-theme-s539/appearance-04-canvas-css/rulers.log 2>&1; echo "exit=$?"`
  -> exit 0.

## Invariants

- On a light canvas, every overlay, ruler, grid and background colour
  equals today's value.
- Element default paint and inherited text colour/colour scheme in the
  pinned layers are light in every theme.

## Done criteria

- The checks above pass and are recorded. `grep -c "color-scheme: light" apps/desktop/src/styles/canvas.css`
  prints 1. `grep -c "nodetto-canvas-dark" apps/desktop/src/styles/canvas.css`
  prints at least 1.
- The style test passes, or is recorded as `pending-join` under rule 8.
- The progress log contains hashes, the intent snapshot and the block line
  ranges, and its last line is `STATUS: done`.
