import { describe, expect, test } from "bun:test";
import {
  BREADBOARD_PART_TYPES,
  getElementTypeDefinition,
  type BreadboardPartSemantic,
  type BreadboardPartType,
  type Element,
} from "@nodetto/ir";
import {
  breadboardCatalogue,
  breadboardBondGroups,
  breadboardBox,
  breadboardDefaultSemantic,
  breadboardDescription,
  breadboardFootprint,
  breadboardLocalBox,
  breadboardPartName,
  breadboardPins,
  breadboardWireEnds,
  breadboardWirePoints,
} from "./catalogue.ts";

function semantic(type: BreadboardPartType): BreadboardPartSemantic {
  return breadboardDefaultSemantic(type) as BreadboardPartSemantic;
}

function element(
  type: BreadboardPartType,
  override: Partial<Element> = {},
): Element {
  return {
    id: "part-1",
    page: "page-1",
    index: "a0",
    type,
    semantic: semantic(type),
    visual: { x: 0, y: 0, width: 999, height: 888, rotation: 0 },
    ...override,
  };
}

describe("breadboard catalogue", () => {
  test("publishes the fixed part catalogue with original default pin tables", () => {
    expect(Array.from(breadboardCatalogue, ({ type }) => type)).toEqual(
      Array.from(BREADBOARD_PART_TYPES),
    );
    expect(
      breadboardCatalogue.find(({ type }) => type === "breadboard.resistor")
        ?.pins,
    ).toEqual([
      { number: 1, name: "1", dx: 0, dy: 0 },
      { number: 2, name: "2", dx: 4, dy: 0 },
    ]);
    expect(
      breadboardCatalogue.find(({ type }) => type === "breadboard.led")?.pins,
    ).toEqual([
      { number: 1, name: "A", dx: 0, dy: 0 },
      { number: 2, name: "K", dx: 1, dy: 0 },
    ]);
  });

  test("positions resistor and LED pins from catalogue dimensions", () => {
    const resistor = element("breadboard.resistor");
    expect(breadboardPins(resistor)).toEqual([
      { number: 1, name: "1", x: 5, y: 5 },
      { number: 2, name: "2", x: 45, y: 5 },
    ]);
    expect(breadboardBox(resistor)).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 10,
    });
    expect(
      breadboardPins(element("breadboard.led")).map(({ name }) => name),
    ).toEqual(["A", "K"]);
    expect(breadboardPins(element("breadboard.led")).at(1)?.x).toBe(15);
  });

  test("models button bonds, DIP rows, transistor pinout and polarized capacitor pins", () => {
    const button = breadboardPins(element("breadboard.button"));
    expect(button).toHaveLength(4);
    const buttonPin1 = button.at(0);
    const buttonPin2 = button.at(1);
    expect(
      buttonPin1 && buttonPin2 ? buttonPin2.y - buttonPin1.y : undefined,
    ).toBe(30);
    expect(breadboardBondGroups("breadboard.button")).toEqual([
      [1, 2],
      [3, 4],
    ]);

    const ic = element("breadboard.ic", {
      semantic: { ...semantic("breadboard.ic"), pinCount: 8 },
    });
    const icPins = breadboardPins(ic);
    const icPin1 = icPins.find(({ number }) => number === 1);
    const icPin5 = icPins.find(({ number }) => number === 5);
    const icPin8 = icPins.find(({ number }) => number === 8);
    expect(
      icPin1 && icPin5 ? [icPin5.x - icPin1.x, icPin5.y - icPin1.y] : null,
    ).toEqual([30, -30]);
    expect(
      icPin1 && icPin8 ? [icPin8.x - icPin1.x, icPin8.y - icPin1.y] : null,
    ).toEqual([0, -30]);

    const transistor = element("breadboard.transistor", {
      semantic: { ...semantic("breadboard.transistor"), pinout: "CBE" },
    });
    expect(breadboardPins(transistor).map(({ name }) => name)).toEqual([
      "C",
      "B",
      "E",
    ]);
    const cap = element("breadboard.capacitor", {
      semantic: { ...semantic("breadboard.capacitor"), style: "electrolytic" },
    });
    expect(breadboardPins(cap).map(({ name }) => name)).toEqual(["+", "-"]);
  });

  test("keeps pins on the 10-unit lattice at every quarter turn", () => {
    for (const type of BREADBOARD_PART_TYPES) {
      for (const rotation of [90, 180, 270]) {
        const part = element(type, {
          visual: { x: 100, y: 50, rotation },
        });
        const pins = breadboardPins(part);
        const origin = pins[0];
        if (!origin) throw new Error(`missing pin 1 for ${type}`);
        for (const current of pins.slice(1)) {
          expect((current.x - origin.x) / 10).toBeCloseTo(
            Math.round((current.x - origin.x) / 10),
            6,
          );
          expect((current.y - origin.y) / 10).toBeCloseTo(
            Math.round((current.y - origin.y) / 10),
            6,
          );
        }
      }
    }
  });

  test("rotates pin 1 around the catalogue box centre", () => {
    const unrotated = breadboardPins(
      element("breadboard.resistor", {
        visual: { x: 100, y: 50, rotation: 0 },
      }),
    ).at(0);
    const rotated = breadboardPins(
      element("breadboard.resistor", {
        visual: { x: 100, y: 50, rotation: 90 },
      }),
    ).at(0);
    expect(unrotated).toMatchObject({ x: 105, y: 55 });
    expect(rotated).toMatchObject({ x: 125, y: 35 });
  });

  test("provides fixed part names, descriptions, footprints and valid defaults", () => {
    const expected: Record<
      BreadboardPartType,
      { name: string; description: string; footprint: string }
    > = {
      "breadboard.resistor": {
        name: "Resistor",
        description: "Resistor 5%",
        footprint: "nodetto:Resistor_P4",
      },
      "breadboard.led": {
        name: "LED",
        description: "LED red",
        footprint: "nodetto:LED_P1",
      },
      "breadboard.capacitor": {
        name: "Capacitor",
        description: "Capacitor ceramic",
        footprint: "nodetto:Capacitor_P1",
      },
      "breadboard.diode": {
        name: "Diode",
        description: "Diode",
        footprint: "nodetto:Diode_P4",
      },
      "breadboard.transistor": {
        name: "TransistorNPN",
        description: "Transistor NPN EBC",
        footprint: "nodetto:Transistor_NPN_EBC",
      },
      "breadboard.button": {
        name: "PushButton",
        description: "Push button",
        footprint: "nodetto:PushButton_P2.54x5.08",
      },
      "breadboard.potentiometer": {
        name: "Potentiometer",
        description: "Potentiometer",
        footprint: "nodetto:Potentiometer_P5.08",
      },
      "breadboard.ic": {
        name: "DIP",
        description: "DIP-8 IC",
        footprint: "nodetto:DIP-8",
      },
      "breadboard.header": {
        name: "Header",
        description: "Pin header 1x4",
        footprint: "nodetto:Header_1x4_P2.54",
      },
      "breadboard.battery": {
        name: "Battery",
        description: "Battery",
        footprint: "nodetto:Battery_P2.54",
      },
    };
    for (const type of BREADBOARD_PART_TYPES) {
      const value = semantic(type);
      expect({
        name: breadboardPartName(type, value),
        description: breadboardDescription(type, value),
        footprint: breadboardFootprint(type, value),
      }).toEqual(expected[type]);
      const definition = getElementTypeDefinition(type);
      if (!definition)
        throw new Error(`missing element definition for ${type}`);
      expect(
        definition.validateSemantic(
          breadboardDefaultSemantic(type),
          "semantic",
        ),
      ).toEqual([]);
    }
  });

  test("unions the battery body and pins into the local box", () => {
    const battery = semantic("breadboard.battery");
    const local = breadboardLocalBox("breadboard.battery", battery);
    expect(local.x).toBe(-3);
    expect(breadboardPins(element("breadboard.battery"))[0]?.x).toBe(30);
  });

  test("maps wire offsets from the visual origin and reports its endpoints", () => {
    const wire: Element = {
      id: "wire-1",
      page: "page-1",
      index: "a0",
      type: "breadboard.wire",
      semantic: {
        color: "red",
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
        ],
      },
      visual: { x: 100, y: 50, rotation: 90 },
    };
    expect(breadboardWirePoints(wire)).toEqual([
      { x: 100, y: 50 },
      { x: 120, y: 50 },
      { x: 120, y: 60 },
    ]);
    expect(breadboardWireEnds(wire)).toEqual([
      { x: 100, y: 50 },
      { x: 120, y: 60 },
    ]);
  });
});
