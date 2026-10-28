# appearance-03-chrome-tokens

- planId: appearance-03-chrome-tokens
- planPath: impl-plans/active/appearance-03-chrome-tokens.md
- wave: 1
- dependsOn: none
- design: `design-docs/specs/design-appearance.md` sections 2 (invariants
  2, 4), 4.1, 4.2, 5.4 (presence label token)
- progress log: `impl-plans/progress/appearance-03-chrome-tokens.md`
- scratch: `tmp/canvas-theme-s539/appearance-03-chrome-tokens/`

## Intent and context

Give the desktop chrome a complete dark token set and remove every colour
literal from the desktop chrome CSS, so `:root[data-nodetto-theme="dark"]`
restyles all chrome. Light rendering must stay identical. Read
`appearance-00-overview.md` first.

## Non-goals

- Do not edit `apps/desktop/src/styles/canvas.css` or
  `apps/desktop/src/styles/canvas-gestures.css` (plan 04).
- Do not edit ui-solid CSS (plan 05).
- Do not change selectors, layout, spacing, cascade order or `style.css`
  imports. Change colour values only.
- Do not change any existing light token value (the 13 tokens in
  `base.css`).

## writePaths

- apps/desktop/src/styles/base.css
- apps/desktop/src/styles/app-header.css
- apps/desktop/src/styles/cloud.css
- apps/desktop/src/styles/panels.css
- apps/desktop/src/styles/prototype-preview.css
- apps/desktop/src/styles/side-panels.css
- apps/desktop/src/styles/toolbar.css
- apps/desktop/src/buttons.css
- apps/desktop/src/inspector.css
- apps/desktop/src/pane.css
- apps/desktop/src/square-chrome.css
- apps/desktop/src/TemplateDialog.css
- apps/desktop/src/settings/settings.css
- impl-plans/progress/appearance-03-chrome-tokens.md (new)

## File-level changes

### `base.css`

1. Keep the existing `:root { ... }` block as the light set. Leave the 13
   existing token values byte-identical. Append the new tokens (step 3)
   inside that block, after `--app-chrome-active`.
2. Directly after the light block, add
   `:root[data-nodetto-theme="dark"] { ... }`. It declares every custom
   property of the light block, and nothing else (no `font-family`,
   `color` or `background`; those resolve through the tokens). Use the
   dark values from design 4.1 for the 13 existing tokens.
3. For each colour literal found in the files of this plan, reuse an
   existing token if its light value is the same colour (compare
   normalized: `#fff` == `#ffffff` == `white`). Otherwise add a token named
   for its role, for example `--nodetto-on-accent`, `--nodetto-danger`,
   `--nodetto-danger-surface`, `--nodetto-warning-surface`,
   `--nodetto-shadow`, `--nodetto-backdrop`,
   `--nodetto-presence-label-ink`. The light value is the exact literal
   replaced. Do not round `#0006` to `rgb(...)`; keep the literal text.
4. Relocate the button tokens (F-S5-01a). `apps/desktop/src/buttons.css:4-9`
   has its own `:root` rule declaring `--app-button-surface: #f0f2f3`,
   `--app-button-hover: #e5e9ec` and `--app-button-active: #d8dfe3`. Move
   these three declarations into the light `:root` block of `base.css`,
   byte-identical, and give them dark values in the dark block (button
   surfaces sit on `--app-chrome-surface`; pick values that stay visibly
   distinct from it and from each other, and keep `--nodetto-ink` text on
   them at 4.5:1 or more). Remove the three lines from `buttons.css`. Keep
   `--app-control-radius: 6px` in the `buttons.css` `:root` rule because it
   is not a colour. `style.css` imports `buttons.css` before `base.css`, but
   custom properties resolve at use time, so moving them does not change
   the cascade. Record this reasoning.
5. Classify each new token's role: `text`, `background`, `border`,
   `shadow` or `fixed`. A `fixed` token has the same value in both themes;
   use it for colours that sit on user-coloured or document surfaces (for
   example the presence label ink `#fffdf8` on a collaborator colour,
   design 5.4). Choose dark values so that every text token reaches 4.5:1
   against each background it is drawn on in the dark theme.

