import {
  getElementTypeDefinition,
  type Element,
  type ElementId,
  type FrameSemantic,
  type GenericEdgeSemantic,
  type Page,
  type UiControlSemantic,
} from "@nodetto/ir";
import {
  componentGeometryValue,
  componentValuesEqual,
} from "../component-refresh.ts";
import { frameParents } from "../frame-tree.ts";
import type { Box } from "../geometry.ts";
import type { ShapeContext } from "../shape-util.ts";
import type { Store } from "../store.ts";

export interface LintNode {
  readonly element: Element;
  readonly box: Box;
  readonly screenId?: ElementId;
  readonly parentId?: ElementId;
  readonly instanceId?: ElementId;
  readonly inInstance: boolean;
  readonly geometryOverridden: boolean;
}

function frameSemantic(
  element: Element | undefined,
): FrameSemantic | undefined {
  return element?.type === "frame"
    ? (element.semantic as FrameSemantic)
    : undefined;
}

function isScreen(element: Element | undefined): boolean {
  const semantic = frameSemantic(element);
  return Boolean(
    semantic &&
      (semantic.screenKind ||
        ["ios", "android", "web"].includes(semantic.platform ?? "")),
  );
}

export function isAppLintPage(store: Store, page: Page): boolean {
  return (
    page.mode === "app" ||
    page.mode === "web" ||
    store.getPageElements(page.id).some(isScreen)
  );
}

function baseline(
  value: string | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function geometryOverridden(element: Element, instance: Element): boolean {
  const semantic = frameSemantic(instance);
  const bindings = semantic?.instanceBindings;
  const item = bindings?.find((binding) => binding.target === element.id);
  const root = bindings?.find(
    (binding) =>
      binding.target === instance.id && binding.source === semantic?.instanceOf,
  );
  const geometry = baseline(item?.baseline)?.geometry;
  const rootGeometry = baseline(root?.baseline)?.geometry;
  if (
    !geometry ||
    typeof geometry !== "object" ||
    !rootGeometry ||
    typeof rootGeometry !== "object"
  )
    return false;
  return (["x", "y", "width", "height"] as const).some(
    (field) =>
      !componentValuesEqual(
        element.visual[field],
        componentGeometryValue(
          field,
          geometry as Record<string, unknown>,
          rootGeometry as Record<string, unknown>,
          instance,
          element.id === instance.id,
        ),
      ),
  );
}

export function collectLintNodes(
  store: Store,
  page: Page,
  context: ShapeContext,
): readonly LintNode[] {
  const parents = frameParents(store, page.id, context, false);
  const nodes: LintNode[] = [];
  for (const element of store.getPageElements(page.id)) {
    if (getElementTypeDefinition(element.type)?.category === "edge") continue;
    const box = context.boundsOf(element.id);
    if (!box) continue;
    const ancestors: Element[] = [];
    const seen = new Set<ElementId>([element.id]);
    let parentId = parents.get(element.id);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = store.get(parentId);
      if (!parent) break;
      ancestors.push(parent);
      parentId = parents.get(parentId);
    }
    if (
      [element, ...ancestors].some(
        (item) => item.visual.hidden || frameSemantic(item)?.component,
      ) ||
      context.isHidden?.(element.id)
    )
      continue;
    const instance = ancestors.find((item) => frameSemantic(item)?.instanceOf);
    const screen = [...ancestors].reverse().concat(element).find(isScreen);
    nodes.push({
      element,
      box,
      ...(screen ? { screenId: screen.id } : {}),
      ...(parents.get(element.id) ? { parentId: parents.get(element.id) } : {}),
      ...(instance ? { instanceId: instance.id } : {}),
      inInstance: Boolean(instance),
      geometryOverridden: instance
        ? geometryOverridden(element, instance)
        : false,
    });
  }
  return nodes;
}

export function isPrototypeSource(id: ElementId, store: Store): boolean {
  const element = store.get(id);
  return Boolean(
    element &&
      store.getPageElements(element.page).some((candidate) => {
        if (candidate.type !== "edge.generic") return false;
        const semantic = candidate.semantic as GenericEdgeSemantic;
        return Boolean(semantic.prototype && semantic.from === id);
      }),
  );
}

const INTERACTIVE_KITS = new Set([
  "ios:list-row",
  "ios:chip",
  "ios:fab",
  "ios:icon-button",
  "ios:search-field",
  "ios:text-field",
  "ios:segmented",
]);
export function isInteractive(node: LintNode, store: Store): boolean {
  const element = node.element;
  if (
    element.type === "ui.control" &&
    (element.semantic as UiControlSemantic).control !== "progress"
  )
    return true;
  if (isPrototypeSource(element.id, store)) return true;
  const semantic = frameSemantic(element);
  if (
    semantic?.instanceOf &&
    semantic.kit &&
    INTERACTIVE_KITS.has(semantic.kit.replace(/@\d+$/, ""))
  )
    return true;
  if (
    element.type !== "frame" ||
    !/^item\d+$/.test(element.visual.componentKey ?? "")
  )
    return false;
  const instance = node.instanceId
    ? frameSemantic(store.get(node.instanceId))
    : undefined;
  const kit = instance?.kit?.replace(/@\d+$/, "");
  return kit === "ios:tab-bar" || kit === "ios:top-tabs";
}

export function touchMinimum(screen: Element | undefined): number | undefined {
  const platform = frameSemantic(screen)?.platform;
  return platform === "ios" ? 44 : platform === "android" ? 48 : undefined;
}
