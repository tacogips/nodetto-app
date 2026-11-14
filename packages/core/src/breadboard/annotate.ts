import {
  BREADBOARD_REFERENCE_PREFIX,
  isBreadboardPartType,
  type BreadboardPartType,
} from "@nodetto/ir";
import type { Command } from "../commands.ts";
import type { Store } from "../store.ts";

export function annotateBreadboardParts(
  existing: readonly string[],
  incoming: readonly {
    readonly type: BreadboardPartType;
    readonly reference: string;
  }[],
): readonly string[] {
  const used = new Set(existing);
  return incoming.map(({ type, reference }) => {
    if (!reference.endsWith("?") && !used.has(reference)) {
      used.add(reference);
      return reference;
    }
    const prefix = BREADBOARD_REFERENCE_PREFIX[type];
    let number = 1;
    while (used.has(`${prefix}${number}`)) number += 1;
    const next = `${prefix}${number}`;
    used.add(next);
    return next;
  });
}

export function planBreadboardAnnotation(
  store: Store,
  pageId: string,
): Command[] {
  const parts = store
    .getPageElements(pageId)
    .filter((element) => isBreadboardPartType(element.type));
  const seen = new Set<string>();
  const needs = parts.map((element) => {
    const semantic = element.semantic as { reference: string };
    const reference = semantic.reference;
    const duplicate = seen.has(reference);
    seen.add(reference);
    return {
      element,
      reference,
      needsFix: reference.endsWith("?") || duplicate,
    };
  });
  const keep = needs
    .filter((item) => !item.needsFix)
    .map((item) => item.reference);
  const fix = needs.filter((item) => item.needsFix);
  const assigned = annotateBreadboardParts(
    keep,
    fix.map(({ element }) => ({
      type: element.type as BreadboardPartType,
      reference: (element.semantic as { reference: string }).reference,
    })),
  );
  return fix.flatMap(({ element, reference }, index): Command[] => {
    const next = assigned[index];
    if (!next || next === reference) return [];
    return [
      {
        type: "updateSemantic",
        id: element.id,
        semantic: { ...(element.semantic as object), reference: next },
      },
    ];
  });
}
