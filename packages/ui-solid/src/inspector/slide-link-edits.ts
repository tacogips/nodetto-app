import type { Command, Store } from "@nodetto/core";
import type { Element, PageId, Visual } from "@nodetto/ir";

export function linkedPages(store: Store, element: Element): PageId[] {
  const link = element.visual.linkId;
  if (!link) return [];
  const pages = new Set(
    store
      .listElements()
      .filter((item) => item.visual.linkId === link)
      .map((item) => item.page),
  );
  return store
    .listPages()
    .filter((page) => pages.has(page.id))
    .map((page) => page.id);
}

export function planUnlink(element: Element): Command[] {
  if (!element.visual.linkId) return [];
  const { linkId: _linkId, ...visual } = element.visual;
  return [{ type: "replaceVisual", id: element.id, visual }];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function planApplyToLinked(
  store: Store,
  element: Element,
  options: { readonly geometry: boolean },
): Command[] {
  const source = element.visual;
  if (!source.linkId) return [];
  const commands: Command[] = [];
  for (const target of store.listElements()) {
    if (
      target.page === element.page ||
      target.type !== element.type ||
      target.visual.linkId !== source.linkId
    )
      continue;
    const visual: { -readonly [K in keyof Visual]: Visual[K] } = {
      ...target.visual,
    };
    for (const key of ["style", "colorTokens", "textStyle"] as const) {
      if (source[key] === undefined) delete visual[key];
      else Object.assign(visual, { [key]: source[key] });
    }
    if (
      options.geometry &&
      typeof source.x === "number" &&
      typeof source.y === "number" &&
      typeof target.visual.x === "number" &&
      typeof target.visual.y === "number"
    ) {
      const origin = (page: PageId) =>
        store.getMeta().slideSize
          ? (store.getPage(page)?.slideOrigin ?? { x: 0, y: 0 })
          : { x: 0, y: 0 };
      const from = origin(element.page);
      const to = origin(target.page);
      visual.x = source.x - from.x + to.x;
      visual.y = source.y - from.y + to.y;
      for (const key of ["width", "height", "rotation"] as const) {
        if (source[key] === undefined) delete visual[key];
        else visual[key] = source[key];
      }
    }
    if (
      JSON.stringify(canonical(visual)) !==
      JSON.stringify(canonical(target.visual))
    )
      commands.push({ type: "replaceVisual", id: target.id, visual });
  }
  return commands;
}
