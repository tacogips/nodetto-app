import type {
  Element,
  ElementId,
  FrameSemantic,
  GenericEdgeSemantic,
} from "@nodetto/ir";
import { frameParents } from "./frame-tree.ts";
import type { Vec } from "./geometry.ts";
import type { ShapeContext } from "./shape-util.ts";
import type { Store } from "./store.ts";
import { fmt } from "./svg-export/markup.ts";

export function compactPrototypeLabel(semantic: GenericEdgeSemantic): string {
  if (semantic.label !== undefined) return semantic.label;
  const actions: Record<string, string> = {
    back: "back",
    "open-overlay": "overlay",
    "swap-overlay": "swap",
    "close-overlay": "close",
    "change-to": "variant",
  };
  const triggers: Record<string, string> = { hover: "hover", press: "press" };
  const animations: Record<string, string> = {
    fade: "fade",
    "slide-left": "slide ←",
    "slide-right": "slide →",
    "slide-up": "slide ↑",
    "slide-down": "slide ↓",
    smart: "smart",
  };
  return [
    actions[semantic.prototypeAction ?? "navigate"],
    semantic.prototypeTrigger === "after-delay"
      ? `after ${(semantic.prototypeDelay ?? 1000) / 1000}s`
      : triggers[semantic.prototypeTrigger ?? "click"],
    animations[semantic.prototypeTransition ?? "instant"],
  ]
    .filter(Boolean)
    .join(" · ");
}

export interface PrototypeLinkGeometry {
  readonly kind: "curve" | "back-tag";
  readonly d?: string;
  readonly start: Vec;
  readonly end?: Vec;
  readonly labelPoint: Vec;
  readonly label: string;
}

export function prototypeLinkGeometry(
  store: Store,
  context: ShapeContext,
  link: Element,
): PrototypeLinkGeometry | undefined {
  if (link.type !== "edge.generic") return undefined;
  const semantic = link.semantic as GenericEdgeSemantic;
  if (
    !semantic.prototype ||
    !semantic.from ||
    !store.get(semantic.from) ||
    context.isHidden?.(semantic.from)
  )
    return undefined;
  const source = context.boundsOf(semantic.from);
  if (!source) return undefined;
  const label = compactPrototypeLabel(semantic);
  if (semantic.prototypeAction === "back") {
    const start = { x: source.x + source.width, y: source.y };
    return {
      kind: "back-tag",
      start,
      labelPoint: start,
      label: label || "back",
    };
  }
  if (
    !semantic.to ||
    store.get(semantic.to)?.type !== "frame" ||
    context.isHidden?.(semantic.to)
  )
    return undefined;
  const target = context.boundsOf(semantic.to);
  if (!target) return undefined;
  const right = target.x + target.width / 2 >= source.x + source.width / 2;
  const start = {
    x: right ? source.x + source.width : source.x,
    y: source.y + source.height / 2,
  };
  const low = target.y + Math.min(12, target.height / 2);
  const high = target.y + target.height - Math.min(12, target.height / 2);
  const end = {
    x: right ? target.x : target.x + target.width,
    y: Math.max(low, Math.min(high, start.y)),
  };
  const k = Math.max(40, Math.abs(end.x - start.x) / 2);
  const c1 = { x: start.x + (right ? k : -k), y: start.y };
  const c2 = { x: end.x + (right ? -k : k), y: end.y };
  const labelPoint = {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
  };
  return {
    kind: "curve",
    start,
    end,
    labelPoint,
    label,
    d: `M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(end.x)} ${fmt(end.y)}`,
  };
}

export interface PrototypeFlow {
  readonly name: string;
  readonly startId: ElementId;
  readonly screens: readonly ElementId[];
  readonly links: readonly {
    id: ElementId;
    from: ElementId;
    screen: ElementId;
    to: ElementId;
    trigger: string;
    action: string;
  }[];
}

function screenFor(
  store: Store,
  context: ShapeContext,
  id: ElementId,
): ElementId | undefined {
  const element = store.get(id);
  if (!element) return undefined;
  const parents = frameParents(store, element.page, context, false);
  let current: ElementId | undefined = id;
  let fallback: ElementId | undefined;
  const visited = new Set<ElementId>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const candidate = store.get(current);
    if (candidate?.type === "frame") {
      fallback = current;
      const semantic = candidate.semantic as FrameSemantic;
      if (semantic.platform || semantic.screenKind) return current;
    }
    current = parents.get(current);
  }
  return fallback;
}

