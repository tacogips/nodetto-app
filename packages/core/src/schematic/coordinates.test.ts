import { expect, test } from "bun:test";
import { coordinateKey } from "@nodetto/ir";
import { element } from "../test-helpers.ts";
import {
  canonicalTarget,
  pinKey,
  pointElementKey,
  shiftedTarget,
  wirePointKeys,
} from "./coordinates.ts";
import { schematicPins } from "./symbols.ts";

test("canonical moves preserve shared key deltas at negative ties", () => {
  expect(shiftedTarget(-1, -0.005)).toBe(-1.01);
  expect(shiftedTarget(-0.999, -0.005)).toBe(-1.01);
  expect(coordinateKey(shiftedTarget(-0.125, 1))).toBe(
    coordinateKey(-0.125) + 100,
  );
  expect(canonicalTarget(0.875)).toBe(0.88);
});
test("electrical keys round stored fields independently", () => {
  const wire = element({
    id: "w",
    type: "schematic.wire",
    semantic: { points: [{ x: 10.004, y: -0.005 }] },
    visual: { x: 0.004 },
  });
  const junction = element({
    id: "j",
    type: "schematic.junction",
    semantic: {},
    visual: { x: 10.008 },
  });
  expect(wirePointKeys(wire)).toEqual([{ kx: 1000, ky: -1 }]);
  expect(pointElementKey(junction)).toEqual({ kx: 1001, ky: 0 });
});
test("pin keys use the canonical origin and exact rotated offsets", () => {
  const resistor = element({
    id: "r",
    type: "schematic.resistor",
    semantic: {},
    visual: { x: 3.37, y: -0.125, rotation: 90 },
  });
  const pin = schematicPins(resistor)[0];
  if (!pin) throw new Error("missing resistor pin");
  expect(pinKey(resistor, pin)).toEqual({
    kx: coordinateKey(3.37) + Math.round((pin.x - 3.37) * 100),
    ky: coordinateKey(-0.125) + Math.round((pin.y + 0.125) * 100),
  });
});
