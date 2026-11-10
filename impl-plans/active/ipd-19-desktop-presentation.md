# ipd-19-desktop-presentation

- planId: ipd-19-desktop-presentation
- planPath: impl-plans/active/ipd-19-desktop-presentation.md
- progressPath: impl-plans/progress/ipd-19-desktop-presentation.md
- dependsOn: ipd-13-prototype-core-cli
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 8.6 (presentation), 8.7 (persistent elements) and 8.1 (`back`, `swap-overlay` actions); user-QA Q4 default (in-window, full-window overlay).
- Evidence: `tmp/ipd-s772/ipd-19-desktop-presentation/`.
<!-- ownership:start -->
- writePaths:
  - `packages/ui-solid/src/prototype-presentation.ts`
  - `packages/ui-solid/src/PrototypePreview.tsx`
  - `packages/ui-solid/src/PrototypeHotspots.tsx`
  - `packages/ui-solid/src/PrototypeLayer.tsx`
  - `packages/ui-solid/src/prototype-transition.ts`
  - `apps/desktop/src/styles/prototype-preview.css`
  - `packages/ui-solid/src/prototype-presentation.test.ts`
  - `packages/ui-solid/src/prototype-preview-flows.test.ts`
  - `impl-plans/progress/ipd-19-desktop-presentation.md`
  - `tmp/ipd-s772/ipd-19-desktop-presentation`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-19-desktop-presentation`
<!-- ownership:end -->

## Intent and context

The desktop already has `packages/ui-solid/src/PrototypePreview.tsx`. It starts at the `prototypeStart` frame and has history, back, overlays and smart animate.

This plan extends it into the presentation mode the request asks for:

- a flow selector and restart;
- an optional generic device frame;
- hotspot hints;
- the `back` and `swap-overlay` actions;
- keyboard back and exit;
- persistent layers that do not animate during navigation.

## Non-goals

- No separate window (Q4).
- No vendor device artwork.
- No changes to the core transition planner, other than consuming `persistentLayerPairs`.

## File-level changes

New `packages/ui-solid/src/prototype-presentation.ts`, pure helpers (testable without DOM):

- `export function presentationFlows(store, context): readonly { name: string; startId: ElementId }[]`, from `prototypeFlows`.
- `export function initialScreen(flows, requestedFlow?: string, selectedFrame?: ElementId, fallbackFrames): ElementId | undefined`
  - Priority: the requested flow, then the first flow, then the selected frame, then the first frame. Keep the existing fallbacks of `PrototypePreview.tsx:105-111`.
- `export function presentationKeyAction(key: string, state: { overlays: number; history: number }): "back" | "close-overlay" | "exit" | "restart" | undefined`
  - Backspace and ArrowLeft -> `back` when history > 0.
  - Escape -> `close-overlay` when overlays > 0, else `exit`.
  - `r` or `R` -> `restart`.

`packages/ui-solid/src/PrototypePreview.tsx`:

- Accept an optional `flow?: string` prop. `ipd-18` wires it from `FlowsPanel` through `Toolbar.tsx`; do not edit `Toolbar.tsx` here.
- Header:
  - flow select listing `presentationFlows`;
  - restart button;
  - "Device frame" toggle;
  - "Show hotspots" toggle.
- The existing back button and history stay.
- Action `back`: the same as the back button.
- Action `swap-overlay`: replace the top overlay with the destination overlay, playing the link's transition.
- Hotspot hints: a pointer-down inside the screen that hits no hotspot outlines all hotspots for 600 ms. With reduced motion, show the outlines without fading.
- Persistent layers: when navigating A -> B with a non-instant transition, compute `persistentLayerPairs(store, ctx, A, B)`.
  - Render B's matched layers in a static layer above the animating screens for the transition duration.
  - Hide them inside both animating screens during the transition, through a CSS class on those layer elements in `PrototypeLayer`.

`packages/ui-solid/src/PrototypeHotspots.tsx`: support the "show hotspots" and hint-flash states with a CSS class and outline. Use no new colors outside the existing tokens; reuse the existing focus/accent token.

`packages/ui-solid/src/prototype-transition.ts`: if needed, add the swap-overlay transition entry and exclude persistent layers. Keep existing exports stable.

`apps/desktop/src/styles/prototype-preview.css`:

- Device frame: a rounded rectangle bezel (radius 48, 12 px border in a neutral token) around the screen, with a 134×5 home-indicator pill, all drawn with CSS.
- Hint outline styles.

## Patterns to imitate

- The existing history and overlay handling in `PrototypePreview.tsx:117-135`, `:263`, `:438-445`.
- `packages/ui-solid/src/prototype-trigger.ts` for trigger handling.
- `prototype-overlays.ts` for the overlay stack.

## Pitfalls

- Keep current behavior when no flows exist: start at the selected or first frame.
- `after-delay` timers must be cleared on navigation, restart and exit. Existing tests cover the old cases; add swap and back cases.
- Persistent layers: only top-level children with `prototypeFixed`. Never re-parent document elements; rendering only.
- Escape inside an overlay closes the overlay first. It does not exit.

## Tests

New `packages/ui-solid/src/prototype-presentation.test.ts`:

- `initialScreen` priority cases.
- `presentationKeyAction`: Escape with an overlay -> `close-overlay`; Escape without one -> `exit`; Backspace with empty history -> undefined; `r` -> `restart`.
- `presentationFlows` order by name.

New `packages/ui-solid/src/prototype-preview-flows.test.ts`:

- Render the preview on a doc with two flows. Choosing the second flow shows its start screen.
- A `back` link click returns to the previous screen.
- A `swap-overlay` link replaces the overlay. Overlay count stays 1.
- A click on an empty area adds the hint class to the hotspots.
- During a slide navigation between two screens with matching fixed tab bars, the static persistent layer is present and the in-screen copies are hidden.

Existing prototype tests (`prototype-overlays.test.ts`, `prototype-transition.test.ts`, `prototype-trigger.test.ts`, `prototype-scroll.test.ts`, `prototype-surface-focus.test.ts`, `prototype-variant-state.test.ts`) must pass.

## Verification (evidence in `final/`)

1. `bun test packages/ui-solid/src/prototype-presentation.test.ts packages/ui-solid/src/prototype-preview-flows.test.ts packages/ui-solid/src/prototype-overlays.test.ts packages/ui-solid/src/prototype-transition.test.ts packages/ui-solid/src/prototype-trigger.test.ts packages/ui-solid/src/prototype-scroll.test.ts packages/ui-solid/src/prototype-surface-focus.test.ts packages/ui-solid/src/prototype-variant-state.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned TS/TSX files -> exit 0.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
