// Pure queries over one prototype screen (or overlay) view: which elements
// paint at the surface root, which stay fixed while the surface scrolls, and
// the clipping and scroll range a scrollable surface uses.

import {
  type Editor,
  groupOf,
  layerClipPolygons,
  polygonBounds,
  type prototypeScreen,
  rotatedBox,
  type ShapeContext,
} from "@nodetto/core";
import {
  type Element,
  type FrameSemantic,
  getElementTypeDefinition,
  type PrototypeOverflow,
} from "@nodetto/ir";
import {
  prototypeScrollRange,
  type PrototypeScrollPoint,
} from "./prototype-scroll.ts";

export type PrototypeView = NonNullable<ReturnType<typeof prototypeScreen>>;

export const prototypeElementsById = (
  view: PrototypeView,
): ReadonlyMap<string, Element> =>
  new Map(view.elements.map((element) => [element.id, element]));

export const prototypeVisualRoots = (
  runtime: Editor,
  view: PrototypeView,
): readonly Element[] => {
  const available = new Set(view.elements.map((element) => element.id));
  return view.elements.filter(
    (element) =>
      element.id !== view.frame.id &&
      !available.has(groupOf(runtime.store, element.id)?.id ?? ""),
  );
};

const prototypeVisualRoot = (
  runtime: Editor,
  view: PrototypeView,
  id: string,
): Element | undefined => {
  const available = new Set(view.elements.map((element) => element.id));
  let element = runtime.store.get(id);
  const visited = new Set<string>();
  while (element && !visited.has(element.id)) {
    visited.add(element.id);
    const group = groupOf(runtime.store, element.id);
    if (!group || !available.has(group.id)) return element;
    element = group;
  }
  return element;
};

export const prototypeIsFixed = (
  runtime: Editor,
  view: PrototypeView,
  id: string,
): boolean => {
  const root = prototypeVisualRoot(runtime, view, id);
  return (
    root?.visual.prototypeFixed === true &&
    getElementTypeDefinition(root.type)?.category !== "edge"
  );
};

export const prototypeScrollMode = (view: PrototypeView): PrototypeOverflow =>
  (view.frame.semantic as FrameSemantic).prototypeOverflow ?? "none";

export const prototypeSurfaceContext = (
  runtime: Editor,
  view: PrototypeView,
): ShapeContext => {
  const base = runtime.createShapeContext();
  if (prototypeScrollMode(view) === "none") return base;
  const polygons = layerClipPolygons(
    runtime.store,
    base,
    new Set([view.frame.id]),
  );
  return {
    ...base,
    clipPolygonOf: polygons,
    clipOf: (id) => {
      const polygon = polygons(id);
      return polygon ? polygonBounds(polygon) : null;
    },
  };
};

export const prototypeSurfaceScrollRange = (
  runtime: Editor,
  view: PrototypeView,
): PrototypeScrollPoint =>
  prototypeScrollRange(
    view.bounds,
    view.elements.flatMap((element) => {
      if (
        element.id === view.frame.id ||
        prototypeIsFixed(runtime, view, element.id)
      )
        return [];
      const box = runtime.getBounds(element.id);
      return box
        ? [
            rotatedBox(
              box,
              getElementTypeDefinition(element.type)?.category === "edge"
                ? 0
                : (element.visual.rotation ?? 0),
            ),
          ]
        : [];
    }),
  );
