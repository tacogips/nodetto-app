# breadboard-14-ui-problems

- planId: breadboard-14-ui-problems
- planPath: impl-plans/active/breadboard-14-ui-problems.md
- wave: 5; dependsOn: breadboard-06-core-editing, breadboard-07-core-connectivity-erc, breadboard-10-core-ratsnest-parity
- design: design-docs/specs/design-breadboard.md sections 7.2 (problems
  panel), 7.5 (cross-probing, `focusBreadboardProbe`), 10 (importWarnings)
- progress log: impl-plans/progress/breadboard-14-ui-problems.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/ui-solid/src/(BreadboardProblemsPanel|breadboard-problems)|^packages/ui-solid/src/index\.ts`

## Intent

Add a breadboard problems panel that lists ERC, parity and import
diagnostics. It is debounced at 300 ms, has a "Fix references" action, and
cross-probes from rows and reference chips to the canvas. It also provides
`focusBreadboardProbe`, which the inspector (plan 13) reuses.

## Non-goals

- No desktop mounting. That is plan 17.
- No canvas overlay drawing. Plan 12 draws the probe highlight.
- No canvas-to-panel direction.

## writePaths

- packages/ui-solid/src/BreadboardProblemsPanel.tsx (new)
- packages/ui-solid/src/BreadboardProblemsPanel.css (new)
- packages/ui-solid/src/breadboard-problems.ts (new)
- packages/ui-solid/src/breadboard-problems.test.ts (new)
- packages/ui-solid/src/index.ts
- impl-plans/progress/breadboard-14-ui-problems.md

## sharedPaths

none

## Contracts (pinned; plans 13, 17 rely on them)

```ts
// breadboard-problems.ts
export interface BreadboardProblemRow { ruleId: string; severity: "error" | "warning"; elementId: ElementId; pin?: number; elementIds: readonly ElementId[]; reference: string; message: string; chips: readonly { elementId: ElementId; reference: string }[] }
export function breadboardProblemRows(document: Document, pageId: PageId): readonly BreadboardProblemRow[]; // lintBreadboardPage order
export function canFixBreadboardReferences(document: Document, pageId: PageId): boolean; // any duplicate or unannotated part reference
export function focusBreadboardProbe(editor: Editor, probe: BreadboardProbe, viewport?: ViewportSize): boolean; // no viewport -> select and probe without framing
// BreadboardProblemsPanel.tsx
export interface BreadboardProblemsPanelProps { editor: Editor; viewport: () => ViewportSize; importWarnings?: readonly BpmnImportWarning[] }
export function BreadboardProblemsPanel(props: BreadboardProblemsPanelProps): JSX.Element;
```

`index.ts` exports `BreadboardProblemsPanel`, `type BreadboardProblemsPanelProps`,
`breadboardProblemRows`, `focusBreadboardProbe` and
`type BreadboardProblemRow`, next to the BPMN exports (index.ts:115-122).

## File-level changes

- `breadboard-problems.ts`:
  - Rows come from `lintBreadboardPage`. `chips` are the parts in
    `elementIds`, in that order, with their references. `reference` is the
    reported element's reference, or an empty string for boards, wires
    and cards.
  - `focusBreadboardProbe` imitates `focusBpmnProblem`
    (bpmn-problems.ts:55):
    1. `editor.setCurrentPage(probe.pageId)`
    2. `editor.selection.set(existing ids)`, keeping only ids still in the
       store and returning false when none remain
    3. `editor.zoomToSelection(viewport)`, only when a viewport with
       positive width and height is given
    4. `editor.setBreadboardProbe(probe)`, which must come after
       `setCurrentPage`, because a page change clears the probe
- `BreadboardProblemsPanel.tsx` imitates `BpmnProblemsPanel.tsx`
  (subscribe, a 300 ms debounce, `Show` when the page kind is
  `breadboard`).
  - Import warnings are listed first, as the BPMN panel does.
  - Each row shows severity, the reference and pin, the message, the rule
    id and the chips.
  - Clicking a row calls `focusBreadboardProbe` with `elementIds` and, when
    the finding has a pin, `pin: {elementId, pin}`.
  - Clicking a chip probes only that part.
  - A "Fix references" button calls
    `editor.annotateBreadboard(pageId)`. It is enabled when
    `canFixBreadboardReferences` is true.
- CSS: imitate `BpmnProblemsPanel.css`, using a `nodetto-breadboard-problems`
  class prefix.

## Pitfalls

- Re-run the lint only after the debounce, never on every store revision.
  Drags write every pointer move.
- A row whose elements were deleted must not throw. `focusBreadboardProbe`
  returns false.
- Do not edit `BpmnProblemsPanel.tsx` or `bpmn-problems.ts`.

## Tests (input -> expected), in `breadboard-problems.test.ts`

- a page with a duplicate R1 -> a row `duplicate-reference` with
  reference `R1`, and `canFixBreadboardReferences` true
- a page with a rail short through a wire -> the row's `chips` list the
  parts on the net, and `elementIds[0]` is the wire
- a page with a target and an unrouted net -> a `parity-missing-connection`
  row with 2 chips
- `focusBreadboardProbe` with a pin -> the selection equals the ids,
  `editor.breadboardProbe()` equals the probe and the current page is the
  probe's page
- a probe on another page -> the page switches and the probe survives
  (set after the switch)
- all ids deleted -> returns false and the selection is unchanged
- a clean page -> no rows, and `canFixBreadboardReferences` false

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-14-ui-problems
bun test packages/ui-solid/src/breadboard-problems.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ui-solid > tmp/breadboard-mode-s485/breadboard-14-ui-problems/ui.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-14-ui-problems/typecheck.log 2>&1     # G1
bunx biome check packages/ui-solid/src/BreadboardProblemsPanel.tsx packages/ui-solid/src/BreadboardProblemsPanel.css packages/ui-solid/src/breadboard-problems.ts packages/ui-solid/src/breadboard-problems.test.ts packages/ui-solid/src/index.ts   # exit 0
git diff --quiet -- packages/ui-solid/src/BpmnProblemsPanel.tsx packages/ui-solid/src/bpmn-problems.ts   # exit 0
```

## Done criteria

- `grep -n 'BreadboardProblemsPanel' packages/ui-solid/src/index.ts` prints the export.
- All verification lines pass, with exit codes and counts in the progress log.
