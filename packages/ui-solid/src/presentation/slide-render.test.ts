import { expect, test } from "bun:test";
import { svgViewBox } from "@nodetto/core";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { renderSlide } from "./slide-render.ts";

const page = {
  id: "p1",
  name: "One",
  kind: "freeform" as const,
  slideOrigin: { x: 100, y: -50 },
};
const shape = element({
  id: "a",
  page: "p1",
  type: "shape.geo",
  semantic: { geo: "rect", label: "" },
  visual: { x: 10, y: 10, width: 100, height: 100 },
});
const slideSize = { width: 1920, height: 1080 };

test("explicit slide renders its viewport and retains rect when empty", () => {
  const editor = makeEditor({
    document: { ...document([shape], [page]), slideSize },
  });
  const result = renderSlide(editor, "p1");
  expect(result.rect).toEqual({ x: 100, y: -50, ...slideSize });
  expect(result.svg).toContain('viewBox="100 -50 1920 1080"');
  const empty = makeEditor({
    document: { ...document([], [page]), slideSize },
  });
  expect(renderSlide(empty, "p1")).toEqual({
    svg: null,
    rect: { x: 100, y: -50, ...slideSize },
  });
});

test("unset slide derives rect from SVG and handles empty pages", () => {
  const editor = makeEditor({ document: document([shape], [page]) });
  const result = renderSlide(editor, "p1");
  expect(result.svg).toBe(editor.exportPageSvgOf("p1", { padding: 0 }));
  expect(result.svg).not.toBeNull();
  expect(result.rect).toEqual(svgViewBox(result.svg ?? ""));
  expect(
    renderSlide(makeEditor({ document: document([], [page]) }), "p1"),
  ).toEqual({ svg: null, rect: null });
});
