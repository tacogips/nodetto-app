import {
  CAPTURE_THEMES,
  Editor,
  captureRasterPlan,
  snapSvgFrameToPixels,
  svgRasterDimensions,
} from "@nodetto/core";
import {
  comparePageOrder,
  encodeRasterDataUrl,
  isRasterAttachmentPath,
  pageAtNumber,
  resolvePageQuery,
  shortPageId,
} from "@nodetto/ir";
import { CAPTURE_HELP } from "./capture-help.ts";
import {
  type CommandIo,
  type CommandResult,
  fail,
  loadDocument,
  ok,
  parseArgs,
} from "./commands.ts";
import {
  attributeMissingGlyphs,
  glyphMissingMessage,
} from "./glyph-coverage.ts";
import { resolveId } from "./ids.ts";

const CAPTURE_OPTIONS = new Set([
  "--page",
  "--page-number",
  "--output",
  "--format",
  "--size",
  "--scale",
  "--theme",
  "--element",
  "--padding",
  "--background",
  "--font-dir",
]);
const CAPTURE_FLAGS = new Set(["--force", "--json", "--inline"]);
const OUTPUT_ADVICE =
  "Pass --output <file> (Mac App Store build: inside the authorized folder).";

export interface CaptureBackend {
  rasterize(
    svg: string,
    scale: number,
    fontDir: string | undefined,
    fallback?: boolean,
  ): Promise<Uint8Array>;
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function usageError(message: string): CommandResult {
  return fail(`${message}\n\n${CAPTURE_HELP}`);
}

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

function writeCapture(
  capture: NonNullable<CommandIo["capture"]>,
  documentPath: string,
  pageId: string,
  png: Uint8Array,
  output: string | undefined,
  force: boolean,
): string {
  if (output !== undefined) {
    const absolute = capture.absolute(output);
    if (capture.write(output, png, force) === "exists") {
      throw new Error(
        `${output} exists with different content; pass --force to replace it, or omit --output.`,
      );
    }
    return absolute;
  }

  try {
    const dir = capture.dir();
    const stem =
      documentPath
        .split(/[\\/]/)
        .at(-1)
        ?.replace(/\.[^.]+$/, "")
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .slice(0, 40) || "document";
    const prefix = `${dir}/${stem}-${shortPageId(pageId)}-${capture.digest(png).slice(0, 12)}`;
    for (let attempt = 1; attempt <= 99; attempt++) {
      const path = `${prefix}${attempt === 1 ? "" : `-${attempt}`}.png`;
      if (capture.write(path, png, false) !== "exists")
        return capture.absolute(path);
    }
    throw new Error(`No unused capture name is available in ${dir}.`);
  } catch (cause) {
    throw new Error(`${describe(cause)} ${OUTPUT_ADVICE}`);
  }
}

export async function captureCommand(
  io: CommandIo,
  args: readonly string[],
  backend: CaptureBackend,
): Promise<CommandResult> {
  const parsed = parseArgs(args, CAPTURE_OPTIONS, CAPTURE_FLAGS);
  if (typeof parsed === "string") return usageError(parsed);
  const [documentPath] = parsed.positional;
  if (parsed.positional.length !== 1 || !documentPath)
    return usageError("capture expects exactly one document path.");

  const { options, flags } = parsed;
  const pageQuery = options.get("--page");
  const pageNumber = options.get("--page-number");
  if (pageQuery !== undefined && pageNumber !== undefined)
    return usageError("--page and --page-number cannot be used together.");
  if (pageNumber !== undefined && !/^[1-9][0-9]*$/.test(pageNumber))
    return usageError("--page-number must be a positive whole number.");
  const output = options.get("--output");
  const format = options.get("--format");
  if (format === "jpg" || (output !== undefined && /\.jpe?g$/i.test(output)))
    return usageError("JPG capture is not available in this build.");
  if (format !== undefined && format !== "png")
    return usageError("--format must be png.");
  if (output !== undefined && !/\.png$/i.test(output))
    return usageError("--output must end in .png.");

  const theme = options.get("--theme") ?? "light";
  if (theme !== "light" && theme !== "dark")
    return usageError("--theme must be light or dark.");
  const background =
    options.get("--background") ?? CAPTURE_THEMES[theme].background;
  if (!/^#[0-9a-f]{6}$/i.test(background))
    return usageError("--background must be a six-digit hex color (#rrggbb).");
  const padding = Number(options.get("--padding") ?? "16");
  if (!Number.isFinite(padding) || padding < 0 || padding > 256)
    return usageError("--padding must be a number between 0 and 256.");
  const size = options.get("--size");
  const box = size === undefined ? undefined : /^(\d+)x(\d+)$/i.exec(size);
  if (box === null)
    return usageError("--size must be W x H in pixels (for example 1024x768).");
  const requestedScale = options.get("--scale");
  const fontDir = options.get("--font-dir");

  const loaded = loadDocument(io, documentPath);
  if (typeof loaded === "string") return fail(loaded);
  const { document } = loaded;
  const pages = [...document.pages].sort(comparePageOrder);
  const elementQuery = options.get("--element");
  let target: (typeof document.elements)[number] | undefined;
  if (elementQuery !== undefined) {
    const resolved = resolveId(
      elementQuery,
      document.elements.map(({ id }) => id),
    );
    if (!resolved.ok) return usageError(resolved.message);
    target = document.elements.find(({ id }) => id === resolved.id);
  }

  const query = pageQuery ?? target?.page;
  const resolved =
    pageNumber !== undefined
      ? pageAtNumber(pages, Number(pageNumber))
      : query !== undefined
        ? resolvePageQuery(pages, query)
        : undefined;
  if (resolved && !resolved.ok) return usageError(resolved.message);
  const page = resolved?.page ?? pages[0];
  if (!page) return fail("The document has no pages.");
  if (target && target.page !== page.id)
    return usageError("--element does not belong to the selected page.");
  if (page.kind === "cad3d")
    return fail("3D CAD capture is not available in this build.");
  if (!io.capture) return fail("This host cannot write captures.");

  let warnings = loaded.warnings;
  try {
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
      return fail(
        `${warnings}Page ${JSON.stringify(page.name)} has no visible content to capture.`,
      );

    const viewport = svgRasterDimensions(svg);
    const plan = captureRasterPlan(viewport, {
      box:
        box === undefined
          ? undefined
          : { width: Number(box[1]), height: Number(box[2]) },
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
        warnings += `warning: glyph-missing ${row.elementId}: ${glyphMissingMessage(row.codePoints)}\n`;
      if (unattributed.length)
        warnings += `warning: glyph-missing page ${page.id}: ${glyphMissingMessage(unattributed)}\n`;
    }
    const png = await backend.rasterize(
      svg,
      1,
      fontDir,
      coverage?.needsFallback === true,
    );
    const { width, height } = pngSize(png);
    const path = writeCapture(
      io.capture,
      documentPath,
      page.id,
      png,
      output,
      flags.has("--force"),
    );
    const number = pages.indexOf(page) + 1;
    const count = pages.length;
    if (flags.has("--json")) {
      return ok(
        `${JSON.stringify({
          path,
          format: "png",
          width,
          height,
          bytes: png.byteLength,
          page: {
            number,
            count,
            id: page.id,
            name: page.name,
            kind: page.kind,
          },
        })}\n`,
        warnings,
      );
    }
    return ok(
      `path: ${path}\nformat: png\nsize: ${width}x${height}\nbytes: ${png.byteLength}\npage: ${number}/${count} ${JSON.stringify(page.name)} (${page.kind}, id ${page.id})\n`,
      warnings,
    );
  } catch (cause) {
    return fail(`${warnings}Cannot capture: ${describe(cause)}`);
  }
}
