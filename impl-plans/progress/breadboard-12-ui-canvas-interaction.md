# breadboard-12-ui-canvas-interaction progress

## Implementation

Added the breadboard workspace and palette, exhaustive typed creation mappings, snapped editor placement, breadboard-only part rotation, hole-grid move snapping, click-by-click wire drafts, selected-wire bend and endpoint editing, net hover/probe highlight, and ratsnest overlays. The canvas overlay follows editor revisions and probe changes. Wire endpoint and bend edits use the editor semantic update API; overlay state remains transient.

New files:
- packages/ui-solid/src/BreadboardOverlay.tsx
- packages/ui-solid/src/breadboard-overlay.ts
- packages/ui-solid/src/breadboard-palette.test.ts
- packages/ui-solid/src/breadboard-interaction.test.ts

Modified files:
- packages/ui-solid/src/tools.ts
- packages/ui-solid/src/workspaces.ts
- packages/ui-solid/src/shape-palette.ts
- packages/ui-solid/src/interaction.ts
- packages/ui-solid/src/Canvas.tsx

No GitHub issue. Workflow issue: Circuit breadboard drawing mode (KiCad/Fritzing-inspired), plan breadboard-12-ui-canvas-interaction. No git write operations were performed.

## Acceptance evidence

- WorkspaceId includes breadboard; the primary palette has half board, resistor, LED, push button and wire. Secondary palette includes other breadboard tools.
- All BREADBOARD_TOOLS have typed creation mappings, including full/half/mini boards and semantic capacitor/transistor variants.
- Placement calls Editor.createBreadboardPart; move snapping follows the 10-unit hole lattice only when UI snapping is enabled.
- r and Shift+R rotate selected breadboard parts by quarter turns. The existing TOOL_KEYS r rectangle mapping remains at interaction.ts:200.
- Wire draft clicks snap to the lattice, duplicate adjacent points are skipped, Enter/double-click finish, and Escape cancels. Selected wire endpoints and bends drag snapped; double-click inserts or removes bends.
- Overlay model applies hover, then probe, then a single selected wire priority; ratsnest recomputes on revision and disappears when target connections become wired.
- Probe-priority coverage uses `secondId` pin 2, outside the selected wire's pin-1 net. It asserts pin 2 is highlighted and `firstId` pin 1 is absent; reversing the priority makes the latter assertion fail.
- The wire draft test asserts both its relative bend points and its visual origin at (10,10).
- interaction.test.ts, workspaces.test.ts and Toolbar.test.ts were not modified and pass on the mise-pinned Bun 1.4.0 runtime.
- One-point wire completion with Enter creates nothing; Escape cancels a draft and clears the active breadboard probe.

## Earlier final-source verification

Final rerun logs are under tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction/step6-current/.

| Command | Exit | Result / evidence |
|---|---:|---|
| mise exec -- bun --version | 0 | 1.4.0; bun-version.log |
| mise exec -- bun test packages/ui-solid/src/breadboard-palette.test.ts packages/ui-solid/src/breadboard-interaction.test.ts | 0 | 10 passed, 0 failed, 29 assertions; focused-final.log |
| mise exec -- bun test packages/ui-solid | 0 | 500 passed, 0 failed, 3678 assertions across 51 files; ui-final.log |
| mise exec -- bun test packages/ui-solid/src/Toolbar.test.ts | 0 | 3 passed, 0 failed, 5 assertions; toolbar-final.log |
| mise exec -- bun test packages/ui-solid/src/interaction.test.ts packages/ui-solid/src/workspaces.test.ts | 0 | 279 passed, 0 failed, 2198 assertions; sibling-tests.log |
| mise exec -- bun run typecheck | 0 | tsc --noEmit; no TypeScript errors; typecheck-final.log |
| G1 ownRegex grep and '^error TS' grep | 0 | No owned diagnostics or TypeScript errors; g1.log and type-errors.log |
| mise exec -- bunx biome check [nine plan-owned TS files] | 0 | Checked 9 files; no fixes; biome-final.log |
| protected-test diff check | 0 | interaction.test.ts, workspaces.test.ts and Toolbar.test.ts unchanged; protected-tests.log |
| grep -n 'r: "geo:rect"' packages/ui-solid/src/interaction.ts | 0 | Existing key mapping remains at line 200; toolkey.log |
| ASCII whole-file and added-lines gates | 0 | No non-ASCII bytes in new files or added lines; ascii-files.log and ascii-added-lines.log |
| ASCII sentinel detector wrapper | 0 | Detector returned expected exit 1 on non-ASCII; wrapper passed; ascii-sentinel.log |

## Prior attempts retained

- focused-01.log: first placement test incorrectly expected the body origin to equal the snapped pin anchor; corrected to assert pin 1 at (30, 50).
- The earlier Bun 1.4.4 ui-solid and Toolbar attempts failed with a jsxDEV module-load error. Checkpoint amendment 2 pins Bun 1.4.0 through mise; the current final-source reruns above pass. These prior failures are superseded, not relabeled.
- The first probe-clear test draft used pin:null, which typecheck rejected; the fixture now omits the optional pin property. Current typecheck-final.log passes.

## Test-integrity revision

Review findings TI12-PROBE-PRIORITY-01 and TI12-SENTINEL-PATH-01 were addressed in the authorized test and progress paths. Optional TI12-WIRE-VISUAL-02 is covered by the origin assertion. No product code or protected tests changed.

Latest logs are under tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction/step6-revision/.

| Command | Exit | Result / evidence |
|---|---:|---|
| mise exec -- bun --version | 0 | 1.4.0; bun-version.log |
| mise exec -- bun test packages/ui-solid/src/breadboard-palette.test.ts packages/ui-solid/src/breadboard-interaction.test.ts | 0 | 10 passed, 0 failed, 31 assertions; focused.log |
| mise exec -- bun test packages/ui-solid | 0 | 500 passed, 0 failed, 3682 assertions across 51 files; ui.log |
| mise exec -- bun run typecheck | 0 | TypeScript check passed; G1 and error TS greps are clean; typecheck.log, g1.log, type-errors.log |
| mise exec -- bunx biome check packages/ui-solid/src/breadboard-interaction.test.ts | 0 | Checked one file; no fixes; biome.log |
| git diff --quiet -- protected interaction, workspace and Toolbar tests | 0 | Protected tests unchanged; protected.log |
| ASCII source, added-lines, and progress gates | 0 | All passed; ascii-source.log, ascii-added.log, ascii-progress.log |
| ASCII sentinel detector at the path declared in plan 12 | 1 expected | Output is in tmp/breadboard-mode-s485/breadboard-12-ui-canvas-interaction/ascii-sentinel.log; sentinel-status.log records expected detector exit 1 and wrapper exit 0. |

Updated test SHA-256: 65599b528ca7fe6370598092bdea889649d30dc7758053d02ed72c9ea536849c (`packages/ui-solid/src/breadboard-interaction.test.ts`). The discriminating assertion fails under reversed selected-wire/probe priority because wire-only highlight includes `firstId` pin 1, which the probe-on-pin-2 highlight excludes.

## Implementation status

Plan 12 implementation and required behavioral verification are complete. No plan-12 implementation blocker remains. Formal test-integrity, adversarial review and serial integration are downstream workflow steps.
