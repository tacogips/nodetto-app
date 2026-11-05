import {
  isRelativeAttachmentPath,
  type Document,
  type Page,
  type PageId,
} from "@nodetto/ir";
import { parseDocument } from "@nodetto/io";
import { lintNodeOverlaps, NODE_OVERLAP_PAGE_KINDS } from "@nodetto/core";
import { planTextWrapFixes, type TextWrapFix } from "@nodetto/core";
import type { CommandIo } from "./commands.ts";
import { runOperations } from "./edit-command.ts";

export const LINT_NO_PAGES_MESSAGE =
  "Document contains no BPMN, breadboard, architecture, freeform, flowchart, ERD, state or UML pages, or pages with images.";

export function documentRelativePath(
  documentPath: string,
  src: string,
): string {
  const slash = documentPath.lastIndexOf("/");
  const directory = slash < 0 ? "" : documentPath.slice(0, slash);
  const absolute = documentPath.startsWith("/");
  const segments: string[] = [];
  for (const segment of directory.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length && segments[segments.length - 1] !== "..")
        segments.pop();
      else if (!absolute) segments.push(segment);
    } else segments.push(segment);
  }
  const normalized = `${absolute ? "/" : ""}${segments.join("/")}`;
  return normalized
    ? `${normalized}${normalized === "/" ? "" : "/"}${src}`
    : src;
}

export function diagramLintApplies(document: Document, page: Page): boolean {
  return (
    NODE_OVERLAP_PAGE_KINDS.includes(page.kind) ||
    document.elements.some(
      (element) => element.page === page.id && element.type === "image.raster",
    )
  );
}
export interface DiagramLintRow {
  readonly pageId: PageId;
  readonly elementId: string;
  readonly severity: "error" | "warning";
  readonly ruleId: "node-overlap" | "image-missing";
  readonly message: string;
}
export interface DiagramLintResult {
  readonly rows: readonly DiagramLintRow[];
  readonly fixes: readonly TextWrapFix[];
  readonly written: boolean;
  readonly error?: string;
}
export function lintDiagramPages(
  io: CommandIo,
  documentPath: string,
  document: Document,
  options: {
    pageId?: PageId;
    fix: boolean;
    textLayoutPageIds?: readonly PageId[];
    format?: "text" | "json";
  },
): DiagramLintResult {
  if (options.fix && documentPath.toLowerCase().endsWith(".bpmn"))
    return {
      rows: [],
      fixes: [],
      written: false,
      error: "--fix needs a nodetto document",
    };
  const fixes = options.fix
    ? (options.textLayoutPageIds ?? [])
        .filter((id) => !options.pageId || id === options.pageId)
        .flatMap((id) => planTextWrapFixes(document, id))
    : [];
  let currentDocument = document;
  let written = false;
  if (fixes.length) {
    const operations = fixes.map((fix) => ({
      op: "update",
      id: fix.elementId,
      semantic: { [fix.field]: fix.after },
    }));
    const result = runOperations(io, documentPath, operations, {
      arrange: false,
      dryRun: false,
      format: options.format ?? "text",
    });
    if (result.exitCode !== 0)
      return {
        rows: [],
        fixes,
        written: false,
        error: result.stderr.trimEnd(),
      };
    written = true;
    try {
      currentDocument = parseDocument(io.readText(documentPath));
    } catch (cause) {
      return {
        rows: [],
        fixes,
        written,
        error: `Cannot read written document: ${cause instanceof Error ? cause.message : String(cause)}`,
      };
    }
  }
  const rows: DiagramLintRow[] = [];
  for (const page of currentDocument.pages) {
    if (options.pageId && page.id !== options.pageId) continue;
    for (const finding of lintNodeOverlaps(currentDocument, page.id))
      rows.push({
        pageId: page.id,
        elementId: finding.elementId,
        severity: "warning",
        ruleId: "node-overlap",
        message: finding.message,
      });
    if (!io.readAttachment) continue;
    const images = currentDocument.elements
      .filter(
        (element) =>
          element.page === page.id && element.type === "image.raster",
      )
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const element of images) {
      const src = (element.semantic as Record<string, unknown>).src;
      if (!isRelativeAttachmentPath(src)) continue;
      const joined = documentRelativePath(documentPath, src);
      let reason = "";
      if (io.exists?.(joined) === false) reason = "file not found";
      else
        try {
          io.readAttachment(documentPath, src);
        } catch {
          reason =
            "cannot be read (outside the document folder, too large, or unreadable)";
        }
      if (reason)
        rows.push({
          pageId: page.id,
          elementId: element.id,
          severity: "error",
          ruleId: "image-missing",
          message: `image src "${src}" ${reason}`,
        });
    }
  }
  return { rows, fixes, written };
}
export function formatFixLines(fixes: readonly TextWrapFix[]): string {
  return fixes
    .map(
      (fix) =>
        `fixed ${fix.elementId} ${fix.ruleId}: ${fix.after.split("\n").length - fix.before.split("\n").length} line break(s)`,
    )
    .join("\n");
}
