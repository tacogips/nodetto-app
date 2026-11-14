import type { Document, ElementId, PageId } from "@nodetto/ir";
import { createShapeContext } from "../hit-test.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { wrapTextToWidth } from "../text-wrap.ts";
import { wideAwareTextWidth } from "../wide-text-width.ts";
import { lintTextLayoutPage } from "./engine.ts";
import { textWrapArea } from "./rules.ts";

export interface TextWrapFix {
  readonly pageId: PageId;
  readonly elementId: ElementId;
  readonly ruleId: string;
  readonly field: string;
  readonly before: string;
  readonly after: string;
}
export function planTextWrapFixes(
  document: Document,
  pageId: PageId,
): TextWrapFix[] {
  const store = new Store(document);
  const registry = createDefaultRegistry();
  const context = createShapeContext(store, registry, 1);
  const findings = lintTextLayoutPage(document, pageId);
  const fixes: TextWrapFix[] = [];
  for (const element of store.getPageElements(pageId)) {
    const ruleId =
      element.type === "text.note" ? "note-overflow" : "label-overflow";
    if (
      !findings.some(
        (f) =>
          f.elementId === element.id &&
          f.ruleId === ruleId &&
          f.message.includes(" wide but the text area is "),
      )
    )
      continue;
    const box = registry
      .getOrFallback(element.type)
      .getBounds(element, context);
    if (!box) continue;
    const area = textWrapArea({ element, box, order: 0 });
    if (!area) continue;
    const value = (element.semantic as Record<string, unknown>)[area.field];
    if (
      typeof value !== "string" ||
      !value
        .split("\n")
        .some(
          (line) =>
            wideAwareTextWidth(line, area.fontSize, area.letterSpacing) >
            area.width + 0.01,
        )
    )
      continue;
    const after = wrapTextToWidth(
      value,
      area.width,
      area.fontSize,
      area.letterSpacing,
    );
    if (after !== value)
      fixes.push({
        pageId,
        elementId: element.id,
        ruleId,
        field: area.field,
        before: value,
        after,
      });
  }
  return fixes.sort((a, b) =>
    a.elementId < b.elementId ? -1 : a.elementId > b.elementId ? 1 : 0,
  );
}
