# car2-r-raster-rounding: one rounding rule for raster plan and frame (R2-10)

- planId: car2-r-raster-rounding
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-10.
- Progress log: `impl-plans/progress/car2-r-raster-rounding.md`

## Intent

`captureRasterPlan` rounds the frame size with `ceil(span * scale)`, while
the frame builder subtracts 1e-6 first. Make both use the frame builder's
rule, compute the integer size once, and pass it to the frame builder.

## Non-goals

- Do not change scale quantization (`SCALE_PRECISION` and the step logic),
  `snapSvgFrameToPixels`, error messages or the limits.

## Changes

1. `packages/core/src/capture/raster-fit.ts`
   - Export `capturePixelSpan(span: number, scale: number): number`, equal
     to `Math.max(1, Math.ceil(span * scale - 1e-6))`.
   - In the loop, compute `pixelWidth` and `pixelHeight` with it, and use
     them for the box, area and `RASTER_LIMITS` checks and in the returned
     plan.
   - `packages/core/src/capture/index.ts:4` already re-exports the whole
     module with `export *`, so no barrel edit is needed.
2. `apps/cli/src/capture-artwork.ts`
   - `pixelFrame(svg, scale, width, height)` uses the plan's `width` and
     `height` instead of recomputing them.
   - The call site at `:140-145` passes `plan.width` and `plan.height`.

## Pitfalls

- Do not edit any barrel file.
- `pngSize` still reports the encoded size. Keep it.

## Tests

1. `packages/core/src/capture/raster-fit.test.ts`
   - `captureRasterPlan({ width: 10000, height: 100 }, { scale: 0.07 })`
     gives `{ scale: 0.07, width: 700, height: 7 }`. Fails before: 701 x 8.
   - The same viewport with `{ box: { width: 700, height: 7 } }` gives
     scale 0.07 and 700 x 7. Fails before: 0.069.
2. `apps/cli/src/capture-command.test.ts`
   - Capture a page whose SVG viewport is 10000 x 100 (padding included),
     once with `--scale 0.07` and once with `--size 700x7`, imitating the
     cases at `:419-427`. Both give a 700 x 7 PNG with equal bytes.
   - The existing over-limit and deterministic PNG tests pass unedited.

## Verification

- `bun test packages/core/src/capture/raster-fit.test.ts apps/cli/src/capture-command.test.ts`
  must exit 0.
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/raster-fit.ts apps/cli/src/capture-artwork.ts packages/core/src/capture/raster-fit.test.ts apps/cli/src/capture-command.test.ts`
  must exit 0.

## Done when

- The tests pass, and the existing tests pass unedited.
- The progress log reads `done`.

## Amendment 2026-11-25 (integration review INT-R10-01)

R2-10 requires a visible default-fit change for a 3000 x 3296 viewport:
1020 x 1121 at scale 0.340 becomes 1023 x 1124 at scale 0.341, which
fits the pixel cap with the shared rounding rule. This is the only existing
test expectation edited.
