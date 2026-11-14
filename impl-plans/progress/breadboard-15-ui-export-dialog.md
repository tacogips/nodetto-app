# Progress: breadboard-15-ui-export-dialog

## Implementation

- Added the optional `exportBreadboard` callback to `ExportDialogProps`.
- Added the `breadboard` format after BPMN. It is enabled only on a breadboard page when the callback is present.
- Added the three ordered export buttons using the pinned labels and kinds. The host owns export generation and file writing.
- Added `breadboard-export.ts` with the export contract and enablement helper, plus focused unit tests.

## Verification

All logs are under `tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/`.

| Command | Exit | Result | Log |
|---|---:|---|---|
| `bun test packages/ui-solid/src/breadboard-export.test.ts` | 0 | 2 pass, 0 fail | `focused-final.log` |
| `bun test packages/ui-solid` | 1 | 464 pass, 5 fail, 5 module-load errors (`jsxDEV` missing from `solid-js/dist/solid.js`) in existing component suites | `ui-final.log` |
| `bun run typecheck` | 0 | `tsc --noEmit` clean | `typecheck-final.log` |
| `! grep -E '^packages/ui-solid/src/(ExportDialog\\.tsx|breadboard-export(\\.test)?\\.ts)' tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/typecheck-final.log` | 0 | No owned-file type diagnostics | `g1-ownregex-final.log` |
| `! grep -E '^error TS' tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/typecheck-final.log` | 0 | No TypeScript errors | `typescript-errors-final.log` |
| `bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts` | 0 | 3 files checked, no fixes | `biome-final.log` |
| Contract grep checks for three `"breadboard"` occurrences, one `exportBreadboard?:` declaration, and a non-empty progress file | 0 | Required UI contract and progress file verified | `contract-final.log` |
| New-file ASCII check and added-line ASCII check for `ExportDialog.tsx` | 0 | No non-ASCII bytes found | `ascii-new-final.log`, `ascii-added-final.log` |

The package-wide UI suite's five `jsxDEV` module-load errors match the failure class recorded in the accepted predecessor review (`/tmp/s7rev/all.log`); the focused owned test, typecheck, and formatter gates pass. Package-wide suite failure is recorded as a sibling diagnostic for serial integration review.

## Step 6 current-source rerun

Fresh foreground verification on the current shared tree is recorded separately from the earlier run:

| Command | Exit | Result | Log |
|---|---:|---|---|
| `bun test packages/ui-solid/src/breadboard-export.test.ts` | 0 | 2 pass, 0 fail, 5 expect calls | `step6-focused.log` |
| `bun test packages/ui-solid` | 1 | 464 pass, 5 fail; all five errors are missing `jsxDEV` exports from `solid-js/dist/solid.js` | `step6-ui.log` |
| `bun run typecheck` | 0 | `tsc --noEmit` clean | `step6-typecheck.log` |
| `! grep -E '^packages/ui-solid/src/(ExportDialog\\.tsx|breadboard-export(\\.test)?\\.ts)' tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/step6-typecheck.log` | 0 | No owned-file diagnostics (G1) | `step6-typecheck.log` |
| `bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts` | 0 | Three files checked, no fixes | `step6-biome.log` |
| Contract grep checks (`"breadboard"` count >= 3; `exportBreadboard?:` count = 1) | 0 | Both contract counts pass | `step6-contract.log` |
| ASCII gates over new files and added `ExportDialog.tsx` lines | 0 | Both gates pass | `step6-ascii.log` |

The package-wide UI errors remain the known `jsxDEV` module-load failure class; no errors were reported for the assigned export files. The focused owned behavioral test and required owned typecheck pass on the current source.

## Final current-source rerun

Foreground reruns for this Step 6 handoff are recorded under the same evidence directory:

| Command | Exit | Result | Log |
|---|---:|---|---|
| `bun test packages/ui-solid/src/breadboard-export.test.ts` | 0 | 2 pass, 0 fail, 5 expect calls | `step6-current-focused.log` |
| `bun test packages/ui-solid` | 1 | 464 pass, 5 fail; five existing component-suite module-load errors because `jsxDEV` is missing from `solid-js/dist/solid.js` | `step6-current-ui.log` |
| `bun run typecheck` | 0 | `tsc --noEmit` clean | `step6-current-typecheck.log` |
| Owned G1 grep and unscoped TypeScript error grep | 0 | No owned diagnostics and no `error TS` lines | `step6-current-g1.log`, `step6-current-ts-errors.log` |
| `bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts` | 0 | 3 files checked, no fixes | `step6-current-biome.log` |
| Export contract grep checks | 0 | Five `"breadboard"` entries and one optional callback declaration | `step6-current-contract.log` |
| New-file and added-line ASCII gates | 0 | Both gates pass | `step6-current-ascii-new.log`, `step6-current-ascii-added.log` |

The focused owned test is the plan's blocking behavioral gate and passes. The package-wide UI suite still has the known sibling `jsxDEV` module-load failures; keep that failure visible for serial integration rather than counting it as a pass. Formal review and integration remain downstream workflow steps.

## Step 6 final handoff rerun

Latest foreground checks on the current source are recorded here:

