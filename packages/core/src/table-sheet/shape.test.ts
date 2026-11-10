import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import type { ShapeContext } from "../shape-util.ts";
import { tableSheetBounds } from "./layout.ts";
import { defaultTableSheetSemantic, tableSheetShapeUtil } from "./shape.ts";
const context = {} as ShapeContext;
const element = {
  visual: { x: 0, y: 0, width: 999 },
  semantic: defaultTableSheetSemantic(),
} as Element;
test("shape bounds ignore stored dimensions", () => {
  expect(tableSheetShapeUtil.getBounds(element, context)).toEqual(
    tableSheetBounds(element.visual, element.semantic),
  );
  expect(tableSheetShapeUtil.getBounds(element, context)?.width).toBe(360);
});
test("shape hit test and resize", () => {
  expect(tableSheetShapeUtil.hitTest(element, { x: 10, y: 10 }, context)).toBe(
    true,
  );
  expect(tableSheetShapeUtil.hitTest(element, { x: 400, y: 10 }, context)).toBe(
    false,
  );
  expect(tableSheetShapeUtil.canResize).toBe(false);
  expect(tableSheetShapeUtil.resize).toBeUndefined();
});
test("fresh default semantic ids and visual", () => {
  const a = defaultTableSheetSemantic();
  const b = defaultTableSheetSemantic();
  expect(a.columns.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  expect(a.rows.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  expect(a).not.toBe(b);
  expect(a.columns[0]).not.toBe(b.columns[0]);
  expect(tableSheetShapeUtil.defaultVisual()).toEqual({ x: 0, y: 0 });
});
