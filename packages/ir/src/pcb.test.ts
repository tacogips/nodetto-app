import { describe, expect, test } from "bun:test";
import { getElementTypeDefinition } from "./registry.ts";
import { isPcbElementType, pcbRotate, roundNm } from "./pcb.ts";
import { validateDocument } from "./validate.ts";

const valid = {
  "pcb.board": {
    format: "kicad_pcb",
    source: "board.kicad_pcb",
    version: 20240108,
    generator: "pcbnew",
    maskExpansion: 0,
    layers: [],
    nets: [],
  },
  "pcb.footprint": {
    reference: "R1",
    value: "10k",
    library: "Resistor_SMD:R_0603",
    at: [1, 2],
    rotation: 0,
    side: "top",
    pads: [],
    graphics: [],
  },
  "pcb.track": {
    layer: "F.Cu",
    width: 0.2,
    net: "GND",
    points: [
      [0, 0],
      [1, 1],
    ],
  },
  "pcb.via": {
    at: [0, 0],
    diameter: 0.6,
    drill: 0.3,
    layers: ["F.Cu", "B.Cu"],
    net: "GND",
  },
  "pcb.zone": {
    layers: ["F.Cu"],
    net: "GND",
    outline: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    filled: [{ layer: "F.Cu", polygons: [] }],
  },
  "pcb.graphic": {
    layer: "Edge.Cuts",
    width: 0.05,
    fill: false,
    shape: { kind: "line", start: [0, 0], end: [1, 1] },
  },
} as const;

function issues(type: keyof typeof valid, semantic: unknown): string[] {
  return (
    getElementTypeDefinition(type)
      ?.validateSemantic(semantic, "semantic")
      .map((issue) => issue.code) ?? []
  );
}

describe("PCB IR", () => {
  test("rotates exactly at quarter and eighth turns", () => {
    expect(pcbRotate([1, 0], 90)).toEqual([0, -1]);
    expect(pcbRotate([1, 0], 180)).toEqual([-1, 0]);
    expect(pcbRotate([1, 0], 45)).toEqual([Math.SQRT1_2, -Math.SQRT1_2]);
    expect(pcbRotate([1, 0], -90)).toEqual(pcbRotate([1, 0], 270));
    const [x, y] = pcbRotate([1, 0], 30);
    expect(x).toBeCloseTo(Math.cos(Math.PI / 6));
    expect(y).toBeCloseTo(-Math.sin(Math.PI / 6));
    expect(pcbRotate([1, 0], 390)).toEqual(pcbRotate([1, 0], 30));
  });
  test("rounds nm half away from zero and removes negative zero", () => {
    expect(roundNm(1.0000004)).toBe(1);
    expect(roundNm(-0.0000001)).toBe(0);
    expect(Object.is(roundNm(-0.0000001), -0)).toBe(false);
  });
  test("validates the page kind and six structural element shapes", () => {
    expect(
      validateDocument({
        schemaVersion: 1,
        id: "d",
        title: "Board",
        pages: [{ id: "p", name: "PCB", kind: "pcb" }],
        elements: [],
      }),
    ).toEqual([]);
    for (const [type, semantic] of Object.entries(valid))
      expect(issues(type as keyof typeof valid, semantic)).toEqual([]);
    expect(isPcbElementType("pcb.via")).toBe(true);
  });
  test("reports required structural issue codes and enums", () => {
    expect(
      issues("pcb.track", { ...valid["pcb.track"], points: [[0, 0]] }),
    ).toContain("pcb.trackPoints");
    expect(
      issues("pcb.track", {
        ...valid["pcb.track"],
        points: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        mid: [1, 1],
      }),
    ).toContain("pcb.trackArc");
    expect(issues("pcb.via", { ...valid["pcb.via"], drill: 0.6 })).toContain(
      "pcb.viaDrill",
    );
    expect(
      issues("pcb.zone", {
        ...valid["pcb.zone"],
        outline: [
          [0, 0],
          [1, 0],
        ],
      }),
    ).toContain("pcb.zoneOutline");
    expect(
      issues("pcb.zone", {
        ...valid["pcb.zone"],
        filled: [
          {
            layer: "F.Cu",
            polygons: [
              [
                [0, 0],
                [1, 0],
              ],
            ],
          },
        ],
      }),
    ).toContain("pcb.polygonPoints");
    expect(issues("pcb.track", { ...valid["pcb.track"], layer: "" })).toContain(
      "value.empty",
    );
    expect(
      issues("pcb.footprint", { ...valid["pcb.footprint"], side: "left" }),
    ).toContain("value.enum");
    expect(issues("pcb.track", { ...valid["pcb.track"], width: 0 })).toContain(
      "value.min",
    );
  });
});
