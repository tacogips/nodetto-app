# appearance-05-ui-solid-chrome-css implementation progress

## Intent snapshot

Replace every chrome color literal in the 15 assigned ui-solid CSS files with `var(--token, <the exact prior literal>)`; add fallbacks to every color-valued custom-property use without one; preserve layout/selectors and ensure existing-light-token rendering stays unchanged. Add matching semantic tokens only by appending to the light and dark blocks in `apps/desktop/src/styles/base.css`. Leave `packages/ui-solid/src/shapes/*.css` untouched. Record token registry rows, introduced text/background pairs, hashes and plan-local checks here.

## Dependency readiness

`appearance-03-chrome-tokens` is included in the dispatched `acceptedPlanIds`, the authoritative plan admission decision. Its progress log ends in `STATUS: done`; the current `base.css` includes `--app-muted-label: #6d7679;` and its light/dark token blocks. No external prerequisite is missing.

## Pre-edit SHA-256

Recorded from fresh reads before CSS edits:

46bed9bdce69e0e3acde35b702991f0965fc033ec2d6dbc0a66dbf03ad995334  packages/ui-solid/src/Toolbar.css
2f535b87b7f1e5eb4e0df10b3d1a52c7933e37d31c7d12b466e6e432601ef626  packages/ui-solid/src/Layers.css
30fca62cba6ebfa002ef45f404e9ef6954e89f6d3f0c9488fc5a66f975e0003a  packages/ui-solid/src/BpmnProblemsPanel.css
f4e8b5b2007d400d6460379f63ef898096ba1983921c043dc24c17860afadd97  packages/ui-solid/src/BreadboardProblemsPanel.css
845bd747b46c90f13ab9df903660dcae8a2982d22dfba23736cfc634ba2679a0  packages/ui-solid/src/HelpHint.css
30498f0c3f4d4782291932acc9a2933bf5367e715e916b51c823afda423ac457  packages/ui-solid/src/ShapePalette.css
5a7f58b9b3d813051cce2776bade66c831d3b4c29502ebe8e8713d89ae00ccdd  packages/ui-solid/src/ShapeWarnings.css
e33db0f8742b15a7e255262cb22facb4561a9e81ce0a7078daac3a3a0df1d6ad  packages/ui-solid/src/Switch.css
e2b69f2b903ff45bf3eafdcee417860cd0a07d24557c0f211b0c4b04571bc7ed  packages/ui-solid/src/PcbLayersPanel.css
67c5546a7f5af529aff96fbe7a3d1fdc10116cf17e5f11d7084d35f153dba04f  packages/ui-solid/src/ExportDialog.css
27d190031c576b11cc34abd8bcc553eb396f11a28c94b57498545e539fc3f752  packages/ui-solid/src/ImageImport.css
801fe4938884f20d91e9d5bae2ad7feeeaf58dff372f1912f26cc7479395b173  packages/ui-solid/src/Inspector.css
89652924d23c6b5db75d92fd14bd0bd5093edbacc192b5e3624b8566b20a33ef  packages/ui-solid/src/ZoomControls.css
e15577175dedad01948392f431517edd6f26ac57554c6cee1219f005634a2495  packages/ui-solid/src/SelectionToolbar.css
ea347e5fda2824c9d8a114d1c65c5c93ac7a9803586a51b7626dd9456a923df1  packages/ui-solid/src/inspector/AssetExportSection.css
45aa8b69b3577da4133cf29aae1718e04167840ec01d8c9b85ed14387adf4140  apps/desktop/src/styles/base.css
## Session 540 implementation

The 15 assigned `packages/ui-solid` chrome CSS files now route each color literal through a `var(--token, <same original literal>)` fallback. Every color-valued variable use has a fallback. Existing `--nodetto-*` and app chrome variables keep their current precedence; fallback-only contextual tokens preserve exact cloud bytes, including the legacy problem-panel `#20252a` and export-dialog `white` fallbacks. Selectors and layout declarations are unchanged. `ZoomControls.css`, `SelectionToolbar.css` and `inspector/AssetExportSection.css` had no original literals; their existing color token uses now have exact light fallbacks. No `packages/ui-solid/src/shapes/*.css` file was modified.

`base.css` was fresh-read immediately before its append and contained `--app-muted-label: #6d7679;`. Its pre-append SHA-256 was `45aa8b69b3577da4133cf29aae1718e04167840ec01d8c9b85ed14387adf4140`; after appending 25 tokens to each theme block it is `4c7404d38821afc97dd807a62944a579603e7e9545b11aaa4604b477dc348f12`. The token-only diff check passes: 52 changed declarations (the prior plan 03 muted-label update plus 25 additions in each block), all within the light/dark token blocks. The pre-append plan 03 diff evidence hash is `9c5e34a69dd8a03c1a67bdde094297fdbedc2f6f5fab671ba558f2aa3ce82878` (`tmp/canvas-theme-s539/appearance-03-chrome-tokens/s540/base-diff-from-58c8171.log`); the current base diff hash is `238adb63d9a2c034fab4fa57237f0cbafd89b05bdbf03b41733ce5668a05a606` (`tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/base-diff.log`). No other line in `base.css` changed.

### Token registry additions

