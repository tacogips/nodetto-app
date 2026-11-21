import type { CadFrame, Vec3 } from "@nodetto/core";

export interface Camera3d {
  readonly target: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly ortho: boolean;
  /** Rotation around the view axis, used to keep sketch U pointing right. */
  readonly roll?: number;
}

const HALF_FOV = Math.PI / 8;
const TAN_HALF_FOV = Math.tan(HALF_FOV);
const MIN_DISTANCE = 0.1;
const MAX_DISTANCE = 100_000;
const ORBIT_RADIANS_PER_PIXEL = 0.005;
const MAX_ORBIT_PITCH = Math.PI / 2 - 0.0001;
const NEAR_DISTANCE_RATIO = 0.01;
// The model extent is limited to 10 m. Keep the far plane beyond the model
// when the camera zooms in on a detail.
const FAR_MARGIN = 40_000;

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cameraAxes({ yaw, pitch, roll = 0 }: Camera3d): {
  right: Vec3;
  up: Vec3;
  back: Vec3;
} {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const back: Vec3 = [cy * cp, sy * cp, sp];
  const right: Vec3 = [-sy, cy, 0];
  const up: Vec3 = [-cy * sp, -sy * sp, cp];
  if (roll === 0) return { right, up, back };

  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  return {
    right: offsetBy([0, 0, 0], right, cr, up, sr),
    up: offsetBy([0, 0, 0], up, cr, right, -sr),
    back,
  };
}

function offsetBy(p: Vec3, a: Vec3, x: number, b: Vec3, y: number): Vec3 {
  return [
    p[0] + a[0] * x + b[0] * y,
    p[1] + a[1] * x + b[1] * y,
    p[2] + a[2] * x + b[2] * y,
  ];
}

function viewAspect(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

export function orbit(camera: Camera3d, dxPx: number, dyPx: number): Camera3d {
  if (dxPx === 0 && dyPx === 0) return camera;
  const roll = camera.roll ?? 0;
  const dx = dxPx * Math.cos(roll) + dyPx * Math.sin(roll);
  const dy = dyPx * Math.cos(roll) - dxPx * Math.sin(roll);
  return {
    ...camera,
    yaw: camera.yaw - dx * ORBIT_RADIANS_PER_PIXEL,
    pitch: Math.max(
      -MAX_ORBIT_PITCH,
      Math.min(MAX_ORBIT_PITCH, camera.pitch + dy * ORBIT_RADIANS_PER_PIXEL),
    ),
  };
}

export function pan(
  camera: Camera3d,
  dxPx: number,
  dyPx: number,
  viewportHeightPx: number,
): Camera3d {
  if (viewportHeightPx <= 0) return camera;
  const { right, up } = cameraAxes(camera);
  const mmPerPixel = cameraViewHeight(camera) / viewportHeightPx;
  const target = offsetBy(
    camera.target,
    right,
    -dxPx * mmPerPixel,
    up,
    dyPx * mmPerPixel,
  );
  return { ...camera, target };
}

export function cameraViewHeight(camera: Camera3d): number {
  return 2 * camera.distance * TAN_HALF_FOV;
}

/** Factors above one move the camera farther from the target. */
export function zoomAt(camera: Camera3d, factor: number): Camera3d {
  if (!Number.isFinite(factor) || factor <= 0) return camera;
  const distance = Math.max(
    MIN_DISTANCE,
    Math.min(MAX_DISTANCE, camera.distance * factor),
  );
  return { ...camera, distance };
}

export function fitBounds(min: Vec3, max: Vec3, aspect: number): Camera3d {
  if (
    !min.every(Number.isFinite) ||
    !max.every(Number.isFinite) ||
    min[0] > max[0] ||
    min[1] > max[1] ||
    min[2] > max[2]
  ) {
    return fitBounds([-50, -50, -50], [50, 50, 50], aspect);
  }
  const target: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const radius =
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  const halfAngle = Math.atan(TAN_HALF_FOV * Math.min(1, viewAspect(aspect)));
  const distance = Math.max(
    MIN_DISTANCE,
    (1.05 * radius) / Math.sin(halfAngle),
  );
  return {
    target,
    yaw: Math.PI / 4,
    pitch: Math.PI / 6,
    distance,
    ortho: false,
  };
}

export function alignToFrame(frame: CadFrame, distance: number): Camera3d {
  const { o, u, n } = frame;
  const horizontal = Math.hypot(n[0], n[1]);
  const camera: Camera3d = {
    target: o,
    yaw: horizontal === 0 ? Math.atan2(-u[0], u[1]) : Math.atan2(n[1], n[0]),
    pitch: Math.atan2(n[2], horizontal),
    distance,
    ortho: true,
  };
  const { right, up } = cameraAxes(camera);
  return { ...camera, roll: Math.atan2(dot(u, up), dot(u, right)) };
}

/** Column-major world-to-clip matrix with WebGL depth in [-1, 1]. */
export function viewProjection(camera: Camera3d, aspect: number): Float32Array {
  const { right, up, back } = cameraAxes(camera);
  const { distance, ortho, target } = camera;
  const near = distance * NEAR_DISTANCE_RATIO;
  const far = distance + FAR_MARGIN;
  const scaleY = 1 / (TAN_HALF_FOV * (ortho ? distance : 1));
  const scaleX = scaleY / viewAspect(aspect);
  const depthScale = -(ortho ? 2 : far + near) / (far - near);
  const depthOffset = -(ortho ? far + near : 2 * far * near) / (far - near);
  const depthTranslation = -dot(back, target) - distance;
  const wScale = ortho ? 0 : -1;
  return new Float32Array([
    right[0] * scaleX,
    up[0] * scaleY,
    back[0] * depthScale,
    back[0] * wScale,
    right[1] * scaleX,
    up[1] * scaleY,
    back[1] * depthScale,
    back[1] * wScale,
    right[2] * scaleX,
    up[2] * scaleY,
    back[2] * depthScale,
    back[2] * wScale,
    -dot(right, target) * scaleX,
    -dot(up, target) * scaleY,
    depthTranslation * depthScale + depthOffset,
    ortho ? 1 : -depthTranslation,
  ]);
}

/** Starts at the near plane so picking skips geometry clipped in front of it. */
export function screenRay(
  camera: Camera3d,
  aspect: number,
  ndcX: number,
  ndcY: number,
): { origin: Vec3; dir: Vec3 } {
  const { right, up, back } = cameraAxes(camera);
  const near = camera.distance * NEAR_DISTANCE_RATIO;
  const height = TAN_HALF_FOV * (camera.ortho ? camera.distance : near);
  const x = ndcX * viewAspect(aspect) * height;
  const y = ndcY * height;
  const depth = camera.distance - near;
  const centre: Vec3 = [
    camera.target[0] + back[0] * depth,
    camera.target[1] + back[1] * depth,
    camera.target[2] + back[2] * depth,
  ];
  const origin = offsetBy(centre, right, x, up, y);
  const forward: Vec3 = [-back[0], -back[1], -back[2]];
  if (camera.ortho) return { origin, dir: forward };

  const dir = offsetBy(forward, right, x / near, up, y / near);
  const length = Math.hypot(...dir);
  return { origin, dir: [dir[0] / length, dir[1] / length, dir[2] / length] };
}
