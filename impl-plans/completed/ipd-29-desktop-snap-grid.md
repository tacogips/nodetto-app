# ipd-29-desktop-snap-grid

- planId: ipd-29-desktop-snap-grid
- planPath: impl-plans/active/ipd-29-desktop-snap-grid.md
- progressPath: impl-plans/progress/ipd-29-desktop-snap-grid.md
- wave: 2. dependsOn: ipd-00-baseline
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 7.6: desktop snap grid of 4, 8 or 24; default 8 in the app and web workspaces, 24 elsewhere; frame layout grids still take precedence.
- Evidence: `tmp/ipd-s772/ipd-29-desktop-snap-grid/`.
<!-- ownership:start -->
- writePaths:
  - `packages/ui-solid/src/interaction/types.ts`
  - `packages/ui-solid/src/interaction/snapping.ts`
  - `packages/ui-solid/src/ZoomControls.tsx`
  - `packages/ui-solid/src/Canvas.tsx`
  - `apps/desktop/src/settings/preferences.ts`
  - `apps/desktop/src/App.tsx`
  - `packages/ui-solid/src/snap-grid-size.test.ts`
  - `impl-plans/progress/ipd-29-desktop-snap-grid.md`
  - `tmp/ipd-s772/ipd-29-desktop-snap-grid`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-29-desktop-snap-grid`
<!-- ownership:end -->

## Intent and context

Item (7) asks for an 8/4-point snap grid. The desktop snap grid is a fixed 24 units (`SNAP_GRID = 24`, `packages/ui-solid/src/interaction/snapping.ts:21`), unless a frame has layout grids (`:150-163`). The CLI `snap` operation is `ipd-08`.

This plan adds a grid-size choice to the desktop snap settings, with a per-workspace default.

## Non-goals

- No change to object or guide snapping, or to frame layout-grid precedence.
- No prototype view work (`ipd-18`).
- No core changes.

## File-level changes

- `packages/ui-solid/src/interaction/types.ts`: `SnapSettings` gains `readonly gridSize?: 4 | 8 | 24`.
- `packages/ui-solid/src/interaction/snapping.ts`: every use of `SNAP_GRID` as the global grid becomes `settings.gridSize ?? SNAP_GRID`. Frame layout grids keep precedence.
- `packages/ui-solid/src/ZoomControls.tsx`: a compact grid-size choice (4 / 8 / 24) next to the "Show grid" toggle (`:211`). It is a native select or segmented buttons using existing toolbar classes, and calls `onSnapChange({...snap, gridSize})`.
- `packages/ui-solid/src/Canvas.tsx`: change only if the grid rendering (the visible dot or line grid) uses a fixed 24. Then draw it with the same `gridSize`. Otherwise do not touch it.
- `apps/desktop/src/settings/preferences.ts`: persist `gridSize` with the existing snap preferences. Read the file to find where snap toggles are stored; if they are not persisted there, keep `gridSize` in the same place the toggles live.
- `apps/desktop/src/App.tsx`: where `SnapSettings` are created per workspace, default `gridSize` to 8 for the `app` and `web` workspaces and 24 otherwise, unless a persisted value exists.

## Patterns to imitate

The existing grid toggle flow `ZoomControls.tsx` -> `onSnapChange` -> App state -> `Canvas` -> `snapping.ts`.

## Pitfalls

- Default behavior for non-design workspaces must stay 24. Existing snapping tests must pass unchanged.
- Do not snap to the global grid when a frame's layout grid applies.

## Tests: new `packages/ui-solid/src/snap-grid-size.test.ts`

- With `gridSize: 8`, a translation snaps to multiples of 8 relative to the grid origin.
- With `gridSize: 4` -> multiples of 4.
- Undefined -> 24, as before.
- A frame with a 10-unit square layout grid -> it snaps to 10, regardless of `gridSize`.

Imitate `packages/ui-solid/src/interaction-selection-snapping.test.ts`.

## Verification (evidence in `final/`)

1. `bun test packages/ui-solid/src/snap-grid-size.test.ts packages/ui-solid/src/interaction-selection-snapping.test.ts packages/ui-solid/src/canvas-rulers.test.ts apps/desktop/src/page-workspace.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned TS/TSX files -> exit 0.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
