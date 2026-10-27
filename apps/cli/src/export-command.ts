import {
  availableMermaidKinds,
  exportMermaid,
  exportD2,
  exportDrawio,
  type MermaidDiagramKind,
} from "@nodetto/io";
import { encodeRasterDataUrl, isRasterAttachmentPath } from "@nodetto/ir";
// `nodetto-cli export`: page artwork, semantic diagrams and developer handoff.
//
// SVG is the core serializer's page export, byte for byte what the app's page
// export produces. PNG rasterizes that SVG with resvg instead of a browser
// canvas, and PDF embeds the PNG with the app's page layout rules.

import {
  Editor,
  exportHandoff,
  HANDOFF_FORMATS,
  type HandoffFormat,
  exportHtmlBundle,
  encodeHtmlBundleZip,
  PDF_PAGE_SIZES,
  type PdfOptions,
  type PdfOrientation,
  type PdfPageSize,
  RASTER_SCALES,
  rasterDimensions,
  snapSvgFrameToPixels,
  svgRasterDimensions,
} from "@nodetto/core";
import {
  type CommandIo,
  type CommandResult,
  fail,
  loadDocument,
  ok,
  parseArgs,
  selectPage,
  writeOutput,
} from "./commands.ts";
import { helpFor } from "./help.ts";
import { resolveId } from "./ids.ts";

const EXPORT_OPTIONS = new Set([
  "--format",
  "--page",
  "--output",
  "--padding",
  "--background",
  "--scale",
  "--pdf-page",
  "--orientation",
  "--margin",
  "--element",
  "--font-dir",
  "--mermaid-kind",
  "--code-format",
]);

const EXPORT_FORMATS = [
  "svg",
  "png",
  "pdf",
  "html",
  "mermaid",
  "d2",
  "drawio",
  "code",
] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];
function isExportFormat(value: string | undefined): value is ExportFormat {
  return EXPORT_FORMATS.some((format) => format === value);
}

function isPdfPageSize(value: string): value is PdfPageSize {
  return Object.hasOwn(PDF_PAGE_SIZES, value);
}

function isOrientation(value: string): value is PdfOrientation {
  return value === "portrait" || value === "landscape";
}

function parseNumber(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : Number(value);
}

