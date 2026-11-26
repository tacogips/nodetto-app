import { expect, test } from "bun:test";
import {
  SCHEMATIC_PART_TYPES,
  type Element,
  type SchematicPartType,
} from "@nodetto/ir";
import {
  schematicAnchorPin,
  schematicBox,
  schematicDefaultSemantic,
  schematicLocalBox,
  schematicPartName,
  schematicPinDefs,
  schematicPins,
} from "./symbols.ts";
function element(
  type: SchematicPartType | "schematic.power",
  patch: object = {},
  visual: Element["visual"] = {},
): Element {
  return {
    id: "e",
    page: "p",
    index: "a0",
    type,
    semantic: schematicDefaultSemantic(type, patch),
    visual,
  };
}
test("pin tables match relative positions and directions", () => {
  const expected: Record<string, [number, string, number, number, string][]> = {
    "schematic.resistor": [
      [1, "1", 0, 0, "left"],
      [2, "2", 40, 0, "right"],
    ],
    "schematic.capacitor": [
      [1, "1", 0, 0, "left"],
      [2, "2", 40, 0, "right"],
    ],
    "schematic.inductor": [
      [1, "1", 0, 0, "left"],
      [2, "2", 40, 0, "right"],
    ],
    "schematic.diode": [
      [1, "A", 0, 0, "left"],
      [2, "K", 40, 0, "right"],
    ],
    "schematic.led": [
      [1, "A", 0, 0, "left"],
      [2, "K", 40, 0, "right"],
    ],
    "schematic.bjt": [
      [1, "E", 0, 0, "down"],
      [2, "B", -30, -20, "left"],
      [3, "C", 0, -40, "up"],
    ],
    "schematic.mosfet": [
      [1, "G", 0, 0, "left"],
      [2, "D", 30, -20, "up"],
      [3, "S", 30, 20, "down"],
    ],
    "schematic.switch": [
      [1, "1", 0, 0, "left"],
      [2, "2", 40, 0, "right"],
    ],
    "schematic.potentiometer": [
      [1, "1", 0, 0, "left"],
      [2, "W", 20, -20, "up"],
      [3, "3", 40, 0, "right"],
    ],
    "schematic.battery": [
      [1, "+", 0, 0, "left"],
      [2, "-", 40, 0, "right"],
    ],
    "schematic.voltageSource": [
      [1, "+", 0, 0, "left"],
      [2, "-", 40, 0, "right"],
    ],
    "schematic.connector": [
      [1, "1", 0, 0, "left"],
      [2, "2", 0, 10, "left"],
    ],
    "schematic.power": [[1, "1", 0, 0, "up"]],
  };
  for (const [type, rows] of Object.entries(expected)) {
    const pins = schematicPinDefs(element(type as SchematicPartType));
    const first = pins[0];
    expect(first).toBeDefined();
    expect(
      pins.map((p) => [
        p.number,
        p.name,
        p.offset.x - (first?.offset.x ?? 0),
        p.offset.y - (first?.offset.y ?? 0),
        p.direction,
      ]),
    ).toEqual(rows);
  }
  expect(
    schematicPinDefs(element("schematic.capacitor", { polarized: true })).map(
      (p) => p.name,
    ),
  ).toEqual(["+", "-"]);
  expect(
    schematicPinDefs(element("schematic.power", { style: "rail" }))[0]
      ?.direction,
  ).toBe("down");
});
test("IC side positions and first-entry anchor", () => {
  const pins = [
    { number: 7, name: "A", side: "left" },
    { number: 3, name: "B", side: "right" },
    { number: 9, name: "C", side: "left" },
    { number: 2, name: "D", side: "top" },
    { number: 5, name: "E", side: "left" },
    { number: 1, name: "F", side: "right" },
  ];
  const e = element("schematic.ic", { pins });
  const defs = schematicPinDefs(e);
  const first = defs[0];
  expect(
    defs.map((p) => [
      p.offset.x - (first?.offset.x ?? 0),
      p.offset.y - (first?.offset.y ?? 0),
    ]),
  ).toEqual([
    [0, 0],
    [100, 20],
    [0, 10],
    [70, -30],
    [0, 20],
    [100, 10],
  ]);
  expect(schematicAnchorPin(e)?.number).toBe(7);
});
test("boxes and rotated mirrored pin offsets retain lattice spacing", () => {
  for (const type of [...SCHEMATIC_PART_TYPES, "schematic.power"] as const) {
    for (const rotation of [0, 90, 180, 270])
      for (const flipX of [false, true]) {
        const e = element(type, {}, { x: 10, y: 20, rotation, flipX });
        const box = schematicLocalBox(e);
        const pins = schematicPins(e);
        const first = pins[0];
        expect(box.width % 5).toBe(0);
        expect(box.height % 5).toBe(0);
        expect(schematicBox(e)).toBeDefined();
        for (const p of pins) {
          expect(Math.abs((p.x - (first?.x ?? 0)) % 10)).toBe(0);
          expect(Math.abs((p.y - (first?.y ?? 0)) % 10)).toBe(0);
        }
      }
  }
});
test("IC part names distinguish dense and sparse numbers", () => {
  const ic = (numbers: number[]) =>
    element("schematic.ic", {
      pins: numbers.map((number) => ({ number, name: "", side: "left" })),
    });
  expect(schematicPartName(ic([1, 2, 3, 4, 5, 6, 7, 8]))).toBe("DIP");
  expect(schematicPartName(ic([1, 3, 7, 9]))).toBe("IC_Generic");
  expect(schematicPartName(ic([1, 2, 3, 4, 5]))).toBe("Header");
  expect(schematicPins({ ...ic([1]), visual: { hidden: true } })).toEqual([]);
});

