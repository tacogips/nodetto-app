import type { Element, ElementId, PageId } from "@nodetto/ir";
import type { Command } from "../commands.ts";
import { compareFractional, keyAfter } from "../fractional.ts";
import { createShapeContext } from "../hit-test.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { Store } from "../store.ts";
import { viewBounds } from "../view-bounds.ts";
import { pageFlowOf, pageFramesInFlowOrder, type PageFlow } from "./order.ts";
import {
  planAddPageFrameGeometry,
  planReflowPageFrames,
  planShiftPageFrames,
  type PageFrameGeometry,
} from "./plan.ts";
import type { PageOrientation } from "./presets.ts";

function geometries(
  store: Store,
  registry: ShapeUtilRegistry,
  frames: readonly Element[],
): PageFrameGeometry[] {
  const context = createShapeContext(store, registry, 1);
  return frames.flatMap((frame) => {
    const box = viewBounds(store, [frame.id], context);
    const semantic = frame.semantic as {
      page: { size: string; orientation: PageOrientation };
    };
    return box ? [{ id: frame.id, ...box, page: semantic.page }] : [];
  });
}

export function planAddPageFrame(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  input: {
    id: ElementId;
    anchorId: ElementId | null;
    size?: string;
    orientation?: PageOrientation;
  },
): { commands: Command[]; id: ElementId } | null {
  const page = store.getPage(pageId);
  if (!page) return null;
  const elements = store.getPageElements(pageId);
  const frames = geometries(
    store,
    registry,
    pageFramesInFlowOrder(store, registry, pageId),
  );
  const context = createShapeContext(store, registry, 1);
  const contentBounds = viewBounds(
    store,
    elements.map((element) => element.id),
    context,
  );
  const geometry = planAddPageFrameGeometry({
    flow: pageFlowOf(page),
    frames,
    anchorId: input.anchorId ?? frames.at(-1)?.id ?? null,
    contentBounds,
    size: input.size,
    orientation: input.orientation,
  });
  const names = new Set(
    elements
      .filter((element) => element.type === "frame")
      .map((element) => (element.semantic as { name?: string }).name),
  );
  let n = 1;
  while (names.has(`Page ${n}`)) n++;
  const last = elements.reduce<string | null>(
    (top, element) =>
      top === null || compareFractional(element.index, top) > 0
        ? element.index
        : top,
    null,
  );
  const element: Element = {
    id: input.id,
    page: pageId,
    type: "frame",
    index: keyAfter(last),
    semantic: {
      name: `Page ${n}`,
      page: { size: geometry.size, orientation: geometry.orientation },
      showTitle: false,
      clipContent: true,
    },
    visual: {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      style: { fill: "#ffffff" },
    },
  };
  return {
    id: input.id,
    commands: [
      { type: "createElement", element },
      ...planShiftPageFrames(store, registry, geometry.shifted),
    ],
  };
}

export function planSetPageFlow(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  flow: PageFlow,
): Command[] {
  const page = store.getPage(pageId);
  if (!page || pageFlowOf(page) === flow) return [];
  const frames = geometries(
    store,
    registry,
    pageFramesInFlowOrder(store, registry, pageId),
  );
  return [
    {
      type: "updatePage",
      id: pageId,
      page: { pageFlow: flow === "vertical" ? null : "horizontal" },
    },
    ...planShiftPageFrames(store, registry, planReflowPageFrames(frames, flow)),
  ];
}
