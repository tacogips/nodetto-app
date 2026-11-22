import { cross3, type Vec3 } from "../cad/vec.ts";

export type CaptureView =
  | "iso"
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export interface CaptureCameraRequest {
  readonly view?: CaptureView;
  readonly direction?: Vec3;
  readonly eye?: Vec3;
  readonly target?: Vec3;
  readonly up?: Vec3;
  readonly zoom?: number;
  /** Millimetres visible over the picture height. Replaces fit and zoom. */
  readonly viewHeight?: number;
}

export interface CaptureCamera {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly forward: Vec3;
  readonly centre: Vec3;
  readonly mmPerPixel: number;
  readonly view: CaptureView | "custom";
}

export type Bounds3 = { readonly min: Vec3; readonly max: Vec3 };

interface PictureSize {
  readonly width: number;
  readonly height: number;
}

const DIRECTIONS: Record<CaptureView, Vec3> = {
  iso: [-1, -1, -1],
  front: [0, 1, 0],
  back: [0, -1, 0],
  left: [1, 0, 0],
  right: [-1, 0, 0],
  top: [0, 0, -1],
  bottom: [0, 0, 1],
};

function unit([x, y, z]: Vec3, message: string): Vec3 {
  // Scale first so squaring a very large or very small component is safe.
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  if (scale === 0 || !Number.isFinite(scale)) throw new RangeError(message);
  const a = x / scale;
  const b = y / scale;
  const c = z / scale;
  const length = Math.sqrt(a * a + b * b + c * c);
  return [a / length, b / length, c / length];
}

function dot([x, y, z]: Vec3, [a, b, c]: Vec3): number {
  return x * a + y * b + z * c;
}

/** The two extreme corners along this basis vector. */
function projectedRange(
  { min, max }: Bounds3,
  [x, y, z]: Vec3,
): readonly [number, number] {
  const ax = min[0] * x;
  const bx = max[0] * x;
  const ay = min[1] * y;
  const by = max[1] * y;
  const az = min[2] * z;
  const bz = max[2] * z;
  return [
    Math.min(ax, bx) + Math.min(ay, by) + Math.min(az, bz),
    Math.max(ax, bx) + Math.max(ay, by) + Math.max(az, bz),
  ];
}

function fitRange(
  basis: Vec3,
  bounds: Bounds3,
  bodyBounds: readonly Bounds3[],
): readonly [number, number] {
  if (bodyBounds.length === 0) return projectedRange(bounds, basis);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const box of bodyBounds) {
    const [lower, upper] = projectedRange(box, basis);
    min = Math.min(min, lower);
    max = Math.max(max, upper);
  }
  return [min, max];
}

/** Fit an orthographic camera. Use the individual boxes when available so
 * oblique views do not fit empty corners of the combined model box.
 */
export function captureCamera(
  request: CaptureCameraRequest,
  bounds: Bounds3,
  { width, height }: PictureSize,
  bodyBounds: readonly Bounds3[] = [],
): CaptureCamera {
  const { direction, eye, target, viewHeight } = request;
  const namedView = request.view ?? "iso";
  const zoom = request.zoom ?? 1;
  if (!Number.isFinite(zoom) || zoom < 0.01 || zoom > 1000)
    throw new RangeError("Capture zoom must be between 0.01 and 1000.");
  if (viewHeight !== undefined) {
    if (!Number.isFinite(viewHeight) || viewHeight <= 0 || viewHeight > 1e7)
      throw new RangeError(
        "Capture view height must be positive and at most 10000000 mm.",
      );
    if (request.zoom !== undefined)
      throw new RangeError("Capture view height and zoom cannot be combined.");
  }
  if (
    !(
      width > 0 &&
      height > 0 &&
      Number.isFinite(width) &&
      Number.isFinite(height)
    )
  )
    throw new RangeError(
      "Capture image dimensions must be positive and finite.",
    );
  if (target && !target.every(Number.isFinite))
    throw new RangeError("Capture target must have finite coordinates.");

  let sight = direction;
  if (sight === undefined && eye !== undefined) {
    const { min, max } = bounds;
    const [x, y, z] = target ?? [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ];
    sight = [x - eye[0], y - eye[1], z - eye[2]];
  }
  const forward = unit(
    sight ?? DIRECTIONS[namedView],
    "Capture direction must be finite and nonzero. Choose an eye distinct from the target.",
  );
  const defaultUp: Vec3 =
    Math.abs(forward[0]) <= 1e-9 && Math.abs(forward[1]) <= 1e-9
      ? [0, forward[2] < 0 ? 1 : -1, 0]
      : [0, 0, 1];
  const requestedUp = request.up
    ? unit(request.up, "Capture up must be finite and nonzero.")
    : defaultUp;
  const parallelUp =
    "Capture up must not be parallel to the viewing direction.";
  let right = unit(cross3(forward, requestedUp), parallelUp);
  let up = cross3(right, forward);
  // Normalising a tiny cross product can amplify roundoff along forward.
  if (Math.abs(dot(right, forward)) > Number.EPSILON) {
    up = unit(up, parallelUp);
    right = cross3(forward, up);
  }
  const [minX, maxX] = fitRange(right, bounds, bodyBounds);
  const [minY, maxY] = fitRange(up, bounds, bodyBounds);
  const cx = target ? dot(target, right) : (minX + maxX) / 2;
  const cy = target ? dot(target, up) : (minY + maxY) / 2;
  const centre: Vec3 = [
    right[0] * cx + up[0] * cy,
    right[1] * cx + up[1] * cy,
    right[2] * cx + up[2] * cy,
  ];
  const fit = Math.max((maxX - minX) / width, (maxY - minY) / height);
  const mmPerPixel =
    viewHeight === undefined
      ? Math.max((fit * 1.08) / zoom, 1e-6)
      : viewHeight / height;
  return {
    right,
    up,
    forward,
    centre,
    mmPerPixel,
    view: sight ? "custom" : namedView,
  };
}

/** Report cropping with half a pixel of slack on every edge. */
export function captureFrame(
  { right, up, centre, mmPerPixel }: CaptureCamera,
  boxes: readonly Bounds3[],
  { width, height }: PictureSize,
): "complete" | "cropped" {
  const cx = dot(centre, right);
  const cy = dot(centre, up);
  const halfWidth = (width / 2 + 0.5) * mmPerPixel;
  const halfHeight = (height / 2 + 0.5) * mmPerPixel;
  for (const box of boxes) {
    const [minX, maxX] = projectedRange(box, right);
    const [minY, maxY] = projectedRange(box, up);
    if (
      minX < cx - halfWidth ||
      maxX > cx + halfWidth ||
      minY < cy - halfHeight ||
      maxY > cy + halfHeight
    )
      return "cropped";
  }
  return "complete";
}