| Command | Exit | Result | Log |
|---|---:|---|---|
| `bun test packages/ui-solid/src/breadboard-export.test.ts` | 0 | 2 pass, 0 fail, 5 expect calls | `step6-final-focused.log` |
| `bun test packages/ui-solid` | 1 | 464 pass, 5 fail; all five are `jsxDEV` module-load errors from `solid-js/dist/solid.js` in component suites | `step6-final-ui.log` |
| `bun run typecheck` | 0 | `tsc --noEmit` clean | `step6-final-typecheck.log` |
| `bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts` | 0 | Three files checked, no fixes | `step6-final-biome.log` |
| Contract, owned-file G1, TypeScript error, new-file ASCII and added-line ASCII gates | 0 | All gates pass | `step6-final-contract-ascii-rerun.log` |

The focused owned behavioral test and assigned typecheck/style/contract gates pass. The package suite's five module-load errors remain visible as a sibling diagnostic for serial integration; they are not claimed as passing results. Formal review and integration remain downstream workflow steps.

## Step 6 verification refresh

Current foreground reruns are under `tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/step6-refresh/`:

| Command | Exit | Result | Log |
|---|---:|---|---|
| `bun test packages/ui-solid/src/breadboard-export.test.ts` | 0 | 2 pass, 0 fail, 5 assertions | `step6-refresh/focused.log` |
| `bun test packages/ui-solid` | 1 | 469 pass, 5 fail; five existing component module-load errors because `jsxDEV` is missing from `solid-js/dist/solid.js` | `step6-refresh/ui.log` |
| `bun run typecheck` | 0 | `tsc --noEmit` clean | `step6-refresh/typecheck.log` |
| Owned G1 grep and TypeScript error grep | 0 | No assigned-file diagnostics and no TypeScript errors | `step6-refresh/g1.log`, `step6-refresh/ts-errors.log` |
| `bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts` | 0 | Three files checked, no fixes | `step6-refresh/biome.log` |
| Contract count gate and new-file/added-line ASCII gates | 0 | Contract and both ASCII checks pass | `step6-refresh/gates-summary.txt`, `step6-refresh/ascii-new.log`, `step6-refresh/ascii-added.log` |

The focused behavioral test and assigned typecheck/style/contract gates pass on current source. The package-wide UI suite retains the previously observed unrelated `jsxDEV` module-load failures and is recorded as a sibling diagnostic for serial integration.

## Checkpoint amendment 2 and final current-source verification

The accepted amendment assigns this plan ownership of the `[tools] bun` pin. `mise.toml` now changes exactly one line from `bun = "latest"` to `bun = "1.4.0"`; no other tool entry changed. `mise install` exited 0 and reported Bun 1.4.0 already installed. The inherited shell PATH still points at the `latest` alias, so plain `bun --version` initially printed 1.4.4; `mise exec -- bun --version` exited 0 and printed 1.4.0. The required checks below all ran under `mise exec`'s selected Bun 1.4.0.

Tool install audit: exact install command `mise install` exited 0 (`step6-final/mise-install.log`); exact version command `mise exec -- bun --version` exited 0 with `1.4.0` (`step6-final/bun-version-mise-exec.log`). `mise which bun` resolves to `/Users/taco/.local/share/mise/installs/bun/1.4.0/bin/bun`; SHA-256 is `539598c775882420b9d8deb7dc14d845f20f7d26f5600c50ab067dde6ac3f3bf` (`step6-final/bun-binary-sha256.log`). No tool was downloaded or newly installed.

| Command | Exit | Result | Log |
|---|---:|---|---|
| `mise exec -- bun test packages/ui-solid/src/breadboard-export.test.ts` | 0 | 2 pass, 0 fail, 5 expect calls | `step6-final/focused.log` |
| `mise exec -- bun test packages/ui-solid` | 0 | 499 pass, 0 fail across 51 files; no `jsxDEV` text | `step6-final/ui.log`, `step6-final/jsxdev-scan.log` |
| `mise exec -- bun test apps/desktop/src/history-shortcuts.test.ts` | 0 | 2 pass, 0 fail, 13 expect calls; test file unchanged | `step6-final/history-shortcuts.log` |
| `mise exec -- bun run typecheck` | 0 | `tsc --noEmit` clean; no plan 15 diagnostics (G1) | `step6-final/typecheck.log`, `step6-final/g1.log` |
| `mise exec -- bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts` | 0 | 3 files checked, no fixes | `step6-final/biome.log` |
| Manifest and protected-file gate | 0 | Exactly one `mise.toml` line changed; Bun lockfile and protected tests unchanged | `step6-final/pin-contract.log` |
| Export contract count gate | 0 | Four `"breadboard"` occurrences and one `exportBreadboard?:` declaration | `step6-final/ui-contract.log` |
| Added-line ASCII gate for `ExportDialog.tsx` | 0 | No non-ASCII added lines | `step6-final/ascii-added.log` |

Plan 15 completion criteria are met on current source: exports are available only on breadboard pages with a handler; the optional callback and format/group entries satisfy the pinned contract; App.tsx compiles; focused and package UI tests pass on Bun 1.4.0; protected tests and `bun.lock` are unchanged; and assigned style, typecheck, and ASCII gates pass. Logs and the pre-node immutable snapshot are under `tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/step6-final/`.

The repository's mise shim also selects the pin when placed ahead of the stale inherited `latest` PATH entry: `PATH="/Users/taco/.local/share/mise/shims:$PATH" bun --version` exited 0 and printed `1.4.0` (`step6-final/bun-version-shim.log`).
