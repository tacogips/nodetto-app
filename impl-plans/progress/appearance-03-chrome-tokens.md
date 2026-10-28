# appearance-03-chrome-tokens implementation progress

## Intent snapshot

Replace only color values in the assigned desktop chrome CSS files with declared tokens, preserve existing light token literals, add matching light/dark token blocks including moved button tokens, keep fixed document/presence paint stable, then record token pairs, contrast and plan-local gates. No selectors, layout, import order, canvas CSS, ui-solid CSS, or unrelated files are changed.

## Pre-edit SHA-256

2f2241c696fbeb53f1a501fc3b1249d0ed9f48a6b6a4d51ff3bbb0763853dcfa  apps/desktop/src/styles/base.css
0daff2c58afad3ea7a97ead1ff711702c5082bad2620d7acdb56a04ab319976d  apps/desktop/src/styles/app-header.css
cb3acefa2c1f823f54a4ac9eefb3a6fad84990b1a557e86fb5391c84189c76ab  apps/desktop/src/styles/cloud.css
806c58f43633c9faa0c82c37f9f1bfb71c799f86c560fd57ed90203ac1f3254e  apps/desktop/src/styles/panels.css
120166b19819050d1837aa947c280e9eec56e54c044c8b9f6b56cc796c66c2ec  apps/desktop/src/styles/prototype-preview.css
8d3372756d1f087ad8181f600518996d990fa71fca73f699e943480af533f6f1  apps/desktop/src/styles/side-panels.css
a2f11e3f80fcb36ddf88b12cb423bdcf28e8de41597c99e15766fde13c6c3c17  apps/desktop/src/styles/toolbar.css
a7e349693696f2148ea8a230fe1dda0600560be585d4e8e1bb1499900c9dcd02  apps/desktop/src/buttons.css
8d08ef252d21c0d737222019ab49cc931f21035130c821656c93a7bc85233c10  apps/desktop/src/inspector.css
ee6236cc83fa3abcd8cbbd4349f0b6d4ab39aeb8b585ba4ab18f268a8832990c  apps/desktop/src/pane.css
ffa58d7592cb9bc3e23be5a0e71070a43bbc60edf680c8595614cdbef8ad8463  apps/desktop/src/square-chrome.css
da0649d9f9e7422919f076dfe30e75720e09c5c679e5ff9b78e6c04668010628  apps/desktop/src/TemplateDialog.css
c3e8d2ff16dc563f128f05a68741cfa0b3af5fc4fea15d16ba6391651bd03852  apps/desktop/src/settings/settings.css

## Edit intention: apps/desktop/src/styles/base.css
Preserve the 13 existing light token declarations byte-for-byte; append role tokens and button tokens; add the exactly mirrored dark token block. Pre-edit SHA-256: 2f2241c696fbeb53f1a501fc3b1249d0ed9f48a6b6a4d51ff3bbb0763853dcfa.

## Edit intention: apps/desktop/src/styles/app-header.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: 0daff2c58afad3ea7a97ead1ff711702c5082bad2620d7acdb56a04ab319976d.
Post-edit SHA-256: 7425286e8cbf08c8f3571ba2bbd45c242eff5e120fd54870d66c20f1ec9101fa.

## Edit intention: apps/desktop/src/styles/cloud.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: cb3acefa2c1f823f54a4ac9eefb3a6fad84990b1a557e86fb5391c84189c76ab.
Post-edit SHA-256: b4e992af8a683603602a2d5fceb12cb5304418a66df0e3b1a024a3c2ae3313a2.

## Edit intention: apps/desktop/src/styles/panels.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: 806c58f43633c9faa0c82c37f9f1bfb71c799f86c560fd57ed90203ac1f3254e.
Post-edit SHA-256: 4940764fce6c8bc15e8efd69d860f8136cb733c3c93d7f8813fe1e27aa9a8e40.

## Edit intention: apps/desktop/src/styles/prototype-preview.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: 120166b19819050d1837aa947c280e9eec56e54c044c8b9f6b56cc796c66c2ec.
Post-edit SHA-256: c00360cf1698fb6bc63f91b71172a3672926b91529b03e75b11cf94c0784d4f6.

