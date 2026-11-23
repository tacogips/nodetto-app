import type { TriangleMesh } from "../types.ts";

type Point = readonly [number, number];

function extrude(
  profile: readonly Point[],
  caps: readonly number[],
  boundaries: readonly (readonly number[])[],
): TriangleMesh {
  const layerSize = profile.length;
  const positions = new Float64Array(layerSize * 6);
  for (let index = 0; index < layerSize; index++) {
    const [x, y] = profile[index];
    positions.set([x, y, 0], index * 3);
    positions.set([x, y, 3], (index + layerSize) * 3);
  }
  const triangles: number[] = [];
  for (let index = 0; index < caps.length; index += 3) {
    const [a, initialB, initialC] = caps.slice(index, index + 3);
    const [ax, ay] = profile[a];
    const [bx, by] = profile[initialB];
    const [cx, cy] = profile[initialC];
    const positive = (bx - ax) * (cy - ay) > (by - ay) * (cx - ax);
    const b = positive ? initialB : initialC;
    const c = positive ? initialC : initialB;
    triangles.push(a, c, b, a + layerSize, b + layerSize, c + layerSize);
  }
  for (const ring of boundaries) {
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      triangles.push(a, b, b + layerSize, a, b + layerSize, a + layerSize);
    }
  }
  return { positions, triangles: Uint32Array.from(triangles) };
}

function ring(size: number, centerX: number): Point[] {
  return Array.from({ length: size }, (_, index) => {
    const angle = (2 * Math.PI * index) / size;
    return [centerX + Math.cos(angle), Math.sin(angle)];
  });
}

export function prism(segments: number): TriangleMesh {
  const caps: number[] = [];
  for (let index = 1; index < segments - 1; index++)
    caps.push(0, index, index + 1);
  return extrude(ring(segments, 0), caps, [
    Array.from({ length: segments }, (_, index) => index),
  ]);
}

export function plate(holes: number): TriangleMesh {
  const profile: Point[] = [
    [-2, -3],
    [holes * 3 + 2, -3],
    [holes * 3 + 2, 3],
    [-2, 3],
  ];
  const [bottomLeft, bottomRight, topRight, topLeft] = [0, 1, 2, 3];
  const boundaries = [[bottomLeft, bottomRight, topRight, topLeft]];
  if (holes === 0) return extrude(profile, [0, 1, 2, 0, 2, 3], boundaries);

  const segments = 64;
  const quarter = segments / 4;
  const half = segments / 2;
  const holeVertex = (hole: number, step: number) =>
    4 + hole * segments + ((step + segments) % segments);
  for (let hole = 0; hole < holes; hole++) {
    profile.push(...ring(segments, hole * 3));
    boundaries.push(
      Array.from({ length: segments }, (_, index) => holeVertex(hole, -index)),
    );
  }

  const caps: number[] = [];
  // Each half-circle has a matching chain at the same heights on the
  // adjacent hole. Join those chains with quads, then cap the end gaps.
  const last = holes - 1;
  for (let step = 0; step < half; step++) {
    const left = holeVertex(0, quarter + step);
    const nextLeft = holeVertex(0, quarter + step + 1);
    const right = holeVertex(last, quarter - step);
    const nextRight = holeVertex(last, quarter - step - 1);
    caps.push(step < quarter ? topLeft : bottomLeft, left, nextLeft);
    caps.push(step < quarter ? topRight : bottomRight, right, nextRight);
    for (let hole = 0; hole < last; hole++) {
      const a = holeVertex(hole, quarter - step);
      const b = holeVertex(hole, quarter - step - 1);
      const c = holeVertex(hole + 1, quarter + step);
      const d = holeVertex(hole + 1, quarter + step + 1);
      caps.push(a, b, d, a, d, c);
    }
  }
  caps.push(topLeft, holeVertex(0, half), bottomLeft);
  caps.push(topRight, holeVertex(last, 0), bottomRight);
  for (const [first, final, step] of [
    [topLeft, topRight, quarter],
    [bottomLeft, bottomRight, -quarter],
  ]) {
    for (let hole = 0; hole < last; hole++) {
      caps.push(first, holeVertex(hole, step), holeVertex(hole + 1, step));
    }
    caps.push(first, holeVertex(last, step), final);
  }
  return extrude(profile, caps, boundaries);
}

export function sphere(
  slices: number,
  stacks: number,
  noise = false,
): TriangleMesh {
  const positions = [0, 0, 31];
  const triangles: number[] = [];
  let seed = 872509;
  for (let stack = 1; stack < stacks; stack++) {
    const latitude = (Math.PI * stack) / stacks;
    for (let slice = 0; slice < slices; slice++) {
      const longitude = (2 * Math.PI * slice) / slices;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const radius = 31 + (noise ? (seed / 2 ** 32 - 0.5) * 0.4 : 0);
      positions.push(
        radius * Math.sin(latitude) * Math.cos(longitude),
        radius * Math.sin(latitude) * Math.sin(longitude),
        radius * Math.cos(latitude),
      );
      const current = 1 + (stack - 1) * slices;
      const next = (slice + 1) % slices;
      if (stack === 1) triangles.push(0, current + slice, current + next);
      if (stack > 1) {
        const previous = current - slices;
        triangles.push(previous + slice, current + slice, current + next);
        triangles.push(previous + slice, current + next, previous + next);
      }
      if (stack === stacks - 1) {
        triangles.push(
          current + slice,
          1 + (stacks - 1) * slices,
          current + next,
        );
      }
    }
  }
  positions.push(0, 0, -31);
  return {
    positions: Float64Array.from(positions),
    triangles: Uint32Array.from(triangles),
  };
}

export function torus(slices: number, stacks: number): TriangleMesh {
  const positions: number[] = [];
  const triangles: number[] = [];
  for (let slice = 0; slice < slices; slice++) {
    const longitude = (2 * Math.PI * slice) / slices;
    for (let stack = 0; stack < stacks; stack++) {
      const latitude = (2 * Math.PI * stack) / stacks;
      const radius = 24 + 7 * Math.cos(latitude);
      positions.push(
        radius * Math.cos(longitude),
        radius * Math.sin(longitude),
        7 * Math.sin(latitude),
      );
      const nextStack = (stack + 1) % stacks;
      const current = slice * stacks;
      const next = ((slice + 1) % slices) * stacks;
      triangles.push(current + stack, next + stack, next + nextStack);
      triangles.push(current + stack, next + nextStack, current + nextStack);
    }
  }
  return {
    positions: Float64Array.from(positions),
    triangles: Uint32Array.from(triangles),
  };
}
