import { expect, test } from "bun:test";
import { svgExportMemberIds } from "../index.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { renderArtboardSvg, renderSelectionSvg } from "../svg-export.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";

const registry = createDefaultRegistry();
const shape = (id: string, x: number) =>
  element({
    id,
    type: "shape.geo",
    semantic: { geo: "rect", label: id },
    visual: { x, y: 10, width: 20, height: 20 },
  });

function renderedIds(svg: string | null): Set<string> {
  if (svg === null) throw new Error("expected SVG");
  return new Set(
    Array.from(
      svg.matchAll(/data-id="([^"]+)"/g),
      (match) => match[1] as string,
    ),
  );
}

test("group membership matches selection rendering", () => {
  const group = element({
    id: "group",
    type: "group",
    semantic: { memberIds: ["inside"] },
    visual: {},
  });
  const store = new Store(
    document([group, shape("inside", 10), shape("outside", 300)]),
  );
  const members = svgExportMemberIds(store, registry, TEST_PAGE.id, ["group"]);
  expect(members).toEqual(new Set(["group", "inside"]));
  expect(members).toEqual(
    renderedIds(
      renderSelectionSvg(store, registry, TEST_PAGE.id, new Set(["group"])),
    ),
  );
});

test("frame membership matches artboard rendering", () => {
  const frame = element({
    id: "frame",
    type: "frame",
    index: "a0",
    semantic: { name: "Frame" },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const store = new Store(
    document([frame, shape("inside", 10), shape("outside", 300)]),
  );
  const members = svgExportMemberIds(store, registry, TEST_PAGE.id, ["frame"]);
  expect(members).toEqual(new Set(["frame", "inside"]));
  expect(members).toEqual(
    renderedIds(renderArtboardSvg(store, registry, "frame")),
  );
  expect(members).toEqual(
    renderedIds(
      renderSelectionSvg(store, registry, TEST_PAGE.id, new Set(["frame"])),
    ),
  );
});

test("single non-container membership excludes other elements", () => {
  const store = new Store(
    document([shape("inside", 10), shape("outside", 300)]),
  );
  expect(svgExportMemberIds(store, registry, TEST_PAGE.id, ["inside"])).toEqual(
    new Set(["inside"]),
  );
});
