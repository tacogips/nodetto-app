# AI capture audit round 1: scope amendments to confirm

Context: `design-docs/specs/design-ai-capture.md` section 19 and
`design-docs/specs/design-cad3d.md` section 19. The audit limits edits to
the files that the 16 findings name and the tests next to them. Two fixes
cannot be completed inside that list. Each question names the smallest
amendment that would allow it. Until a question is answered, the plans
touch none of its files.

How to answer: replace `pending` on a question's `Decision:` line with
`approved` or `declined`. The gated implementation plans read that line
first. While it reads `pending`, they make no edit and report themselves as
blocked.

## Q1. F2 stale-insertion guard: allow `packages/ui-solid/src/cad/board-picker.tsx`

Decision: approved

- Why it is needed: F2 asks that insertion reject a board whose page is no
  longer a PCB page. The only insertion path is `insert` in
  `board-picker.tsx`. Today it checks only editability and record type,
  then calls `pcbReferenceCommands` in `packages/core/src/cad/authoring.ts`,
  which is also not in the list. No listed file can enforce the check at
  commit time.
- Amendment:
  - A guard of about three lines in `board-picker.tsx`. It calls
    `isPcbBoardChoice` from `pcb-insert.ts` against a fresh snapshot.
  - A stale-submission case in the picker's existing DOM test,
    `packages/ui-solid/src/test-dom/cad-workspace.dom.tsx`. That file is
    run by `packages/ui-solid/src/cad-palette.test.ts`.
  - Earlier revisions named `viewport.test.tsx`, but the picker's DOM
    coverage lives in `cad-workspace.dom.tsx`.
  - Plan: `impl-plans/active/car1-d2-pcb-insert-guard.md`.
- If not approved: the picker and the single-board shortcut still omit
  the board, and capture reports `cad.reference.missing`. A submission
  that was already open when the page changed can still insert a
  reference, which then reports `cad.reference.missing`. F2 stays
  partially open.
- Recommended answer: approve.

## Q2. F9 native bounds and strict decoder typing: allow `apps/cli/src/commands.ts`, `packages/core/src/svg-export/theme.ts`, `packages/core/src/svg-export/document.ts`

Decision: approved

- Why it is needed: native SVG export reaches `cadPageWireframe` only
  through `renderPageSvg` (`svg-export/document.ts`), whose options type
  lives in `svg-export/theme.ts`. The capture decoder reaches
  `capture-command.ts` through `CommandIo.decodeMesh`, whose type in
  `commands.ts` declares only `positions` and `triangles`. Without these
  files, the native export keeps decoding meshes in Boa, and the new
  `bounds` and `booleanTarget` fields cannot be typed on the native
  capture path.
- Amendment:
  - `commands.ts`: one return-type change on `CommandIo.decodeMesh`, and
    one optional member `meshBounds?`.
  - `theme.ts`: one optional `SvgExportOptions.meshBounds` member.
  - `document.ts`: one argument forwarded to `cadPageWireframe`.
- If not approved: plan A2 (`impl-plans/active/car1-a2-native-wiring.md`)
  cannot land as designed. F9 stays open, and F1 and F4 (plans B2 and B3)
  cannot be typed on the native CLI; the design rejects an untyped
  fallback.
- Recommended answer: approve. Plans B2 and B3 wait for plan A2. Plan A1
  (the decoder contract) and all other plans do not depend on Q2.
