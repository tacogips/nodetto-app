import { expect, test } from "bun:test";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import {
  renderArtboardSvg,
  renderPageSvg,
  renderSelectionSvg,
} from "./svg-export.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

const registry = createDefaultRegistry();

function frame(semantic: Record<string, unknown>, style = {}) {
  return element({
    id: "frame",
    type: "frame",
    semantic: { name: "Frame title", ...semantic },
    visual: { x: 100, y: 100, width: 390, height: 844, style },
  });
}

function titleY(svg: string): number {
  const match = svg.match(/<text\b[^>]*\by="([^"]+)"[^>]*>Frame title<\/text>/);
  if (!match) throw new Error("frame title missing");
  return Number(match[1]);
}

test("device title is outside page bounds and omitted from artboard and selection exports", () => {
  const store = new Store(document([frame({ platform: "ios" })]));
  const page = renderPageSvg(store, registry, TEST_PAGE.id, {
    padding: 0,
  }) as string;
  expect(titleY(page)).toBeLessThan(100);
  const viewBox = page.match(/viewBox="[^"]+"/)?.[0];
  expect(viewBox).toBeDefined();
  expect(Number(viewBox?.match(/viewBox="\S+ (\S+)/)?.[1])).toBeLessThan(94);
  expect(renderArtboardSvg(store, registry, "frame")).not.toContain(
    "Frame title",
  );
  expect(
    renderSelectionSvg(store, registry, TEST_PAGE.id, new Set(["frame"])),
  ).not.toContain("Frame title");
});

test("diagram and explicitly inside device titles remain inside", () => {
  for (const semantic of [{}, { platform: "ios", titlePlacement: "inside" }]) {
    const store = new Store(document([frame(semantic)]));
    const svg = renderPageSvg(store, registry, TEST_PAGE.id) as string;
    expect(titleY(svg)).toBeGreaterThan(100);
  }
});

test("a bottom-only frame stroke renders one strip", () => {
  const store = new Store(
    document([frame({}, { strokeSides: { bottom: 1 } })]),
  );
  const svg = renderPageSvg(store, registry, TEST_PAGE.id) as string;
  expect(svg).toContain('<rect x="100" y="943" width="390" height="1"');
  expect(svg.match(/<rect\b/g)?.length).toBe(1);
});
