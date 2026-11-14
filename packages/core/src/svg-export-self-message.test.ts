import { describe, expect, test } from "bun:test";
import type { Visual } from "@nodetto/ir";
import { connectorLabelLayout } from "./label-layout.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { Store } from "./store.ts";
import { renderPageSvg } from "./svg-export.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

function svg(
  label = "",
  visual: Visual = {},
  kind = "sync",
  normal = false,
): string {
  const participant = element({
    id: "a",
    type: "sequence.participant",
    semantic: { name: "", kind: "service", order: "a1" },
    visual: { x: 0, y: 0, width: 160, height: 300 },
  });
  const other = element({
    id: "b",
    index: "a2",
    type: "sequence.participant",
    semantic: { name: "", kind: "service", order: "a2" },
    visual: { x: 280, y: 0, width: 160, height: 300 },
  });
  const message = element({
    id: "m",
    index: "a3",
    type: "sequence.message",
    semantic: { from: "a", to: normal ? "b" : "a", order: "b1", kind, label },
    visual: { y: 120, ...visual },
  });
  const result = renderPageSvg(
    new Store(
      document(normal ? [participant, other, message] : [participant, message]),
    ),
    createDefaultRegistry(),
    TEST_PAGE.id,
  );
  if (!result) throw new Error("expected SVG");
  return result;
}

function viewBox(value: string): number[] {
  const match = /viewBox="([^"]+)"/.exec(value);
  if (!match?.[1]) throw new Error("missing viewBox");
  return match[1].split(" ").map(Number);
}
function right(value: string): number {
  const box = viewBox(value);
  return (box[0] ?? 0) + (box[2] ?? 0);
}

describe("self-message SVG export", () => {
  for (const kind of ["sync", "async", "return"]) {
    test(`${kind} paints a loop and start-anchored label`, () => {
      const output = svg("check", {}, kind);
      expect(output).toContain('points="80,120 120,120 120,152 80,152"');
      expect(output).toContain('marker-end="url(#nodetto-arrow)"');
      const line = output.match(/<polyline[^>]+>/)?.[0] ?? "";
      if (kind === "return") expect(line).toContain('stroke-dasharray="6 4"');
      else expect(line).not.toContain("stroke-dasharray");
      expect(output).toMatch(
        /<text x="128"[^>]*text-anchor="start"[^>]*>check<\/text>/,
      );
    });
  }
  test("bounds wide glyphs and positive and negative spacing", () => {
    expect(
      right(
        svg("W".repeat(26), { style: { fontSize: 11, fontFamily: "Arial" } }),
      ),
    ).toBeCloseTo(472.9);
    expect(
      right(svg("W".repeat(6), { style: { letterSpacing: 20 } })),
    ).toBeCloseTo(339.9);
    expect(
      right(svg("W".repeat(6), { style: { letterSpacing: -5 } })),
    ).toBeCloseTo(219.9);
  });
  test("uses the longest wrapped line", () => {
    const label = `${"W".repeat(20)}\n${"W".repeat(10)}`;
    const layout = connectorLabelLayout(label, { y: 120 });
    expect(layout.lines.length).toBe(2);
    expect(right(svg(label))).toBeCloseTo(128 + 20 * 11 * 1.15 + 16);
  });
  test("short labels do not enlarge the viewBox", () => {
    expect(viewBox(svg("Hi"))).toEqual(viewBox(svg()));
  });
  test("other connectors do not enlarge the viewBox and remain centered", () => {
    const output = svg("W".repeat(60), {}, "sync", true);
    expect(viewBox(output)).toEqual(viewBox(svg("", {}, "sync", true)));
    expect(output).toContain('text-anchor="middle"');
  });
  test("hidden messages add no label bounds", () => {
    expect(viewBox(svg("W".repeat(26), { hidden: true }))).toEqual(
      viewBox(svg("", { hidden: true })),
    );
  });
});