## Edit intention: apps/desktop/src/styles/side-panels.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: 8d3372756d1f087ad8181f600518996d990fa71fca73f699e943480af533f6f1.
Post-edit SHA-256: d84811f2a3d5f0c79be102732acca50ab2526044840696299ac1ac8c3cf06987.

## Edit intention: apps/desktop/src/styles/toolbar.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: a2f11e3f80fcb36ddf88b12cb423bdcf28e8de41597c99e15766fde13c6c3c17.
Post-edit SHA-256: 6e7491c1625f04d03dcd081c8b74752447b0a10d0fa2c648d70099b9cd603df2.

## Edit intention: apps/desktop/src/buttons.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: a7e349693696f2148ea8a230fe1dda0600560be585d4e8e1bb1499900c9dcd02.
Post-edit SHA-256: 3510b0f086800ca814187805ba395f214321156b084ed73c3d225eea6807fe2c.

## Edit intention: apps/desktop/src/inspector.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: 8d08ef252d21c0d737222019ab49cc931f21035130c821656c93a7bc85233c10.
Post-edit SHA-256: 9f69a6a9c5843a9a61d3340eb1393693aa778437d969bc01905f14567c8e544d.

## Edit intention: apps/desktop/src/pane.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: ee6236cc83fa3abcd8cbbd4349f0b6d4ab39aeb8b585ba4ab18f268a8832990c.
Post-edit SHA-256: 6238d069c8cc0abcf10fd54bfb1fad9e47879b925777c82e46c6afa5d3d77b09.

## Edit intention: apps/desktop/src/TemplateDialog.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: da0649d9f9e7422919f076dfe30e75720e09c5c679e5ff9b78e6c04668010628.
Post-edit SHA-256: a126c92eb88f080be506335c0558f4473be992a57f3f26299b1785fd09ebcd2c.

## Edit intention: apps/desktop/src/settings/settings.css
Replace color literals and the assigned undeclared/declared var() fallbacks with the mapped central tokens; move button token declarations out of buttons.css; preserve layout and selectors. Pre-edit SHA-256: c3e8d2ff16dc563f128f05a68741cfa0b3af5fc4fea15d16ba6391651bd03852.
Post-edit SHA-256: 9ce20503bd965a056b8e8f568ed0e052b0ac6737426c563c98f3fd683c1ebb6a.

## Edit intention: apps/desktop/src/styles/base.css follow-up
Append --app-shadow-small to both mirrored token blocks for the remaining toolbar/file-menu shadow literal; this is a token-only change and preserves the exact light alpha value. Pre-edit SHA-256: e83ce283b191bc5a1aead68b33b1e61c4306bfbe3a851f803f84fdafc1f6902f.
Post-edit SHA-256: a0c52dea8dcb54ca08951865a100d0dda15ed876d35184e24d63ddb985cb3698.

## Edit intention: apps/desktop/src/buttons.css follow-up
Replace remaining color literal(s) with the declared contextual token; keep selection, pin and contrast roles explicit. Pre-edit SHA-256: 3510b0f086800ca814187805ba395f214321156b084ed73c3d225eea6807fe2c.
Post-edit SHA-256: 8c44c89eaba8c41b126ae0f48b1900336f40bfd2c650c0e6588af9d966dd9b1f.

## Edit intention: apps/desktop/src/styles/side-panels.css follow-up
Replace remaining color literal(s) with the declared contextual token; keep selection, pin and contrast roles explicit. Pre-edit SHA-256: d84811f2a3d5f0c79be102732acca50ab2526044840696299ac1ac8c3cf06987.
Post-edit SHA-256: 321caedbc5af203ab17b2dc7dee01bcd82d458ed92ad6b3baff832e2b9b6a307.

## Edit intention: apps/desktop/src/settings/settings.css follow-up
Replace remaining color literal(s) with the declared contextual token; keep selection, pin and contrast roles explicit. Pre-edit SHA-256: 9ce20503bd965a056b8e8f568ed0e052b0ac6737426c563c98f3fd683c1ebb6a.
Post-edit SHA-256: 92d7bf451c45f041462632162b2b1a59467746576c17cf09e0802f1686a5ba96.