test("page pins and boxes follow clockwise rotation and flip before rotation", () => {
  // The resistor box is 50 by 30, with pin 1 at (5, 15) and center (25, 15).
  const cases = [
    {
      rotation: 0,
      flipX: false,
      pins: [
        [1, 5, 15, "left"],
        [2, 45, 15, "right"],
      ],
    },
    {
      rotation: 90,
      flipX: false,
      pins: [
        [1, 25, -5, "up"],
        [2, 25, 35, "down"],
      ],
    },
    {
      rotation: 180,
      flipX: false,
      pins: [
        [1, 45, 15, "right"],
        [2, 5, 15, "left"],
      ],
    },
    {
      rotation: 270,
      flipX: false,
      pins: [
        [1, 25, 35, "down"],
        [2, 25, -5, "up"],
      ],
    },
    {
      rotation: 0,
      flipX: true,
      pins: [
        [1, 45, 15, "right"],
        [2, 5, 15, "left"],
      ],
    },
    {
      rotation: 90,
      flipX: true,
      pins: [
        [1, 25, 35, "down"],
        [2, 25, -5, "up"],
      ],
    },
  ];
  for (const { rotation, flipX, pins: expected } of cases) {
    const e = element(
      "schematic.resistor",
      {},
      { x: 0, y: 0, rotation, flipX },
    );
    const pins = schematicPins(e);
    expect(
      pins.map((p): (string | number)[] => [p.number, p.x, p.y, p.direction]),
    ).toEqual(expected);
    if (rotation === 90 || rotation === 270) {
      const box = schematicBox(e);
      expect(box).toEqual({ x: 10, y: -10, width: 30, height: 50 });
      for (const p of pins) {
        expect(p.x).toBeGreaterThanOrEqual(10);
        expect(p.x).toBeLessThanOrEqual(40);
        expect(p.y).toBeGreaterThanOrEqual(-10);
        expect(p.y).toBeLessThanOrEqual(40);
      }
    }
  }
  const plain = schematicPins(element("schematic.bjt"));
  const mirrored = schematicPins(element("schematic.bjt", {}, { flipX: true }));
  expect((plain[1]?.x ?? 0) - (plain[0]?.x ?? 0)).toBe(-30);
  expect((mirrored[1]?.x ?? 0) - (mirrored[0]?.x ?? 0)).toBe(30);
  expect(mirrored[1]?.direction).toBe("right");
  expect(mirrored[2]?.direction).toBe("up");
});
