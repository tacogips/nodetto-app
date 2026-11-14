import { expect, test } from "bun:test";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { renderArtboardSvg, renderPageSvg } from "../svg-export.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import { slideSource, svgSize } from "./source.ts";
const registry = createDefaultRegistry();
const frame = (id: string, hidden = false) =>
  element({
    id,
    type: "frame",
    semantic: { name: id },
    visual: { x: 0, y: 0, width: 100, height: 100, hidden },
  });
const rect = element({
  id: "rect",
  type: "shape.geo",
  semantic: { geo: "rect", label: "" },
  visual: { x: 300, y: 300, width: 100, height: 100 },
});
test("inherited hidden frame uses page with visible content", () => {
  const group = element({
    id: "group",
    type: "group",
    semantic: { memberIds: ["frame"] },
    visual: { hidden: true },
  });
  const store = new Store(document([group, frame("frame"), rect]));
  expect(slideSource(store, registry, TEST_PAGE.id)).toEqual({ kind: "page" });
  const svg = renderPageSvg(store, registry, TEST_PAGE.id);
  expect(svg).not.toBeNull();
  expect(svg).toContain('data-id="rect"');
  expect(svgSize(svg as string)).toEqual({ width: 132, height: 132 });
});
test("exactly one visible frame selects an exportable artboard", () => {
  const store = new Store(document([frame("one"), frame("hidden", true)]));
  expect(slideSource(store, registry, TEST_PAGE.id)).toEqual({
    kind: "artboard",
    frameId: "one",
  });
  expect(renderArtboardSvg(store, registry, "one")).not.toBeNull();
  expect(
    slideSource(store, registry, TEST_PAGE.id, (id) => id === "one"),
  ).toEqual({ kind: "artboard", frameId: "hidden" });
});
test("zero or multiple visible frames use page", () => {
  expect(
    slideSource(new Store(document([rect])), registry, TEST_PAGE.id),
  ).toEqual({ kind: "page" });
  expect(
    slideSource(
      new Store(document([frame("a"), frame("b")])),
      registry,
      TEST_PAGE.id,
    ),
  ).toEqual({ kind: "page" });
});
test("SVG size reads only positive root dimensions", () => {
  expect(svgSize("<svg>")).toBeNull();
  expect(svgSize('<svg width="0" height="1">')).toBeNull();
  expect(svgSize('<svg width="1px" height="1">')).toBeNull();
  expect(svgSize('<svg><svg width="2" height="3"></svg>')).toBeNull();
});