## Edit intention: apps/desktop/src/styles/toolbar.css follow-up
Replace remaining color literal(s) with the declared contextual token; keep selection, pin and contrast roles explicit. Pre-edit SHA-256: 6e7491c1625f04d03dcd081c8b74752447b0a10d0fa2c648d70099b9cd603df2.
Post-edit SHA-256: 4109a98bc96a3fd61b0538f6984c87b9941388e034a53d3532a95543045e7aa1.

## Edit intention: apps/desktop/src/pane.css follow-up
Replace remaining color literal(s) with the declared contextual token; keep selection, pin and contrast roles explicit. Pre-edit SHA-256: 6238d069c8cc0abcf10fd54bfb1fad9e47879b925777c82e46c6afa5d3d77b09.
Post-edit SHA-256: 358ee50c0f19e223d7d9f55b15621b7fc2391c24b09f6b50498203327eb5f22c.
## Contrast script edit note
Created tmp/canvas-theme-s539/appearance-03-chrome-tokens/contrast.ts from the plan contract. It reads both base.css token blocks and checks the design text pairs plus all newly introduced text pairs; this scratch script is verification support, not a test file.

## Edit intention: apps/desktop/src/inspector.css verification repair
Remove only the two surplus closing parentheses introduced while unwrapping nested declared-token fallbacks; restore valid CSS declarations. Pre-edit SHA-256: 9f69a6a9c5843a9a61d3340eb1393693aa778437d969bc01905f14567c8e544d.
Post-edit SHA-256: ddd4006f46b6a6a6fa88589c3e3620be76f84d0914aa11ca04c20e934656f334.

## Edit intention: apps/desktop/src/styles/prototype-preview.css verification repair
Replace the malformed partial alpha-color substitution with the fixed preview hotspot fill token, preserving the original #335c6710 paint. Pre-edit SHA-256: c00360cf1698fb6bc63f91b71172a3672926b91529b03e75b11cf94c0784d4f6.
Post-edit SHA-256: 50fee1e82cfabe7240b2142355b327e1263d42fd5a15bd907e56dab8a3a4da99.

## Edit intention: apps/desktop/src/styles/base.css verification repair
Rename submit-state semantic tokens away from the app-button token family so its declaration count remains exactly the three moved tokens in each theme. Pre-edit SHA-256: a0c52dea8dcb54ca08951865a100d0dda15ed876d35184e24d63ddb985cb3698.
Post-edit SHA-256: 8c1d080b1b520bdd1ebcea9d43b6907c12460c3271b4001dede8b71fdba1a99b.

## Edit intention: apps/desktop/src/buttons.css verification repair
Rename submit-state semantic tokens away from the app-button token family so its declaration count remains exactly the three moved tokens in each theme. Pre-edit SHA-256: 8c44c89eaba8c41b126ae0f48b1900336f40bfd2c650c0e6588af9d966dd9b1f.
Post-edit SHA-256: ce68b4188a909ac59995eb30316518f3bd85cb34f06042757fc6f15c4e85ef92.

## Token registry

