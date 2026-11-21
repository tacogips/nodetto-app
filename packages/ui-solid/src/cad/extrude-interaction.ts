import { type CadFrame, toWorld, type Vec3 } from "@nodetto/core";
import { type Camera3d, viewProjection } from "./camera3d.ts";

export interface ExtrudeDrag {
  readonly startDistance: number;
  readonly distance: number;
}

type Point = { x: number; y: number };

export const CAD_DRAG_THRESHOLD = 3;

export function extrudeTip(
  frame: CadFrame,
  distance: number,
  symmetric = false,
): Vec3 {
  return toWorld(frame, [0, 0], symmetric ? distance / 2 : distance);
}

function clip(
  matrix: Float32Array,
  row: number,
  [x, y, z]: Vec3,
  offset: number,
): number {
  return matrix[row] * x + matrix[row + 4] * y + matrix[row + 8] * z + offset;
}

export function projectExtrudePoint(
  matrix: Float32Array,
  point: Vec3,
): Point | null {
  const w = clip(matrix, 3, point, matrix[15]);
  const depth = clip(matrix, 2, point, matrix[14]);
  return w > 0 && Math.abs(depth) <= w
    ? {
        x: clip(matrix, 0, point, matrix[12]) / w,
        y: clip(matrix, 1, point, matrix[13]) / w,
      }
    : null;
}

/** Pointer positions are normalized device coordinates. */
export function dragDistance(
  frame: CadFrame,
  camera: Camera3d,
  aspect: number,
  from: Point,
  to: Point,
  start: number,
  options: { symmetric?: boolean; previous?: number } = {},
): number {
  const normalScale = options.symmetric ? 0.5 : 1;
  const matrix = viewProjection(camera, aspect);
  const tip = extrudeTip(frame, start, options.symmetric);
  const point = projectExtrudePoint(matrix, tip);
  if (!point) return start;
  const w = clip(matrix, 3, tip, matrix[15]);
  const dw = clip(matrix, 3, frame.n, 0) * normalScale;
  // The screen axis is measured in equal-sized pixels on both axes.
  const x =
    ((clip(matrix, 0, frame.n, 0) * normalScale - point.x * dw) * aspect) / w;
  const y = (clip(matrix, 1, frame.n, 0) * normalScale - point.y * dw) / w;
  const lengthSquared = x * x + y * y;
  if (lengthSquared < 1e-16) return start;
  const projected =
    ((to.x - from.x) * aspect * x + (to.y - from.y) * y) / lengthSquared;
  if (!Number.isFinite(projected) || Math.abs(projected) < 1e-8) return start;
  // In perspective the displacement is divided by the changing clip w.
  // Invert it so the handle tip follows the pointer along the screen axis.
  const divisor = 1 - (projected * dw) / w;
  const raw =
    divisor > 0 ? start + projected / divisor : 10_000 * Math.sign(projected);
  const clamped = Math.max(-10_000, Math.min(10_000, raw));
  const snapped = Math.round(clamped * 10) / 10;
  return snapped || (Math.sign(options.previous ?? start) || 1) / 10;
}
