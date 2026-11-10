# ipd-18-desktop-prototype-view

- planId: ipd-18-desktop-prototype-view
- planPath: impl-plans/active/ipd-18-desktop-prototype-view.md
- progressPath: impl-plans/progress/ipd-18-desktop-prototype-view.md
- dependsOn: ipd-13-prototype-core-cli, ipd-19-desktop-presentation (this plan passes the `flow` prop that `ipd-19` adds to `PrototypePreview`), ipd-29-desktop-snap-grid (`Canvas.tsx` ownership order)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 8.3 (view toggle and drawing) and 8.5 (Flows list), D9. The desktop snap grid (7.6) is `ipd-29`.
- Evidence: `tmp/ipd-s772/ipd-18-desktop-prototype-view/`.
<!-- ownership:start -->
- writePaths:
  - `packages/ui-solid/src/Toolbar.tsx`
  - `packages/ui-solid/src/shortcuts.ts`
  - `packages/ui-solid/src/Canvas.tsx`
  - `packages/ui-solid/src/PrototypeViewLayer.tsx`
  - `packages/ui-solid/src/shapes/ConnectorView.tsx`
  - `packages/ui-solid/src/interaction/hit-testing.ts`
  - `packages/ui-solid/src/FlowsPanel.tsx`
  - `packages/ui-solid/src/prototype-view.test.ts`
  - `packages/ui-solid/src/flows-panel.test.ts`
  - `impl-plans/progress/ipd-18-desktop-prototype-view.md`
  - `tmp/ipd-s772/ipd-18-desktop-prototype-view`
- sharedPaths:
  - `packages/ui-solid/src/index.ts`
- sharedPathNotes:
  - path: `packages/ui-solid/src/index.ts`; intendedEdit: append export lines only, and only if needed; re-read before writing; verify sibling lines survive
- artifactRoots:
  - `tmp/ipd-s772/ipd-18-desktop-prototype-view`
<!-- ownership:end -->

## Intent and context

On the desktop canvas, prototype links are drawn as ordinary connectors across all artboards (D9). This plan adds:

- **A view toggle**, "Design | Prototype", in the toolbar of the app and web workspaces:
  - Design view hides prototype links.
  - Prototype view draws curves, back tags and flow flags from the core `prototypeLinkGeometry` (`ipd-13`), so the canvas matches `export --prototype`.
- **A Flows list** in prototype view.

## Non-goals

- Presentation mode (`ipd-19`).
- The Export dialog (`ipd-22`).
- The snap grid (`ipd-29`). Do not edit `interaction/types.ts`, `interaction/snapping.ts`, `ZoomControls.tsx`, `apps/desktop/src/settings/preferences.ts` or `apps/desktop/src/App.tsx`.
- No core changes.
- The view state is UI state, never stored in the document.

## File-level changes

`packages/ui-solid/src/Toolbar.tsx`:

- A segmented toggle "Design | Prototype", visible only in design workspaces (next to the existing Preview button, `:553-565`).
- Keyboard shortcut: Shift+E. First check `packages/ui-solid/src/shortcuts.ts` and `shortcuts.test.ts`. If Shift+E is bound, choose a free key, record it, and use it everywhere.
- Add the shortcut registration in `packages/ui-solid/src/shortcuts.ts` (owned here).

`packages/ui-solid/src/Canvas.tsx`:

- Hold a `prototypeView` signal, passed from the Toolbar through the existing shell state pattern; see how `snap` settings flow through `ZoomControls`.
- In design view, do not render `edge.generic` elements with `prototype: true`.
- Make hit-testing consistent: `packages/ui-solid/src/interaction/hit-testing.ts:173` already special-cases prototype edges. Hidden links must not be pickable in design view.
- In prototype view, render the new `PrototypeViewLayer` above content.

New `packages/ui-solid/src/PrototypeViewLayer.tsx`:

- For each prototype link on the page, call `prototypeLinkGeometry`:
  - curve: path, stroke `#7c3aed` width 2 (zoom-independent stroke via `vector-effect: non-scaling-stroke`), start dot, end arrow;
  - compact label on a rounded white backdrop;
  - back tag.
- Flow flags above start frames.
- Clicking a curve selects its link element, so the inspector edits it.

`packages/ui-solid/src/shapes/ConnectorView.tsx`: skip prototype links when the view is design, if `Canvas.tsx` does not already filter them before rendering. Choose one place and record it.

New `packages/ui-solid/src/FlowsPanel.tsx`:

- Shown in prototype view as a small side list, using `prototypeFlows`.
- For each flow: its name and screen count.
- Clicking a flow selects and zooms to its screens. Use the existing camera "zoom to selection" helper in `packages/core/src/camera.ts`/ui-solid.
- A "Present" button starts presentation at that flow. `FlowsPanel` calls `onPresent(flowName)`, and `Toolbar.tsx` opens the existing lazy `PrototypePreview` with the `flow` prop (added by `ipd-19`).

