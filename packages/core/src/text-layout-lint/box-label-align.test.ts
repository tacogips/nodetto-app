import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { labelOverflow } from "./rules.ts";

test("box label overflow respects opt-in vertical padding", () => {
  const editor = new Editor();
  for (const type of ["node.generic", "shape.geo"] as const) {
    for (const verticalAlign of ["top", "bottom"] as const) {
      const element = editor.buildElement(type, {
        semantic: {
          label: "Widget",
          ...(type === "shape.geo" ? { geo: "rect" } : {}),
        },
        visual: {
          width: 100,
          height: 20,
          style: { verticalAlign, boxLabelAlign: true },
        },
      });
      const box = { x: 0, y: 0, width: 100, height: 20 };
      expect(labelOverflow({ element, box, order: 0 })).toHaveLength(1);
      expect(
        labelOverflow({
          element: {
            ...element,
            visual: { ...element.visual, style: { verticalAlign } },
          },
          box,
          order: 0,
        }),
      ).toHaveLength(0);
    }
  }
});
