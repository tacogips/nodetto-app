// Path and error helpers for the document session: which interchange format
// a path names, the title an import takes from it, and how a failed read is
// told apart from a missing file.

import { newElementId } from "@nodetto/core";
import { type Document, SCHEMA_VERSION } from "@nodetto/ir";

/**
 * How the backend reports a file that is not there. Must match
 * `MISSING_FILE_MESSAGE` in `apps/desktop/src-tauri/src/fs.rs`; both sides
 * carry a comment saying so, and both sides have a test pinning it.
 */
const MISSING_FILE_MARKER = "file not found";

/**
 * The document a new file starts from: one empty freeform page, matching
 * what `Editor` builds for itself when constructed without a document.
 */
export function emptyLocalDocument(): Document {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newElementId(),
    title: "Untitled",
    pages: [{ id: newElementId(), name: "Page 1", kind: "freeform" }],
    elements: [],
  };
}

/** The last path segment, for either separator. */
export function baseName(path: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return separator === -1 ? path : path.slice(separator + 1);
}

export function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path);
}

export function isMermaidPath(path: string): boolean {
  return /\.(?:mmd|mermaid)$/i.test(path);
}

export function mermaidTitle(path: string): string {
  return baseName(path).replace(/\.(?:mmd|mermaid)$/i, "");
}

export function isDrawioPath(path: string): boolean {
  return /\.(?:drawio|dio)$/i.test(path);
}

export function drawioTitle(path: string): string {
  return baseName(path).replace(/\.(?:drawio|dio)$/i, "");
}

export function isBpmnPath(path: string): boolean {
  return /\.bpmn$/i.test(path);
}

export function isKicadPath(path: string): boolean {
  return /\.(?:kicad_sch|net)$/i.test(path);
}

export function isKicadPcbPath(path: string): boolean {
  return path.toLowerCase().endsWith(".kicad_pcb");
}

/** Gerber and drill files, alone or in a board house ZIP. */
const PCB_PATH =
  /\.(?:zip|gbr|ger|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gko|gm1|gml|drl|xln|exc)$/i;

export function isPcbPath(path: string): boolean {
  return PCB_PATH.test(path);
}

export function bpmnTitle(path: string): string {
  return baseName(path).replace(/\.bpmn$/i, "");
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True when a read failed because the file does not exist. */
export function isMissingFile(error: unknown): boolean {
  return describeError(error).startsWith(MISSING_FILE_MARKER);
}
