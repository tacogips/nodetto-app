// Framework-free export geometry shared by the desktop exporter and nodetto-cli:
// supported raster densities, pixel limits and PDF page layout.

export const RASTER_LIMITS = { maxSide: 8192, maxPixels: 32_000_000 } as const;

export const RASTER_SCALES = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

/** Read only the root viewport of an SVG produced by our deterministic serializer.
 * This is not an external SVG parser or sanitizer. */
export function svgRasterDimensions(svg: string) {
  const viewport = /^<svg\s[^>]*\bviewBox="([^"]+)"/.exec(svg)?.[1];
  const values = viewport?.trim().split(/\s+/).map(Number) ?? [];
  const width = values[2];
  const height = values[3];
  if (
    values.length !== 4 ||
    !values.every(Number.isFinite) ||
    !width ||
    !height ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("The generated SVG has no valid export viewport.");
  return { width, height };
}

/**
 * Grows an editor SVG's frame, and its background, to whole pixels at
 * `scale`. Rasterizers round the canvas up, so a frame that ends inside a
 * pixel otherwise leaves the last row and column partly outside the
 * background (transparent in a PNG). Geometry is not scaled or moved. Only
 * for SVG produced by our deterministic serializer.
 */
export function snapSvgFrameToPixels(svg: string, scale: number): string {
  const root = /^<svg\s[^>]*>/.exec(svg)?.[0];
  const viewBox = root && /\bviewBox="([^"]+)"/.exec(root)?.[1];
  if (!root || !viewBox) return svg;
  const [x, y, width, height] = viewBox.trim().split(" ");
  if ([x, y, width, height].some((value) => value === undefined)) return svg;
  // The frame ends at the rasterizer's last pixel, in the serializer's two
  // decimals (rounded down, so the pixel count does not grow); the
  // background reaches one pixel further and the frame clips it.
  const pixels = (value: number) => Math.ceil(value * scale - 1e-6);
  const snap = (value: number) =>
    Math.floor((pixels(value) / scale) * 100) / 100;
  const snappedWidth = snap(Number(width));
  const snappedHeight = snap(Number(height));
  if (
    pixels(Number(width)) === Number(width) * scale &&
    pixels(Number(height)) === Number(height) * scale
  )
    return svg;
  const overscan = Math.ceil(100 / scale) / 100;
  const snappedRoot = root
    .replace(/\bwidth="[^"]*"/, `width="${snappedWidth}"`)
    .replace(/\bheight="[^"]*"/, `height="${snappedHeight}"`)
    .replace(
      /\bviewBox="[^"]*"/,
      `viewBox="${x} ${y} ${snappedWidth} ${snappedHeight}"`,
    );
  // The background rect repeats the viewBox numbers exactly.
  const background = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill=`;
  return (
    snappedRoot +
    svg
      .slice(root.length)
      .replace(
        background,
        `<rect x="${x}" y="${y}" width="${Math.round((snappedWidth + overscan) * 100) / 100}" height="${Math.round((snappedHeight + overscan) * 100) / 100}" fill=`,
      )
  );
}

/** Bound allocations before creating browser image/canvas resources. */
export function rasterDimensions(width: number, height: number, scale: number) {
  if (
    ![width, height, scale].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    !RASTER_SCALES.some((value) => value === scale)
  )
    throw new Error(
      "PNG export requires positive dimensions and a supported density scale.",
    );
  const pixels = {
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
  };
  if (
    pixels.width > RASTER_LIMITS.maxSide ||
    pixels.height > RASTER_LIMITS.maxSide ||
    pixels.width * pixels.height > RASTER_LIMITS.maxPixels
  )
    throw new Error(
      `PNG export is limited to ${RASTER_LIMITS.maxSide} pixels per side and ${RASTER_LIMITS.maxPixels / 1_000_000} megapixels. Minimum scale is ${RASTER_SCALES[0]}. Choose a smaller scale or use SVG.`,
    );
  return pixels;
}

export const PDF_PAGE_SIZES = {
  artwork: "Fit artwork",
  a4: "A4",
  letter: "Letter",
} as const;
export type PdfPageSize = keyof typeof PDF_PAGE_SIZES;
export type PdfOrientation = "portrait" | "landscape";
export interface PdfOptions {
  readonly pageSize: PdfPageSize;
  readonly orientation: PdfOrientation;
  readonly marginMm: number;
}

/** CSS pixels become PDF points at 96 dpi; density never changes paper size. */
export function pdfLayout(width: number, height: number, options: PdfOptions) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("PDF artwork must have positive dimensions.");
  if (
    !Number.isFinite(options.marginMm) ||
    options.marginMm < 0 ||
    options.marginMm > 50
  )
    throw new Error("PDF margins must be between 0 and 50 mm.");
  if (options.pageSize === "artwork") {
    const w = width * 0.75;
    const h = height * 0.75;
    if (Math.max(w, h) > 14400)
      throw new Error(
        "Artwork is too large for a PDF page. Choose A4 or Letter.",
      );
    return { pageWidth: w, pageHeight: h, x: 0, y: 0, width: w, height: h };
  }
  const paper = options.pageSize === "a4" ? [595.276, 841.89] : [612, 792];
  const pageWidth = paper[options.orientation === "landscape" ? 1 : 0] ?? 612;
  const pageHeight = paper[options.orientation === "landscape" ? 0 : 1] ?? 792;
  const margin = (options.marginMm * 72) / 25.4;
  const ratio = Math.min(
    (pageWidth - 2 * margin) / width,
    (pageHeight - 2 * margin) / height,
  );
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width * ratio) / 2,
    y: (pageHeight - height * ratio) / 2,
    width: width * ratio,
    height: height * ratio,
  };
}
