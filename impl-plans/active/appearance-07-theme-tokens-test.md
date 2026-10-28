# appearance-07-theme-tokens-test

- planId: appearance-07-theme-tokens-test
- planPath: impl-plans/active/appearance-07-theme-tokens-test.md
- wave: 3
- dependsOn: appearance-03-chrome-tokens, appearance-04-canvas-css,
  appearance-05-ui-solid-chrome-css
- design: `design-docs/specs/design-appearance.md` sections 4.1, 4.2 and
  6 items 1-7 (case 1b enforces the 4.1/4.2 rule that only declared tokens
  are referenced)
- progress log: `impl-plans/progress/appearance-07-theme-tokens-test.md`
- scratch: `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/`

## Intent and context

Lock the theming rules into one permanent test. It checks for no stray
literals, dark/light parity, unchanged light values, the document paint
pin, WCAG contrast, ui-solid fallback equality and export isolation. Read
`appearance-00-overview.md` and the token registries in
`impl-plans/progress/appearance-03-chrome-tokens.md` and
`appearance-05-ui-solid-chrome-css.md` first.

## Non-goals

- Do not fix residual literals or wrong token references in CSS files you
  do not own. Record each one as a finding with the owning plan, and the
  serial repair after the join fixes it.
- No new runtime code and no DOM harness.

## writePaths

- apps/desktop/src/styles/theme-tokens.test.ts (new)
- impl-plans/progress/appearance-07-theme-tokens-test.md (new)

## sharedPaths

- apps/desktop/src/styles/base.css. Only dark values may change, and only
  to reach a contrast ratio the test requires. No name, light value or
  ordering change.
- apps/desktop/src/styles/canvas.css. Only dark canvas-set values may
  change, for the same reason.

## Test design (`theme-tokens.test.ts`)

Imitate `apps/desktop/src/style.test.ts`. Use its `stylesheet()` `@import`
inliner, its comment stripping and its `rules()` splitter. Read files with
`readFileSync` relative to `import.meta.dir`. Write small local helpers:
parse a rule body into `Map<name, value>`, normalize a colour to
lowercase `#rrggbb` (accept `#rgb`, `#rgba`/`#rrggbbaa` with alpha noted,
`rgb()` space or comma syntax with an optional `/ a`, `white`, `black`),
and compute WCAG relative luminance and contrast. For a colour with
alpha, composite it over its background before measuring. Every lookup
result must be checked with `if (x === undefined) throw` or `expect`. Do
not use non-null assertions. The code must typecheck under
`noUncheckedIndexedAccess`.

Constants:

- `DESKTOP_FILES`: `styles/*.css` (all nine), `../buttons.css`,
  `../inspector.css`, `../pane.css`, `../square-chrome.css`,
  `../style.css`, `../TemplateDialog.css`, `../settings/settings.css`.
- `UI_SOLID_CHROME_FILES`: the 15 files listed in plan 05.
- `LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b/`.
  Apply it to declaration values only, never to selectors (avoid `#app`).

Test cases:

1. "desktop chrome CSS has no colour literals outside token blocks". Read
   each file in `DESKTOP_FILES` on its own, without inlining imports. The
   allowlist is keyed by (file, selector):
   - `styles/base.css`: `:root` and `:root[data-nodetto-theme="dark"]`.
   - `styles/canvas.css`: `.nodetto-canvas`,
     `.nodetto-canvas.nodetto-canvas-dark`, and the pin selector.

   A literal is allowed only as the value of a custom-property declaration
   (`--x: ...`) in an allowlisted (file, selector) pair. In every other
   file, a `:root { --x: #fff }` fails like any other literal; this is what
   catches tokens declared outside `base.css`, for example the old
   `buttons.css` button tokens. Normal declarations in allowlisted rules
   (for example `background-color`) are still checked. A failure message
   names the file, selector and value.
1b. "every desktop var() reference is declared". Every `var(--name` used in
   `DESKTOP_FILES` must be declared (`--name:`) somewhere in
   `DESKTOP_FILES` or `UI_SOLID_CHROME_FILES`. Non-colour locals such as
   `--pane-width`, `--app-control-radius` and `--nodetto-switch-*` pass
   because they are declared in `pane.css` and `buttons.css`. The only
   exception is an explicit, commented allowlist of names set inline by
   TSX. Today that is exactly `--app-cloud-top`
   (`apps/desktop/src/App.tsx:497`). This catches `var(--line)`-style
   references to undeclared names, which render as invalid values.
