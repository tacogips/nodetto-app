import type { TableSheetSemantic } from "@nodetto/ir";
import { boxContains } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";
import { tableSheetBounds } from "./layout.ts";

export function defaultTableSheetSemantic(): TableSheetSemantic {
  return {
    columns: [
      { id: "c1", name: "Name", type: "text", width: 160 },
      {
        id: "c2",
        name: "Status",
        type: "select",
        width: 120,
        options: ["Todo", "Doing", "Done"],
      },
      { id: "c3", name: "Done", type: "checkbox", width: 80 },
    ],
    rows: [
      { id: "r1", cells: {} },
      { id: "r2", cells: {} },
      { id: "r3", cells: {} },
    ],
  };
}

export const tableSheetShapeUtil: ShapeUtil = {
  type: "table.sheet",
  canResize: false,
  getBounds(element) {
    return tableSheetBounds(element.visual, element.semantic);
  },
  hitTest(element, point) {
    return boxContains(
      tableSheetBounds(element.visual, element.semantic),
      point,
    );
  },
  defaultVisual() {
    return { x: 0, y: 0 };
  },
  defaultSemantic: defaultTableSheetSemantic,
};