| name | light | dark | role | pairs with |
| --- | --- | --- | --- | --- |
| `--nodetto-on-accent` | `#ffffff` | `#132327` | text | `--nodetto-accent` |
| `--nodetto-danger` | `#8c2f26` | `#ffb4a8` | text | `--nodetto-danger-surface` |
| `--nodetto-danger-surface` | `#fdf1ef` | `#4b2521` | background | — |
| `--nodetto-warning` | `#7a5a12` | `#f1cf76` | text | `--nodetto-warning-surface` |
| `--nodetto-warning-surface` | `#fdf3dc` | `#41351b` | background | — |
| `--app-disabled-ink` | `#9aa2a8` | `#7c878c` | text | Disabled control text; exempt from WCAG contrast pair |
| `--app-disabled-soft-ink` | `#a8a8a8` | `#858f94` | text | Disabled control text; exempt from WCAG contrast pair |
| `--app-disabled-strong-ink` | `#c4c4c4` | `#8b969b` | text | Disabled control text; exempt from WCAG contrast pair |
| `--app-popover-ink` | `#172124` | `#e6e9ea` | text | `--nodetto-surface` |
| `--app-header-ink` | `#172b35` | `#e6e9ea` | text | `--app-chrome-surface` |
| `--app-divider` | `#ddd` | `#33393c` | border | — |
| `--app-divider-strong` | `#ccc` | `#41494d` | border | — |
| `--app-shadow` | `rgb(20 28 32 / 16%)` | `rgb(0 0 0 / 36%)` | shadow | — |
| `--app-shadow-small` | `rgb(20 28 32 / 10%)` | `rgb(0 0 0 / 30%)` | shadow | — |
| `--app-shadow-soft` | `rgba(29, 42, 46, 0.08)` | `rgb(0 0 0 / 28%)` | shadow | — |
| `--app-shadow-medium` | `rgba(29, 42, 46, 0.12)` | `rgb(0 0 0 / 32%)` | shadow | — |
| `--app-shadow-strong` | `rgba(29, 42, 46, 0.14)` | `rgb(0 0 0 / 38%)` | shadow | — |
| `--app-backdrop` | `rgb(0 0 0 / 30%)` | `rgb(0 0 0 / 55%)` | background | — |
| `--app-template-backdrop` | `rgb(10 25 22 / 40%)` | `rgb(0 0 0 / 60%)` | background | — |
| `--app-pane-shadow` | `rgb(0 0 0 / 14%)` | `rgb(0 0 0 / 40%)` | shadow | — |
| `--app-comment-shadow` | `rgb(15 23 42 / 22%)` | `rgb(0 0 0 / 40%)` | shadow | — |
| `--app-comment-pin-shadow` | `rgb(15 23 42 / 28%)` | `rgb(0 0 0 / 45%)` | shadow | — |
| `--app-focus-ring` | `#227c91` | `#7fb3bf` | border | — |
| `--app-muted-label` | `#727b7e` | `#a3adb1` | text | `--app-chrome-surface` (light result 4.33:1; unresolved) |
| `--app-divider-soft` | `#eee9dd` | `#33393c` | border | — |
| `--app-submit-hover` | `#274b55` | `#6b9da8` | background | — |
| `--app-submit-active` | `#1d3d46` | `#5c8790` | background | — |
| `--app-template-preview` | `#ebece6` | `#ebece6` | fixed | — |
| `--app-preview-surface` | `#f3f4f5` | `#f3f4f5` | fixed | — |
| `--app-preview-ink` | `#1d2a2e` | `#1d2a2e` | fixed | — |
| `--app-preview-disabled` | `#9aa2a8` | `#9aa2a8` | fixed | — |
| `--app-preview-focus` | `#5d7480` | `#5d7480` | fixed | — |
| `--app-preview-hotspot` | `#335c67` | `#335c67` | fixed | — |
| `--app-preview-hotspot-fill` | `#335c6710` | `#335c6710` | fixed | — |
| `--app-swatch-red` | `#b91c1c` | `#b91c1c` | fixed | — |
| `--app-document-swatch-red` | `#c0392b` | `#c0392b` | fixed | — |
| `--app-comment-pin-border` | `#fff` | `#fff` | fixed | — |
| `--app-comment-pin-ink` | `#fff` | `#fff` | fixed | — |
| `--nodetto-presence-label-ink` | `#fffdf8` | `#fffdf8` | fixed | — |
| `--app-component-header` | `#f5f2e9` | `#262c2f` | background | — |
| `--app-component-preview` | `#f2f0e9` | `#1f2427` | background | — |
| `--app-button-surface` | `#f0f2f3` | `#242a2d` | background | — |
| `--app-button-hover` | `#e5e9ec` | `#2c3337` | background | — |
| `--app-button-active` | `#d8dfe3` | `#343c40` | background | — |

The `--nodetto-on-accent` pair uses existing `--nodetto-accent`. Comment pin and presence label tokens are fixed over user/document colors. Disabled control text is intentionally recorded separately because WCAG exempts inactive controls. `--app-muted-label` is the existing comment timestamp color, preserved exactly in light mode; it measures 4.33:1 against its white comment surface. No token-only dark value can raise that light result, and changing the light value would violate design invariant 2.

## Final verification

