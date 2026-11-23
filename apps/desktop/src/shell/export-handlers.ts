// What the Export dialog calls to write a file: artwork, BPMN XML, the
// breadboard's BOM and netlists, and Gerber/drill ZIPs. Each writes through
// the export backend's save dialog, or falls back to a browser download
// where there is no filesystem.

import { decodeRasterDataUrl } from "@nodetto/ir";
import {
  DEFAULT_CAD_INTERFERENCE,
  prepareCadCapture,
  parseSolidReport,
  describeInterference,
  describeBodies,
  type CaptureCameraRequest,
  type CaptureTheme,
  DOCUMENT_BUNDLE_EXTENSION,
  documentPdfPlan,
  encodeDocumentBundle,
  exportMarkdownDocument,
  encodeStoredZip,
  bpmnRouteResolver,
  type CadEngine,
  collectCadInput,
  computeBreadboardConnectivity,
  type Editor,
  encodeBreadboardPcbZip,
  encodePcbBoardZip,
  encodePcbExportZip,
  exportBreadboardPcb,
  exportPcbBoard,
  exportPcbPage,
  toBreadboardNetlist,
} from "@nodetto/core";
import { decodeCaptureMesh } from "@nodetto/io/nmesh";
import { pagesToPdf, rasterizeSvg } from "@nodetto/ui-solid";
import type { ExportBackend } from "../file/backend.ts";

