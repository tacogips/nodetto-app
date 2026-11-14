import { describe, expect, test } from "bun:test";
import { breadboardNotation, type Box } from "@nodetto/core";
import { BREADBOARD_ELEMENT_TYPES, type Element } from "@nodetto/ir";
import { breadboardViewModel } from "./breadboard-view.ts";

const box: Box = { x: 0, y: 0, width: 50, height: 10 };

function element(
  type: string,
  semantic: Record<string, unknown>,
  rotation = 0,
): Element {
  return {
    id: "element-1",
    page: "page-1",
    index: "a0",
    type,
    semantic,
    visual: { x: 0, y: 0, rotation },
  } as Element;
}

describe("breadboard view model", () => {
  test("keeps unrotated labels and resistor bands in the expected groups", () => {
    const model = breadboardViewModel(
      element("breadboard.resistor", {
        reference: "R1",
        value: "220",
        span: 4,
        bands: 4,
      }),
      box,
      false,
    );
    expect(model.labelTransform).toBeUndefined();
    expect(model.body.map(({ role }) => role)).toContain("resistor-band-1");
    expect(model.labels.map(({ role }) => role)).toContain("breadboard-label");
  });

  test("counter-rotates labels around the box center", () => {
    const model = breadboardViewModel(
      element(
        "breadboard.resistor",
        { reference: "R1", value: "220", span: 4, bands: 4 },
        90,
      ),
      box,
      false,
    );
    expect(model.labelTransform).toBe("rotate(-90 25 5)");
  });

  test("retains all half-board holes", () => {
    const model = breadboardViewModel(
      element("breadboard.board", { size: "half" }, 0),
      { x: 0, y: 0, width: 330, height: 220 },
      false,
    );
    expect(model.body.filter(({ role }) => role === "board-hole")).toHaveLength(
      400,
    );
  });

  test("dims an inert target netlist card", () => {
    const model = breadboardViewModel(
      element("breadboard.netlist", {
        source: "design.net",
        format: "kicad_net",
        parts: [],
        nets: [],
      }),
      { x: 0, y: 0, width: 100, height: 40 },
      true,
    );
    expect(model.body.every(({ opacity }) => opacity === 0.5)).toBe(true);
    expect(model.labels.every(({ opacity }) => opacity === 0.5)).toBe(true);
  });

  test("preserves every notation body primitive for all breadboard types", () => {
    const examples: Record<string, Record<string, unknown>> = {
      "breadboard.board": { size: "half" },
      "breadboard.wire": {
        color: "red",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      },
      "breadboard.resistor": {
        reference: "R1",
        value: "220",
        span: 4,
        bands: 4,
      },
      "breadboard.led": { reference: "D1", value: "red", color: "red" },
      "breadboard.capacitor": {
        reference: "C1",
        value: "100n",
        style: "ceramic",
        span: 1,
      },
      "breadboard.diode": { reference: "D2", value: "1N4148", span: 4 },
      "breadboard.transistor": {
        reference: "Q1",
        value: "NPN",
        polarity: "npn",
        pinout: "EBC",
      },
      "breadboard.button": { reference: "SW1", value: "PUSH" },
      "breadboard.potentiometer": { reference: "RV1", value: "10k" },
      "breadboard.ic": { reference: "U1", value: "IC", pinCount: 8 },
      "breadboard.header": { reference: "J1", value: "HEADER", pinCount: 4 },
      "breadboard.battery": { reference: "BT1", value: "5V" },
      "breadboard.netlist": {
        source: "design.net",
        format: "kicad_net",
        parts: [],
        nets: [],
      },
    };
    expect(Object.keys(examples)).toEqual([...BREADBOARD_ELEMENT_TYPES]);
    for (const type of BREADBOARD_ELEMENT_TYPES) {
      const current = element(type, examples[type] ?? {});
      const actual = breadboardViewModel(current, box, false);
      expect(actual.body.length).toBe(
        breadboardNotation(current, box).body.length,
      );
    }
  });
});
