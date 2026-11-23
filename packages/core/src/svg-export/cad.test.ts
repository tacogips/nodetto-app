import { expect, test } from "bun:test";
import { createShapeContext } from "../hit-test.ts";
import { Editor } from "../index.ts";
import {
  CAD_TEST_PAGE,
  extrude,
  plateElements,
  rectangle,
  sketch,
} from "../cad/testing/documents.ts";
import { document, element } from "../test-helpers.ts";
import { renderElementsSvg } from "./document.ts";

test("CAD page exports one fitted path and a caption with the export theme", () => {
  const editor = new Editor({
    document: document(plateElements(), [CAD_TEST_PAGE]),
  });
  const options = {
    viewport: { x: 10, y: 20, width: 200, height: 140 },
    background: "white",
    theme: { ink: "navy", fontFamily: "sans-serif" },
  };
  const svg = editor.exportPageSvg(options);
  expect(svg).toContain('viewBox="10 20 200 140"');
  expect(svg?.match(/<path /g)).toHaveLength(1);
  expect(svg).toContain('stroke="navy"');
  expect(svg).toContain('font-family="sans-serif"');
  expect(svg).toContain(">Construction view</text>");
  expect(svg).toBe(editor.exportPageSvg(options));
});

test("an empty CAD page exports like an empty drawing", () => {
  const editor = new Editor({ document: document([], [CAD_TEST_PAGE]) });
  expect(editor.exportPageSvg()).toBeNull();
});

test("the default construction frame fits large parts at a raster-friendly size", () => {
  const editor = new Editor({
    document: document(
      [
        sketch("wide", "a1"),
        ...rectangle("wide", -5000, -5000, 10000, 10000),
        extrude("plate", "a2", { sketch: "wide", distance: 5, op: "new" }),
      ],
      [CAD_TEST_PAGE],
    ),
  });
  const svg = editor.exportPageSvg();
  expect(svg).toContain('viewBox="0 0 1920 1080"');
  expect(svg?.match(/<path /g)).toHaveLength(1);
});

test("the non-CAD page entry point preserves the existing renderer's bytes", () => {
  const editor = new Editor({
    document: document([
      element({
        id: "rectangle",
        type: "shape.geo",
        semantic: { geo: "rect" },
        visual: { x: 10, y: 20, width: 80, height: 40 },
      }),
    ]),
  });
  const expected = renderElementsSvg(
    editor.store.getPageElements(editor.currentPageId),
    editor.registry,
    createShapeContext(editor.store, editor.registry, 1),
  );
  expect(expected).toContain("<rect ");
  expect(editor.exportPageSvg()).toBe(expected);
});
