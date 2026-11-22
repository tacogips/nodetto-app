import { RASTER_LIMITS } from "../export-geometry.ts";

export const CAPTURE_DEFAULT_BOX = {
  width: 1568,
  height: 1568,
  maxPixels: 1_150_000,
} as const;

interface RasterSize {
  readonly width: number;
  readonly height: number;
}

export interface CaptureRasterPlan extends RasterSize {
  readonly scale: number;
}

const SCALE_PRECISION = 1000;
const MIN_SCALE_STEPS = 10;
const MIN_SCALE = MIN_SCALE_STEPS / SCALE_PRECISION;
const MAX_SCALE = 4;
const FIT_GUIDANCE =
  "Choose a different --size or --scale, or capture a smaller --element.";

function validSize({ width, height }: RasterSize): boolean {
  return (
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
  );
}

/** Plan a 2D capture from the SVG viewport and the requested fit or scale. */
export function captureRasterPlan(
  viewport: RasterSize,
  options: { box?: RasterSize; scale?: number },
): CaptureRasterPlan {
  if (!validSize(viewport)) {
    throw new RangeError("Capture requires a positive, finite SVG viewport.");
  }

  const { width, height } = viewport;
  const box =
    options.scale === undefined
      ? (options.box ?? CAPTURE_DEFAULT_BOX)
      : undefined;
  const maxFitPixels =
    options.box === undefined
      ? CAPTURE_DEFAULT_BOX.maxPixels
      : Number.POSITIVE_INFINITY;
  let requestedScale = options.scale ?? 1;
  if (box) {
    if (!validSize(box) || box.width < 1 || box.height < 1) {
      throw new RangeError(
        "Capture --size requires finite dimensions of at least one pixel.",
      );
    }
    requestedScale = Math.min(
      1,
      box.width / width,
      box.height / height,
      options.box === undefined
        ? Math.sqrt(maxFitPixels / (width * height))
        : 1,
    );
  } else if (
    !Number.isFinite(requestedScale) ||
    requestedScale < MIN_SCALE ||
    requestedScale > MAX_SCALE
  ) {
    throw new RangeError(
      `Capture --scale must be between ${MIN_SCALE} and ${MAX_SCALE}.`,
    );
  }

  // Compare the represented decimal to the input so an exact thousandth is
  // preserved even if multiplying it by 1,000 rounded slightly downward.
  const nearestSteps = Math.round(requestedScale * SCALE_PRECISION);
  let steps =
    nearestSteps / SCALE_PRECISION > requestedScale
      ? nearestSteps - 1
      : nearestSteps;
  steps = Math.max(MIN_SCALE_STEPS, steps);

  for (;;) {
    const scale = steps / SCALE_PRECISION;
    const pixelWidth = Math.max(1, Math.ceil(width * scale));
    const pixelHeight = Math.max(1, Math.ceil(height * scale));
    const pixels = pixelWidth * pixelHeight;
    if (
      box &&
      (pixelWidth > box.width ||
        pixelHeight > box.height ||
        pixels > maxFitPixels)
    ) {
      if (steps === MIN_SCALE_STEPS) {
        throw new RangeError(
          `Capture cannot fit at the minimum scale of ${MIN_SCALE}. ${FIT_GUIDANCE}`,
        );
      }
      // Whole-pixel rounding can put a fit just over the box or area limit.
      steps -= 1;
      continue;
    }
    if (
      pixelWidth > RASTER_LIMITS.maxSide ||
      pixelHeight > RASTER_LIMITS.maxSide ||
      pixels > RASTER_LIMITS.maxPixels
    ) {
      throw new RangeError(
        `Capture is limited to ${RASTER_LIMITS.maxSide} pixels per side and ${RASTER_LIMITS.maxPixels / 1_000_000} megapixels. ${FIT_GUIDANCE}`,
      );
    }
    return { scale, width: pixelWidth, height: pixelHeight };
  }
}
