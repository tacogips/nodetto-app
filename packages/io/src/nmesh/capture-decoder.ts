import {
  decodeNmesh,
  fromInline,
  inspectNmesh,
  toTriangleMesh,
} from "@nodetto/nmesh";

export function decodeCaptureMesh(data: string): {
  positions: Float64Array;
  triangles: Uint32Array;
} {
  const { positions, triangles } = toTriangleMesh(
    decodeNmesh(fromInline(data)),
  );
  return { positions, triangles };
}

export interface CaptureMeshDecodeOptions {
  maxVertices?: number;
  needTarget?: boolean;
  onAllocate?: (
    kind: "positions" | "triangles" | "mm" | "target",
    length: number,
  ) => void;
}
export interface CaptureMeshDecodeResult {
  vertexCount: number;
  triangleCount: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  } | null;
  booleanTarget?: boolean;
  positions?: Float64Array;
  triangles?: Uint32Array;
}

type ContactUse = { triangle: number; direction: number };
type ContactEdge = { u: number; v: number; uses: ContactUse[] };
type ContactTriangle = {
  vertices: [number, number, number];
  plane: string;
  side: number;
};

function contactEligible(q: Int32Array, indices: Uint32Array): boolean {
  const count = indices.length / 3;
  const edgeKey = (u: number, v: number) =>
    `${Math.min(u, v)},${Math.max(u, v)}`;
  const edges = new Map<string, ContactEdge>();
  const triangles: ContactTriangle[] = [];
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    let current = i;
    while (parent[root] !== root) root = parent[root] as number;
    while (parent[current] !== root) {
      const next = parent[current] as number;
      parent[current] = root;
      current = next;
    }
    return root;
  };
  const join = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const point = (i: number): [bigint, bigint, bigint] => [
    BigInt(q[i * 3] as number),
    BigInt(q[i * 3 + 1] as number),
    BigInt(q[i * 3 + 2] as number),
  ];
  const cross = (a: bigint[], b: bigint[]): [bigint, bigint, bigint] => [
    (a[1] as bigint) * (b[2] as bigint) - (a[2] as bigint) * (b[1] as bigint),
    (a[2] as bigint) * (b[0] as bigint) - (a[0] as bigint) * (b[2] as bigint),
    (a[0] as bigint) * (b[1] as bigint) - (a[1] as bigint) * (b[0] as bigint),
  ];
  const gcd = (a: bigint, b: bigint): bigint => {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) [x, y] = [y, x % y];
    return x;
  };
  for (let i = 0; i < count; i++) {
    const vertices: [number, number, number] = [
      indices[i * 3] as number,
      indices[i * 3 + 1] as number,
      indices[i * 3 + 2] as number,
    ];
    const [a, b, c] = vertices.map(point);
    if (!a || !b || !c) return false;
    const n = cross(
      b.map((v, j) => v - (a[j] as bigint)),
      c.map((v, j) => v - (a[j] as bigint)),
    );
    const divisor = gcd(gcd(n[0], n[1]), n[2]);
    if (divisor === 0n) return false;
    const reduced = n.map((v) => v / divisor);
    const first = reduced.find((v) => v !== 0n) as bigint;
    const side = first > 0n ? 1 : -1;
    const normal = reduced.map((v) => v * BigInt(side));
    const offset = normal.reduce((sum, v, j) => sum + v * (a[j] as bigint), 0n);
    triangles.push({ vertices, plane: `${normal.join(",")},${offset}`, side });
    for (const [u, v] of [
      [vertices[0], vertices[1]],
      [vertices[1], vertices[2]],
      [vertices[2], vertices[0]],
    ]) {
      const key = edgeKey(u as number, v as number);
      let edge = edges.get(key);
      if (!edge) {
        edge = {
          u: Math.min(u as number, v as number),
          v: Math.max(u as number, v as number),
          uses: [],
        };
        edges.set(key, edge);
      }
      edge.uses.push({
        triangle: i,
        direction: (u as number) < (v as number) ? 1 : -1,
      });
    }
  }
  for (const edge of edges.values()) {
    if (
      edge.uses.reduce((sum, use) => sum + use.direction, 0) !== 0 ||
      edge.uses.length % 2 !== 0
    )
      return false;
    const groups = new Map<string, ContactUse[]>();
    for (const use of edge.uses) {
      const triangle = triangles[use.triangle] as ContactTriangle;
      const key = `${triangle.plane}:${triangle.side}`;
      const group = groups.get(key) ?? [];
      group.push(use);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.length === 2 && group[0]?.direction !== group[1]?.direction)
        join(
          (group[0] as ContactUse).triangle,
          (group[1] as ContactUse).triangle,
        );
    }
  }
  const patches = new Map<
    number,
    { plane: string; side: number; triangles: number[]; boundary: string[] }
  >();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    const triangle = triangles[i] as ContactTriangle;
    let patch = patches.get(root);
    if (!patch) {
      patch = {
        plane: triangle.plane,
        side: triangle.side,
        triangles: [],
        boundary: [],
      };
      patches.set(root, patch);
    }
    patch.triangles.push(i);
  }
  for (const [key, edge] of edges) {
    const groups = new Map<number, ContactUse[]>();
    for (const use of edge.uses) {
      const root = find(use.triangle);
      const group = groups.get(root) ?? [];
      group.push(use);
      groups.set(root, group);
    }
    for (const [root, uses] of groups) {
      if (uses.length === 2 && uses[0]?.direction !== uses[1]?.direction)
        continue;
      const patch = patches.get(root);
      if (!patch) return false;
      for (const use of uses) patch.boundary.push(`${key}:${use.direction}`);
    }
  }
  const unmatched = new Map<
    string,
    typeof patches extends Map<number, infer P> ? P[] : never
  >();
  const cancelled = new Set<number>();
  const attachment = new Set<string>();
  for (const patch of patches.values()) {
    const boundary = patch.boundary.slice().sort().join(";");
    const reverse = patch.boundary
      .map((entry) =>
        entry.endsWith(":1")
          ? `${entry.slice(0, -1)}-1`
          : `${entry.slice(0, -2)}1`,
      )
      .sort()
      .join(";");
    const matchKey = `${patch.plane}|${-patch.side}|${reverse}`;
    const match = unmatched.get(matchKey)?.shift();
    if (match) {
      for (const entry of patch.boundary) {
        const key = entry.slice(0, entry.lastIndexOf(":"));
        if ((edges.get(key)?.uses.length ?? 0) < 4) return false;
        attachment.add(key);
      }
      for (const i of [...patch.triangles, ...match.triangles])
        cancelled.add(i);
    } else {
      const key = `${patch.plane}|${patch.side}|${boundary}`;
      const list = unmatched.get(key) ?? [];
      list.push(patch);
      unmatched.set(key, list);
    }
  }
  const remaining = new Map<string, ContactUse[]>();
  for (const [key, edge] of edges)
    remaining.set(
      key,
      edge.uses.filter((use) => !cancelled.has(use.triangle)),
    );
  for (const key of attachment) {
    const uses = remaining.get(key) ?? [];
    if (uses.length !== 2 || uses[0]?.direction === uses[1]?.direction)
      return false;
  }
  const faces = new Set<string>();
  for (let i = 0; i < count; i++) {
    parent[i] = i;
    if (cancelled.has(i)) continue;
    const face = (triangles[i] as ContactTriangle).vertices
      .slice()
      .sort((a, b) => a - b)
      .join(",");
    if (faces.has(face)) return false;
    faces.add(face);
  }
  for (const [key, uses] of remaining)
    if (uses.length === 2 && !attachment.has(key))
      join((uses[0] as ContactUse).triangle, (uses[1] as ContactUse).triangle);
  const sides = new Map<number, { min: number[]; max: number[] }>();
  for (let i = 0; i < count; i++) {
    if (cancelled.has(i)) continue;
    const root = find(i);
    let box = sides.get(root);
    if (!box) {
      box = {
        min: [
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ],
        max: [
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ],
      };
      sides.set(root, box);
    }
    for (const vertex of (triangles[i] as ContactTriangle).vertices)
      for (let axis = 0; axis < 3; axis++) {
        const value = q[vertex * 3 + axis] as number;
        box.min[axis] = Math.min(box.min[axis] as number, value);
        box.max[axis] = Math.max(box.max[axis] as number, value);
      }
  }
  for (const key of attachment) {
    const uses = remaining.get(key) as ContactUse[];
    const x = find((uses[0] as ContactUse).triangle);
    const y = find((uses[1] as ContactUse).triangle);
    const a = sides.get(x);
    const b = sides.get(y);
    if (
      x === y ||
      !a ||
      !b ||
      ![0, 1, 2].some(
        (axis) =>
          (a.max[axis] as number) <= (b.min[axis] as number) ||
          (b.max[axis] as number) <= (a.min[axis] as number),
      )
    )
      return false;
  }
  for (const key of attachment) {
    const uses = remaining.get(key) as ContactUse[];
    join((uses[0] as ContactUse).triangle, (uses[1] as ContactUse).triangle);
  }
  const shells = new Map<
    number,
    { min: number[]; max: number[]; volume: bigint }
  >();
  for (let i = 0; i < count; i++) {
    if (cancelled.has(i)) continue;
    const root = find(i);
    let shell = shells.get(root);
    if (!shell) {
      shell = {
        min: [
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ],
        max: [
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ],
        volume: 0n,
      };
      shells.set(root, shell);
    }
    const vertices = (triangles[i] as ContactTriangle).vertices;
    for (const vertex of vertices)
      for (let axis = 0; axis < 3; axis++) {
        const value = q[vertex * 3 + axis] as number;
        shell.min[axis] = Math.min(shell.min[axis] as number, value);
        shell.max[axis] = Math.max(shell.max[axis] as number, value);
      }
    const a = point(vertices[0]);
    const bc = cross(point(vertices[1]), point(vertices[2]));
    shell.volume += a.reduce(
      (sum, value, axis) => sum + value * (bc[axis] as bigint),
      0n,
    );
  }
  let sign = 0;
  for (const shell of shells.values()) {
    const next = shell.volume > 0n ? 1 : shell.volume < 0n ? -1 : 0;
    if (!next || (sign && sign !== next)) return false;
    sign = next;
  }
  if (!sign) return false;
  for (const uses of remaining.values()) {
    if (uses.length === 0 || uses.length === 2) continue;
    const groups = new Map<number, ContactUse[]>();
    for (const use of uses) {
      const root = find(use.triangle);
      const group = groups.get(root) ?? [];
      group.push(use);
      groups.set(root, group);
    }
    const roots = [...groups.keys()];
    for (const group of groups.values())
      if (group.length !== 2 || group[0]?.direction === group[1]?.direction)
        return false;
    for (let i = 0; i < roots.length; i++)
      for (let j = i + 1; j < roots.length; j++) {
        const a = shells.get(roots[i] as number);
        const b = shells.get(roots[j] as number);
        if (
          !a ||
          !b ||
          ![0, 1, 2].some(
            (axis) =>
              (a.max[axis] as number) <= (b.min[axis] as number) ||
              (b.max[axis] as number) <= (a.min[axis] as number),
          )
        )
          return false;
      }
  }
  return true;
}

