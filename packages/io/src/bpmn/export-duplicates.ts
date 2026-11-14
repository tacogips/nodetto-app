// Detect duplicate BPMN model and diagram identifiers in an assembled
// export tree without changing the emitted XML.

import { BPMNDI, type BpmnExportWarning, MODEL } from "./export-common.ts";
import type { XmlElement } from "./xml.ts";

export function duplicateIdWarnings(root: XmlElement): BpmnExportWarning[] {
  const counts = new Map<string, number>();
  function visit(element: XmlElement): void {
    if (element.ns !== MODEL && element.ns !== BPMNDI) return;
    if (element.ns === MODEL && element.local === "extensionElements") return;
    const id = element.attributes.find(
      (attribute) => attribute.name === "id",
    )?.value;
    if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const child of element.children) {
      if (!("kind" in child)) visit(child);
    }
  }
  visit(root);
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => ({
      message: `Duplicate BPMN id ${id} was emitted.`,
    }));
}
