import {
  type Element,
  type PageId,
  getElementTypeDefinition,
  readSlideSettings,
  SLIDE_SETTINGS_TYPE,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import type { Box } from "../geometry.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import {
  SLIDE_MOVE_MS,
  type SlideAppearance,
  type SlideBox,
  type SlideNavigation,
  type SlideTransitionPlan,
  type SlideTransitionStep,
  type SlideViewBox,
  staggerStart,
} from "./slide-transition-types.ts";

import {
  mirrorEnter,
  mirrorExit,
  resolveEntrance,
  resolveExit,
  resolveLinked,
  slideOffset,
  slideTiming,
} from "./slide-transition-settings.ts";

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
  input: {
    readonly from: Slide;
    readonly to: Slide;
    readonly navigation?: SlideNavigation;
  },
): SlideTransitionPlan {
  if (
    Math.abs(input.from.rect.width - input.to.rect.width) > 0.5 ||
    Math.abs(input.from.rect.height - input.to.rect.height) > 0.5
  )
    return { kind: "cut", reason: "size-mismatch" };
  const backward = input.navigation === "backward";
  const settings = readSlideSettings(
    store.getPageElements(backward ? input.from.page : input.to.page),
  );
  if (settings?.mode === "cut") return { kind: "cut", reason: "setting" };
  const context = createShapeContext(store, registry, 1);
  function items(page: PageId): Item[] {
    const result: Item[] = [];
    for (const element of store.getPageElements(page)) {
      if (
        element.type === SLIDE_SETTINGS_TYPE ||
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
  if (settings?.mode === "fade") {
    const duration = settings.durationMs ?? SLIDE_MOVE_MS;
    return {
      kind: "animate",
      duration,
      steps: [
        { kind: "slide-fade", start: 0, duration, easing: "ease-in-out" },
      ],
    };
  }
  const timing = slideTiming(settings?.durationMs);
  const stagger = (rank: number, count: number) =>
    settings?.stagger === false ? 0 : staggerStart(rank, count, timing);
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
  const steps: SlideTransitionStep[] = exits.map((item) => {
    const animation = item.element.visual.animation;
    const effect = backward
      ? mirrorEnter(animation?.enter, animation?.enterFrom)
      : { effect: animation?.exit, side: animation?.exitTo };
    const kind = resolveExit(item.element, effect.effect);
    return {
      kind,
      from: item.element.id,
      start: animation?.delayMs ?? 0,
      duration:
        kind === "disappear"
          ? 0
          : (animation?.durationMs ??
            (kind === "fade-out" ? timing.fadeOut : timing.move)),
      easing: "ease-in-out",
      ...(kind === "scale-out" ? { fromBox: box(item, input.from.rect) } : {}),
      ...(kind === "slide-out"
        ? {
            offset: slideOffset(
              box(item, input.from.rect),
              input.from.rect,
              effect.side,
            ),
          }
        : {}),
    };
  });
  const owner = (pair: { from: Item; to: Item }) =>
    backward ? pair.from : pair.to;
  pairs.sort(
    (a, b) =>
      (owner(a).element.visual.animation?.order ?? 0) -
      (owner(b).element.visual.animation?.order ?? 0),
  );
  pairs.forEach((pair, rank) => {
    const { from, to } = pair;
    const animation = owner(pair).element.visual.animation;
    const kind = resolveLinked(animation?.linked, edge(to));
    const baseStart = stagger(rank, pairs.length);
    const common = {
      from: from.element.id,
      to: to.element.id,
      start:
        animation?.delayMs === undefined
          ? baseStart
          : baseStart + animation.delayMs,
      duration: kind === "swap" ? 0 : (animation?.durationMs ?? timing.move),
      easing: "ease-in-out" as const,
    };
    steps.push(
      kind !== "transform"
        ? { kind, ...common }
        : {
            kind,
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
  const offset = steps.length ? timing.entranceOffset : 0;
  entrances.sort(
    (a, b) =>
      (a.element.visual.animation?.order ?? 0) -
      (b.element.visual.animation?.order ?? 0),
  );
  entrances.forEach((item, rank) => {
    const animation = item.element.visual.animation;
    const effect = backward
      ? mirrorExit(animation?.exit, animation?.exitTo)
      : { effect: animation?.enter, side: animation?.enterFrom };
    const kind = resolveEntrance(item.element, effect.effect);
    const baseStart = offset + stagger(rank, entrances.length);
    steps.push({
      kind,
      to: item.element.id,
      start:
        animation?.delayMs === undefined
          ? baseStart
          : baseStart + animation.delayMs,
      duration:
        kind === "appear" ? 0 : (animation?.durationMs ?? timing.entrance),
      easing: "ease-in-out",
      ...(kind === "scale-in" ? { toBox: box(item, input.to.rect) } : {}),
      ...(kind === "slide-in"
        ? {
            offset: slideOffset(
              box(item, input.to.rect),
              input.to.rect,
              effect.side,
            ),
          }
        : {}),
    });
  });
  return {
    kind: "animate",
    duration: Math.max(...steps.map((step) => step.start + step.duration)),
    steps,
  };
}
