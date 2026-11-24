import {
  CAPTURE_THEMES,
  type CaptureTheme,
  Editor,
  captureRasterPlan,
  snapSvgFrameToPixels,
  svgRasterDimensions,
} from "@nodetto/core";
import {
  type Document,
  type Element,
  encodeRasterDataUrl,
  isRasterAttachmentPath,
  type Page,
} from "@nodetto/ir";
import type { CaptureBackend } from "./capture-command.ts";
import type { CommandIo } from "./commands.ts";
import {
  attributeMissingGlyphs,
  glyphMissingMessage,
} from "./glyph-coverage.ts";

export interface ArtworkCaptureRequest {
  readonly document: Document;
  readonly documentPath: string;
  readonly page: Page;
  /** Capture only this element; a frame is captured as an artboard. */
  readonly target: Element | undefined;
  readonly options: ReadonlyMap<string, string>;
  readonly format: "png" | "jpg";
  readonly quality: number;
  readonly theme: CaptureTheme;
  readonly box: { width: number; height: number } | undefined;
  /** Receives one warning line, without prefix or newline. */
  readonly warn: (message: string) => void;
}

export type ArtworkCapture =
  | { image: Uint8Array; width: number; height: number }
  | { error: string; usage: boolean };

const usage = (error: string): ArtworkCapture => ({ error, usage: true });

/** Give both renderers the same integer surface. Zooming in the backend
 * can add a pixel when its single-precision product rounds above an integer.
 * The viewBox still applies the requested scale to the artwork. */
function pixelFrame(
  svg: string,
  viewport: { width: number; height: number },
  scale: number,
): string {
  const snap = (span: number) => Math.max(1, Math.ceil(span * scale - 1e-6));
  const width = snap(viewport.width);
  const height = snap(viewport.height);
  return snapSvgFrameToPixels(svg, scale).replace(/^<svg\s[^>]*>/, (root) =>
    root
      .replace(/\bwidth="[^"]*"/, `width="${width}"`)
      .replace(/\bheight="[^"]*"/, `height="${height}"`)
      .replace(
        /\bviewBox="([^ ]+) ([^ ]+) [^"]+"/,
        (_, x: string, y: string) =>
          `viewBox="${x} ${y} ${width / scale} ${height / scale}"`,
      ),
  );
}

/** Report the actual encoded size. Pixel-frame snapping can remove a sliver
 * that the conservative raster plan rounded up to an extra pixel. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    header.byteLength < 33 ||
    header.getUint32(0) !== 0x89504e47 ||
    header.getUint32(4) !== 0x0d0a1a0a ||
    header.getUint32(8) !== 13 ||
    header.getUint32(12) !== 0x49484452
  ) {
    throw new Error("The capture renderer did not produce a PNG header.");
  }
  return { width: header.getUint32(16), height: header.getUint32(20) };
}

/** Render a 2D page, frame or element through the SVG exporter. */
export async function renderArtworkCapture(
  io: CommandIo,
  backend: CaptureBackend,
  {
    document,
    documentPath,
    page,
    target,
    options,
    format,
    quality,
    theme,
    box,
    warn,
  }: ArtworkCaptureRequest,
): Promise<ArtworkCapture> {
  const transcode =
    format === "jpg" ? backend.transcode?.bind(backend) : undefined;
  if (format === "jpg" && !transcode)
    return usage("JPG capture needs the native nodetto-cli.");
  const background =
    options.get("--background") ?? CAPTURE_THEMES[theme].background;
  if (!/^#[0-9a-f]{6}$/i.test(background))
    return usage("--background must be a six-digit hex color (#rrggbb).");
  const padding = Number(options.get("--padding") ?? "16");
  if (!Number.isFinite(padding) || padding < 0 || padding > 256)
    return usage("--padding must be a number between 0 and 256.");
  const requestedScale = options.get("--scale");
  const fontDir = options.get("--font-dir");
  const editor = new Editor({ document });
  editor.setCurrentPage(page.id);
  const resolveAsset = (source: string): string => {
    const cached = editor.assets.resolve(source);
    if (cached) return cached;
    if (!isRasterAttachmentPath(source) || !io.readAttachment)
      throw new Error(`Missing attachment: ${source}`);
    const data = encodeRasterDataUrl(io.readAttachment(documentPath, source));
    editor.assets.set(source, data);
    return data;
  };

  let svg: string | null;
  if (target?.type === "frame") {
    svg = editor.exportArtboardSvg(target.id, { background, resolveAsset });
  } else if (target) {
    editor.selection.set([target.id]);
    svg = editor.exportSelectionSvg({ padding, background, resolveAsset });
  } else {
    svg = editor.exportPageSvg({ padding, background, resolveAsset });
  }
  if (svg === null)
    return {
      error: `Page ${JSON.stringify(page.name)} has no visible content to capture.`,
      usage: false,
    };

  const viewport = svgRasterDimensions(svg);
  const plan = captureRasterPlan(viewport, {
    box,
    scale: requestedScale === undefined ? undefined : Number(requestedScale),
  });
  svg = pixelFrame(svg, viewport, plan.scale);
  const coverage = io.fontCoverage?.(svg, fontDir);
  if (coverage?.missing.length) {
    const elements = document.elements.filter(
      (element) =>
        element.page === page.id &&
        (!target ||
          target.type === "frame" ||
          target.type === "group" ||
          element.id === target.id),
    );
    const { rows, unattributed } = attributeMissingGlyphs(
      elements,
      new Set(coverage.missing),
    );
    for (const row of rows)
      warn(
        `glyph-missing ${row.elementId}: ${glyphMissingMessage(row.codePoints)}`,
      );
    if (unattributed.length)
      warn(
        `glyph-missing page ${page.id}: ${glyphMissingMessage(unattributed)}`,
      );
  }
  const png = await backend.rasterize(
    svg,
    1,
    fontDir,
    coverage?.needsFallback === true,
  );
  const { width, height } = pngSize(png);
  const image = transcode ? transcode(png, "jpg", quality, background) : png;
  return { image, width, height };
}
