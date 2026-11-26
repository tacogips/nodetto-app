import { describe, expect, test } from "bun:test";
import {
  SCHEMATIC_ELEMENT_TYPES,
  type Document,
  type Element,
} from "@nodetto/ir";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { renderPageSvg } from "../svg-export.ts";
import { schematicDefaultSemantic } from "./symbols.ts";

function document(): Document {
  const elements: Element[] = SCHEMATIC_ELEMENT_TYPES.map((type, i) => ({
    id: `element-${i}`,
    page: "page",
    type,
    index: `a${String(i).padStart(3, "0")}`,
    semantic:
      i < 14
        ? schematicDefaultSemantic(
            type as Parameters<typeof schematicDefaultSemantic>[0],
          )
        : type === "schematic.wire"
          ? {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
              ],
            }
          : type === "schematic.label"
            ? { net: "SIGNAL" }
            : {},
    visual: {
      x: i * 120,
      y: 100,
      ...(i === 0 ? { rotation: 90, flipX: true } : {}),
    },
  }));
  return {
    schemaVersion: 1,
    id: "doc",
    title: "Schematic",
    pages: [{ id: "page", name: "Circuit", kind: "schematic" }],
    elements,
  };
}
function svg(ink: string): string {
  const result = renderPageSvg(
    new Store(document()),
    createDefaultRegistry(),
    "page",
    { padding: 0, theme: { ink } },
  );
  if (!result) throw new Error("expected SVG");
  return result;
}

describe("schematic SVG export", () => {
  test("renders every schematic type using shared notation", () => {
    const output = svg("#123456");
    for (const type of SCHEMATIC_ELEMENT_TYPES)
      expect(output).toContain(`data-type="${type}"`);
    for (const role of ["resistor", "junction", "label"])
      expect(output).toContain(`class="schematic-${role}"`);
    expect(output).not.toContain("scale(-1");
  });
  test("keeps rotated labels upright and applies theme ink", () => {
    const dark = svg("#eeeeee");
    const light = svg("#111111");
    const start = dark.indexOf('<g data-id="element-0"');
    const end = dark.indexOf("</g>", start);
    const label = dark.indexOf('class="schematic-ref"', end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(dark.slice(start, end)).toContain("rotate(90");
    expect(label).toBeGreaterThan(end);
    expect(dark.slice(end, label)).not.toContain('<g transform="rotate');
    expect(dark).toContain('stroke="#eeeeee"');
    expect(light).toContain('stroke="#111111"');
    expect(dark).not.toEqual(light);
  });
});
