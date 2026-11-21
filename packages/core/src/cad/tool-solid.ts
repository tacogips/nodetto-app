import type { CadFaceRef, ElementId } from "@nodetto/ir";
import type { CadFrame } from "./frames.ts";
import type { ToolMesh } from "./kernel.ts";
import type { CadLoop } from "./loops.ts";
import { triangulateSimplePolygon } from "./triangulate.ts";
import { coordinate } from "./vec.ts";

function escapeFaceId(id: ElementId): string {
  return id.replaceAll("%", "%25").replaceAll(":", "%3A");
}

export function faceName(
  feature: ElementId,
  role: "start" | "end" | "side",
  entity?: ElementId,
): string {
  return entity === undefined
    ? `${escapeFaceId(feature)}:${role}`
    : `${escapeFaceId(feature)}:${role}:${escapeFaceId(entity)}`;
}

export function parseFaceName(name: string): CadFaceRef | null {
  const [source, role, side, extra] = name.split(":");
  if (!source || extra !== undefined) return null;
  const unescapeId = (id: string) =>
    id.replaceAll("%3A", ":").replaceAll("%25", "%");
  const feature = unescapeId(source);
  if (role === "side" && side)
    return { feature, role, entity: unescapeId(side) };
  if ((role === "start" || role === "end") && side === undefined)
    return { feature, role };
  return null;
}

export function prismTool(
  loop: CadLoop,
  { o, u, v, n }: CadFrame,
  { t0, t1 }: { t0: number; t1: number },
  feature: ElementId,
): ToolMesh {
  const count = loop.points.length / 2;
  const cap = triangulateSimplePolygon(loop.points);
  if (count < 3 || cap.length !== (count - 2) * 3 || t0 === t1) {
    throw new RangeError(
      "A prism requires a triangulable profile and a nonzero span",
    );
  }

  const positions = new Float64Array(count * 6);
  const triangles = new Uint32Array(cap.length * 2 + count * 6);
  const triFace = new Uint32Array(triangles.length / 3);
  const faceNames = [faceName(feature, "start"), faceName(feature, "end")];
  const sideIds = new Map<ElementId, number>();
  const forward = t1 > t0;
  let triangle = 0;
  function emit(a: number, b: number, c: number, face: number): void {
    const i = triangle * 3;
    triangles[i] = a;
    triangles[i + 1] = forward ? b : c;
    triangles[i + 2] = forward ? c : b;
    triFace[triangle] = face;
    triangle += 1;
  }

  for (let i = 0; i < cap.length; i += 3) {
    const a = coordinate(cap, i);
    const b = coordinate(cap, i + 1);
    const c = coordinate(cap, i + 2);
    emit(a, c, b, 0);
    emit(a + count, b + count, c + count, 1);
  }
  for (let i = 0; i < count; i += 1) {
    const x = coordinate(loop.points, i * 2);
    const y = coordinate(loop.points, i * 2 + 1);
    for (const axis of [0, 1, 2] as const) {
      const base = o[axis] + u[axis] * x + v[axis] * y;
      positions[i * 3 + axis] = base + n[axis] * t0;
      positions[(i + count) * 3 + axis] = base + n[axis] * t1;
    }
    const source = loop.sources[i];
    if (source === undefined)
      throw new RangeError("A prism edge requires a source");
    let face = sideIds.get(source);
    if (face === undefined) {
      face = faceNames.length;
      faceNames.push(faceName(feature, "side", source));
      sideIds.set(source, face);
    }
    const j = (i + 1) % count;
    emit(i, j, j + count, face);
    emit(i, j + count, i + count, face);
  }
  return { positions, triangles, triFace, faceNames };
}