### All other files in writePaths

Replace each colour literal (hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`,
`white`, `black`, including inside `box-shadow`, gradients and
`color-mix()`) with `var(--token)`. Keep `transparent`, `currentColor`,
`inherit` and `color-mix()` over tokens. Where a literal appears inside
`color-mix(in srgb, <literal> N%, transparent)`, replace only the literal.

Known hotspots: `side-panels.css` (about 43 literals, including the comment
pin `border: 2px solid #fff`, which becomes a `fixed` token so pins read on
both canvases), `inspector.css` (14), `cloud.css` (11; presence label
`#fffdf8` becomes `--nodetto-presence-label-ink`, `fixed`), `buttons.css`
(11), `panels.css` (10), `app-header.css` (7), `toolbar.css`,
`prototype-preview.css`, `pane.css` (6 each), `settings.css` (3, including
`background: #0006`), `TemplateDialog.css` (2). `square-chrome.css` has
none today; touch it only if a literal appears.

Handling a literal that is a `var()` fallback (F-S5-01b). Before editing
any `var(--name, <literal>)`, check whether `--name` is declared in any
desktop CSS (`grep -rn -- "--name:" apps/desktop/src`).

- Declared in `base.css` (for example `var(--app-chrome-surface, #fff)`):
  drop the fallback, which leaves `var(--app-chrome-surface)`. Record the
  check.
- Declared nowhere: the literal is what renders today. At HEAD 28c9ded
  this applies to `--line`, `--surface`, `--ink`, `--nodetto-border`,
  `--nodetto-panel-bg` and `--nodetto-text`, with 18 uses in
  `styles/side-panels.css` (lines 9, 10, 95, 146, 150, 164, 167, 174, 257,
  260, 261, 300, 309) and `styles/app-header.css` (lines 14, 15, 20, 21,
  22). Replace the whole `var(...)` with a declared token whose light value
  equals the literal: `#d8d2c3` -> `var(--nodetto-line)`, `#fffdf8` ->
  `var(--nodetto-surface)`, `#fff` -> `var(--app-chrome-surface)`. For
  `#172124`, `#172b35`, `#ddd` and `#ccc`, no token matches, so add a
  role-named token whose light value is the exact literal (for example
  `--app-popover-ink: #172124`, `--app-header-ink: #172b35`,
  `--app-divider: #ddd`, `--app-divider-strong: #ccc`) with a dark value,
  and reference it.
- Never just delete the fallback of an undeclared name. `var(--line)` with
  no declaration is invalid at computed-value time: borders become
  `currentColor` and backgrounds become transparent, which changes light
  rendering.
- Exception: `--app-cloud-top` (`styles/cloud.css:41,44`) is a length set
  inline by `apps/desktop/src/App.tsx:497`. It is not a colour. Leave it
  as it is.

Pitfalls:

- `inspector.css` also styles document elements, for example
  `.nodetto-text-note` and `.nodetto-text-editor`. Those rules already use
  tokens and are covered by plan 04's paint pin. Do not change their token
  names. Replace any literal there with a `fixed` token, so that document
  paint never changes with the theme.
- `prototype-preview.css`: if a literal paints the previewed document or
  device screen rather than chrome, use a `fixed` token.
- A selector such as `#app` is not a colour. Do not touch it.
- Keep the token-reference form `var(--x)`. Desktop CSS does not need
  fallbacks.

## Progress log: token registry (contract for plans 05 and 07)

Record a table with one row per token you added:
`name | light | dark | role | pairs with (background tokens for text
tokens)`. Also list every existing token whose meaning you relied on in a
new pair (for example `--nodetto-on-accent` on `--nodetto-accent`).

## Tests and checks

This plan adds no test file. Plan 07 owns `theme-tokens.test.ts`. Run
these mechanical checks.