- `! grep -nE '#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|(^|[;{[:space:]])(white|black)([;[:space:]]|$)' apps/desktop/src/styles/app-header.css apps/desktop/src/styles/cloud.css apps/desktop/src/styles/panels.css apps/desktop/src/styles/prototype-preview.css apps/desktop/src/styles/side-panels.css apps/desktop/src/styles/toolbar.css apps/desktop/src/buttons.css apps/desktop/src/inspector.css apps/desktop/src/pane.css apps/desktop/src/square-chrome.css apps/desktop/src/TemplateDialog.css apps/desktop/src/settings/settings.css` exited 0; no color literals (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/literals-final.log`). The value-keyword boundary excludes `white-space` property names.
- `test "$(grep -cE '^[[:space:]]*--app-button-(surface|hover|active):' apps/desktop/src/buttons.css)" -eq 0 && test "$(grep -cE '^[[:space:]]*--app-button-(surface|hover|active):' apps/desktop/src/styles/base.css)" -eq 6 && grep -nE '^[[:space:]]*--app-control-radius:' apps/desktop/src/buttons.css > tmp/canvas-theme-s539/appearance-03-chrome-tokens/button-tokens-final.log 2>&1` exited 0; 0 declarations remain in `buttons.css`, 6 declarations are in `base.css`, and `--app-control-radius: 6px` remains (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/button-tokens-final.log`).
- `python3 tmp/canvas-theme-s539/appearance-03-chrome-tokens/parity.py` exited 0; 57 names in each block, identical (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/parity-script-final.log`).
- `python3 tmp/canvas-theme-s539/appearance-03-chrome-tokens/light-values.py` exited 0; all 13 values remain byte-identical (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/light-values-script-final.log`).
- `python3 tmp/canvas-theme-s539/appearance-03-chrome-tokens/undeclared.py` exited 0; only `--app-cloud-top` remains (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/undeclared-script-final.log`).
- `bun tmp/canvas-theme-s539/appearance-03-chrome-tokens/contrast.ts` exited 1 (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/contrast.log`): light `--app-muted-label` on `--app-chrome-surface` is 4.33:1; every other listed pair passed.
- `bun test apps/desktop/src/style.test.ts` exited 0; 1 test passed, 0 failed, 6 expectations (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/style-test-joined-final.log`). It was rerun after the plan 04 progress log reached `STATUS: done`.
- `bunx biome check apps/desktop/src/styles/base.css apps/desktop/src/styles/app-header.css apps/desktop/src/styles/cloud.css apps/desktop/src/styles/panels.css apps/desktop/src/styles/prototype-preview.css apps/desktop/src/styles/side-panels.css apps/desktop/src/styles/toolbar.css apps/desktop/src/buttons.css apps/desktop/src/inspector.css apps/desktop/src/pane.css apps/desktop/src/square-chrome.css apps/desktop/src/TemplateDialog.css apps/desktop/src/settings/settings.css --diagnostic-level=warn` exited 0; 13 files checked (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/biome-final.log`).

`git diff --check -- apps/desktop/src/styles/base.css apps/desktop/src/styles/app-header.css apps/desktop/src/styles/cloud.css apps/desktop/src/styles/panels.css apps/desktop/src/styles/prototype-preview.css apps/desktop/src/styles/side-panels.css apps/desktop/src/styles/toolbar.css apps/desktop/src/buttons.css apps/desktop/src/inspector.css apps/desktop/src/pane.css apps/desktop/src/square-chrome.css apps/desktop/src/TemplateDialog.css apps/desktop/src/settings/settings.css` exited 0 (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/diff-check-final.log`).

Final source SHA-256 values are in `tmp/canvas-theme-s539/appearance-03-chrome-tokens/final-source-sha256.txt`.



## Continuation attempt 1 (progress gate)

The latest fanout snapshot and current source are identical for `apps/desktop/src/styles/base.css` and `apps/desktop/src/styles/side-panels.css` (snapshot/current SHA-256 values are in the Step 6 continuation evidence). The current source places `--app-muted-label` on `.nodetto-comment-message time` inside `.nodetto-comment-thread`, whose light background is `--app-chrome-surface`; the contrast script rerun exited 1 with 4.33:1 (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/contrast-continuation1.log`).

The accepted plan requires both exact light-value preservation and at least 4.5:1 for this text pair. No source-only correction can satisfy both. Resume requires the design owner to choose whether the comment timestamp may use a darker light value (relaxing the exact-light-rendering invariant) or whether this existing metadata pair is explicitly exempt from the 4.5:1 gate. No source files changed in this continuation.

STATUS: incomplete