export interface RasterBackend {
  rasterize(
    svg: string,
    scale: number,
    fontDir: string | undefined,
  ): Promise<Uint8Array>;
  pngToPdf(
    png: Uint8Array,
    width: number,
    height: number,
    options: PdfOptions,
  ): Promise<Uint8Array>;
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export async function exportCommand(
  io: CommandIo,
  args: readonly string[],
  backend?: RasterBackend,
): Promise<CommandResult> {
  const parsed = parseArgs(args, EXPORT_OPTIONS, new Set());
  if (typeof parsed === "string")
    return fail(`${parsed}\n\n${helpFor("export")}`);
  if (parsed.positional.length !== 1)
    return fail(
      `export expects exactly one document path.\n\n${helpFor("export")}`,
    );
  const path = parsed.positional[0] as string;
  const format = parsed.options.get("--format");
  if (!isExportFormat(format))
    return fail(
      format === undefined
        ? `export requires --format ${EXPORT_FORMATS.join(", ")}.\n\n${helpFor("export")}`
        : `Unsupported format "${format}". Choose ${EXPORT_FORMATS.join(", ")}.`,
    );
  const exportFormat: ExportFormat = format;
  const outputPath = parsed.options.get("--output");
  if (["png", "pdf", "html"].includes(exportFormat) && outputPath === undefined)
    return fail(`${exportFormat.toUpperCase()} export requires --output.`);

  const mermaidKind = parsed.options.get("--mermaid-kind");
  if (mermaidKind !== undefined && exportFormat !== "mermaid")
    return fail("--mermaid-kind requires --format mermaid.");
  const codeFormat = parsed.options.get("--code-format") ?? "css";
  if (!HANDOFF_FORMATS.includes(codeFormat as HandoffFormat))
    return fail(`--code-format must be one of ${HANDOFF_FORMATS.join(", ")}.`);
  if (parsed.options.has("--code-format") && exportFormat !== "code")
    return fail("--code-format requires --format code.");
  const padding = parseNumber(parsed.options.get("--padding"), 16);
  if (!Number.isFinite(padding) || padding < 0 || padding > 256)
    return fail("--padding must be a number between 0 and 256.");
  const backgroundOption = parsed.options.get("--background");
  const background =
    backgroundOption === "transparent"
      ? null
      : (backgroundOption ?? (exportFormat === "svg" ? null : "#ffffff"));
  if (background !== null && !/^#[0-9a-f]{6}$/i.test(background))
    return fail(
      "--background must be a six-digit hex color (#rrggbb) or transparent.",
    );
  const scaleOption = parsed.options.get("--scale");
  const requestedScale = parseNumber(
    scaleOption,
    exportFormat === "pdf" ? 2 : 1,
  );
  if (!RASTER_SCALES.some((value) => value === requestedScale))
    return fail(`--scale must be one of ${RASTER_SCALES.join(", ")}.`);
  const pageSize = parsed.options.get("--pdf-page") ?? "artwork";
  if (!isPdfPageSize(pageSize))
    return fail("--pdf-page must be artwork, a4 or letter.");
  const orientation = parsed.options.get("--orientation") ?? "portrait";
  if (!isOrientation(orientation))
    return fail("--orientation must be portrait or landscape.");
  const marginMm = parseNumber(parsed.options.get("--margin"), 10);

  const loaded = loadDocument(io, path);
  if (typeof loaded === "string") return fail(loaded);
  const elementQuery = parsed.options.get("--element");
  let pageQuery = parsed.options.get("--page");
  let elementId: string | undefined;
  if (elementQuery !== undefined) {
    const resolved = resolveId(
      elementQuery,
      loaded.document.elements.map((element) => element.id),
    );
    if (!resolved.ok) return fail(resolved.message);
    elementId = resolved.id;
    const owner = loaded.document.elements.find(
      (element) => element.id === resolved.id,
    );
    if (pageQuery === undefined) pageQuery = owner?.page;
  }
  if (exportFormat === "drawio") {
    // A draw.io file holds every page unless one is asked for.
    if (elementId) return fail("drawio exports whole pages; omit --element.");
    let pageIds: readonly string[] | undefined;
    if (pageQuery !== undefined) {
      const only = selectPage(
        loaded.document,
        pageQuery,
        loaded.document.pages,
        "The document has no pages.",
        "pages",
      );
      if (typeof only === "string") return fail(only);
      pageIds = [only.id];
    }
    try {
      const report = exportDrawio(loaded.document, pageIds ? { pageIds } : {});
      const warnings =
        loaded.warnings +
        report.warnings
          .map((warning) => `warning: ${warning.message}\n`)
          .join("");
      if (outputPath === undefined) return ok(report.xml, warnings);
      const failure = writeOutput(io, outputPath, report.xml);
      return failure
        ? fail(`${warnings}${failure}`)
        : ok("", `${warnings}Wrote ${outputPath}.\n`);
    } catch (error) {
      return fail(`Cannot export drawio: ${describe(error)}`);
    }
  }
  const page = selectPage(
    loaded.document,
    pageQuery,
    loaded.document.pages,
    "The document has no pages.",
    "pages",
  );
  if (typeof page === "string") return fail(page);
  if (
    elementId &&
    loaded.document.elements.find((element) => element.id === elementId)
      ?.page !== page.id
  )
    return fail("--element does not belong to the selected --page.");
  if (elementId && (exportFormat === "mermaid" || exportFormat === "d2"))
    return fail(`${exportFormat} exports a whole page; omit --element.`);
  if (exportFormat === "code" && !elementId)
    return fail(
      "Code export requires --element (select an artboard for generated code).",
    );
  const editor = new Editor({ document: loaded.document });
  editor.setCurrentPage(page.id);
  if (
    exportFormat === "mermaid" ||
    exportFormat === "d2" ||
    exportFormat === "code"
  ) {
    try {
      let text: string;
      let warnings = loaded.warnings;
      if (exportFormat === "code") {
        text = exportHandoff(
          editor,
          elementId as string,
          codeFormat as HandoffFormat,
        );
      } else {
        const kinds = availableMermaidKinds(loaded.document, page.id);
        if (
          exportFormat === "mermaid" &&
          mermaidKind !== undefined &&
          !kinds.includes(mermaidKind as MermaidDiagramKind)
        )
          return fail(
            `--mermaid-kind is not available on this page. Choose ${kinds.join(", ") || "a page containing ERD, UML or sequence elements"}.`,
          );
        if (exportFormat === "mermaid" && kinds.length === 0)
          return fail(`Page "${page.name}" has no Mermaid-compatible content.`);
        const report =
          exportFormat === "d2"
            ? exportD2(loaded.document, page.id)
            : exportMermaid(
                loaded.document,
                page.id,
                (mermaidKind ?? kinds[0]) as MermaidDiagramKind,
              );
        text = report.code;
        warnings += report.warnings
          .map((warning) => `warning: ${warning.message}\n`)
          .join("");
      }
      if (outputPath === undefined) return ok(text, warnings);
      const failure = writeOutput(io, outputPath, text);
      return failure
        ? fail(`${warnings}${failure}`)
        : ok("", `${warnings}Wrote ${outputPath}.\n`);
    } catch (error) {
      return fail(`Cannot export ${exportFormat}: ${describe(error)}`);
    }
  }
  const resolveAsset = (source: string): string => {
    const cached = editor.assets.resolve(source);
    if (cached) return cached;
    if (!isRasterAttachmentPath(source) || !io.readAttachment)
      throw new Error(`Missing attachment: ${source}`);
    const data = encodeRasterDataUrl(io.readAttachment(path, source));
    editor.assets.set(source, data);
    return data;
  };
  if (exportFormat === "html") {
    try {
      const bundle = exportHtmlBundle(
        editor,
        elementId ? [elementId] : undefined,
        resolveAsset,
      );
      if (!io.writeBytes)
        return fail("This environment cannot write binary files.");
      io.writeBytes(outputPath as string, encodeHtmlBundleZip(bundle));
      return ok(
        "",
        `Wrote ${outputPath} (${bundle.files.length} HTML/CSS and asset files).\n`,
      );
    } catch (error) {
      return fail(`Cannot export HTML: ${describe(error)}`);
    }
  }
  let svg: string | null;
  try {
    if (elementId !== undefined) {
      // A frame exports as its artboard; anything else as a one-element
      // selection. (A page export clipped to a viewport can make resvg panic.)
      const target = editor.store.get(elementId);
      if (target?.type === "frame")
        svg = editor.exportArtboardSvg(elementId, { background, resolveAsset });
      else {
        editor.selection.set([elementId]);
        svg = editor.exportSelectionSvg({ padding, background, resolveAsset });
      }
      if (svg === null)
        return fail(`Element ${elementId} has nothing visible to export.`);
    } else svg = editor.exportPageSvg({ padding, background, resolveAsset });
  } catch (error) {
    return fail(
      `Could not resolve export attachments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (svg === null)
    return fail(`Page "${page.name}" has no visible content to export.`);

  if (exportFormat === "svg") {
    if (outputPath === undefined) return ok(svg, loaded.warnings);
    const failure = writeOutput(io, outputPath, svg);
    if (failure) return fail(`${loaded.warnings}${failure}`);
    return ok("", `${loaded.warnings}Wrote ${outputPath}.\n`);
  }

  let bytes: Uint8Array;
  let pixels: { readonly width: number; readonly height: number };
  let scale = requestedScale;
  let note = "";
  try {
    const viewport = svgRasterDimensions(svg);
    if (scaleOption === undefined) {
      // Without an explicit --scale, step down until the image fits the limits.
      const fitting = [...RASTER_SCALES]
        .filter((value) => value <= requestedScale)
        .reverse()
        .find((value) => {
          try {
            rasterDimensions(viewport.width, viewport.height, value);
            return true;
          } catch {
            return false;
          }
        });
      if (fitting === undefined)
        throw new Error(
          "The drawing is too large to rasterize at the minimum scale of 0.1 (8192 pixels per side, 32 megapixels). Export one frame with --element, or use SVG.",
        );
      if (fitting !== requestedScale) {
        scale = fitting;
        note = `, scaled to ${fitting} to fit the pixel limit`;
      }
    }
    svg = snapSvgFrameToPixels(svg, scale);
    const snapped = svgRasterDimensions(svg);
    pixels = rasterDimensions(snapped.width, snapped.height, scale);
    const renderer = backend ?? (await import("./raster-backend.ts"));
    const png = await renderer.rasterize(
      svg,
      scale,
      parsed.options.get("--font-dir"),
    );
    bytes =
      exportFormat === "png"
        ? png
        : await renderer.pngToPdf(png, snapped.width, snapped.height, {
            pageSize,
            orientation,
            marginMm,
          });
  } catch (cause) {
    return fail(`${loaded.warnings}Cannot export: ${describe(cause)}`);
  }
  const target = outputPath as string;
  if (!io.writeBytes)
    return fail("This environment cannot write binary files.");
  try {
    io.writeBytes(target, bytes);
  } catch (cause) {
    return fail(`${loaded.warnings}Cannot write ${target}: ${describe(cause)}`);
  }
  const detail =
    exportFormat === "png"
      ? `${pixels.width}x${pixels.height} px${note}`
      : `${PDF_PAGE_SIZES[pageSize]} page${note}`;
  return ok(
    "",
    `${loaded.warnings}Wrote ${target} (page "${page.name}", ${detail}).\n`,
  );
}
