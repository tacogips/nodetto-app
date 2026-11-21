import type { CadDisplayBody, Vec3 } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";

export interface CadPick {
  readonly bodyId: ElementId;
  readonly faceName: string;
  readonly t: number;
  readonly point: Vec3;
}

// Allow roundoff in the barycentric coordinates on a shared edge.
const EDGE_EPSILON = 32 * Number.EPSILON;

export function pickBodies(
  bodies: readonly CadDisplayBody[],
  ray: { origin: Vec3; dir: Vec3 },
): CadPick | null {
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.dir;
  let nearest = Number.POSITIVE_INFINITY;
  let bodyId: ElementId | undefined;
  let faceName = "";

  for (const { id, positions, indices, triFace, faceNames } of bodies) {
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const a = indices[i] * 3;
      const b = indices[i + 1] * 3;
      const c = indices[i + 2] * 3;
      const ax = positions[a];
      const ay = positions[a + 1];
      const az = positions[a + 2];
      const e1x = positions[b] - ax;
      const e1y = positions[b + 1] - ay;
      const e1z = positions[b + 2] - az;
      const e2x = positions[c] - ax;
      const e2y = positions[c + 1] - ay;
      const e2z = positions[c + 2] - az;

      // Two-sided Möller–Trumbore with a scale-relative parallel test.
      const px = dy * e2z - dz * e2y;
      const py = dz * e2x - dx * e2z;
      const pz = dx * e2y - dy * e2x;
      const termX = e1x * px;
      const termY = e1y * py;
      const termZ = e1z * pz;
      const det = termX + termY + termZ;
      const error =
        8 *
        Number.EPSILON *
        (Math.abs(termX) + Math.abs(termY) + Math.abs(termZ));
      if (Math.abs(det) <= error) continue;

      const sx = ox - ax;
      const sy = oy - ay;
      const sz = oz - az;
      const inverse = 1 / det;
      const u = (sx * px + sy * py + sz * pz) * inverse;
      if (u < -EDGE_EPSILON || u > 1 + EDGE_EPSILON) continue;

      const qx = sy * e1z - sz * e1y;
      const qy = sz * e1x - sx * e1z;
      const qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inverse;
      if (v < -EDGE_EPSILON || u + v > 1 + EDGE_EPSILON) continue;

      const t = (e2x * qx + e2y * qy + e2z * qz) * inverse;
      if (!(t > 0 && t < nearest)) continue;
      const name = faceNames[triFace[i / 3]];
      if (name === undefined) continue;
      nearest = t;
      bodyId = id;
      faceName = name;
    }
  }

  if (bodyId === undefined) return null;
  return {
    bodyId,
    faceName,
    t: nearest,
    point: [ox + nearest * dx, oy + nearest * dy, oz + nearest * dz],
  };
}
