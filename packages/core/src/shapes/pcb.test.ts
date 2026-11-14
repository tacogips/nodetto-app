import { describe, expect, test } from "bun:test";
import {
  PCB_ELEMENT_TYPES,
  getElementTypeDefinition,
  type Element,
} from "@nodetto/ir";
import { element } from "../test-helpers.ts";
import { createDefaultRegistry } from "./index.ts";

const registry = createDefaultRegistry();
const page = "pcb-page";

function pcbElement(type: string, semantic: unknown, visual = {}): Element {
  return element({ id: type, type, page, semantic, visual });
}

describe("PCB shape utilities", () => {
  test("registers one fixed-size util with a valid default for every PCB type", () => {
    for (const type of PCB_ELEMENT_TYPES) {
      const util = registry.get(type);
      expect(util?.type).toBe(type);
      expect(util?.canResize).toBe(false);
      expect(util?.defaultVisual()).toEqual({});
      expect(
        getElementTypeDefinition(type)?.validateSemantic(
          util?.defaultSemantic(),
          "semantic",
        ),
      ).toEqual([]);
    }
  });

  test("uses footprint semantic bounds in page units, independent of visual geometry", () => {
    const footprint = pcbElement(
      "pcb.footprint",
      {
        reference: "J1",
        value: "Conn",
        library: "",
        at: [10, 10],
        rotation: 0,
        side: "top",
        pads: [
          {
            number: "1",
            type: "smd",
            shape: "rect",
            at: [0, 0],
            rotation: 0,
            size: [2, 2],
            layers: ["F.Cu"],
            net: "",
          },
        ],
        graphics: [],
      },
      { x: -9000, y: 50, width: 1, height: 1 },
    );
    expect(
      registry.get("pcb.footprint")?.getBounds(footprint, {} as never),
    ).toEqual({
      x: 90,
      y: 90,
      width: 20,
      height: 20,
    });
  });

  test("track bounds include width and arc midpoint; hit distances use mm", () => {
    const track = pcbElement("pcb.track", {
      layer: "F.Cu",
      width: 0.25,
      net: "",
      points: [
        [0, 0],
        [10, 0],
      ],
    });
    const util = registry.get("pcb.track");
    expect(util?.getBounds(track, {} as never)).toEqual({
      x: -1.25,
      y: -1.25,
      width: 102.5,
      height: 2.5,
    });
    expect(util?.hitTest(track, { x: 50, y: 1 }, {} as never)).toBe(true);
    expect(util?.hitTest(track, { x: 50, y: 5 }, {} as never)).toBe(false);

    const arc = pcbElement("pcb.track", {
      layer: "F.Cu",
      width: 0.2,
      net: "",
      points: [
        [0, 0],
        [2, 0],
      ],
      mid: [3, 4],
    });
    const arcBounds = util?.getBounds(arc, {} as never);
    expect(arcBounds?.x).toBe(-1);
    expect(arcBounds?.y).toBe(-1);
    expect(arcBounds?.width).toBeCloseTo(32);
    expect(arcBounds?.height).toBeCloseTo(42);
  });

  test("uses via and graphic semantic geometry for bounds", () => {
    const via = pcbElement("pcb.via", {
      at: [4, 5],
      diameter: 1,
      drill: 0.3,
      layers: ["F.Cu", "B.Cu"],
      net: "",
    });
    expect(registry.get("pcb.via")?.getBounds(via, {} as never)).toEqual({
      x: 35,
      y: 45,
      width: 10,
      height: 10,
    });

    const graphic = pcbElement("pcb.graphic", {
      layer: "Edge.Cuts",
      width: 0.2,
      fill: false,
      shape: { kind: "rect", start: [2, 3], end: [6, 8] },
    });
    const bounds = registry.get("pcb.graphic")?.getBounds(graphic, {} as never);
    expect(bounds?.x).toBe(19);
    expect(bounds?.y).toBe(29);
    expect(bounds?.width).toBeCloseTo(42);
    expect(bounds?.height).toBeCloseTo(52);
  });

  test("graphic arc picking follows the circular stroke", () => {
    const arc = pcbElement("pcb.graphic", {
      layer: "Edge.Cuts",
      width: 0.1,
      fill: false,
      shape: {
        kind: "arc",
        start: [10, 0],
        mid: [Math.SQRT1_2 * 10, Math.SQRT1_2 * 10],
        end: [0, 10],
      },
    });
    expect(
      registry
        .get("pcb.graphic")
        ?.hitTest(arc, { x: 92.388, y: 38.268 }, {} as never),
    ).toBe(true);
  });

  test("zones pick the outline but not the pour, and boards have no hit bounds", () => {
    const zone = pcbElement("pcb.zone", {
      layers: ["F.Cu"],
      net: "GND",
      outline: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      filled: [],
    });
    const zoneUtil = registry.get("pcb.zone");
    expect(zoneUtil?.getBounds(zone, {} as never)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(zoneUtil?.hitTest(zone, { x: 50, y: 1 }, {} as never)).toBe(true);
    expect(zoneUtil?.hitTest(zone, { x: 50, y: 50 }, {} as never)).toBe(false);

    const board = pcbElement("pcb.board", {
      format: "kicad_pcb",
      source: "board.kicad_pcb",
      version: 20240108,
      generator: "pcbnew",
      maskExpansion: 0,
      layers: [],
      nets: [],
    });
    expect(registry.get("pcb.board")?.getBounds(board, {} as never)).toBeNull();
    expect(
      registry.get("pcb.board")?.hitTest(board, { x: 0, y: 0 }, {} as never),
    ).toBe(false);
  });
});
