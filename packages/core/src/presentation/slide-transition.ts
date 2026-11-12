import {
  type Element,
  type PageId,
  getElementTypeDefinition,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import type { Box } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import {
  SLIDE_ENTRANCE_MS,
  SLIDE_ENTRANCE_OFFSET_MS,
  SLIDE_FADE_OUT_MS,
  SLIDE_MOVE_MS,
  type SlideAppearance,
  type SlideBox,
  type SlideTransitionPlan,
  type SlideTransitionStep,
  type SlideViewBox,
  staggerStart,
} from "./slide-transition-types.ts";

type Item = { element: Element; bounds: Box; key: string };
type Slide = { readonly page: PageId; readonly rect: SlideViewBox };

function canonical(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return entry;
    return Object.fromEntries(
      Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}
function appearance(element: Element): SlideAppearance {
  const style = element.visual.style;
  return {
    opacity: style?.opacity ?? 1,
    ...(style?.fill !== undefined ? { fill: style.fill } : {}),
    ...(style?.stroke !== undefined ? { stroke: style.stroke } : {}),
    ...(style?.strokeWidth !== undefined
      ? { strokeWidth: style.strokeWidth }
      : {}),
  };
}
function box(item: Item, rect: SlideViewBox): SlideBox {
  return {
    ...item.bounds,
    x: item.bounds.x - rect.x,
    y: item.bounds.y - rect.y,
    rotation: item.element.visual.rotation ?? 0,
  };
}
function appearanceKey(element: Element): string | undefined {
  const { style, colorTokens, textStyle } = element.visual;
  return canonical({
    style,
    semantic: element.semantic,
    colorTokens,
    textStyle,
  });
}
function edge(item: Item): boolean {
  return getElementTypeDefinition(item.element.type)?.category === "edge";
}
function unique(items: Item[]): Map<string, Item> {
  const result = new Map<string, Item>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (!item.key) continue;
    if (result.has(item.key)) {
      result.delete(item.key);
      duplicates.add(item.key);
    } else if (!duplicates.has(item.key)) result.set(item.key, item);
  }
  return result;
}

export function planSlideTransition(
  store: Store,
  registry: ShapeUtilRegistry,
  input: { readonly from: Slide; readonly to: Slide },
): SlideTransitionPlan {
  if (
    Math.abs(input.from.rect.width - input.to.rect.width) > 0.5 ||
    Math.abs(input.from.rect.height - input.to.rect.height) > 0.5
  )
    return { kind: "cut", reason: "size-mismatch" };
  const context = createShapeContext(store, registry, 1);
  function items(page: PageId): Item[] {
    const result: Item[] = [];
    for (const element of store.getPageElements(page)) {
      if (
        element.type === "group" ||
        (element.type === "edge.generic" &&
          (element.semantic as { prototype?: boolean } | null)?.prototype) ||
        element.visual.hidden ||
        context.isHidden?.(element.id) ||
        context.isMaskSource?.(element.id)
      )
        continue;
      const bounds = registry
        .getOrFallback(element.type)
        .getBounds(element, context);
      if (bounds)
        result.push({
          element,
          bounds,
          key: element.visual.linkId?.trim() ?? "",
        });
    }
    return result.sort(
      (a, b) =>
        compareFractional(a.element.index, b.element.index) ||
        compareFractional(a.element.id, b.element.id),
    );
  }
  const outgoing = items(input.from.page);
  const incoming = items(input.to.page);
  if (!outgoing.length && !incoming.length)
    return { kind: "cut", reason: "empty" };
  const fromKeys = unique(outgoing);
  const toKeys = unique(incoming);
  const pairs: { from: Item; to: Item }[] = [];
  for (const to of incoming) {
    const from = fromKeys.get(to.key);
    if (
      from &&
      toKeys.get(to.key) === to &&
      from.element.type === to.element.type
    )
      pairs.push({ from, to });
  }
  const matchedFrom = new Set(pairs.map((pair) => pair.from.element.id));
  const matchedTo = new Set(pairs.map((pair) => pair.to.element.id));
  const exits = outgoing.filter((item) => !matchedFrom.has(item.element.id));
  const entrances = incoming.filter((item) => !matchedTo.has(item.element.id));
  const steps: SlideTransitionStep[] = exits.map(({ element }) => ({
    kind: "fade-out",
    from: element.id,
    start: 0,
    duration: SLIDE_FADE_OUT_MS,
    easing: "ease-in-out",
  }));
  pairs.forEach(({ from, to }, rank) => {
    const common = {
      from: from.element.id,
      to: to.element.id,
      start: staggerStart(rank, pairs.length),
      duration: SLIDE_MOVE_MS,
      easing: "ease-in-out" as const,
    };
    steps.push(
      edge(to)
        ? { kind: "crossfade", ...common }
        : {
            kind: "transform",
            ...common,
            fromBox: box(from, input.from.rect),
            toBox: box(to, input.to.rect),
            fromAppearance: appearance(from.element),
            toAppearance: appearance(to.element),
            appearanceChanged:
              appearanceKey(from.element) !== appearanceKey(to.element),
          },
    );
  });
  const offset = steps.length ? SLIDE_ENTRANCE_OFFSET_MS : 0;
  entrances.forEach((item, rank) =>
    steps.push({
      kind: edge(item)
        ? "grow"
        : item.element.type === "text.note" ||
            item.element.type === "image.raster"
          ? "fade-in"
          : "draw-on",
      to: item.element.id,
      start: offset + staggerStart(rank, entrances.length),
      duration: SLIDE_ENTRANCE_MS,
      easing: "ease-in-out",
    }),
  );
  return {
    kind: "animate",
    duration: Math.max(...steps.map((step) => step.start + step.duration)),
    steps,
  };
}