/** Drop a trailing extension and anything a filesystem would refuse. */
export function exportBaseName(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, "");
  const safe = stem.replace(/[/\\:*?"<>|]+/g, "-").trim();
  return safe === "" ? "untitled" : safe;
}

/** The shell state the handlers read; the App's props satisfy it. */
export interface ExportSource {
  readonly editor: Editor;
  readonly exportBackend: ExportBackend;
}

export interface ExportHandlers {
  readonly saveArtwork: (
    name: string,
    blob: Blob,
    extension: string,
  ) => Promise<boolean>;
  readonly exportDocumentPdf: (
    scale: number,
    background: string | null,
  ) => Promise<void>;
  readonly exportDocumentMarkdown: () => Promise<void>;
  /** The document and its images as one `.nodetto` bundle. */
  readonly exportDocumentBundle: () => Promise<void>;
  readonly exportBpmn: () => Promise<void>;
  readonly exportBreadboard: (
    kind: "bom" | "kicad" | "spice" | "gerber",
  ) => Promise<void>;
  readonly exportGerber: () => Promise<void>;
  readonly exportPcbGerber: () => Promise<void>;
  readonly exportStl: () => Promise<void>;
  readonly captureCadImage: (options: {
    camera: CaptureCameraRequest;
    format: "png" | "jpg";
    theme: CaptureTheme;
    width: number;
    height: number;
  }) => Promise<void>;
}

/** Hand `blob` to the browser as a download named `name`. */
function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Bind the export handlers to the shell. `source` is read on every call, so
 * passing the App's props keeps them current; `setExportError` reports
 * failures and export notes in the dialog.
 */
export function createExportHandlers(
  source: ExportSource,
  setExportError: (message: string | null) => void,
  deps: {
    readonly rasterizeSvg?: (svg: string, scale: number) => Promise<Blob>;
    readonly createCadEngine?: () => CadEngine;
  } = {},
): ExportHandlers {
  const saveArtwork = async (
    name: string,
    blob: Blob,
    extension: string,
  ): Promise<boolean> => {
    const path = await source.exportBackend.pickExportPath(name, extension);
    if (path === null) return false;
    await source.exportBackend.writeBytes(
      path,
      new Uint8Array(await blob.arrayBuffer()),
    );
    return true;
  };

  const exportBpmn = async (): Promise<void> => {
    setExportError(null);
    const page = source.editor.store.getPage(source.editor.currentPageId);
    if (page?.kind !== "bpmn") return;
    try {
      const { exportBpmnXml } = await import("@nodetto/io/bpmn");
      const { xml } = exportBpmnXml(
        source.editor.store.getSnapshot(),
        source.editor.currentPageId,
        { routeOf: bpmnRouteResolver(source.editor) },
      );
      const name = `${exportBaseName(page.name)}.bpmn`;
      if (!source.exportBackend.available) {
        downloadBlob(new Blob([xml], { type: "application/xml" }), name);
        return;
      }
      const path = await source.exportBackend.pickExportPath(name, "bpmn");
      if (path === null) return;
      await source.exportBackend.writeText(path, xml);
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  /** Gerber and drill ZIP for the selected board, or the page's only board. */
  const exportBreadboardGerber = async (
    snapshot: ReturnType<Editor["getSnapshot"]>,
    pageName: string,
  ): Promise<void> => {
    const pageId = source.editor.currentPageId;
    const selected = new Set(source.editor.selection.ids());
    const board = snapshot.elements.find(
      (element) =>
        element.page === pageId &&
        element.type === "breadboard.board" &&
        selected.has(element.id),
    );
    const pcb = exportBreadboardPcb(snapshot, pageId, {
      name: exportBaseName(pageName),
      ...(board ? { board: board.id } : {}),
    });
    if (typeof pcb === "string") {
      setExportError(
        pcb.startsWith("The page has")
          ? "This page has several boards; select the board to export and try again."
          : pcb,
      );
      return;
    }
    const saved = await saveZip(
      encodeBreadboardPcbZip(pcb),
      `${exportBaseName(pageName)}-pcb.zip`,
    );
    if (saved)
      setExportError(
        `Export notes: ${[...pcb.warnings, ...pcb.notes].join("; ")}`,
      );
  };

  const saveBinary = async (
    bytes: Uint8Array,
    name: string,
    extension: string,
    type: string,
  ): Promise<boolean> => {
    if (!source.exportBackend.available) {
      downloadBlob(new Blob([bytes], { type }), name);
      return true;
    }
    const path = await source.exportBackend.pickExportPath(name, extension);
    if (path === null) return false;
    await source.exportBackend.writeBytes(path, bytes);
    return true;
  };

  const saveZip = (bytes: Uint8Array, name: string): Promise<boolean> =>
    saveBinary(bytes, name, "zip", "application/zip");

  const exportStl = async (): Promise<void> => {
    setExportError(null);
    const { editor } = source;
    const page = editor.store.getPage(editor.currentPageId);
    if (page?.kind !== "cad3d") return;
    const input = collectCadInput(
      editor.getSnapshot(),
      page.id,
      editor.revision,
    );
    const bodyIds = input.elements.flatMap(({ type, id, visual }) =>
      !visual.hidden && (type === "cad.extrude" || type === "cad.mesh")
        ? [id]
        : [],
    );
    try {
      if (bodyIds.length === 0)
        throw new Error("There are no visible solid bodies to export.");
      const engine = deps.createCadEngine?.();
      if (!engine) throw new Error("The CAD engine is unavailable.");
      const result = await engine
        .evaluate({ ...input, exportStl: { bodyIds } })
        .finally(() => engine.dispose());
      const { stl } = result;
      if (result.failure || !stl || stl.byteLength < 84)
        throw new Error("The CAD engine could not export this page.");
      if (stl.byteLength === 84)
        throw new Error("There are no visible solid bodies to export.");
      const saved = await saveBinary(
        stl,
        `${exportBaseName(page.name)}.stl`,
        "stl",
        "model/stl",
      );
      if (saved) {
        const issues = result.status.filter(([, status]) => !status.ok).length;
        if (issues > 0) {
          const features =
            issues === 1 ? "1 feature has" : `${issues} features have`;
          setExportError(
            `STL saved. ${features} issues that may affect the exported model. Check the feature list for details.`,
          );
        }
      }
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const captureCadImage: ExportHandlers["captureCadImage"] = async (
    options,
  ) => {
    setExportError(null);
    try {
      const page = source.editor.store.getPage(source.editor.currentPageId);
      if (page?.kind !== "cad3d")
        throw new Error("The current page is not a 3D CAD page.");
      const capture = source.exportBackend.captureSolid;
      if (!capture) throw new Error("Capture is available in the desktop app.");
      const prepared = prepareCadCapture(
        source.editor.getSnapshot().elements,
        page.id,
        {
          camera: options.camera,
          width: options.width,
          height: options.height,
          theme: options.theme,
          interference: DEFAULT_CAD_INTERFERENCE,
          decodeMesh: decodeCaptureMesh,
        },
      );
      const result = await capture(prepared.scene, options.format, 90);
      const report = parseSolidReport(result.report);
      const path = await source.exportBackend.pickExportPath(
        `${exportBaseName(page.name)}.${options.format}`,
        options.format,
      );
      if (path === null) return;
      await source.exportBackend.writeBytes(path, result.image);
      const errors = describeBodies(report, prepared.model).errors;
      const failed = prepared.model.errors.length;
      setExportError(
        [
          "Image saved.",
          ...describeInterference(report, prepared.model.bodies).lines,
          ...errors.map((error) => `${error.id}: ${error.code} ${error.text}`),
          ...(failed > 0 ? [`${failed} features failed.`] : []),
        ].join("\n"),
      );
    } catch (error) {
      setExportError(
        `could not capture: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const exportDocumentPdf = async (
    scale: number,
    background: string | null,
  ): Promise<void> => {
    setExportError(null);
    try {
      const name = `${exportBaseName(source.editor.getSnapshot().title)}.pdf`;
      const pages = [];
      for (const page of documentPdfPlan(source.editor, { background }))
        pages.push({
          png: await (deps.rasterizeSvg ?? rasterizeSvg)(page.svg, scale),
          spec: page.spec,
        });
      const blob = await pagesToPdf(pages);
      if (source.exportBackend.available) await saveArtwork(name, blob, "pdf");
      else downloadBlob(blob, name);
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const exportDocumentMarkdown = async (): Promise<void> => {
    setExportError(null);
    try {
      const base = exportBaseName(source.editor.getSnapshot().title);
      const result = exportMarkdownDocument(source.editor, {
        assetDir: `${base}.assets`,
      });
      const encoder = new TextEncoder();
      const bytes = encodeStoredZip(
        [
          { path: `${base}.md`, contents: encoder.encode(result.markdown) },
          ...result.assets.map((asset) => ({
            path: `${base}.assets/${asset.name}`,
            contents: encoder.encode(asset.svg),
          })),
        ],
        "Document",
      );
      await saveZip(bytes, `${base}.zip`);
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const exportDocumentBundle = async (): Promise<void> => {
    setExportError(null);
    try {
      const snapshot = source.editor.getSnapshot();
      // Images are held as data URLs once the session has loaded them.
      const { bytes } = encodeDocumentBundle(snapshot, (src) => {
        const data = source.editor.assets.resolve(src);
        return data ? decodeRasterDataUrl(data).bytes : undefined;
      });
      const name = `${exportBaseName(snapshot.title)}.${DOCUMENT_BUNDLE_EXTENSION}`;
      if (!source.exportBackend.available) {
        downloadBlob(new Blob([bytes], { type: "application/zip" }), name);
        return;
      }
      const path = await source.exportBackend.pickExportPath(
        name,
        DOCUMENT_BUNDLE_EXTENSION,
      );
      if (path === null) return;
      await source.exportBackend.writeBytes(path, bytes);
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  /** The imported board's Gerber and drill files, edits included. */
  const exportGerber = async (): Promise<void> => {
    setExportError(null);
    const page = source.editor.store.getPage(source.editor.currentPageId);
    if (!page) return;
    try {
      const report = exportPcbPage(source.editor.getSnapshot(), page.id, {
        name: exportBaseName(page.name),
      });
      const saved = await saveZip(
        encodePcbExportZip(report),
        `${exportBaseName(page.name)}-gerber.zip`,
      );
      if (saved)
        setExportError(
          `Export notes: ${[
            ...report.warnings,
            `${report.layers.length} layer(s) written; nothing was checked, so review the files before ordering.`,
          ].join("; ")}`,
        );
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const exportPcbGerber = async (): Promise<void> => {
    setExportError(null);
    const page = source.editor.store.getPage(source.editor.currentPageId);
    if (page?.kind !== "pcb") return;
    try {
      const pcb = exportPcbBoard(source.editor.store.getSnapshot(), page.id, {
        name: page.name,
      });
      if (typeof pcb === "string") {
        setExportError(pcb);
        return;
      }
      const saved = await saveZip(
        encodePcbBoardZip(pcb),
        `${exportBaseName(page.name)}.zip`,
      );
      if (saved)
        setExportError(
          `Export notes: ${[...pcb.warnings, ...pcb.notes].join("; ")}`,
        );
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const exportBreadboard = async (
    kind: "bom" | "kicad" | "spice" | "gerber",
  ): Promise<void> => {
    setExportError(null);
    const page = source.editor.store.getPage(source.editor.currentPageId);
    if (page?.kind !== "breadboard") return;
    try {
      const snapshot = source.editor.getSnapshot();
      if (kind === "gerber") {
        await exportBreadboardGerber(snapshot, page.name);
        return;
      }
      const connectivity = computeBreadboardConnectivity(
        snapshot,
        source.editor.currentPageId,
      );
      const netlist = toBreadboardNetlist(
        snapshot,
        source.editor.currentPageId,
        connectivity,
      );
      const io = await import("@nodetto/io");
      const report =
        kind === "bom"
          ? io.exportBreadboardBomCsv(netlist)
          : kind === "kicad"
            ? io.exportBreadboardKicadNetlist(netlist)
            : io.exportBreadboardSpiceNetlist(netlist);
      const extension =
        kind === "bom" ? "csv" : kind === "kicad" ? "net" : "cir";
      const name = `${exportBaseName(page.name)}.${extension}`;
      if (!source.exportBackend.available) {
        downloadBlob(new Blob([report.text], { type: "text/plain" }), name);
      } else {
        const path = await source.exportBackend.pickExportPath(name, extension);
        if (path === null) return;
        await source.exportBackend.writeText(path, report.text);
      }
      if (report.warnings.length > 0)
        setExportError(`Export notes: ${report.warnings.join("; ")}`);
    } catch (error) {
      setExportError(
        `could not export: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return {
    saveArtwork,
    exportDocumentPdf,
    exportDocumentMarkdown,
    exportDocumentBundle,
    exportBpmn,
    exportBreadboard,
    exportGerber,
    exportPcbGerber,
    exportStl,
    captureCadImage,
  };
}
