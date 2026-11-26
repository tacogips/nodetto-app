import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { Store } from "../store.ts";
import { document, element } from "../test-helpers.ts";
import { pinKey } from "./coordinates.ts";
import { schematicPins } from "./symbols.ts";
import {
  planSchematicAnnotation,
  planSchematicMirror,
  planSchematicRotation,
} from "./transform.ts";

const page = { id: "s", name: "Circuit", kind: "schematic" as const };
function storeFor(elements: Element[]) {
  return new Store(document(elements, [page]));
}
function applyVisual(
  item: Element,
  command: ReturnType<typeof planSchematicRotation>[number] | undefined,
): Element {
  if (!command || command.type !== "updateVisual")
    throw new Error("expected visual command");
  return { ...item, visual: { ...item.visual, ...command.visual } };
}
function anchor(item: Element) {
  const pin = schematicPins(item)[0];
  if (!pin) throw new Error("missing pin");
  return pinKey(item, pin);
}
function resistor(x: number, y: number): Element {
  return element({
    id: "r",
    page: page.id,
    type: "schematic.resistor",
    semantic: { reference: "R1", value: "1k" },
    visual: { x, y },
  });
}

test("rotation preserves off-grid anchor and restores visual after four turns", () => {
  const original = resistor(3.37, 0);
  let current = original;
  for (let i = 0; i < 4; i++) {
    current = applyVisual(
      current,
      planSchematicRotation(storeFor([current]), ["r"], 1)[0],
    );
    expect(anchor(current)).toEqual(anchor(original));
  }
  expect(current.visual.x).toBe(original.visual.x);
  expect(current.visual.y).toBe(original.visual.y);
  expect(current.visual.rotation).toBe(0);
});

test("rotations keep every pin on the lattice when the anchor is on it", () => {
  let current = resistor(-5, -15);
  for (let i = 0; i < 4; i++) {
    current = applyVisual(
      current,
      planSchematicRotation(storeFor([current]), ["r"], 1)[0],
    );
    for (const pin of schematicPins(current)) {
      expect(Math.abs(pin.x % 10)).toBe(0);
      expect(Math.abs(pin.y % 10)).toBe(0);
    }
  }
});

test("mirror keeps anchor and toggles back", () => {
  const original = resistor(3.37, 0);
  const mirrored = applyVisual(
    original,
    planSchematicMirror(storeFor([original]), ["r"])[0],
  );
  expect(mirrored.visual.flipX).toBe(true);
  expect(anchor(mirrored)).toEqual(anchor(original));
  const restored = applyVisual(
    mirrored,
    planSchematicMirror(storeFor([mirrored]), ["r"])[0],
  );
  expect(restored.visual.flipX).toBe(false);
  expect(restored.visual.x).toBe(original.visual.x);
  expect(restored.visual.y).toBe(original.visual.y);
});

test("rotates labels in place and ignores wires", () => {
  const label = element({
    id: "l",
    page: page.id,
    type: "schematic.label",
    semantic: { net: "A" },
    visual: { x: 3.375, y: -2 },
  });
  const wire = element({
    id: "w",
    page: page.id,
    type: "schematic.wire",
    semantic: {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    },
  });
  expect(planSchematicRotation(storeFor([label, wire]), ["l", "w"], 1)).toEqual(
    [{ type: "updateVisual", id: "l", visual: { rotation: 90 } }],
  );
});

test("annotation preserves the first reference and assigns free numbers", () => {
  const items = [
    resistor(0, 0),
    element({
      id: "r2",
      page: page.id,
      index: "a2",
      type: "schematic.resistor",
      semantic: { reference: "R1", value: "2k" },
    }),
    element({
      id: "c",
      page: page.id,
      index: "a3",
      type: "schematic.capacitor",
      semantic: { reference: "C?", value: "1n" },
    }),
  ];
  expect(planSchematicAnnotation(storeFor(items), page.id)).toEqual([
    {
      type: "updateSemantic",
      id: "r2",
      semantic: { reference: "R2", value: "2k" },
    },
    {
      type: "updateSemantic",
      id: "c",
      semantic: { reference: "C1", value: "1n" },
    },
  ]);
});
