# ipd-19-desktop-presentation

- planId: ipd-19-desktop-presentation
- planPath: impl-plans/active/ipd-19-desktop-presentation.md
- progressPath: impl-plans/progress/ipd-19-desktop-presentation.md
- dependsOn: none (ipd-13-prototype-core-cli is an accepted dependency)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 8.6 (presentation), 8.7 (persistent elements) and 8.1 (`back`, `swap-overlay` actions); user-QA Q4 default (in-window, full-window overlay).
- Evidence: `tmp/ipd-s772/ipd-19-desktop-presentation/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/prototype.ts`
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
2. `sh -c 'L=tmp/ipd-s772/ipd-19-desktop-presentation/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-19-desktop-presentation/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/ui-solid/src/prototype-presentation\.ts|packages/ui-solid/src/PrototypePreview\.tsx|packages/ui-solid/src/PrototypeHotspots\.tsx|packages/ui-solid/src/PrototypeLayer\.tsx|packages/ui-solid/src/prototype-transition\.ts|packages/ui-solid/src/prototype-presentation\.test\.ts|packages/ui-solid/src/prototype-preview-flows\.test\.ts|packages/core/src/prototype\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 also when the workspace typecheck fails only in files this plan does not own (record those as `owned_elsewhere`). Exit 1 prints the `error TS` lines in owned files: fix them. Exit 2 means tsc failed without diagnostics: a gate failure. The full log is the evidence.
3. `bunx biome check packages/ui-solid/src/prototype-presentation.ts packages/ui-solid/src/PrototypePreview.tsx packages/ui-solid/src/PrototypeHotspots.tsx packages/ui-solid/src/PrototypeLayer.tsx packages/ui-solid/src/prototype-transition.ts apps/desktop/src/styles/prototype-preview.css packages/ui-solid/src/prototype-presentation.test.ts packages/ui-solid/src/prototype-preview-flows.test.ts packages/core/src/prototype.ts` -> exit 0 (owned TS/TSX/CSS files only; every listed file must exist at completion).
4. After the `packages/core/src/prototype.ts` edit: `bun test packages/core/src/prototype.test.ts packages/core/src/screen-transition.test.ts packages/core/src/workspace-workflow.test.ts packages/core/src/outline-interaction.test.ts packages/core/src/masks.test.ts packages/core/src/boolean-operations.test.ts packages/core/src/group-compositing.test.ts apps/desktop/src/design-workflow.test.ts` -> exit 0, 0 fail. These suites pin the accepted ipd-13 `prototypeScreen` behavior (navigate, open-overlay, close-overlay, change-to, hidden-target filtering, fixed/overflow hit gating). Do not weaken or edit them; this plan does not own them.

## Done criteria

Implementation verification passes (30 presentation tests, 43 core/desktop tests, scoped Biome and typecheck; see `impl-plans/progress/ipd-19-desktop-presentation.md`). Formal review remains downstream.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.
- Gate scope (S5-s786-R2): the typecheck and biome gates cover only this plan's owned files. `error TS` lines or biome diagnostics in files this plan does not own never block completion and are never fixed here: record each as an `owned_elsewhere` finding in the progress log (file path and the first error line, no fix) and finish. Errors in owned files always block. Do not wait for, or ask for, another amendment because a sibling's in-progress file fails the workspace typecheck.

## Amendment 2026-11-10 (operator round 9)

This plan owns `packages/core/src/prototype.ts`. Change `prototypeScreen` so `back` and `swap-overlay` links reach the presentation; keep every existing navigate and overlay behavior and test. Then rerun the presentation regression and the required verification. Keep the ipd-19 work already in the working tree and continue from it.

## Amendment 2026-11-10 (step5 s786 S5-s786-R1 and S5-s786-R2)

Ownership, plan ID and dependsOn (none; `ipd-13-prototype-core-cli` is an accepted dependency) are unchanged. This section binds the round-9 `prototype.ts` change.

`prototypeScreen` change (`packages/core/src/prototype.ts`, the `validTarget` expression in the `links` flatMap):

- Add only `back` and `swap-overlay` to the action allow-list next to `navigate`, `open-overlay` and `close-overlay`. Keep `target?.type === "frame"` for both. A `swap-overlay` `to` must be a frame; a link whose `to` is not a frame stays dropped.
- Keep the `change-to` variant check, the hidden-source and hidden-target filtering, the `hitBox` requirement, and the `prototypeFixed` / `prototypeOverflow` hit gating exactly as they are. Do not restructure the function and do not change the returned link shape other than letting the two actions through.

Pitfalls:

- A `back` link's `to` is the source's own screen frame (`connectPrototypeBack`, `packages/core/src/screen-transition.ts:98-116`). The presentation must treat `back` as "pop history" (the same handler as the back button) and must never navigate to `to`. Navigating to `to` silently does nothing, because it is the current screen.
- `back` with empty history does nothing (no exit, no navigation).
- `swap-overlay` replaces the top overlay. With no open overlay it opens the destination as the only overlay, as the in-progress handler at `PrototypePreview.tsx:414-427` already does. The overlay count must never grow on a swap.
- Do not edit the core test suites listed in Verification item 4; they belong to accepted plans. If one fails, the `prototype.ts` change is wrong: fix `prototype.ts`.

Regression test (add to the owned `packages/ui-solid/src/prototype-preview-flows.test.ts`), `input -> expected`:

- Two screens A and B, A navigates to B, and B has a button with a back link created by `connectPrototypeBack` -> `prototypeScreen(editor, B).links` contains that link with `action: "back"` (the returned link field is `action`, read from the semantic `prototypeAction`); the preview on B shows its hotspot; clicking it returns to A and history shrinks by one.
- Screen B with an open overlay O1 and a hotspot inside O1 with a `swap-overlay` link to frame O2 -> `prototypeScreen` returns the link with `action: "swap-overlay"`; clicking it shows O2, O1 is gone, overlay count stays 1.
- A `swap-overlay` link whose `to` is not a frame -> not returned by `prototypeScreen`, no hotspot.
- Existing navigate and open-overlay hotspots on the same screens keep working (one click each, same destinations as before).

Gates are now scoped to owned files (S5-s786-R2); see Verification items 2 and 3 and the gate-scope worker rule.
