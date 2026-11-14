// Opening an interchange format: Mermaid, draw.io, BPMN XML, KiCad, Gerber
// and drill files, and HTML pages.
//
// None of these is our persistence format, so every importer hands its
// result to `DocumentSession.importDocument`, which keeps the document
// detached: autosave can never rewrite the source file. Each importer checks
// `stale` after every await, because a newer open, a new document or a
// hand-over to another mode may have overtaken it.

import type { Editor, PcbImportFile } from "@nodetto/core";
import type { Document } from "@nodetto/ir";
import type { BpmnImportWarning } from "@nodetto/io";
import type { FileBackend } from "./backend.ts";
import {
  baseName,
  bpmnTitle,
  describeError,
  drawioTitle,
  isBpmnPath,
  isDrawioPath,
  isHtmlPath,
  isKicadPath,
  isKicadPcbPath,
  isMermaidPath,
  isPcbPath,
  mermaidTitle,
} from "./session-paths.ts";

/** What an importer needs from the session that runs it. */
export interface ImportHost {
  readonly editor: Editor;
  readonly backend: FileBackend;
  importDocument(
    document: Document,
    name: string,
    importWarnings?: readonly BpmnImportWarning[],
  ): Promise<boolean>;
  fail(message: string): void;
}

/**
 * Import a format the importer reads itself (binary ZIPs, KiCad boards).
 * Null when `path` is not one of them and the session should read the text.
 */
export function importUnreadPath(
  host: ImportHost,
  path: string,
  stale: () => boolean,
): Promise<boolean> | null {
  if (isKicadPcbPath(path)) return importKicadPcbPath(host, path, stale);
  if (isPcbPath(path)) return importPcbPath(host, path, stale);
  return null;
}

/**
 * Import the text read from `path` when it is an interchange format. Null
 * when it is not, and the text is a document of our own to parse.
 */
export function importInterchangeText(
  host: ImportHost,
  path: string,
  diskText: string,
  stale: () => boolean,
): Promise<boolean> | null {
  if (isHtmlPath(path)) return importHtml(host, path, diskText, stale);
  if (isMermaidPath(path))
    return importMermaidText(host, path, diskText, stale);
  if (isDrawioPath(path)) return importDrawioText(host, path, diskText, stale);
  if (isKicadPath(path)) return importKicadText(host, path, diskText, stale);
  if (isBpmnPath(path)) return importBpmnText(host, path, diskText, stale);
  return null;
}

/**
 * Gerber and drill files are an interchange source: the board becomes a
 * detached document so autosave never rewrites the fabrication files.
 */
async function importPcbPath(
  host: ImportHost,
  path: string,
  stale: () => boolean,
): Promise<boolean> {
  const name = baseName(path);
  try {
    const { importPcbFiles, pcbFilesFromZip } = await import("@nodetto/core");
    let files: PcbImportFile[];
    if (/\.zip$/i.test(path)) {
      if (!host.backend.readDocumentBytes)
        throw new Error("this build cannot read ZIP archives");
      files = pcbFilesFromZip(await host.backend.readDocumentBytes(path));
      if (files.length === 0)
        throw new Error("the archive holds no Gerber or drill file");
    } else {
      files = [{ name, text: await host.backend.readDocument(path) }];
    }
    if (stale()) return false;
    const report = importPcbFiles(files, {
      pageName: name.replace(/\.[^.]+$/, ""),
    });
    return await host.importDocument(
      report.document,
      name,
      report.warnings.map((warning) => ({
        element: warning.file ? baseName(warning.file) : name,
        message: warning.message,
      })),
    );
  } catch (error) {
    if (!stale())
      host.fail(`could not import ${name}: ${describeError(error)}`);
    return false;
  }
}

/** KiCad boards are imported as detached documents, never autosaved over. */
async function importKicadPcbPath(
  host: ImportHost,
  path: string,
  stale: () => boolean,
): Promise<boolean> {
  const name = baseName(path);
  try {
    const text = await host.backend.readDocument(path);
    if (stale()) return false;
    const { importKicadPcb } = await import("@nodetto/io/kicad");
    if (stale()) return false;
    const result = importKicadPcb(text, { fileName: name });
    const error = result.diagnostics.find(
      (diagnostic) => diagnostic.severity === "error",
    );
    if (error) {
      host.fail(`could not import ${name}: ${error.message}`);
      return false;
    }
    if (!result.plan) {
      host.fail(`could not import ${name}: no import plan was produced`);
      return false;
    }
    const { pcbDocumentFromPlan } = await import("@nodetto/core");
    if (stale()) return false;
    const document = pcbDocumentFromPlan(result.plan, {
      pageName: result.plan.title,
    });
    return await host.importDocument(
      document,
      name,
      result.diagnostics
        .filter((diagnostic) => diagnostic.severity === "warning")
        .map((diagnostic) => ({
          element: name,
          message:
            diagnostic.line !== undefined && diagnostic.column !== undefined
              ? `${diagnostic.line}:${diagnostic.column}: ${diagnostic.message}`
              : diagnostic.message,
        })),
    );
  } catch (error) {
    if (!stale())
      host.fail(`could not import ${name}: ${describeError(error)}`);
    return false;
  }
}

