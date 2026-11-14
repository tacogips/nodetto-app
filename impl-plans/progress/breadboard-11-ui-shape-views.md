# Progress: breadboard-11-ui-shape-views

Status: implementation complete; plan-local focused verification passes.

## Changes

- Added `breadboard-view.ts` with the pinned pure view model. It calls the public `@nodetto/core` notation API, preserves body and label primitives, and counter-rotates labels around the local box center.
- Added `BreadboardShapeView.tsx`. It renders every primitive through the existing primitive attribute mapper, applies `breadboard-<role>` classes, preserves opacity, and renders labels in their own counter-rotated group. `inert` is an optional view input because `ShapeView` has no editor snapshot or page context; the caller can supply the target-card state.
- Added tests for resistor bands and labels, rotation, the 400-hole half board, inert netlist opacity, and body primitive counts across all 13 breadboard types. The tests import no core source by relative path.
- Added `isBreadboardElementType` dispatch in `ShapeView.tsx`.

## Final-source verification

Evidence directory: `tmp/breadboard-mode-s485/breadboard-11-ui-shape-views/step6-current/`.

| Command | Exit | Result |
|---|---:|---|
| `mise exec -- bun test packages/ui-solid/src/shapes/breadboard-view.test.ts` | 0 | 5 passed, 0 failed, 21 assertions (`focused.log`) |
| `mise exec -- bun test packages/ui-solid` | 0 | 499 passed, 0 failed, 3675 assertions (`ui.log`) |
| `mise exec -- bun run typecheck` | 0 | TypeScript completed successfully (`typecheck.log`) |
| Owned-file G1 grep against `typecheck.log` | 0 | No plan-11 diagnostics (`g1.log`) |
| `mise exec -- bunx biome check packages/ui-solid/src/shapes/BreadboardShapeView.tsx packages/ui-solid/src/shapes/breadboard-view.ts packages/ui-solid/src/shapes/breadboard-view.test.ts packages/ui-solid/src/shapes/ShapeView.tsx` | 0 | Four files checked; no fixes applied (`biome.log`) |
| Whole-file and added-line ASCII gates | 0 | No non-ASCII bytes in plan-11 files (`ascii.log`, `shape_added_ascii.log`) |
| Relative core-source import boundary | 0 | No relative core-source imports found (`import_boundary.log`) |
| `grep -n 'isBreadboardElementType' packages/ui-solid/src/shapes/ShapeView.tsx` | 0 | Breadboard dispatch present (`dispatch.log`) |

## Aggregate suite resolution

- The earlier aggregate failure under Bun 1.4.4 (469 passed and five `jsxDEV` module-load errors) is superseded by the current rerun through mise-pinned Bun 1.4.0, which passes all 499 ui-solid tests with no failures.
- Typecheck succeeds, and the owned-file G1 grep finds no plan-11 diagnostics.

## Earlier attempts

- The first focused run had one incorrect test expectation (`resistor-band-0`); notation roles start at `resistor-band-1`. The assertion was corrected and the final-source focused run passes (`focused-initial.log`).
- Earlier plan-local diagnostics and their resolutions are retained above; the current source-matched typecheck exits 0.
- Biome formatting-only issues were fixed on the four owned files; current Biome check passes.

No cargo commands were required. No git write operations were performed.
