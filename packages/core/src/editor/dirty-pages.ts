import {
  type Element,
  type PageId,
  getElementTypeDefinition,
} from "@nodetto/ir";
import type { Command } from "../commands.ts";
import type { Store } from "../store.ts";

function references(element: Element): string[] {
  const ids = (
    getElementTypeDefinition(element.type)?.references(element.semantic) ?? []
  ).map((ref) => ref.id);
  for (const id of Object.values(element.visual.colorTokens ?? {}))
    if (typeof id === "string") ids.push(id);
  for (const id of Object.values(element.visual.numberTokens ?? {}))
    if (typeof id === "string") ids.push(id);
  if (element.visual.textStyle) ids.push(element.visual.textStyle);
  const semantic = element.semantic as { instanceOf?: unknown };
  if (typeof semantic?.instanceOf === "string") ids.push(semantic.instanceOf);
  return ids;
}

/** Conservative cross-page dependency set, rebuilt at whole-document passes. */
export function crossLinkedPages(store: Store): Set<PageId> {
  const pages = new Set<PageId>();
  for (const element of store.listElements()) {
    for (const id of references(element)) {
      const target = store.get(id);
      if (!target) {
        for (const page of store.listPages()) pages.add(page.id);
        continue;
      }
      if (target && target.page !== element.page) {
        pages.add(element.page);
        pages.add(target.page);
      }
    }
  }
  return pages;
}

/** Undefined means the entire document must be planned. */
export function dirtyPages(
  store: Store,
  commands: readonly Command[],
  linked: ReadonlySet<PageId>,
): Set<PageId> | undefined {
  const pages = new Set<PageId>();
  const changed: Element[] = [];
  for (const command of commands) {
    if (
      command.type === "updateDocument" ||
      command.type === "createPage" ||
      command.type === "updatePage" ||
      command.type === "deletePage"
    )
      return undefined;
    if (command.type === "createElement") {
      if (store.has(command.element.id)) return undefined;
      changed.push(command.element);
    } else if (command.type === "deleteElements") {
      for (const id of command.ids) {
        const element = store.get(id);
        if (element) changed.push(element);
      }
    } else {
      const element = store.get(command.id);
      if (element) {
        changed.push(element);
        if (command.type === "convertElement")
          changed.push({
            ...element,
            type: command.elementType,
            semantic: command.semantic,
            visual: command.visual,
          });
        if (command.type === "updateSemantic")
          changed.push({ ...element, semantic: command.semantic });
        if (command.type === "updateVisual")
          changed.push({
            ...element,
            visual: { ...element.visual, ...command.visual },
          });
        if (command.type === "replaceVisual")
          changed.push({ ...element, visual: command.visual });
      }
    }
  }
  for (const element of changed) {
    pages.add(element.page);
    const semantic = element.semantic as { component?: unknown };
    if (
      element.type === "design.token" ||
      element.type === "design.text-style" ||
      (element.type === "frame" && semantic?.component)
    )
      return undefined;
    if (linked.has(element.page)) return undefined;
    for (const id of references(element)) {
      const target = store.get(id);
      if (!target || target.page !== element.page) return undefined;
    }
  }
  return pages;
}