| name | light | dark | role | pairs with |
| --- | --- | --- | --- | --- |
| `--app-problem-ink` | `#20252a` | `#e6e9ea` | text | `--app-chrome-surface` (fallback for existing problem-panel ink) |
| `--app-problem-muted` | `#5d6872` | `#a3adb1` | text | `--app-chrome-surface` |
| `--app-bpmn-warning-ink` | `#b54708` | `#ffb4a8` | text | `--app-bpmn-warning-surface` |
| `--app-bpmn-warning-surface` | `#fff4e5` | `#4b2521` | background | — |
| `--app-help-border` | `#d7dce0` | `#41494d` | border | — |
| `--app-help-ink` | `#263238` | `#e6e9ea` | text | `--app-chrome-surface` |
| `--app-help-shadow` | `#0000001a` | `rgb(0 0 0 / 32%)` | shadow | — |
| `--app-ui-focus` | `#5d7480` | `#7fb3bf` | border | — |
| `--app-warning-badge-border` | `#b45309` | `#f1cf76` | border | — |
| `--app-warning-badge-surface` | `#fffbeb` | `#41351b` | background | — |
| `--app-warning-badge-ink` | `#92400e` | `#f1cf76` | text | `--app-warning-badge-surface` |
| `--app-switch-off` | `#a1a1aa` | `#626c72` | background | — |
| `--app-switch-thumb` | `#ffffff` | `#ffffff` | fixed | — |
| `--app-switch-on` | `#34c759` | `#2f9e50` | background | — |
| `--app-toolbar-selection-surface` | `#e7edf6` | `#303a40` | background | — |
| `--app-toolbar-selection-border` | `#526d96` | `#8aa6cf` | border | — |
| `--app-toolbar-selection-ink` | `#526071` | `#d6deeb` | text | `--app-toolbar-selection-surface` |
| `--app-toolbar-selected-surface` | `#303a40` | `#2b3438` | background | — |
| `--app-toolbar-selected-ink` | `#ffffff` | `#e6e9ea` | text | `--app-toolbar-selected-surface` |
| `--app-image-dismiss-hover` | `#eef0f2` | `#262c2f` | background | — |
| `--app-toolbar-menu-shadow` | `rgb(0 0 0 / 0.14)` | `rgb(0 0 0 / 38%)` | shadow | — |
| `--app-ui-shadow` | `#0003` | `rgb(0 0 0 / 38%)` | shadow | — |
| `--app-export-backdrop` | `#0006` | `rgb(0 0 0 / 60%)` | background | — |
| `--app-export-accent-shade` | `#000` | `#11181b` | fixed | — |
| `--app-export-surface-fallback` | `#ffffff` | `#1b1f21` | background | export fallback `white` |

### Recorded text/background pairs

The scratch contrast run checks these pairs in both themes: `--app-problem-ink` / `--app-chrome-surface`; `--app-problem-muted` / `--app-chrome-surface`; `--app-bpmn-warning-ink` / `--app-bpmn-warning-surface`; `--app-help-ink` / `--app-chrome-surface`; `--app-warning-badge-ink` / `--app-warning-badge-surface`; `--app-toolbar-selection-ink` / `--app-toolbar-selection-surface`; `--app-toolbar-selected-ink` / `--app-toolbar-selected-surface`; reused `--nodetto-muted` / `--app-chrome-surface` and `/ --nodetto-surface`; `--nodetto-ink` / `--nodetto-surface`, `/ --app-chrome-surface`, `/ --app-chrome-hover`, `/ --app-chrome-active`; `--nodetto-on-accent` / `--nodetto-accent`; `--app-chrome-muted` / `--app-chrome-surface`; `--nodetto-accent` / `--app-chrome-active`. All 30 measured ratios are at least 4.5:1; the lowest is light `--app-bpmn-warning-ink` on its surface at 4.99:1.

### Per-file literal and fallback-var counts

See `tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/file-counts-final.log`: 119 literal occurrences total, all within fallbacks; all listed `var()` calls have fallback arguments. `ZoomControls.css`, `SelectionToolbar.css` and `inspector/AssetExportSection.css` each had zero literal occurrences before these changes.

### Verification

- `bun tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/fallbacks.ts` exited 0; `fallback tokens checked=114 mismatches=0 missingFallbacks=0 bareColorLiterals=0` (`tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/fallbacks.log`).
- `bun tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/contrast.ts` exited 0; 30/30 pairs passed, `failures=0` (`tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/contrast.log`).
- `python3 tmp/canvas-theme-s539/appearance-03-chrome-tokens/parity.py` exited 0; light/dark blocks each declare 82 names and the name sets are identical (`tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/parity.log`).
- The plan's literal sweep over all 15 files exited 0 and wrote all matches to `literals.log`; all 119 occurrences are inside fallback arguments. Per-file literal/fallback counts are in `file-counts-final.log`.
- `python3 tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/base-diff-check.py` exited 0; all 52 changed declarations are within the two token blocks (`base-diff-check.log`).
- `git diff --check -- <15 assigned CSS files> apps/desktop/src/styles/base.css impl-plans/progress/appearance-05-ui-solid-chrome-css.md` exited 0 (`diff-check.log`).
- `git diff --quiet -- packages/ui-solid/src/shapes` exited 0 (`shapes-untouched.log`).
- Initial `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid` run exited 0; 559 pass, 0 fail, 4,123 expectations (`ui-solid-pending-join.log`). Superseded by the final joined-source rerun below.

## Final source SHA-256

See `tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/post-edit-sha256.txt`; the CSS source hashes match the values recorded after each edit. `base.css` is included at SHA-256 `4c7404d38821afc97dd807a62944a579603e7e9545b11aaa4604b477dc348f12`.

## Joined final verification

`BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid` exited 0 after the plan 05 CSS and token edits were complete; 559 passed, 0 failed, 4,123 expectations across 63 files (`tmp/canvas-theme-s539/appearance-05-ui-solid-chrome-css/ui-solid.log`). Plan 06's same-wave progress log ends with `STATUS: done`. The final plan 05 changes satisfy the assigned acceptance criteria; downstream combined-tree integration verification remains with reconciliation.

STATUS: done
