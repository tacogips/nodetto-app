import { expect, test } from "bun:test";
import { fitSlide, svgSize } from "@nodetto/core";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { createPresentationController } from "./controller.ts";
const page = {
  id: "p1",
  name: "One",
  kind: "freeform" as const,
  slideOrigin: { x: 100, y: -50 },
};
const size = { width: 1920, height: 1080 };
const shape = (id: string, x: number) =>
  element({
    id,
    page: "p1",
    type: "shape.geo",
    semantic: { geo: "rect", label: "" },
    visual: { x, y: x, width: 100, height: 100 },
  });
const controllerFor = (editor: ReturnType<typeof makeEditor>) =>
  createPresentationController({ editor, from: "p1", onExit: () => {} });
test("explicit slide uses exact viewport and fit", () => {
  const editor = makeEditor({
    document: {
      ...document([shape("a", 10), shape("b", 5000)], [page]),
      slideSize: size,
    },
  });
  const controller = controllerFor(editor);
  expect(controller.slide().size).toEqual(size);
  const svg = decodeURIComponent(controller.slide().src ?? "");
  expect(svg).toContain('viewBox="100 -50 1920 1080"');
  expect(svg).toContain('width="1920"');
  expect(svg).toContain('height="1080"');
  expect(controller.layout({ width: 1000, height: 1000 })).toEqual(
    fitSlide(size, { width: 1000, height: 1000 }),
  );
});
test("empty explicit slide keeps size", () => {
  const controller = controllerFor(
    makeEditor({ document: { ...document([], [page]), slideSize: size } }),
  );
  expect(controller.slide()).toEqual({ src: null, size });
  const layout = controller.layout({ width: 1000, height: 1000 });
  expect(layout.width / layout.height).toBeCloseTo(16 / 9);
});
test("unset slide uses original content export", () => {
  const editor = makeEditor({ document: document([shape("a", 10)], [page]) });
  const svg = editor.exportPageSvgOf("p1", { padding: 0 });
  expect(controllerFor(editor).slide()).toEqual({
    src: svg
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      : null,
    size: svg ? svgSize(svg) : null,
  });
});