function eligible(q: Int32Array, triangles: Uint32Array): boolean {
  const count = q.length / 3;
  if (!triangles.length) return false;
  const edges: { key: number; direction: number }[] = [];
  const faces = new Set<string>();
  const origin = [
    (q[0] as number) / 1000,
    (q[1] as number) / 1000,
    (q[2] as number) / 1000,
  ];
  let volume = 0;
  let area = 0;
  let duplicateFace = false;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] as number;
    const b = triangles[i + 1] as number;
    const c = triangles[i + 2] as number;
    if (a >= count || b >= count || c >= count || a === b || b === c || a === c)
      return false;
    const face = [a, b, c].sort((x, y) => x - y).join(",");
    if (faces.has(face)) duplicateFace = true;
    faces.add(face);
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ] as [number, number][]) {
      edges.push({
        key: Math.min(u, v) * count + Math.max(u, v),
        direction: u < v ? 1 : -1,
      });
    }
    const point = (index: number) =>
      [0, 1, 2].map(
        (axis) =>
          (q[index * 3 + axis] as number) / 1000 - (origin[axis] as number),
      );
    const pa = point(a);
    const pb = point(b);
    const pc = point(c);
    const ab = pb.map((v, j) => v - (pa[j] as number));
    const ac = pc.map((v, j) => v - (pa[j] as number));
    const cross = (x: number[], y: number[]) => [
      (x[1] as number) * (y[2] as number) - (x[2] as number) * (y[1] as number),
      (x[2] as number) * (y[0] as number) - (x[0] as number) * (y[2] as number),
      (x[0] as number) * (y[1] as number) - (x[1] as number) * (y[0] as number),
    ];
    const world = (index: number) =>
      [0, 1, 2].map((axis) => (q[index * 3 + axis] as number) / 1000);
    const wa = world(a);
    const wb = world(b);
    const wc = world(c);
    const closureNormal = cross(
      wb.map((v, j) => v - (wa[j] as number)),
      wc.map((v, j) => v - (wa[j] as number)),
    );
    const closureSquared =
      (closureNormal[0] as number) ** 2 +
      (closureNormal[1] as number) ** 2 +
      (closureNormal[2] as number) ** 2;
    if (!Number.isFinite(closureSquared) || closureSquared === 0) return false;
    const normal = cross(ab, ac);
    const squared =
      (normal[0] as number) ** 2 +
      (normal[1] as number) ** 2 +
      (normal[2] as number) ** 2;
    area += Math.sqrt(squared) / 2;
    const bc = cross(pb, pc);
    volume +=
      ((pa[0] as number) * (bc[0] as number) +
        (pa[1] as number) * (bc[1] as number) +
        (pa[2] as number) * (bc[2] as number)) /
      6;
  }
  edges.sort((a, b) => a.key - b.key);
  if (edges.some((edge, i) => edges[i + 2]?.key === edge.key)) {
    return (
      contactEligible(q, triangles) &&
      volume !== 0 &&
      2 * Math.abs(volume) >= area * 5e-7
    );
  }
  if (duplicateFace) return false;
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i];
    const b = edges[i + 1];
    if (
      !a ||
      !b ||
      a.key !== b.key ||
      a.direction === b.direction ||
      edges[i + 2]?.key === a.key
    )
      return false;
  }
  return volume !== 0 && 2 * Math.abs(volume) >= area * 5e-7;
}

export function decodeCaptureMeshWith(
  data: string,
  options: CaptureMeshDecodeOptions = {},
): CaptureMeshDecodeResult {
  const bytes = fromInline(data);
  const inspection = inspectNmesh(bytes);
  const over =
    inspection.vertexCount > (options.maxVertices ?? Number.POSITIVE_INFINITY);
  const bounds =
    inspection.min && inspection.max
      ? {
          min: inspection.min.map((v) => v / 1000) as [number, number, number],
          max: inspection.max.map((v) => v / 1000) as [number, number, number],
        }
      : null;
  const result: CaptureMeshDecodeResult = {
    vertexCount: inspection.vertexCount,
    triangleCount: inspection.triangleCount,
    bounds,
  };
  if (!over || options.needTarget) {
    const mesh = decodeNmesh(bytes, {
      onAllocate: (kind, length) =>
        options.onAllocate?.(over ? "target" : kind, length),
    });
    if (options.needTarget)
      result.booleanTarget = eligible(mesh.positions, mesh.triangles);
    if (!over) {
      options.onAllocate?.("mm", mesh.positions.length);
      const geometry = toTriangleMesh(mesh);
      result.positions = geometry.positions;
      result.triangles = geometry.triangles;
    }
  }
  return result;
}
