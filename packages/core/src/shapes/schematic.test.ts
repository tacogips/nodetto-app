import { describe, expect, test } from "bun:test";
import {
  coordinateKey,
  SCHEMATIC_ELEMENT_TYPES,
  type Element,
} from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { hitTestPoint } from "../hit-test.ts";
import { localCoordinateForKey, pinKey } from "../schematic/coordinates.ts";
import { schematicBox, schematicPins } from "../schematic/symbols.ts";
import { Store } from "../store.ts";
import { document, element, TEST_PAGE } from "../test-helpers.ts";
import { createDefaultRegistry } from "./index.ts";
import {
  schematicContactsAt,
  schematicPinAt,
  schematicWireInteriorAt,
} from "./schematic.ts";

const registry = createDefaultRegistry();
const page = "schematic-page";
const make = (
  type: string,
  semantic: unknown,
  visual = {},
  id = type,
): Element => element({ id, type, page, semantic, visual });
const store = (elements: readonly Element[]) => ({
  getPageElements: () => elements,
});
const wire = make(
  "schematic.wire",
  {
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ],
  },
  { x: 100, y: 100 },
);

describe("schematic shape utilities", () => {
  test("picks rotated resistor leads in page coordinates", () => {
    for (const rotation of [0, 90, 270]) {
      const resistor = element({
        id: "R",
        type: "schematic.resistor",
        semantic: registry.get("schematic.resistor")?.defaultSemantic(),
        visual: { x: 0, y: 0, rotation },
      });
      const box = schematicBox(resistor);
      const pin = schematicPins(resistor)[0];
      expect(box).toBeDefined();
      expect(pin).toBeDefined();
      if (!box || !pin) throw new Error("Missing resistor geometry");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const lead =
        rotation === 0
          ? { x: pin.x + 2 * Math.sign(cx - pin.x), y: pin.y }
          : { x: pin.x, y: pin.y + 2 * Math.sign(cy - pin.y) };
      const outside =
        rotation === 0 ? { x: cx, y: box.y - 10 } : { x: box.x - 10, y: cy };
      const documentStore = new Store(document([resistor]));
      expect(hitTestPoint(documentStore, registry, TEST_PAGE.id, lead)).toBe(
        "R",
      );
      expect(
        hitTestPoint(documentStore, registry, TEST_PAGE.id, outside),
      ).toBeNull();
    }
  });
  test("registers bounds and disables resize for all types", () => {
    for (const type of SCHEMATIC_ELEMENT_TYPES) {
      const util = registry.get(type);
      expect(util?.type).toBe(type);
      expect(util?.canResize).toBe(false);
      const box = util?.getBounds(
        make(type, util.defaultSemantic()),
        {} as never,
      );
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
    }
  });
  test("wire bounds and segment hit tolerance", () => {
    const util = registry.get("schematic.wire");
    expect(util?.getBounds(wire, {} as never)).toEqual({
      x: 97,
      y: 97,
      width: 26,
      height: 26,
    });
    expect(util?.hitTest(wire, { x: 110, y: 104 }, {} as never)).toBe(true);
    expect(util?.hitTest(wire, { x: 110, y: 105 }, {} as never)).toBe(false);
  });
  test("snaps to nearest joinable target, excluding bends and hidden elements", () => {
    const resistor = make(
      "schematic.resistor",
      registry.get("schematic.resistor")?.defaultSemantic(),
    );
    const pin = schematicPins(resistor)[0];
    expect(pin).toBeDefined();
    if (!pin) return;
    expect(
      schematicPinAt(store([resistor]), page, { x: pin.x + 1, y: pin.y }),
    ).toMatchObject({ kind: "pin", pin: 1, elementId: resistor.id });
    expect(
      schematicPinAt(store([wire]), page, { x: 120, y: 100 }),
    ).toBeUndefined();
    expect(
      schematicPinAt(store([wire]), page, { x: 101, y: 100 }),
    ).toMatchObject({ kind: "wireEnd", end: 0 });
    const first = make("schematic.junction", {}, { x: 2 }, "first");
    const second = make("schematic.label", { net: "N" }, { x: -2 }, "second");
    expect(
      schematicPinAt(store([first, second]), page, { x: 0, y: 0 })?.elementId,
    ).toBe("first");
    expect(
      schematicPinAt(
        store([make("schematic.junction", {}, { hidden: true })]),
        page,
        { x: 0, y: 0 },
      ),
    ).toBeUndefined();
  });
  test("finds interior segments and bends but excludes wire endpoints", () => {
    expect(
      schematicWireInteriorAt(store([wire]), page, { x: 110, y: 100 }),
    ).toEqual([wire.id]);
    expect(
      schematicWireInteriorAt(store([wire]), page, { x: 120, y: 100 }),
    ).toEqual([wire.id]);
    expect(
      schematicWireInteriorAt(store([wire]), page, { x: 100, y: 100 }),
    ).toEqual([]);
    expect(
      schematicWireInteriorAt(store([wire]), page, { x: 110, y: 101 }),
    ).toEqual([]);
  });
});

