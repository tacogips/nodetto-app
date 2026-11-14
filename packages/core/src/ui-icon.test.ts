import { describe, expect, test } from "bun:test";
import { shapeAuthoringWarnings } from "./shape-warnings.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import { renderPageSvg } from "./svg-export.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

describe("ui.icon export", () => {
  const icon = (semantic: Record<string, unknown>, style = {}) =>
    element({
      id: "icon",
      type: "ui.icon",
      index: "a1",
      semantic,
      visual: { x: 0, y: 0, width: 48, height: 48, style },
    });
  const svg = (item: ReturnType<typeof icon>) =>
    renderPageSvg(
      new Store(document([item])),
      createDefaultRegistry(),
      TEST_PAGE.id,
    ) ?? "";

  test("renders named icons with default paint and viewBox scaling", () => {
    const result = svg(icon({ icon: "bell" }));
    expect(result).toContain("scale(2)");
    expect(result).toContain('stroke="#000000"');
  });
  test("unknown names render a placeholder and authoring warning", () => {
    const item = icon({ icon: "nope" });
    expect(svg(item)).toContain("stroke-dasharray");
    expect(
      shapeAuthoringWarnings(item, { resolve: () => undefined }),
    ).toContain(
      'Unknown icon "nope". Search with nodetto-cli shapes icon <query>.',
    );
  });
  test("custom path honors fill and stroke width", () => {
    const result = svg(
      icon({ path: "M0 0L24 24" }, { fill: "#ff0000", strokeWidth: 1.5 }),
    );
    expect(result).toContain('fill="#ff0000"');
    expect(result).toContain('stroke-width="1.5"');
  });
  test("respects rotation and horizontal flip", () => {
    const item = icon({ icon: "bell" });
    const result = svg({
      ...item,
      visual: { ...item.visual, flipX: true, rotation: 90 },
    });
    expect(result).toContain("rotate(90 24 24)");
    expect(result).toContain("scale(-1 1)");
  });
});
