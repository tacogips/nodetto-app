import { expect, test } from "bun:test";
import type { CadExtrudeSemantic } from "@nodetto/ir";
import {
  baseFrame,
  capOutwardSign,
  extrudeSpan,
  faceFrame,
  toWorld,
} from "./index.ts";

test("base frames use the cyclic axes and offset along the normal", () => {
  expect(toWorld(baseFrame("xy"), [1, 2])).toEqual([1, 2, 0]);
  expect(toWorld(baseFrame("yz", 3), [1, 2], 4)).toEqual([7, 1, 2]);
  expect(toWorld(baseFrame("zx", -3), [1, 2], 4)).toEqual([2, 1, 1]);
});

test("cap coordinates are aligned and the side frame follows the stored line", () => {
  const xy = baseFrame("xy");
  const span = { t0: 0, t1: 5 };
  expect(toWorld(faceFrame(xy, span, "start"), [1, 2])).toEqual([1, 2, 0]);
  expect(toWorld(faceFrame(xy, span, "end"), [1, 2])).toEqual([1, 2, 5]);
  const side = faceFrame(xy, span, "side", { a: [0, 0], b: [10, 0] });
  expect(side.n).toEqual([0, -1, 0]);
  expect(toWorld(side, [2, 3])).toEqual([2, 0, 3]);

  const rotated = faceFrame(baseFrame("yz", 2), { t0: -3, t1: 3 }, "side", {
    a: [1, 2],
    b: [4, 6],
  });
  expect(rotated).toEqual({
    o: [-1, 1, 2],
    u: [0, 0.6, 0.8],
    v: [1, 0, 0],
    n: [0, 0.8, -0.6],
  });
});

test.each([
  [5, false, { t0: 0, t1: 5 }],
  [-5, false, { t0: 0, t1: -5 }],
  [6, true, { t0: -3, t1: 3 }],
  [-6, true, { t0: 3, t1: -3 }],
] as const)(
  "cap outward directions leave the span for distance %d, symmetric %s",
  (distance, symmetric, expected) => {
    const e: CadExtrudeSemantic = {
      name: "Body",
      distance,
      symmetric,
      op: "new",
    };
    const span = extrudeSpan(e);
    expect(span).toEqual(expected);
    for (const role of ["start", "end"] as const) {
      const cap = faceFrame(baseFrame("xy"), span, role);
      const z = toWorld(cap, [0, 0], capOutwardSign(span, role) * 0.001)[2];
      expect(
        z < Math.min(span.t0, span.t1) || z > Math.max(span.t0, span.t1),
      ).toBe(true);
    }
  },
);
