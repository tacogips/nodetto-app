// What the Export dialog calls to write a file: artwork, BPMN XML, the
// breadboard's BOM and netlists, and Gerber/drill ZIPs. Each writes through
// the export backend's save dialog, or falls back to a browser download
// where there is no filesystem.

import {
  bpmnRouteResolver,
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
  readonly exportBpmn: () => Promise<void>;
  readonly exportBreadboard: (
    kind: "bom" | "kicad" | "spice" | "gerber",
  ) => Promise<void>;
  readonly exportGerber: () => Promise<void>;
  readonly exportPcbGerber: () => Promise<void>;
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

  /** Saves a ZIP through the export backend, or downloads it; false if cancelled. */
  const saveZip = async (bytes: Uint8Array, name: string): Promise<boolean> => {
    if (!source.exportBackend.available) {
      downloadBlob(new Blob([bytes], { type: "application/zip" }), name);
      return true;
    }
    const path = await source.exportBackend.pickExportPath(name, "zip");
    if (path === null) return false;
    await source.exportBackend.writeBytes(path, bytes);
    return true;
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
    exportBpmn,
    exportBreadboard,
    exportGerber,
    exportPcbGerber,
  };
}
