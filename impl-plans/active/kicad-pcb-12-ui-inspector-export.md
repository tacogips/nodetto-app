# kicad-pcb-12-ui-inspector-export

- planId: kicad-pcb-12-ui-inspector-export
- planPath: impl-plans/active/kicad-pcb-12-ui-inspector-export.md
- wave: 4; dependsOn: kicad-pcb-09-core-index-fixture-integration
- design: design-docs/specs/design-kicad-pcb.md sections 6.4 (inspector,
  "Select net"), 9 (Export dialog), 5.2, 5.4
- progress log: impl-plans/progress/kicad-pcb-12-ui-inspector-export.md
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Add an inspector section for PCB elements: footprint fields, track and via
fields, and "Select net". Add a PCB tab to the Export dialog with "Gerber
and drill (.zip)", wired in the desktop app.

## Repository context (imitate)

- `packages/ui-solid/src/inspector/BreadboardSection.tsx` and
  `inspector/breadboard-edits.ts` (pure edit-command builders with tests
  in `breadboard-edits.test.ts`); `packages/ui-solid/src/Inspector.tsx`
  lines ~181 (section titles) and ~301 (`<Match
  when={element().type.startsWith("breadboard.")}>`).
- `packages/ui-solid/src/ExportDialog.tsx` (tab ids, line ~54;
  `breadboardExportEnabled`, line ~115; the tab list, line ~130; the
  `<Match when={active() === "breadboard"}>` body, line ~284) and
  `packages/ui-solid/src/breadboard-export.ts`.
- `apps/desktop/src/App.tsx`: `exportBreadboardGerber` (line ~687) and
  `exportBreadboard` (line ~734). These show how a ZIP is saved and how
  warnings and notes are reported.
- How breadboard cross-probing selects elements: find it in
  `BreadboardSection.tsx` or `breadboard-problems.ts` and use the same
  editor selection call.
- Core API (`@nodetto/core`): `exportPcbBoard`, `encodePcbBoardZip`,
  `pcbNetMembers`, `pcbNetNames`, `pageCopperLayers`, and
  `editor.rotatePcbFootprints`.

## Non-goals

- No canvas, tools or overlay (plan 11). No core changes. No zone or
  graphic editing beyond read-only info.

## writePaths

- packages/ui-solid/src/inspector/PcbSection.tsx (new)
- packages/ui-solid/src/inspector/pcb-edits.ts (new)
- packages/ui-solid/src/inspector/pcb-edits.test.ts (new)
- packages/ui-solid/src/Inspector.tsx
- packages/ui-solid/src/ExportDialog.tsx
- packages/ui-solid/src/pcb-export.ts (new)
- packages/ui-solid/src/pcb-export.test.ts (new)
- apps/desktop/src/App.tsx
- impl-plans/progress/kicad-pcb-12-ui-inspector-export.md (new)

## sharedPaths

none

## Pinned behaviour

- Inspector title for `pcb.*`: "Footprint", "Track", "Via", "Zone",
  "Graphic". `pcb.board` is never selected on the canvas.
- `PcbSection.tsx` fields:
  - footprint: reference and value (text); x and y in mm (number inputs,
    3 decimals); rotation (number; on commit, call
    `editor.rotatePcbFootprints([id], newValue - current)`); side and pad
    count (read only); "Select net" is not shown for footprints
  - track: layer (select from `pageCopperLayers`), width (> 0), net
    (select from `pcbNetNames` plus "No net")
  - via: diameter, drill (keep `diameter > drill > 0`, rejecting invalid
    input as other inspector numeric fields do), net
  - zone: layers, net, number of fills (read only)
  - graphic: layer and width (read only)
  - "Select net" for track, via and zone: sets the selection to
    `pcbNetMembers(document, page, net)` when the net is not empty
- `pcb-edits.ts` (pure): builds `updateSemantic` commands for these field
  changes, with nm rounding through `roundNm` from `@nodetto/ir`. Editing
  footprint x/y changes `at`, and the core follow planner moves attached
  track ends.
- Export dialog:
  - a tab `pcb`, label "PCB", enabled when the current page kind is `pcb`
    and the `exportPcb` prop is provided
  - one item, "Gerber and drill (.zip)"
  - prop `exportPcb?: () => Promise<void>`
  - `pcb-export.ts`: `pcbExportEnabled(pageKind, hasHandler)`, imitating
    `breadboardExportEnabled`
- `App.tsx`: `exportPcbGerber`:
  - snapshot -> `exportPcbBoard(snapshot, page.id, {name: page.name})`
  - an error string is shown as the export error
  - otherwise save `encodePcbBoardZip(result)` named `<page name>.zip`
    through the same save path as `exportBreadboardGerber`, and report the
    warnings and notes the same way
  - pass it as `exportPcb` to the dialog

## Pitfalls

- Rotation in the inspector must go through `rotatePcbFootprints`. Never
  write `visual.rotation`.
- Do not touch the breadboard tab behaviour.
- `App.tsx` is large. Change only the export wiring; keep every other
  line.

## Tests (input -> expected)

- `pcb-edits.test.ts`:
  - a footprint x edit to 12.3456789 gives `at[0]` 12.345679
  - a track width of 0 or less is rejected (no command)
  - a via drill >= diameter is rejected
  - a net change sets `net`
  - "Select net" ids equal `pcbNetMembers` for a small document
- `pcb-export.test.ts`: `pcbExportEnabled("pcb", true)` is true;
  `("breadboard", true)` is false; `("pcb", false)` is false.

## Verification

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid/src/inspector packages/ui-solid/src/pcb-export.test.ts packages/ui-solid/src/breadboard-export.test.ts`
   exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check packages/ui-solid/src/inspector/PcbSection.tsx packages/ui-solid/src/inspector/pcb-edits.ts packages/ui-solid/src/inspector/pcb-edits.test.ts packages/ui-solid/src/Inspector.tsx packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/pcb-export.ts packages/ui-solid/src/pcb-export.test.ts apps/desktop/src/App.tsx --diagnostic-level=warn`
   exits 0.

## Done criteria

- `grep -c "exportPcb" apps/desktop/src/App.tsx packages/ui-solid/src/ExportDialog.tsx`
  shows at least 1 per file.
- All verification steps are recorded with exit code 0.
