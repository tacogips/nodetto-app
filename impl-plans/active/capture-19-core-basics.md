# M19 capture-19-core-basics

- dependsOn: M1 (green type check)
- Design: sections 5 (scale rule), 6.5 (theme), 4.5 (token bound)
- writePaths: `packages/core/src/capture/raster-fit.ts` (new) and its
  test, `packages/core/src/capture/theme.ts` (new) and its test,
  `packages/core/src/capture/index.ts` (new),
  `packages/core/src/index.ts` (one line: `export * from
  "./capture/index.ts";`)
- Pre-authorised: none. `apps/desktop/src/styles/theme-tokens.test.ts`
  passes unmodified.

## Contract

```ts
// packages/core/src/capture/raster-fit.ts (no imports besides export-geometry)
export const CAPTURE_DEFAULT_BOX = { width: 1568, height: 1568, maxPixels: 1_150_000 } as const;
export interface CaptureRasterPlan { readonly scale: number; readonly width: number; readonly height: number }
/** box: explicit --size (no megapixel term) or undefined for the default.
 *  Throws a message for the user when RASTER_LIMITS cannot be met. */
export function captureRasterPlan(viewport: { width: number; height: number },
  options: { box?: { width: number; height: number }; scale?: number }): CaptureRasterPlan;

// packages/core/src/capture/theme.ts
export type CaptureTheme = "light" | "dark";
export const CAPTURE_THEMES: Readonly<Record<CaptureTheme,
  { background: string; body: string; edge: string; interference: string }>>;
```

## Behavior

- `captureRasterPlan`: design section 5. Default: `scale = min(1, 1568/w,
  1568/h, sqrt(1150000/(w*h)))`; with `box`: `min(1, box.width/w,
  box.height/h)`; with `scale`: that value (0.01 to 4, else a
  `RangeError`). Round the scale down to three decimals, at least 0.01.
  `width = ceil(w*scale)`, same for height; throw when a side exceeds
  `RASTER_LIMITS.maxSide` or the area `RASTER_LIMITS.maxPixels`
  (`packages/core/src/export-geometry.ts:4`), with a message that names
  `--size`, `--scale` and `--element`.
- `theme.ts`: the four canvas-mode tokens of design section 6.5 for both
  modes, as `#rrggbb` strings; no other colour and no fallback. Nothing
  under `packages/core/src/capture` reads appearance state, the DOM or
  the environment.
- `capture/index.ts` re-exports both modules; later milestones add their
  modules to it.

## Tests

- `raster-fit.test.ts`: default box and megapixel term; never above 1;
  explicit box; explicit scale; three-decimal rounding; limit errors; for
  1,000 viewports from a seeded generator (sides 10 to 20,000) the
  default plan costs at most 1,568 tokens of 28 x 28 pixels
  (`ceil(w/28) * ceil(h/28)`), the bound design section 4.5 states.
- `theme.test.ts`: reads `apps/desktop/src/styles/canvas.css`, extracts
  the light block and the `.nodetto-canvas-dark` block, and requires the
  four values of each mode to equal `CAPTURE_THEMES`; contrast of
  `interference` against `body` and of `edge` against `background` is at
  least 3:1 in both modes (WCAG relative luminance, computed in the test;
  the hatch of design section 6.6 alternates exactly `interference` and
  `body`).
- The existing token test and the core barrel still pass.

## Acceptance criteria

- The 2D default size rule and the token mirror exist as pure functions
  and constants with tests; a token change in `canvas.css` fails a test
  here.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/capture apps/desktop/src/styles/theme-tokens.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m19; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m19/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m19/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture'`
3. `sh -c 'bun run lint:ts && bun test packages/core/src/capture/theme.test.ts'`

## Progress

Implemented. Added the 2D raster planner and the two canvas palettes to the
core barrel. The fit rule rounds down another thousandth when whole-pixel
rounding would exceed the box or area bound. A fit that cannot meet its
bound at 0.01 fails with the same option guidance as an oversized raster.
These boundary cases preserve the documented default size and token limits.
Removed the two scratch mise symlinks identified by CAP-M2-05 before
verification. The existing desktop token test is unchanged.

All three milestone commands passed. The full Bun run passed with 4,523
tests and 77 skips across 728 files after the CAD picking deadline passed
in isolation. Workspace Rust check, desktop format check and clippy
passed. The optional Rust test runs hit the worktree-only write guard in
unchanged macOS Foundation atomic-write tests. Logs are in
`tmp/capture/m19/`.
