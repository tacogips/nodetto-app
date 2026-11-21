import { expect, test } from "bun:test";
import { baseFrame, faceFrame, type Vec3 } from "@nodetto/core";
import {
  alignToFrame,
  type Camera3d,
  fitBounds,
  orbit,
  pan,
  screenRay,
  viewProjection,
  zoomAt,
} from "./camera3d.ts";

function project(matrix: Float32Array, [x, y, z]: Vec3): Vec3 {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  function axis(i: number): number {
    return (
      (matrix[i] * x + matrix[i + 4] * y + matrix[i + 8] * z + matrix[i + 12]) /
      w
    );
  }
  return [axis(0), axis(1), axis(2)];
}

function at(ray: ReturnType<typeof screenRay>, t: number): Vec3 {
  return [
    ray.origin[0] + t * ray.dir[0],
    ray.origin[1] + t * ray.dir[1],
    ray.origin[2] + t * ray.dir[2],
  ];
}

function expectVector(actual: Vec3, expected: Vec3): void {
  for (const axis of [0, 1, 2] as const) {
    expect(actual[axis]).toBeCloseTo(expected[axis], 6);
  }
}

test("fit contains every corner of a unit cube at wide and tall aspects", () => {
  for (const aspect of [0.15, 1, 2.2]) {
    const matrix = viewProjection(
      fitBounds([3, 2, 7], [4, 3, 8], aspect),
      aspect,
    );
    for (const x of [3, 4]) {
      for (const y of [2, 3]) {
        for (const z of [7, 8]) {
          for (const coordinate of project(matrix, [x, y, z])) {
            expect(Math.abs(coordinate)).toBeLessThan(1);
          }
        }
      }
    }
  }
});

test("empty bounds fit a 100 mm cube and a single point stays centered", () => {
  const empty = fitBounds(
    [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ],
    [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ],
    2,
  );
  expect(empty).toEqual(fitBounds([-50, -50, -50], [50, 50, 50], 2));
  expect(fitBounds([1, 2, 3], [1, 2, 3], 2)).toMatchObject({
    target: [1, 2, 3],
    distance: 0.1,
  });
});

const camera: Camera3d = {
  target: [11, -5, 3],
  yaw: 0.7,
  pitch: 0.4,
  distance: 60,
  ortho: false,
};

test("orbit keeps its target and distance and stops short of both poles", () => {
  const up = orbit(camera, 25, 5000);
  const down = orbit(camera, 25, -5000);
  expect(up.target).toEqual(camera.target);
  expect(up.distance).toBe(camera.distance);
  expect(up.yaw).not.toBe(camera.yaw);
  expect(up.pitch).toBeGreaterThan(camera.pitch);
  expect(up.pitch).toBeLessThan(Math.PI / 2);
  expect(down.pitch).toBe(-up.pitch);
});

test("orbit respects the screen axes of a zx-aligned sketch", () => {
  const aligned = alignToFrame(baseFrame("zx"), 100);
  const point: Vec3 = [0, 10, 0];
  const [x, y] = project(viewProjection(orbit(aligned, 40, 0), 1), point);
  expect(Math.abs(x)).toBeGreaterThan(0.04);
  expect(y).toBeCloseTo(0, 6);
  const [verticalX, verticalY] = project(
    viewProjection(orbit(aligned, 0, 40), 1),
    point,
  );
  expect(verticalX).toBeCloseTo(0, 6);
  expect(Math.abs(verticalY)).toBeGreaterThan(0.04);
});

test("zoom changes distance within the CAD range", () => {
  expect(zoomAt(camera, 0.5)).toEqual({ ...camera, distance: 30 });
  expect(zoomAt(camera, 0.00001).distance).toBe(0.1);
  expect(zoomAt(camera, 1_000_000).distance).toBe(100_000);
});

test("nonfinite or nonpositive zoom factors leave the camera valid", () => {
  for (const factor of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1])
    expect(zoomAt(camera, factor)).toBe(camera);
});

test("pan moves the scene by the pointer delta at the target depth", () => {
  for (const ortho of [false, true]) {
    const original = { ...camera, ortho, roll: 0.3 };
    const moved = pan(original, 120, 90, 600);
    const aspect = 2;
    const [x, y, z] = project(viewProjection(moved, aspect), original.target);
    expect(x).toBeCloseTo(120 / 600, 6);
    expect(y).toBeCloseTo(-180 / 600, 6);
    expect(z).toBeCloseTo(
      project(viewProjection(original, aspect), original.target)[2],
      6,
    );
    expect(pan(original, 120, 90, 0)).toBe(original);
  }
});

test("center and off-center rays agree with both projection modes", () => {
  for (const ortho of [false, true]) {
    const c = { ...camera, ortho, roll: 0.3 };
    const aspect = 1.4;
    const center = screenRay(c, aspect, 0, 0);
    const centerDepth = Math.hypot(
      center.origin[0] - c.target[0],
      center.origin[1] - c.target[1],
      center.origin[2] - c.target[2],
    );
    expectVector(at(center, centerDepth), c.target);

    const ray = screenRay(c, aspect, -0.72, 0.49);
    const matrix = viewProjection(c, aspect);
    const [nearX, nearY, nearZ] = project(matrix, ray.origin);
    // The Float32 matrix rounds its translation before the near-plane divide.
    const nearTolerance = 0.00002;
    expect(Math.abs(nearX + 0.72)).toBeLessThan(nearTolerance);
    expect(Math.abs(nearY - 0.49)).toBeLessThan(nearTolerance);
    expect(Math.abs(nearZ + 1)).toBeLessThan(nearTolerance);
    const [x, y] = project(matrix, at(ray, 55));
    expect(x).toBeCloseTo(-0.72, 6);
    expect(y).toBeCloseTo(0.49, 6);
    expect(Math.hypot(...ray.dir)).toBeCloseTo(1, 12);
    if (ortho) expect(ray.dir).toEqual(center.dir);
  }
});

test("aligned sketch frames put U to the right and V up, including a rotated side face", () => {
  const xy = baseFrame("xy", 6);
  const side = faceFrame(baseFrame("zx"), { t0: 3, t1: 7 }, "side", {
    a: [1, 2],
    b: [4, -2],
  });
  for (const frame of [xy, baseFrame("yz"), baseFrame("zx"), side]) {
    const aligned = alignToFrame(frame, 40);
    expect(aligned.target).toEqual(frame.o);
    expect(aligned.ortho).toBe(true);
    const ray = screenRay(aligned, 1, 0, 0);
    expectVector(ray.dir, [-frame.n[0], -frame.n[1], -frame.n[2]]);
    const matrix = viewProjection(aligned, 1);
    const [ox, oy, oz] = frame.o;
    const [uRight, uUp] = project(matrix, [
      ox + frame.u[0],
      oy + frame.u[1],
      oz + frame.u[2],
    ]);
    const [vRight, vUp] = project(matrix, [
      ox + frame.v[0],
      oy + frame.v[1],
      oz + frame.v[2],
    ]);
    expect(uRight).toBeGreaterThan(0);
    expect(vUp).toBeGreaterThan(0);
    expect(uUp).toBeCloseTo(0, 6);
    expect(vRight).toBeCloseTo(0, 6);
  }
});