## Patterns to imitate

- The Preview toggle in `Toolbar.tsx:553-565`.
- `packages/ui-solid/src/BreadboardOverlay.tsx` / `PcbOverlay.tsx` for canvas overlay layers.
- `packages/ui-solid/src/BpmnProblemsPanel.tsx` for a side panel.

## Pitfalls

- Never mutate the document when toggling views.
- Undo history must not record view changes.
- Prototype view curves must be computed per render frame efficiently. Memoize on the document revision; do not recompute on pointer moves.
- Keep the view toggle state in ui-solid (a signal shared between `Toolbar.tsx` and `Canvas.tsx` through their existing props or context), so `apps/desktop/src/App.tsx` needs no change. If a shell change in `App.tsx` turns out to be required, record a finding for `ipd-22`, which owns `App.tsx` after `ipd-29`.

## Tests

New `packages/ui-solid/src/prototype-view.test.ts`:

- In design view, a page with a prototype link -> no connector element rendered for it, and it is not hit-testable.
- In prototype view -> a path whose `d` starts at the hotspot edge, and a label backdrop with the compact text.
- A back link -> a tag.
- A start frame -> a flag with the flow name.

New `packages/ui-solid/src/flows-panel.test.ts`: two flows listed in name order; clicking one selects its screens.

Existing: `packages/ui-solid/src/Toolbar.test.ts`, `shortcuts.test.ts`, `interaction-selection-snapping.test.ts` and `canvas-paint-order.test.ts` must pass.

## Verification (evidence in `final/`)

1. `bun test packages/ui-solid/src/prototype-view.test.ts packages/ui-solid/src/flows-panel.test.ts packages/ui-solid/src/Toolbar.test.ts packages/ui-solid/src/shortcuts.test.ts packages/ui-solid/src/interaction-selection-snapping.test.ts packages/ui-solid/src/canvas-paint-order.test.ts apps/desktop/src/design-workflow.test.ts` -> exit 0, 0 fail.
2. `sh -c 'L=tmp/ipd-s772/ipd-18-desktop-prototype-view/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-18-desktop-prototype-view/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/ui-solid/src/Toolbar\.tsx|packages/ui-solid/src/shortcuts\.ts|packages/ui-solid/src/Canvas\.tsx|packages/ui-solid/src/PrototypeViewLayer\.tsx|packages/ui-solid/src/shapes/ConnectorView\.tsx|packages/ui-solid/src/interaction/hit-testing\.ts|packages/ui-solid/src/FlowsPanel\.tsx|packages/ui-solid/src/prototype-view\.test\.ts|packages/ui-solid/src/flows-panel\.test\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 also when the workspace typecheck fails only in files this plan does not own (record those as `owned_elsewhere`). Exit 1 prints the `error TS` lines in owned files: fix them. Exit 2 means tsc failed without diagnostics: a gate failure. The full log is the evidence.
3. `bunx biome check packages/ui-solid/src/Toolbar.tsx packages/ui-solid/src/shortcuts.ts packages/ui-solid/src/Canvas.tsx packages/ui-solid/src/PrototypeViewLayer.tsx packages/ui-solid/src/shapes/ConnectorView.tsx packages/ui-solid/src/interaction/hit-testing.ts packages/ui-solid/src/FlowsPanel.tsx packages/ui-solid/src/prototype-view.test.ts packages/ui-solid/src/flows-panel.test.ts` -> exit 0 (owned TS/TSX/CSS files only; every listed file must exist at completion).
4. Visual evidence: run the desktop dev build only if available in the sandbox. Otherwise export `final/prototype-view.png` with `export --prototype` and compare the canvas geometry by test only. Record which was done.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/ui-solid/src/index.ts` is shared: append export lines only, if needed.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
- Gate scope (S5-s786-R2): the typecheck and biome gates cover only this plan's owned files. `error TS` lines or biome diagnostics in files this plan does not own never block completion and are never fixed here: record each as an `owned_elsewhere` finding in the progress log (file path and the first error line, no fix) and finish. Errors in owned files always block. Do not wait for, or ask for, another amendment because a sibling's in-progress file fails the workspace typecheck.

## Amendment 2026-11-10 (step5 s786 S5-s786-R2)

The manifest and Verification typecheck and biome gates are now scoped to this plan's owned files, with the expected result stated (typecheck: exit 0, or exit 0 when only non-owned files fail; exit 1 lists owned-file `error TS` lines; exit 2 is a tsc failure without diagnostics). The markdown and the manifest carry the identical command strings. Ownership, plan ID and dependsOn are unchanged. Errors in non-owned files are `owned_elsewhere` findings and never block (see Worker rules).