export function prototypeFlows(
  store: Store,
  context: ShapeContext,
): {
  readonly flows: readonly PrototypeFlow[];
  readonly unreachable: readonly ElementId[];
  readonly dangling: readonly ElementId[];
} {
  const elements = store.getSnapshot().elements;
  const starts = elements.filter(
    (element) =>
      element.type === "frame" &&
      (element.semantic as FrameSemantic).prototypeStart &&
      !context.isHidden?.(element.id),
  );
  starts.sort((a, b) => {
    const sa = a.semantic as FrameSemantic;
    const sb = b.semantic as FrameSemantic;
    return (
      (sa.prototypeFlowName ?? sa.name).localeCompare(
        sb.prototypeFlowName ?? sb.name,
      ) || a.id.localeCompare(b.id)
    );
  });
  const links: PrototypeFlow["links"][number][] = [];
  const dangling: ElementId[] = [];
  for (const element of elements) {
    if (
      element.type !== "edge.generic" ||
      !(element.semantic as GenericEdgeSemantic).prototype ||
      context.isHidden?.(element.id)
    )
      continue;
    const semantic = element.semantic as GenericEdgeSemantic;
    const from = semantic.from && store.get(semantic.from);
    const to = semantic.to && store.get(semantic.to);
    const screen = from && screenFor(store, context, from.id);
    if (
      !from ||
      !to ||
      to.type !== "frame" ||
      !screen ||
      context.isHidden?.(from.id) ||
      context.isHidden?.(to.id)
    ) {
      dangling.push(element.id);
      continue;
    }
    links.push({
      id: element.id,
      from: from.id,
      screen,
      to: to.id,
      trigger: semantic.prototypeTrigger ?? "click",
      action: semantic.prototypeAction ?? "navigate",
    });
  }
  const reached = new Set<ElementId>();
  const flows = starts.map((start): PrototypeFlow => {
    const screens: ElementId[] = [];
    const flowLinks: PrototypeFlow["links"][number][] = [];
    const seen = new Set<ElementId>([start.id]);
    const queue = [start.id];
    for (const screen of queue) {
      screens.push(screen);
      reached.add(screen);
      for (const link of links) {
        if (link.screen !== screen) continue;
        flowLinks.push(link);
        if (link.action !== "back" && !seen.has(link.to)) {
          seen.add(link.to);
          queue.push(link.to);
        }
      }
    }
    const semantic = start.semantic as FrameSemantic;
    return {
      name: semantic.prototypeFlowName ?? semantic.name,
      startId: start.id,
      screens,
      links: flowLinks,
    };
  });
  const pages = new Set(starts.map((start) => start.page));
  const unreachable = elements
    .filter(
      (element) =>
        element.type === "frame" &&
        pages.has(element.page) &&
        !context.isHidden?.(element.id) &&
        Boolean(
          (element.semantic as FrameSemantic).platform ||
            (element.semantic as FrameSemantic).screenKind,
        ) &&
        !reached.has(element.id),
    )
    .map((element) => element.id);
  return { flows, unreachable, dangling };
}

export function persistentLayerPairs(
  store: Store,
  context: ShapeContext,
  fromScreen: ElementId,
  toScreen: ElementId,
): readonly { from: ElementId; to: ElementId }[] {
  const from = store.get(fromScreen);
  const to = store.get(toScreen);
  const fromBox = context.boundsOf(fromScreen);
  const toBox = context.boundsOf(toScreen);
  if (!from || !to || !fromBox || !toBox) return [];
  const children = (screen: Element) => {
    const parents = frameParents(store, screen.page, context, false);
    return store
      .getPageElements(screen.page)
      .filter(
        (element) =>
          parents.get(element.id) === screen.id &&
          element.visual.prototypeFixed &&
          !context.isHidden?.(element.id),
      );
  };
  const sources = children(from);
  const used = new Set<ElementId>();
  return children(to)
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((target) => {
      const targetBox = context.boundsOf(target.id);
      if (!targetBox) return [];
      const match = sources.find((source) => {
        if (used.has(source.id)) return false;
        const sourceBox = context.boundsOf(source.id);
        const sourceKit =
          source.type === "frame"
            ? (source.semantic as FrameSemantic).kit
            : undefined;
        const targetKit =
          target.type === "frame"
            ? (target.semantic as FrameSemantic).kit
            : undefined;
        const namesMatch = Boolean(
          source.visual.layerName &&
            source.visual.layerName === target.visual.layerName,
        );
        const kitsMatch = Boolean(
          source.type === "frame" &&
            target.type === "frame" &&
            (source.semantic as FrameSemantic).instanceOf &&
            (target.semantic as FrameSemantic).instanceOf &&
            sourceKit &&
            sourceKit === targetKit,
        );
        return (
          sourceBox &&
          (namesMatch || kitsMatch) &&
          Math.abs(sourceBox.x - fromBox.x - (targetBox.x - toBox.x)) <= 0.5 &&
          Math.abs(sourceBox.y - fromBox.y - (targetBox.y - toBox.y)) <= 0.5 &&
          Math.abs(sourceBox.width - targetBox.width) <= 0.5 &&
          Math.abs(sourceBox.height - targetBox.height) <= 0.5
        );
      });
      if (!match) return [];
      used.add(match.id);
      return [{ from: match.id, to: target.id }];
    });
}
