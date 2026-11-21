import { type CadXY, roundNm } from "@nodetto/ir";
import { coordinate, NM_PER_MM } from "./vec.ts";

export const CAD_CHORD_TOLERANCE_MM = 0.01;
export const CAD_MAX_BISECTION_DEPTH = 6;

function appendPoint(out: number[], x: number, y: number): void {
  const snappedX = roundNm(x);
  const snappedY = roundNm(y);
  if (out.at(-2) !== snappedX || out.at(-1) !== snappedY) {
    out.push(snappedX, snappedY);
  }
}

/** Emit chord starts in traversal order. The caller owns the last endpoint. */
function appendChord(
  out: number[],
  origin: CadXY,
  radius: number,
  direction: 1 | -1,
  start: CadXY,
  end: CadXY,
  startApothem?: number,
): void {
  const stack: number[] = [];
  let ax = start[0];
  let ay = start[1];
  let bx = end[0];
  let by = end[1];
  let depth = 0;
  for (;;) {
    const dx = bx - ax;
    const dy = by - ay;
    const halfChordSquared = (dx * dx + dy * dy) / 4;
    const apothem =
      depth === 0 && startApothem !== undefined
        ? startApothem
        : -Math.sqrt(Math.max(0, radius * radius - halfChordSquared));
    // Rationalize r - apothem to keep shallow arcs accurate.
    const sagitta =
      apothem >= 0 ? radius + apothem : halfChordSquared / (radius - apothem);
    if (depth < CAD_MAX_BISECTION_DEPTH && sagitta > CAD_CHORD_TOLERANCE_MM) {
      depth += 1;
      stack.push(bx, by, depth);
      const scale = (direction * sagitta) / (2 * Math.sqrt(halfChordSquared));
      bx = (ax + bx) / 2 + dy * scale;
      by = (ay + by) / 2 - dx * scale;
      continue;
    }
    appendPoint(out, origin[0] + ax, origin[1] + ay);
    const next = stack.length - 3;
    if (next < 0) break;
    ax = bx;
    ay = by;
    bx = coordinate(stack, next);
    by = coordinate(stack, next + 1);
    depth = coordinate(stack, next + 2);
    stack.length = next;
  }
}

export function tessellateCircle(c: CadXY, r: number): number[] {
  const out: number[] = [];
  appendChord(out, c, r, 1, [r, 0], [0, r]);
  appendChord(out, c, r, 1, [0, r], [-r, 0]);
  appendChord(out, c, r, 1, [-r, 0], [0, -r]);
  appendChord(out, c, r, 1, [0, -r], [r, 0]);
  return out;
}

function signedApothem(
  start: CadXY,
  end: CadXY,
  cx: number,
  cy: number,
  direction: 1 | -1,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  // The sign is positive when the centre lies on the major arc's side.
  return (
    (direction * ((cx - start[0]) * dy - (cy - start[1]) * dx)) /
    Math.sqrt(dx * dx + dy * dy)
  );
}

export function tessellateArc(a: CadXY, m: CadXY, b: CadXY): number[] | null {
  const ax = Math.round(a[0] * NM_PER_MM);
  const ay = Math.round(a[1] * NM_PER_MM);
  const mx = BigInt(Math.round(m[0] * NM_PER_MM) - ax);
  const my = BigInt(Math.round(m[1] * NM_PER_MM) - ay);
  const bx = BigInt(Math.round(b[0] * NM_PER_MM) - ax);
  const by = BigInt(Math.round(b[1] * NM_PER_MM) - ay);
  const determinant = mx * by - my * bx;
  if (determinant === 0n) return null;

  // Solve the perpendicular bisectors relative to a. Keep the products
  // exact until division to avoid cancellation at nearly collinear points.
  const mSquared = mx * mx + my * my;
  const bSquared = bx * bx + by * by;
  const denominator = 2 * Number(determinant) * NM_PER_MM;
  const cx = Number(by * mSquared - my * bSquared) / denominator;
  const cy = Number(mx * bSquared - bx * mSquared) / denominator;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const direction = determinant > 0n ? 1 : -1;
  const start: CadXY = [0, 0];
  const middle: CadXY = [Number(mx) / NM_PER_MM, Number(my) / NM_PER_MM];
  const end: CadXY = [Number(bx) / NM_PER_MM, Number(by) / NM_PER_MM];

  // Project the centre for the stored chords to distinguish major arcs
  // and avoid the ill-conditioned square root of a nearly diametric chord.
  const firstApothem = signedApothem(start, middle, cx, cy, direction);
  const secondApothem = signedApothem(middle, end, cx, cy, direction);
  const out: number[] = [];
  appendChord(out, a, radius, direction, start, middle, firstApothem);
  appendChord(out, a, radius, direction, middle, end, secondApothem);
  appendPoint(out, b[0], b[1]);
  return out;
}
