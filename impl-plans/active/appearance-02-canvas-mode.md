# appearance-02-canvas-mode

- planId: appearance-02-canvas-mode
- planPath: impl-plans/active/appearance-02-canvas-mode.md
- wave: 1
- dependsOn: none
- design: `design-docs/specs/design-appearance.md` sections 2 (invariant 3),
  5.1, 5.5
- progress log: `impl-plans/progress/appearance-02-canvas-mode.md`
- scratch: `tmp/canvas-theme-s539/appearance-02-canvas-mode/`

## Intent and context

Let the desktop app tell `NodettoCanvas` whether the current page's canvas
is light or dark, per page kind (PCB pages versus all others). This is the
only ui-solid TSX change in the feature. The private nodetto-cloud web app
consumes ui-solid and passes no new prop, so its behaviour must not change.
Read `appearance-00-overview.md` first.

## Non-goals

- No CSS (canvas styling belongs to plan 04).
- Do not touch `pcb-view.ts`, `PcbShapeView.tsx`, `PcbOverlay.tsx`,
  `PcbLayersPanel.tsx`, `pcb-state.ts`, `CanvasRulers.tsx`, or anything
  under `canvas/` other than the new file.
- No knowledge of `match` or the app theme in ui-solid. The prop carries
  already-resolved modes.

## writePaths

- packages/ui-solid/src/canvas/canvas-background.ts (new)
- packages/ui-solid/src/canvas/canvas-background.test.ts (new)
- packages/ui-solid/src/Canvas.tsx
- packages/ui-solid/src/index.ts
- impl-plans/progress/appearance-02-canvas-mode.md (new)

## File-level changes

### `canvas/canvas-background.ts` (new)

- `export type CanvasMode = "light" | "dark";`
- `export interface CanvasBackgroundSetting { readonly diagram: CanvasMode;
  readonly pcb: CanvasMode; }`
- `export function canvasModeFor(pageKind: PageKind | undefined, setting:
  CanvasBackgroundSetting | undefined): CanvasMode`. With an undefined
  setting, return `"light"`. If `pageKind === "pcb"`, return `setting.pcb`.
  Otherwise, including an undefined page kind, return `setting.diagram`.
- `export const CANVAS_DARK_CLASS = "nodetto-canvas-dark";`
- Import `PageKind` as a type from `@nodetto/ir`. Check how sibling files
  import IR types (for example `packages/ui-solid/src/Canvas.tsx` imports
  and `canvas/geometry.ts`) and follow that.

### `Canvas.tsx`

- Add to `NodettoCanvasProps`, after `showRulers`, the optional
  `readonly canvasBackground?: CanvasBackgroundSetting;` with a doc comment:
  "Resolved light/dark canvas per page kind; omitted keeps every page
  light."
- Add a memo next to `isPcbPage` (around `Canvas.tsx:185`) that reads
  `signals.rev()` and returns `canvasModeFor(props.editor.store.getPage(
  props.editor.currentPageId)?.kind, props.canvasBackground)`. Follow the
  existing `isPcbPage` memo pattern exactly.
- In the root `classList` (around `Canvas.tsx:258`), add
  `[CANVAS_DARK_CLASS]: canvasMode() === "dark"`. Use the computed-key form
  already used for the tool class.
- Change nothing else in the file.

Pitfall: the memo must react to page switches. `signals.rev()` covers
document changes. Confirm that switching `currentPageId` also bumps `rev`
(the `isPcbPage` memo relies on the same thing). If it does not, record that
in the progress log and use the same mechanism `isPcbPage` uses. Do not
invent a new subscription.

### `index.ts`

Add one export line next to the `NodettoCanvas` export:
`export { CANVAS_DARK_CLASS, type CanvasBackgroundSetting, type CanvasMode,
canvasModeFor } from "./canvas/canvas-background.ts";`

## Tests to add (`canvas/canvas-background.test.ts`)

- `canvasModeFor("pcb", undefined)` -> `light`. Same for `"erd"` and
  `undefined` (nodetto-cloud keeps today's behaviour).
- Desktop defaults `{diagram:"light", pcb:"dark"}`: `"pcb"` -> `dark`;
  `"freeform"`, `"erd"`, `"breadboard"`, `"bpmn"` -> `light`.
- `{diagram:"dark", pcb:"light"}`: `"pcb"` -> `light`, `"uml"` -> `dark`.
- Every value in `PAGE_KINDS` (import from `@nodetto/ir`) other than
  `"pcb"` follows `setting.diagram`. Loop over the tuple, with no index
  access.
- `CANVAS_DARK_CLASS === "nodetto-canvas-dark"`.

## Invariants

- `NodettoCanvas` with no `canvasBackground` prop renders the same DOM
  classes as today (the dark class is absent).
- The new code typechecks under `noUncheckedIndexedAccess`.

## Verification

- `bun test packages/ui-solid/src/canvas/canvas-background.test.ts packages/ui-solid/src/canvas-rulers.test.ts > tmp/canvas-theme-s539/appearance-02-canvas-mode/test.log 2>&1; echo "exit=$?"`
  -> exit 0.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid > tmp/canvas-theme-s539/appearance-02-canvas-mode/ui-solid.log 2>&1; echo "exit=$?"`
  -> exit 0 (no regression in the canvas, interaction and export tests).
- `bun run typecheck > tmp/canvas-theme-s539/appearance-02-canvas-mode/typecheck.log 2>&1; echo "exit=$?"`
  -> exit 0 (protocol rule 8 applies).
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/canvas-theme-s539/appearance-02-canvas-mode/unchecked.log 2>&1; echo "exit=$?"`.
  Then `grep -c "canvas-background\|ui-solid/src/Canvas.tsx" tmp/canvas-theme-s539/appearance-02-canvas-mode/unchecked.log`
  must print 0. Baseline at HEAD 28c9ded: exit 2 with 91 errors, none of
  them in these files (`tmp/canvas-theme-s539/step4/unchecked-baseline.log`).
- `bunx biome check packages/ui-solid/src/canvas/canvas-background.ts packages/ui-solid/src/canvas/canvas-background.test.ts packages/ui-solid/src/Canvas.tsx packages/ui-solid/src/index.ts --diagnostic-level=warn`
  -> exit 0.

## Done criteria

- `git diff --stat -- packages/ui-solid/src/Canvas.tsx` shows at most about
  15 changed lines.
- `grep -n "canvasBackground?: CanvasBackgroundSetting" packages/ui-solid/src/Canvas.tsx`
  prints 1 line.
- `grep -n "canvas-background.ts" packages/ui-solid/src/index.ts` prints 1
  line.
- The verification results and the progress log are complete, and the
  last line of the log is `STATUS: done` (overview rules 8-9).
