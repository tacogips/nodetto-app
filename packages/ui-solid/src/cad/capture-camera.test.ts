import { expect, test } from "bun:test";
import { captureCamera } from "@nodetto/core";
import { captureRequestFromCamera } from "./capture-camera.ts";
import { cameraViewHeight, type Camera3d } from "./camera3d.ts";

test("viewport camera produces capture direction, up and scale", () => {
  const camera: Camera3d = {
    target: [1, 2, 3],
    yaw: Math.PI / 4,
    pitch: Math.PI / 6,
    distance: 100,
    ortho: true,
  };
  const request = captureRequestFromCamera(camera);
  expect(request.direction?.every((v) => v < 0)).toBe(true);
  expect(request.up?.[2]).toBeGreaterThan(0);
  expect(request.target).toEqual(camera.target);
  expect(request.viewHeight).toBe(cameraViewHeight(camera));
  expect(captureRequestFromCamera({ ...camera, distance: 50 }).viewHeight).toBe(
    cameraViewHeight(camera) / 2,
  );
  const result = captureCamera(
    request,
    { min: [0, 0, 0], max: [10, 10, 10] },
    { width: 1024, height: 768 },
  );
  expect(result.mmPerPixel).toBeCloseTo(cameraViewHeight(camera) / 768);
  for (const v of [result.forward, result.up, result.right])
    expect(Math.hypot(...v)).toBeCloseTo(1);
  expect(
    result.forward.reduce((sum, n, i) => sum + n * (result.up[i] ?? 0), 0),
  ).toBeCloseTo(0);
  const top = captureRequestFromCamera({ ...camera, pitch: Math.PI / 2 });
  expect(top.direction?.[2]).toBeCloseTo(-1);
  expect(Math.hypot(...(top.up ?? [0, 0, 0]))).toBeCloseTo(1);
});
