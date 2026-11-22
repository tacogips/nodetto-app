import { expect, test } from "bun:test";
import { cross3, type Vec3 } from "../cad/vec.ts";
import {
  type Bounds3,
  type CaptureCameraRequest,
  type CaptureView,
  captureCamera,
  captureFrame,
} from "./index.ts";

const plate: Bounds3 = { min: [0, 0, 0], max: [100, 60, 5] };
const size = { width: 1024, height: 768 };
const isoAxis = 1 / Math.sqrt(3);
const isoRight = 1 / Math.sqrt(2);
const isoUp = 1 / Math.sqrt(6);
const views: readonly [CaptureView, Vec3, Vec3, Vec3][] = [
  [
    "iso",
    [-isoAxis, -isoAxis, -isoAxis],
    [-isoRight, isoRight, 0],
    [-isoUp, -isoUp, 2 * isoUp],
  ],
  ["front", [0, 1, 0], [1, 0, 0], [0, 0, 1]],
  ["back", [0, -1, 0], [-1, 0, 0], [0, 0, 1]],
  ["left", [1, 0, 0], [0, -1, 0], [0, 0, 1]],
  ["right", [-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  ["top", [0, 0, -1], [1, 0, 0], [0, 1, 0]],
  ["bottom", [0, 0, 1], [1, 0, 0], [0, -1, 0]],
];

function expectVector(actual: Vec3, expected: Vec3): void {
  for (const axis of [0, 1, 2] as const)
    expect(actual[axis]).toBeCloseTo(expected[axis], 14);
}

test.each(views)(
  "%s uses the expected orthonormal camera basis",
  (view, forward, right, up) => {
    const camera = captureCamera({ view }, plate, size);
    expect(camera.view).toBe(view);
    expectVector(camera.forward, forward);
    expectVector(camera.right, right);
    expectVector(camera.up, up);
    expectVector(cross3(camera.right, camera.up), [
      -forward[0],
      -forward[1],
      -forward[2],
    ]);
  },
);

test.each([
  ["iso", [-1, -1, -1]],
  ["top", [0, 0, -1]],
  ["bottom", [0, 0, 1]],
] as const)(
  "%s and its custom direction yield exactly the same camera geometry",
  (view, direction) => {
    const named = captureCamera({ view }, plate, size);
    expect(captureCamera({ view: "left", direction }, plate, size)).toEqual({
      ...named,
      view: "custom",
    });
  },
);

test("direction and eye agree, and an omitted eye target defaults to the bounds centre", () => {
  const target: Vec3 = [70, 40, 3];
  const aim = captureCamera(
    { eye: [80, 60, 33], target, view: "top" },
    plate,
    size,
  );
  expect(aim).toEqual(
    captureCamera({ direction: [-10, -20, -30], target }, plate, size),
  );
  const fromEye = captureCamera({ eye: [51, 32, 5.5] }, plate, size);
  expect(fromEye).toEqual(
    captureCamera({ direction: [-1, -2, -3] }, plate, size),
  );
  expect(captureCamera({ direction: [1e-300, 0, 0] }, plate, size)).toEqual(
    captureCamera({ direction: [1e300, 0, 0] }, plate, size),
  );
});

test("a direction tilted from Z uses Z-up and an explicit up can roll the image", () => {
  const tilted = captureCamera({ direction: [1e-6, 0, -1] }, plate, size);
  expectVector(tilted.right, [0, -1, 0]);
  const rolled = captureCamera({ view: "top", up: [2, 0, 0] }, plate, size);
  expectVector(rolled.up, [1, 0, 0]);
  expectVector(rolled.right, [0, -1, 0]);
});

test("a nearly parallel explicit up still gives an orthonormal basis", () => {
  const { forward, right, up } = captureCamera(
    { direction: [3, 7, 11], up: [3 + 1e-12, 7 - 1e-12, 11 + 1e-12] },
    plate,
    size,
  );
  expectVector(cross3(right, up), [-forward[0], -forward[1], -forward[2]]);
  expectVector(cross3(forward, up), right);
  expectVector(cross3(right, forward), up);
});

const invalid: readonly [CaptureCameraRequest, RegExp][] = [
  [{ direction: [0, 0, 0] }, /direction/],
  [{ direction: [0, Number.POSITIVE_INFINITY, 0] }, /direction/],
  [{ eye: [50, 30, 2.5] }, /eye distinct/],
  [{ up: [0, 0, 0] }, /up/],
  [{ up: [0, 0, 5], view: "top" }, /parallel/],
  [{ direction: [1, 2, 3], up: [5, 10, 15] }, /parallel/],
  [{ target: [0, Number.NaN, 0] }, /target/],
  [{ zoom: 0.009 }, /zoom/],
  [{ zoom: 1001 }, /zoom/],
  [{ zoom: Number.NaN }, /zoom/],
  [{ viewHeight: 0 }, /view height/],
  [{ viewHeight: 1e7 + 1 }, /view height/],
  [{ viewHeight: 10, zoom: 1 }, /view height and zoom/],
];

test.each(invalid)("rejects invalid camera options %j", (request, message) => {
  expect(() => captureCamera(request, plate, size)).toThrow(RangeError);
  expect(() => captureCamera(request, plate, size)).toThrow(message);
});

test("fits the plate and reports when zoom or target crops it", () => {
  const fit = captureCamera({ view: "top" }, plate, size);
  expectVector(fit.centre, [50, 30, 0]);
  expect(fit.mmPerPixel).toBe((100 * 1.08) / 1024);
  expect(captureFrame(fit, [plate], size)).toBe("complete");

  const zoom = captureCamera({ view: "top", zoom: 2 }, plate, size);
  expect(zoom.mmPerPixel).toBe(fit.mmPerPixel / 2);
  expect(captureFrame(zoom, [plate], size)).toBe("cropped");

  const pan = captureCamera(
    { view: "top", target: [250, 400, 900] },
    plate,
    size,
  );
  expectVector(pan.centre, [250, 400, 0]);
  expect(pan.mmPerPixel).toBe(fit.mmPerPixel);
  expect(captureFrame(pan, [plate], size)).toBe("cropped");
});

test("supports a fixed view height, a degenerate fit, and a half-pixel frame margin", () => {
  expect(captureCamera({ viewHeight: 76.8 }, plate, size).mmPerPixel).toBe(
    76.8 / 768,
  );
  const point: Bounds3 = { min: [7, 5, 1], max: [7, 5, 1] };
  expect(captureCamera({ view: "top" }, point, size).mmPerPixel).toBe(1e-6);

  const small = { width: 10, height: 10 };
  const camera = captureCamera(
    { view: "top", target: [0, 0, 0], viewHeight: 10 },
    plate,
    small,
  );
  const inside: Bounds3 = { min: [-5.5, -5.5, 0], max: [5.5, 5.5, 5] };
  const outside: Bounds3 = { min: [5.51, 0, 0], max: [7, 1, 1] };
  expect(captureFrame(camera, [inside], small)).toBe("complete");
  expect(captureFrame(camera, [inside, outside], small)).toBe("cropped");
});

test("fits the union of the projected body boxes when they are supplied", () => {
  const low: Bounds3 = { min: [-52, -52, 0], max: [-48, -48, 1] };
  const high: Bounds3 = { min: [48, 48, 0], max: [52, 52, 1] };
  const bounds = { min: low.min, max: high.max };
  const fit = captureCamera({}, bounds, size, [low, high]);
  expect(fit.mmPerPixel).toBeLessThan(
    captureCamera({}, bounds, size).mmPerPixel,
  );
  expect(captureFrame(fit, [low, high], size)).toBe("complete");
  expect(captureFrame(fit, [bounds], size)).toBe("cropped");
});
