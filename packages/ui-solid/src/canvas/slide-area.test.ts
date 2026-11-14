import { expect, test } from "bun:test";
import { renderPageSvg } from "@nodetto/core";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { effectiveShowSlideArea, slideAreaModel } from "./slide-area.ts";

test("visibility and model follow explicit preferences and rect kind", () => {
  const size = { width: 1920, height: 1080 };
  expect(effectiveShowSlideArea(undefined, size)).toBe(true);
  expect(effectiveShowSlideArea(undefined, undefined)).toBe(false);
  expect(effectiveShowSlideArea(false, size)).toBe(false);
  expect(effectiveShowSlideArea(true, undefined)).toBe(true);
  const rect = { kind: "explicit" as const, x: 0, y: 0, ...size };
  expect(slideAreaModel({ rect, label: "Slide 1 / 1", show: true })).toEqual({
    rect,
    label: "Slide 1 / 1",
    dim: true,
  });
  const content = { ...rect, kind: "content" as const };
  expect(slideAreaModel({ rect: content, label: null, show: true })?.dim).toBe(
    false,
  );
  expect(slideAreaModel({ rect, label: null, show: false })).toBeNull();
  expect(slideAreaModel({ rect: null, label: null, show: true })).toBeNull();
});
test("core SVG export excludes overlay", () => {
  const shape = element({
    id: "a",
    page: "p1",
    type: "shape.geo",
    semantic: { geo: "rect", label: "" },
    visual: { x: 0, y: 0, width: 10, height: 10 },
  });
  const editor = makeEditor({
    document: {
      ...document([shape], [{ id: "p1", name: "One", kind: "freeform" }]),
      slideSize: { width: 1920, height: 1080 },
    },
  });
  const svg = renderPageSvg(
    editor.store,
    editor.registry,
    editor.currentPageId,
  );
  expect(svg).not.toBeNull();
  expect(svg ?? "").not.toContain("nodetto-slide-area");
});
