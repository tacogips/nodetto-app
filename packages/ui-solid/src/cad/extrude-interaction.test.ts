import { expect, test } from "bun:test";
import { baseFrame } from "@nodetto/core";
import { alignToFrame, type Camera3d, viewProjection } from "./camera3d.ts";
import {
  dragDistance,
  extrudeTip,
  projectExtrudePoint,
} from "./extrude-interaction.ts";

const frame = baseFrame("xy");
const aspect = 1.75;
const camera: Camera3d = {
  yaw: 0.45,
  pitch: 0.65,
  target: [12, 5, 2],
  distance: 100,
  ortho: false,
};

function projected(view: Camera3d, distance: number, symmetric = false) {
  const point = projectExtrudePoint(
    viewProjection(view, aspect),
    extrudeTip(frame, distance, symmetric),
  );
  if (!point) throw new Error("Test point is outside the view");
  return point;
}

for (const ortho of [false, true]) {
  test(`dragging follows the projected normal and snaps in the ${ortho ? "orthographic" : "perspective"} view`, () => {
    const view = { ...camera, ortho };
    const from = projected(view, 10);
    expect(
      dragDistance(frame, view, aspect, from, projected(view, 13.47), 10),
    ).toBe(13.5);
    expect(
      dragDistance(frame, view, aspect, from, projected(view, -2.94), 10),
    ).toBe(-2.9);
    expect(
      dragDistance(frame, view, aspect, from, projected(view, 0), 10),
    ).toBe(0.1);
    expect(
      dragDistance(frame, view, aspect, from, projected(view, 0), 10, {
        previous: -1,
      }),
    ).toBe(-0.1);
  });
}

test("symmetric features move the end cap by half the distance", () => {
  const from = projected(camera, 5, true);
  const to = projected(camera, -4.6, true);
  expect(
    dragDistance(frame, camera, aspect, from, to, 5, { symmetric: true }),
  ).toBe(-4.6);
});

test("stationary, perpendicular and face-on inputs keep the current distance", () => {
  const start = 3.234567;
  const from = projected(camera, start);
  const along = projected(camera, start + 1);
  const across = {
    x: from.x + (along.y - from.y) / aspect,
    y: from.y - (along.x - from.x) * aspect,
  };
  expect(dragDistance(frame, camera, aspect, from, from, start)).toBe(start);
  expect(dragDistance(frame, camera, aspect, from, across, start)).toBe(start);
  expect(
    dragDistance(frame, alignToFrame(frame, 100), aspect, from, along, start),
  ).toBe(start);
  expect(
    dragDistance(frame, camera, aspect, from, { x: Number.NaN, y: 0 }, start),
  ).toBe(start);
});
