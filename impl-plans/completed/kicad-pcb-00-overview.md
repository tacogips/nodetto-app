# kicad-pcb-00-overview

- planId: kicad-pcb-00-overview (coordination only; no writePaths)
- design: design-docs/specs/design-kicad-pcb.md (revision 3, accepted by
  session-536 step3 comm-009975); user QA defaults:
  design-docs/user-qa/kicad-pcb.md (Q1-Q5, implement the defaults)
- session: opus-luna-design-and-implement-review-loop-session-530 (plans
  01-03, committed 6865464); sessions 534-535 (plans 04, 05, 06, 08 in
  cf0c4d7; plan 07 in 8181d51); session-536 implements plans 09-13
  through impl-plans/active/kicad-pcb-s536-dispatch.json; issue: none
  (workflowInput only); branch feat/kicad-pcb; gitPush=false
- scratch root: tmp/kicad-pcb-s536/<planId>/ for plans 09-13 (git-ignored;
  never put `*.test.ts` files there). Older plans keep their s530 or s534
  scratch paths.

## Intent

Add a `pcb` page kind: KiCad `.kicad_pcb` import (KiCad 5 to 9), editing in
the desktop app (move and rotate footprints with track ends following, add,
edit and delete tracks and vias, net highlight, ratsnest, layer
visibility), lossless JSONL, Gerber X2 and Excellon export through the
`packages/core/src/pcb` writers, `nodetto-cli pcb import|gerber` (TS and
native), docs.

## Waves and ownership

| Wave | Plan | Depends on | Owns (summary) |
| --- | --- | --- | --- |
| 1 | kicad-pcb-01-ir-core-contracts | - | `packages/ir` pcb types, page kind, registry; `packages/core/src/pcb-board/{geometry,page,test-builder}.ts`; `apps/cli/src/types-command.ts` |
| 1 | kicad-pcb-02-fabrication-writers | - | additive `GerberLayer` and `excellonDrill` changes in `packages/core/src/pcb` |
| 1 | kicad-pcb-03-docs | - | `docs/pcb/kicad-pcb.md`, `docs/cli.md`, `README.md` |
| 2 | kicad-pcb-04-kicad-reader | 01 | `packages/io/src/kicad/pcb.ts`, fixtures |
| 2 | kicad-pcb-05-core-editing | 01 | `packages/core/src/editor.ts` pcb branches, follow planner, add track/via |
| 2 | kicad-pcb-06-core-connectivity | 01 | connectivity, ratsnest, highlight |
| 2 | kicad-pcb-07-core-export | 01, 02 | `exportPcbBoard`, `encodePcbBoardZip` |
| 2 | kicad-pcb-08-core-shapes | 01 | `packages/core/src/shapes/pcb.ts`, registration |
| 3 | kicad-pcb-09-core-index-fixture-integration | 04, 05, 06, 07, 08 | `packages/core/src/pcb-board/index.ts`, core index line, fixture integration tests |
| 4 | kicad-pcb-10-cli | 09 | `pcb import`, `pcb gerber`, help, native parity case |
| 4 | kicad-pcb-11-ui-canvas | 09 | views, overlay, workspace, tools, `shape-palette.ts`, interaction, layer visibility and tool options, `page-workspace.ts` |
| 4 | kicad-pcb-12-ui-inspector-export | 09 | inspector PCB section, Export dialog PCB tab, `App.tsx` wiring |
| 4 | kicad-pcb-13-desktop-open | 09 | `.kicad_pcb` open in `session.ts`, `dialogs.rs` filter |

Why wave 3 exists: `@nodetto/core` exposes only `src/index.ts`. The
`pcb-board` barrel is written once, after all wave-2 modules exist, so no
two plans ever edit the same index. Wave-2 plans import each other's
modules only through relative paths, and only modules from earlier waves.

## Pinned cross-plan contracts (summary; the owning plan has the details)

