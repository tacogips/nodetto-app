import { boxContains } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";

export const uiIconShapeUtil: ShapeUtil = {
  type: "ui.icon",
  canResize: true,
  getBounds: (element) => ({
    x: element.visual.x ?? 0,
    y: element.visual.y ?? 0,
    width: element.visual.width ?? 24,
    height: element.visual.height ?? 24,
  }),
  hitTest(element, point, context) {
    const box = this.getBounds(element, context);
    return Boolean(box && boxContains(box, point));
  },
  resize: (_element, box) => ({ visual: { ...box } }),
  defaultSemantic: () => ({ icon: "square" }),
  defaultVisual: () => ({
    x: 0,
    y: 0,
    width: 24,
    height: 24,
    style: { stroke: "#000000", strokeWidth: 2 },
  }),
};
