import type { CaptureCameraRequest } from "@nodetto/core";
import { cameraAxes, cameraViewHeight, type Camera3d } from "./camera3d.ts";

export function captureRequestFromCamera(
  camera: Camera3d,
): CaptureCameraRequest {
  const { back, up } = cameraAxes(camera);
  return {
    direction: [-back[0], -back[1], -back[2]],
    up,
    target: camera.target,
    viewHeight: cameraViewHeight(camera),
  };
}