- Literal sweep, which must print nothing:
  `grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b" apps/desktop/src/styles/app-header.css apps/desktop/src/styles/cloud.css apps/desktop/src/styles/panels.css apps/desktop/src/styles/prototype-preview.css apps/desktop/src/styles/side-panels.css apps/desktop/src/styles/toolbar.css apps/desktop/src/buttons.css apps/desktop/src/inspector.css apps/desktop/src/pane.css apps/desktop/src/square-chrome.css apps/desktop/src/TemplateDialog.css apps/desktop/src/settings/settings.css > tmp/canvas-theme-s539/appearance-03-chrome-tokens/literals.log; echo "exit=$?"`
  -> exit 1 (no match) and an empty log. Inspect any matches. A `#id`
  selector false positive must be justified in the progress log.
- `base.css`: all literal matches fall inside the two `:root` blocks.
  Record the line ranges of both blocks and the line numbers of the
  matches.
- Parity: the sorted custom-property names of the light and dark blocks
  are identical. Extract them with a `grep -o "\-\-[a-z0-9-]*:"` per
  block, diff them, and record the diff exit code (0).
- Light unchanged: `git diff -U0 -- apps/desktop/src/styles/base.css`
  shows no removed line among the 13 original token lines. The light
  `--app-muted-label` value is `#6d7679` (the one allowed change; see
  Invariants), and the former `#727b7e` literal no longer appears.
- Contrast: write a scratch script
  `tmp/canvas-theme-s539/appearance-03-chrome-tokens/contrast.ts`, which is
  not a test file. It computes WCAG contrast for every text/background pair
  in your registry plus the design 6 item 5 pairs, in both themes. Run
  `bun tmp/canvas-theme-s539/appearance-03-chrome-tokens/contrast.ts`; every
  pair must be at least 4.5. Record the output.
- Undeclared var() check (expected 0): collect every `var(--name` used in
  the files of this plan and every `--name:` declared in
  `apps/desktop/src/**/*.css` plus `packages/ui-solid/src/**/*.css`, then
  diff the two sets. For example, run `grep -ohE "var\(--[a-z0-9-]+"` on
  the files, `sed 's/var(//'`, `sort -u` into
  `tmp/canvas-theme-s539/appearance-03-chrome-tokens/used.txt`, do the
  same for the declarations into `decl.txt`, and run
  `comm -23 used.txt decl.txt`. The only allowed output line is
  `--app-cloud-top`. Record the output and the count.
- Button token move: `grep -c -- "--app-button-" apps/desktop/src/buttons.css`
  prints 0, and `grep -c -- "--app-button-" apps/desktop/src/styles/base.css`
  prints 6 (3 light and 3 dark declarations; uses in other files are
  `var()` references and do not count).
- `bun test apps/desktop/src/style.test.ts > tmp/canvas-theme-s539/appearance-03-chrome-tokens/style-test.log 2>&1; echo "exit=$?"`
  -> exit 0. This test inlines the whole `style.css` import tree,
  including plan 04's `canvas.css` and `canvas-gestures.css`. Protocol
  rule 8 applies: the result counts only if plan 04's progress log ends
  with `STATUS: done`. Otherwise, record it as `pending-join`.
  Reconciliation reruns it.
- `bunx biome check <each file in writePaths except the progress log> --diagnostic-level=warn`
  -> exit 0, if biome checks CSS in this repo. If biome ignores CSS,
  record that.

## Invariants

- Light computed colours are unchanged: each replaced literal maps to a
  token whose light value is the same colour. The single exception
  (design section 2, invariant 2) is the light `--app-muted-label`, which
  is `#6d7679` (4.65:1 on `--app-chrome-surface`) instead of the former
  `#727b7e` (4.33:1), so the contrast gate passes.
- The dark block declares exactly the light block's names.
- No colour literal remains outside the two `:root` blocks.
- No `var()` in the plan's files references an undeclared name, except
  `--app-cloud-top`.

## Done criteria

- The literal sweep is empty, the parity diff exits 0, the undeclared
  var() diff prints only `--app-cloud-top`, the button-token counts are
  0 and 6, and the contrast script shows every pair at 4.5 or more.
- The style test either passes or is recorded as `pending-join` under
  rule 8.
- The progress log contains the token registry, hashes and an intent
  snapshot, and its last line is `STATUS: done`.
