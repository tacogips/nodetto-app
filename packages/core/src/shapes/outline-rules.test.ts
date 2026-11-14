import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import { elementOutlinePolygon, geoOutlinePolygon } from "./outline.ts";

test("actor uses its box while person keeps its outline", () => {
  const box = { x: 0, y: 0, width: 100, height: 100 };
  expect(geoOutlinePolygon("actor", box)).toBeNull();
  expect(geoOutlinePolygon("person", box)).not.toBeNull();
});

test("single open contour uses bounds while closed contour has an outline", () => {
  const editor = new Editor();
  const points = [
    { x: 0, y: 0 },
    { x: 80, y: 30 },
    { x: 40, y: 70 },
  ];
  for (const closed of [false, undefined]) {
    const id = editor.createElement("draw.path", {
      semantic: {
        contours: [{ points, ...(closed === false ? { closed } : {}) }],
        fillRule: "nonzero",
      },
      visual: { x: 0, y: 0, width: 80, height: 70 },
    });
    const outline = elementOutlinePolygon(
      editor.store.get(id)!,
      editor.createShapeContext(),
    );
    if (closed === false) expect(outline).toBeNull();
    else expect(outline).not.toBeNull();
  }
});