2. "dark chrome tokens mirror light tokens": the name sets of `:root` and
   `:root[data-nodetto-theme="dark"]` in `base.css` are equal. Do the same
   for the two canvas blocks in `canvas.css`.
3. "light values are unchanged": the 13 original tokens equal design 4.1
   light values, and the light canvas block equals design 5.2 light
   values. Hard-code both tables in the test.
4. "document paint pin keeps light defaults": find the rule whose selector
   contains `.nodetto-backdrop-layer`, `.nodetto-shape-layer`,
   `.nodetto-connector-layer` and `.nodetto-text-editor`. It declares the
   six tokens with values equal to light `:root`, plus
   `color: var(--nodetto-ink)` and `color-scheme: light`. A missing
   declaration fails.
5. "theme text meets WCAG AA": run every pair at 4.5 or more in both
   themes. Pairs: the design 6 item 5 list, plus every text pair recorded
   in the plan 03 and 05 registries. Hard-code the pair list in the test,
   with a comment pointing to the design. Canvas pairs for both canvas
   sets: overlay on bg at 3 or more; ruler text on ruler surface at 4.5 or
   more.
6. "ui-solid chrome CSS falls back to the light tokens": in
   `UI_SOLID_CHROME_FILES`, every declaration value matching `LITERAL`
   must have each literal as a `var(--name, literal)` fallback. Where
   `base.css` light defines `--name`, the normalized values are equal.
7. "exports take no input from appearance": read the sources of
   `packages/core/src/svg-export.ts`, every `.ts` under
   `packages/core/src/svg-export/`, `packages/core/src/pcb-export.ts`,
   `packages/ui-solid/src/raster-export.ts`, `pdf-export.ts`,
   `pcb-export.ts`, `breadboard-export.ts`, and every non-test `.ts`
   under `packages/io/src/jsonl/`. Use `readdirSync` and skip
   `*.test.ts`. None contains `data-nodetto-theme`, `nodetto-canvas-dark`,
   `canvasBackground`, `matchMedia`, `getComputedStyle` or
   `settings/appearance`.

Pitfalls:

- Do not let the parser treat `@media` wrappers as rules. The existing
  `rules()` regex matches innermost `{...}` only. Confirm `@media
  (forced-colors: active)` blocks in `base.css` still parse correctly.
- `color-mix(in srgb, var(--x) 92%, transparent)` contains no literal. Do
  not flag it.
- When a case fails because of another plan's file, do not edit that file.
  Mark the finding in the progress log as `owner: <planId>` and stop.

## Verification

- `bun test apps/desktop/src/styles/theme-tokens.test.ts apps/desktop/src/style.test.ts > tmp/canvas-theme-s539/appearance-07-theme-tokens-test/test.log 2>&1; echo "exit=$?"`
  -> exit 0, with the 8 theme cases (1, 1b, 2-7) and 5 negative cases
  passing.
- Negative evidence inside the test. Write the case 1, 1b, 4 and 6 checks
  as pure functions that take CSS text plus a file name, or for 1b a
  declared-name set, and return problem messages (`string[]`). Run them on
  the real files. Add five negative cases that feed them inline snippets;
  each must return at least one problem:
  (a) a pin rule without `color-scheme: light`;
  (b) `.x { color: #fff; }` in a non-token rule;
  (c) a ui-solid rule `a { color: #123456; }` without a `var()`;
  (d) the case 1 function given file name `buttons.css` and
      `:root { --x: #fff; }`;
  (e) the case 1b function given `.a { border-color: var(--nope); }`.
  Never mutate repository files for this.
- `bun run typecheck > tmp/canvas-theme-s539/appearance-07-theme-tokens-test/typecheck.log 2>&1; echo "exit=$?"`
  -> exit 0.
- `bunx biome check apps/desktop/src/styles/theme-tokens.test.ts --diagnostic-level=warn`
  -> exit 0.
- If you changed shared paths, run `git diff -U0 -- apps/desktop/src/styles/base.css apps/desktop/src/styles/canvas.css`
  and confirm that only dark values changed.

## Done criteria

- The test file exists with the 8 cases (1, 1b, 2-7) plus 5 negative
  cases, and the verification commands pass.
- The progress log lists any findings with owners, any dark-value
  adjustments (old -> new, with ratio), the commands, exit codes and log
  paths, and its last line is `STATUS: done`.
