import {
  getElementTypeDefinition,
  type Document,
  type PageId,
} from "@nodetto/ir";
import { createShapeContext } from "../hit-test.ts";
import {
  connectorLabelBackdrop,
  connectorLabelLayout,
} from "../label-layout.ts";
import {
  connectorDecoration,
  endpointReaderFor,
  resolveConnector,
} from "../shapes/connector.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import {
  labelOverflow,
  pairFindings,
  TEXT_LAYOUT_LINT_RULE_IDS,
  type Item,
  type LabelItem,
  type TextLayoutLintFinding,
} from "./rules.ts";

export function lintTextLayoutPage(
  document: Document,
  pageId: PageId,
): readonly TextLayoutLintFinding[] {
  const store = new Store(document);
  const registry = createDefaultRegistry();
  const context = createShapeContext(store, registry, 1);
  const elements = store.getPageElements(pageId);
  const labels: LabelItem[] = [];
  const bodies: Item[] = [];
  const notes: Item[] = [];
  const findings: TextLayoutLintFinding[] = [];
  for (const [order, element] of elements.entries()) {
    if (
      element.visual.hidden ||
      context.isHidden?.(element.id) ||
      context.isMaskSource?.(element.id) ||
      element.type === "group"
    )
      continue;
    const box = registry
      .getOrFallback(element.type)
      .getBounds(element, context);
    if (!box) continue;
    const item = { element, box, order };
    const edge = getElementTypeDefinition(element.type)?.category === "edge";
    if (edge && !element.type.startsWith("bpmn.")) {
      const label = connectorDecoration(element).label;
      const resolved = resolveConnector(
        element,
        context,
        endpointReaderFor(element.type),
      );
      if (label && resolved) {
        const labelBox = connectorLabelBackdrop(
          connectorLabelLayout(label, element.visual),
          resolved.labelPoint,
        );
        if (labelBox)
          labels.push({ ...item, box: labelBox, points: resolved.points });
      }
    }
    if (
      !edge &&
      !["frame", "group", "draw.freehand", "draw.path"].includes(
        element.type,
      ) &&
      (element.visual.rotation ?? 0) === 0
    )
      bodies.push(item);
    findings.push(...labelOverflow(item));
    if (element.type === "text.note") notes.push(item);
  }
  findings.push(...pairFindings(labels, bodies, notes));
  const unique = new Map(
    findings.map((f) => [
      JSON.stringify([f.ruleId, f.elementId, f.message]),
      f,
    ]),
  );
  const order = new Map(elements.map((e, i) => [e.id, i]));
  return [...unique.values()].sort(
    (a, b) =>
      (order.get(a.elementId) ?? 0) - (order.get(b.elementId) ?? 0) ||
      TEXT_LAYOUT_LINT_RULE_IDS.indexOf(a.ruleId) -
        TEXT_LAYOUT_LINT_RULE_IDS.indexOf(b.ruleId) ||
      a.message.localeCompare(b.message),
  );
}