test("snap exclusion precedes ranking and targets carry stored keys", () => {
  const w = make(
    "schematic.wire",
    {
      points: [
        { x: 0, y: 0 },
        { x: -20, y: 0 },
      ],
    },
    {},
    "w",
  );
  const base = make(
    "schematic.resistor",
    registry.get("schematic.resistor")?.defaultSemantic(),
    {},
    "r",
  );
  const basePin = schematicPins(base)[0];
  if (!basePin) throw new Error("Missing resistor pin");
  const part = make(
    "schematic.resistor",
    base.semantic,
    { x: 3 - basePin.x, y: -basePin.y },
    "r",
  );
  const pin = schematicPins(part)[0];
  if (!pin) throw new Error("Missing resistor pin");
  expect(schematicPinAt(store([w, part]), page, { x: 1, y: 0 })).toMatchObject({
    elementId: "w",
    key: { kx: 0, ky: 0 },
  });
  expect(
    schematicPinAt(store([w, part]), page, { x: 1, y: 0 }, "w"),
  ).toMatchObject({ elementId: "r", key: pinKey(part, pin) });
  const label = make("schematic.label", { net: "CLK" }, { x: 0.004 }, "label");
  expect(schematicPinAt(store([label]), page, { x: 0, y: 0 })?.key).toEqual({
    kx: 0,
    ky: 0,
  });
});

test("contacts use stored-field keys before and after serialization", () => {
  const a = make(
    "schematic.wire",
    {
      points: [
        { x: -20, y: 0 },
        { x: 20, y: 0 },
      ],
    },
    {},
    "a",
  );
  const b = make(
    "schematic.wire",
    {
      points: [
        { x: 0, y: -20 },
        { x: 0, y: 20 },
      ],
    },
    { x: 0.004 },
    "b",
  );
  const label = make("schematic.label", { net: "CLK" }, {}, "clk");
  const hidden = make("schematic.junction", {}, { hidden: true }, "hidden");
  const doc = document(
    [a, b, label, hidden],
    [{ id: page, name: "Circuit", kind: "schematic" }],
  );
  for (const current of [doc, parseDocument(serializeDocument(doc))]) {
    const currentStore = new Store(current);
    const key = { kx: 0, ky: 0 };
    expect(schematicContactsAt(currentStore, page, key)).toEqual({
      wires: ["a", "b"],
      labels: ["clk"],
      joinables: 0,
    });
    expect(schematicContactsAt(currentStore, page, key, "b")).toEqual({
      wires: ["a"],
      labels: ["clk"],
      joinables: 0,
    });
  }
});

test("contacts count joinables and wire bends but not wire endpoints as interiors", () => {
  const junction = make("schematic.junction", {}, { x: 120, y: 100 }, "j");
  const endpoint = schematicContactsAt(store([wire]), page, {
    kx: 10000,
    ky: 10000,
  });
  expect(endpoint).toEqual({ wires: [], labels: [], joinables: 1 });
  expect(
    schematicContactsAt(store([wire, junction]), page, {
      kx: 12000,
      ky: 10000,
    }),
  ).toEqual({ wires: [wire.id], labels: [], joinables: 1 });
});

test("key-relative coordinates preserve negative-tie origins", () => {
  expect(localCoordinateForKey(-1000, -0.125)).toBe(-9.87);
  expect(coordinateKey(-0.125) + coordinateKey(-9.87)).toBe(-1000);
});

test("contacts count each visible joinable at its electrical key", () => {
  const resistor = make(
    "schematic.resistor",
    registry.get("schematic.resistor")?.defaultSemantic(),
    {},
    "r",
  );
  const power = make(
    "schematic.power",
    registry.get("schematic.power")?.defaultSemantic(),
    {},
    "p",
  );
  const resistorPin = schematicPins(resistor)[0];
  const powerPin = schematicPins(power)[0];
  if (!resistorPin || !powerPin) throw new Error("Missing pins");
  const target = pinKey(resistor, resistorPin);
  const shiftedPower = make(
    "schematic.power",
    power.semantic,
    { x: resistorPin.x - powerPin.x, y: resistorPin.y - powerPin.y },
    "p",
  );
  const w = make(
    "schematic.wire",
    {
      points: [
        { x: resistorPin.x, y: resistorPin.y },
        { x: resistorPin.x + 20, y: resistorPin.y },
      ],
    },
    {},
    "w",
  );
  const j = make(
    "schematic.junction",
    {},
    { x: resistorPin.x, y: resistorPin.y },
    "j",
  );
  const hidden = make(
    "schematic.junction",
    {},
    { x: resistorPin.x, y: resistorPin.y, hidden: true },
    "hidden",
  );
  expect(
    schematicContactsAt(
      store([resistor, shiftedPower, w, j, hidden]),
      page,
      target,
    ).joinables,
  ).toBe(4);
  expect(
    schematicContactsAt(
      store([resistor, shiftedPower, w, j, hidden]),
      page,
      target,
      "p",
    ).joinables,
  ).toBe(3);
});
