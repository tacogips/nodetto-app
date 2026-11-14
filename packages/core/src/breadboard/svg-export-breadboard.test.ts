import { describe, expect, test } from "bun:test";
import { buildBreadboardDocument } from "./test-builder.ts";
import { createDefaultRegistry } from "../shapes/index.ts";
import { Store } from "../store.ts";
import { renderPageSvg } from "../svg-export.ts";

const registry = createDefaultRegistry();
function svgFor(document: ReturnType<typeof buildBreadboardDocument>): string {
  const store = new Store(document);
  const result = renderPageSvg(store, registry, "breadboard-page", {
    padding: 0,
  });
  if (result === null) throw new Error("expected breadboard SVG");
  return result;
}
function count(svg: string, needle: string): number {
  return svg.split(needle).length - 1;
}

describe("breadboard SVG export", () => {
  test("default registry wire bounds enclose every point without visual dimensions", () => {
    const document = buildBreadboardDocument({
      boards: [],
      wires: [
        {
          id: "wire-1",
          points: [
            { x: 100, y: 100 },
            { x: 130, y: 100 },
            { x: 130, y: 120 },
          ],
        },
      ],
    });
    const svg = svgFor(document);
    const match = svg.match(
      /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const [, xRaw, yRaw, widthRaw, heightRaw] = match;
    const x = Number(xRaw);
    const y = Number(yRaw);
    const width = Number(widthRaw);
    const height = Number(heightRaw);
    for (const point of [
      { x: 100, y: 100 },
      { x: 130, y: 100 },
      { x: 130, y: 120 },
    ]) {
      expect(point.x).toBeGreaterThanOrEqual(x);
      expect(point.x).toBeLessThanOrEqual(x + width);
      expect(point.y).toBeGreaterThanOrEqual(y);
      expect(point.y).toBeLessThanOrEqual(y + height);
    }
    expect(
      document.elements.find(({ id }) => id === "wire-1")?.visual.width,
    ).toBeUndefined();
    expect(
      document.elements.find(({ id }) => id === "wire-1")?.visual.height,
    ).toBeUndefined();
  });

  test("renders board holes, resistor bands, LED polarity and wire ends", () => {
    const svg = svgFor(
      buildBreadboardDocument({
        boards: [{ id: "board-1", size: "half" }],
        parts: [
          {
            id: "resistor-1",
            type: "breadboard.resistor",
            reference: "R1",
            value: "220",
            pin1: { x: 430, y: 50 },
          },
          {
            id: "led-1",
            type: "breadboard.led",
            reference: "D1",
            value: "red",
            pin1: { x: 500, y: 50 },
          },
        ],
        wires: [
          {
            id: "wire-1",
            points: [
              { x: 550, y: 60 },
              { x: 580, y: 60 },
            ],
          },
        ],
      }),
    );
    expect(count(svg, 'class="breadboard-board-hole"')).toBe(400);
    expect(count(svg, 'class="breadboard-resistor-band-')).toBe(4);
    expect(count(svg, 'class="breadboard-led-flat"')).toBe(1);
    expect(count(svg, 'class="breadboard-wire-end"')).toBe(2);
  });

  test("renders a rotated part label outside its rotated element group", () => {
    const svg = svgFor(
      buildBreadboardDocument({
        boards: [],
        parts: [
          {
            id: "led-1",
            type: "breadboard.led",
            reference: "D1",
            value: "red",
            pin1: { x: 100, y: 100 },
            rotation: 90,
          },
        ],
      }),
    );
    const groupStart = svg.indexOf(
      '<g data-id="led-1" data-type="breadboard.led"',
    );
    const groupEnd = svg.indexOf("</g>", groupStart);
    const label = svg.indexOf('class="breadboard-breadboard-label"', groupEnd);
    expect(groupStart).toBeGreaterThanOrEqual(0);
    expect(svg.slice(groupStart, groupEnd)).toContain("rotate(90");
    expect(label).toBeGreaterThan(groupEnd);
    expect(svg.slice(groupEnd, label)).not.toContain('<g transform="rotate');
  });

  test("dims secondary target netlist cards", () => {
    const document = buildBreadboardDocument({ boards: [] });
    const first = document.elements.find(
      ({ type }) => type === "breadboard.netlist",
    );
    const card = (id: string, index: string) => ({
      id,
      page: "breadboard-page",
      type: "breadboard.netlist",
      index,
      semantic: {
        source: `${id}.net`,
        format: "kicad_net",
        parts: [],
        nets: [],
      },
      visual: { x: 100, y: 100, width: 160, height: 40 },
    });
    const svg = svgFor({
      ...document,
      elements: [
        ...document.elements,
        card("first-card", "a001"),
        card("second-card", "a002"),
      ],
    });
    expect(first).toBeUndefined();
    expect(count(svg, 'class="breadboard-netlist-card"')).toBe(2);
    const secondCard = svg.indexOf('data-id="second-card"');
    const cardMarkup = svg.slice(secondCard, svg.indexOf("</g>", secondCard));
    expect(cardMarkup).toContain('class="breadboard-netlist-card"');
    expect(cardMarkup).toContain('opacity="0.5"');
  });
});