async function importHtml(
  host: ImportHost,
  path: string,
  diskText: string,
  stale: () => boolean,
): Promise<boolean> {
  try {
    const { importHtmlPage } = await import("./html-import.ts");
    const report = await importHtmlPage(diskText, path, host.backend);
    if (stale()) return false;
    const imported = await host.importDocument(
      report.document,
      baseName(path),
      report.warnings,
    );
    if (imported)
      for (const [relative, data] of report.assets)
        host.editor.assets.set(relative, data);
    return imported;
  } catch (error) {
    if (!stale())
      host.fail(`could not import ${baseName(path)}: ${describeError(error)}`);
    return false;
  }
}

async function importMermaidText(
  host: ImportHost,
  path: string,
  diskText: string,
  stale: () => boolean,
): Promise<boolean> {
  try {
    const { importMermaid } = await import("@nodetto/io/mermaid/import");
    if (stale()) {
      return false;
    }
    const imported = importMermaid(diskText, { title: mermaidTitle(path) });
    // Mermaid is an interchange source, not our persistence format. Keep
    // the imported document detached so autosave can never rewrite it.
    return await host.importDocument(imported.document, baseName(path));
  } catch (error) {
    host.fail(`could not import ${baseName(path)}: ${describeError(error)}`);
    return false;
  }
}

async function importDrawioText(
  host: ImportHost,
  path: string,
  diskText: string,
  stale: () => boolean,
): Promise<boolean> {
  try {
    const { importDrawio } = await import("@nodetto/io/drawio");
    if (stale()) {
      return false;
    }
    const report = importDrawio(diskText, { title: drawioTitle(path) });
    // draw.io files are an interchange source, not our persistence
    // format. Keep them detached so autosave never rewrites the source.
    return await host.importDocument(
      report.document,
      baseName(path),
      report.warnings.map((warning) => ({
        element: warning.cell ?? warning.page,
        message: `${warning.page}: ${warning.message}`,
      })),
    );
  } catch (error) {
    if (!stale()) {
      host.fail(`could not import ${baseName(path)}: ${describeError(error)}`);
    }
    return false;
  }
}

async function importKicadText(
  host: ImportHost,
  path: string,
  diskText: string,
  stale: () => boolean,
): Promise<boolean> {
  try {
    const { importKicad } = await import("@nodetto/io/kicad");
    if (stale()) return false;
    const result = importKicad(diskText, { fileName: baseName(path) });
    if (!result.plan) {
      const diagnostic = result.diagnostics.find(
        (item) => item.severity === "error",
      );
      host.fail(
        `could not import ${baseName(path)}: ${diagnostic?.message ?? "no import plan was produced"}`,
      );
      return false;
    }
    const { layoutBreadboardImport } = await import("@nodetto/core");
    if (stale()) return false;
    return await host.importDocument(
      layoutBreadboardImport(result.plan),
      baseName(path),
      result.diagnostics.map((diagnostic) => ({
        element:
          diagnostic.reference ??
          (diagnostic.line !== undefined && diagnostic.column !== undefined
            ? `${diagnostic.line}:${diagnostic.column}`
            : baseName(path)),
        message: `${diagnostic.code}: ${diagnostic.message}`,
      })),
    );
  } catch (error) {
    if (!stale()) {
      host.fail(`could not import ${baseName(path)}: ${describeError(error)}`);
    }
    return false;
  }
}

async function importBpmnText(
  host: ImportHost,
  path: string,
  diskText: string,
  stale: () => boolean,
): Promise<boolean> {
  try {
    const { importBpmnXml } = await import("@nodetto/io/bpmn");
    if (stale()) {
      return false;
    }
    const report = importBpmnXml(diskText, { title: bpmnTitle(path) });
    // BPMN XML is an interchange source, not our persistence format.
    // Keep it detached so autosave can never rewrite the source file.
    return await host.importDocument(
      report.document,
      baseName(path),
      report.warnings,
    );
  } catch (error) {
    if (!stale()) {
      host.fail(`could not import ${baseName(path)}: ${describeError(error)}`);
    }
    return false;
  }
}
