import { expect, test } from "bun:test";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { renderPageSvg } from "../svg-export.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import {
  scopeSvgIds,
  staggerStart,
  svgViewBox,
} from "./slide-transition-types.ts";

test("stagger starts increase and respect the budget", () => {
  expect(staggerStart(0, 1)).toBe(0);
  expect(staggerStart(3, 5)).toBe(180);
  expect(staggerStart(9, 21)).toBe(216);
  for (let rank = 1; rank < 21; rank++) {
    expect(staggerStart(rank, 21)).toBeGreaterThan(staggerStart(rank - 1, 21));
  }
});

const ids = (svg: string) =>
  Array.from(svg.matchAll(/\sid="([^"]+)"/g), (m) => m[1]);
const dataIds = (svg: string) =>
  Array.from(svg.matchAll(/\sdata-id="([^"]+)"/g), (m) => m[1]);

test("scoped real exports have disjoint ids and resolvable references", () => {
  const store = new Store(
    document([
      element({
        id: "gradient",
        type: "shape.geo",
        semantic: { geo: "rect" },
        visual: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          style: {
            fillGradient: {
              type: "linear",
              angle: 0,
              stops: [
                { offset: 0, color: "#000000" },
                { offset: 1, color: "#ffffff" },
              ],
            },
          },
        },
      }),
      element({
        id: "inside",
        type: "shape.geo",
        index: "a2",
        semantic: { geo: "rect" },
        visual: {
          x: 150,
          y: 0,
          width: 100,
          height: 100,
          style: {
            stroke: "#000000",
            strokeWidth: 4,
            strokeAlign: "inside",
            strokeSides: { left: 4 },
            shadow: { x: 30, y: 0, blur: 0, color: "#000000", opacity: 1 },
          },
        },
      }),
      element({
        id: "edge",
        type: "edge.generic",
        index: "a3",
        semantic: {
          fromPoint: { x: 0, y: 150 },
          toPoint: { x: 200, y: 150 },
          arrowheads: { end: "arrow" },
        },
      }),
    ]),
  );
  const svg = renderPageSvg(store, createDefaultRegistry(), TEST_PAGE.id);
  if (!svg) throw new Error("missing export");
  expect(svg).toContain("<linearGradient");
  expect(svg).toContain("nd-strokes-");
  expect(svg).toContain("<marker");
  expect(svg).toContain("<filter");
  const a = scopeSvgIds(svg, "a-");
  const b = scopeSvgIds(svg, "b-");
  const aIds = new Set(ids(a));
  const bIds = new Set(ids(b));
  expect(aIds.size).toBeGreaterThan(0);
  for (const id of aIds) expect(bIds.has(id)).toBe(false);
  for (const scoped of [a, b]) {
    const declared = new Set(ids(scoped));
    for (const match of scoped.matchAll(
      /url\(#([^)]*)\)|\s(?:xlink:)?href="#([^"]*)"/g,
    )) {
      expect(declared.has(match[1] ?? match[2])).toBe(true);
    }
    expect(dataIds(scoped)).toEqual(dataIds(svg));
  }
});

test("only declared ids and their references change", () => {
  const svg =
    '<svg data-id="a.b" data-layer="x"><defs><g id="a.b"/></defs><use href="#a.b" xlink:href="#a.b"/><path fill="url(#a.b)"/><use href="#external"/><image href="data:image/png;base64,abc"/></svg>';
  expect(scopeSvgIds(svg, "p-")).toBe(
    '<svg data-id="a.b" data-layer="x"><defs><g id="p-a.b"/></defs><use href="#p-a.b" xlink:href="#p-a.b"/><path fill="url(#p-a.b)"/><use href="#external"/><image href="data:image/png;base64,abc"/></svg>',
  );
  const noIds = '<svg data-id="x"><use href="#outside"/></svg>';
  expect(scopeSvgIds(noIds, "p-")).toBe(noIds);
});

test("viewBox requires four finite values and positive dimensions", () => {
  expect(svgViewBox('<svg viewBox="100 -50 1920 1080"></svg>')).toEqual({
    x: 100,
    y: -50,
    width: 1920,
    height: 1080,
  });
  expect(svgViewBox('<svg><g viewBox="0 0 1 1"/></svg>')).toBeNull();
  expect(svgViewBox('<svg viewBox="0 0 0 10"/>')).toBeNull();
  expect(svgViewBox('<svg viewBox="0 NaN 10 10"/>')).toBeNull();
});