- IR (plan 01, `packages/ir/src/pcb.ts`): `PcbXY`, `PcbShape`, `PcbPad`,
  `PcbGraphicItem`, `PcbBoardSemantic`, `PcbFootprintSemantic`,
  `PcbTrackSemantic`, `PcbViaSemantic`, `PcbZoneSemantic`,
  `PcbGraphicSemantic`, `PcbImportPlan`, `PCB_ELEMENT_TYPES`,
  `PcbElementType`, `isPcbElementType`, `PCB_PAGE_SCALE = 10`,
  `pcbRotate`, `roundNm`.
- Core geometry (plan 01, `packages/core/src/pcb-board/geometry.ts`):
  `footprintToBoard`, `boardToFootprint`, `padCopperOutline`,
  `outlineContains`, `outlineBounds`, `padHasCopperLayer`,
  `expandCopperLayers`, `pageCopperLayers`, `arcCenter`, `shapeBounds`,
  `footprintBounds`, `PcbGrid`, `pcbAnchor`, `translatePcbSemantic`;
  plan 07 adds `padShapeCenter` and centres `padCopperOutline` and
  `padPrimitiveOutlines` on it (drill offset, design 3.2).
- Page (plan 01, `page.ts`): `pcbPageFromPlan(plan, options)`.
- Editing (plan 05): `Editor.rotatePcbFootprints`, `Editor.addPcbTrack`,
  `Editor.addPcbVia`, `planPcbTrackFollow`.
- Connectivity (plan 06): `computePcbConnectivity`, `computePcbRatsnest`,
  `pcbNetHighlight`, `pcbNetMembers`, `pcbNetNames`.
- Export (plan 07): `exportPcbBoard`, `encodePcbBoardZip`,
  `PcbBoardExport`.
- Reader (plan 04): `importKicadPcb(text, {fileName})` from `@nodetto/io`
  and `@nodetto/io/kicad`.

## Per-worker protocol (every plan)

1. Before editing a file, read it fresh and record its sha256
   (`shasum -a 256 <path>`) in your progress log. Record it again after
   the edit.
2. Before the first edit, write an intent snapshot (what you will change
   and why) to the progress log.
3. If a file you own changed since your last read, or a file you do not own
   changed in a way that breaks your work, stop, record the drift, and do
   not overwrite another plan's edits.
4. Edit only your `writePaths`. Do not run state-changing git commands
   (`git add`, `commit`, `stash`, `checkout`, `reset`). Read-only
   `git diff` and `git status` are fine.
5. Do not run workspace-wide formatters (`mise run format`). Format only
   your own files with `bunx biome format --write <files>`.
6. Edit only your own progress log, `impl-plans/progress/<planId>.md`.
   Record each verification command, its exit code, and the important
   output lines. A log that stops halfway through is not a passing check.
7. Run commands in the foreground. No `&`, no `nohup`. Never pipe a
   verification command into `tee` or `head`: the pipeline would report
   the last command's status. Redirect to a log and print `echo
   "exit=$?"` instead.
8. `bun run typecheck` is repo-wide. Inside a wave, it can fail because a
   sibling plan's edit is half done. If every error is in a file you do
   not own, record the errors and the owning plan, wait, and rerun.
   Never edit the other plan's file, and never count such a failure as a
   pass.

## Final verification (serial, after wave 4, owned by reconciliation)

- `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify`
  exits 0.
- `CARGO_TERM_QUIET=true mise run test-cli` exits 0, including the pcb
  native parity case.
- `bun test packages/io/src/kicad packages/core/src/pcb packages/core/src/pcb-board packages/ir/src packages/io/src/jsonl apps/cli/src/pcb-commands.test.ts`
  exits 0.
- `bun run typecheck` exits 0.
- `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check`
  exits 0.
- `bun test packages/core/src/breadboard/export-golden.test.ts` exits 0
  (the breadboard writer bytes are unchanged).
- `git status --short` shows no change outside the union of the plans'
  writePaths.
- `impl-plans/README.md` gets a short "KiCad PCB pages" entry during
  finalization. That is reconciliation work, not a worker task.
