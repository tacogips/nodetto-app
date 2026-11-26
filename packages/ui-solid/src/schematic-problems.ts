import {
  computeSchematicConnectivity,
  firstSchematicPageId,
  lintSchematicPage,
  schematicPcbParityFindings,
  toSchematicNetlist,
  type Editor,
} from "@nodetto/core";
import { isSchematicPartType, type Document, type PageId } from "@nodetto/ir";
import { breadboardTargetFromSchematic } from "@nodetto/io";

export function schematicProblemRows(document: Document, pageId: PageId) {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  if (page?.kind === "schematic") return lintSchematicPage(document, pageId);
  if (page?.kind === "pcb") {
    const schematicId = firstSchematicPageId(document);
    if (schematicId)
      return schematicPcbParityFindings(document, pageId, schematicId);
  }
  return [];
}

export type SchematicProblemRow = ReturnType<
  typeof schematicProblemRows
>[number];

export function canFixSchematicReferences(
  document: Document,
  pageId: PageId,
): boolean {
  if (
    !document.pages.some(
      (page) => page.id === pageId && page.kind === "schematic",
    )
  )
    return false;
  const references = new Set<string>();
  for (const element of document.elements) {
    if (element.page !== pageId || !isSchematicPartType(element.type)) continue;
    const reference = (element.semantic as { reference: string }).reference;
    if (reference.endsWith("?") || references.has(reference)) return true;
    references.add(reference);
  }
  return false;
}

export function sendSchematicToBreadboard(
  editor: Editor,
  schematicPageId: PageId,
  breadboardPageId: PageId,
) {
  const document = editor.store.getSnapshot();
  const page = document.pages.find(
    (candidate) =>
      candidate.id === schematicPageId && candidate.kind === "schematic",
  );
  if (!page) throw new Error("Schematic page not found");
  const netlist = toSchematicNetlist(
    document,
    schematicPageId,
    computeSchematicConnectivity(document, schematicPageId),
  );
  const result = breadboardTargetFromSchematic(netlist, {
    pageName: page.name,
  });
  if (result.target)
    editor.setBreadboardTarget(breadboardPageId, result.target);
  return result.diagnostics;
}
