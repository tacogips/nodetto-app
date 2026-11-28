import {
  type CadDisplayBody,
  type Editor,
  parseFaceName,
  type Vec3,
} from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { createSignal } from "solid-js";
import type { CadPick } from "./pick.ts";

interface CadInspection {
  readonly elementId: ElementId;
  readonly bodyId: ElementId;
  readonly reference: boolean;
  readonly size: Vec3;
  readonly face?: CadPick;
}

function createInspection() {
  const [face, setFace] = createSignal<{
    readonly hit: CadPick;
    readonly body: CadDisplayBody;
  }>();
  const [details, setDetails] = createSignal<CadInspection>();
  return { face, setFace, details, setDetails };
}

const inspections = new WeakMap<Editor, ReturnType<typeof createInspection>>();

export function cadInspectionFor(editor: Editor) {
  let inspection = inspections.get(editor);
  if (!inspection) {
    inspection = createInspection();
    inspections.set(editor, inspection);
  }
  return inspection;
}

export function boundsOfPositions(sets: Iterable<Float32Array>): {
  readonly min: Vec3;
  readonly max: Vec3;
} {
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const positions of sets) {
    for (let i = 0; i + 2 < positions.length; i += 3) {
      for (const axis of [0, 1, 2] as const) {
        const value = positions[i + axis];
        if (value === undefined || !Number.isFinite(value)) continue;
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
  }
  return { min, max };
}

const millimeters = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
  useGrouping: false,
});

export function formatCadLength(value: number): string {
  return millimeters.format(value);
}

/** A feature can give disconnected surfaces the same provenance name. */
export function connectedFacePositions(
  body: CadDisplayBody,
  triangle: number,
): Float32Array {
  const { indices, positions, triFace } = body;
  const face = triFace[triangle];
  if (face === undefined) return new Float32Array();
  const selected: number[] = [];
  const append = (i: number) => {
    for (const vertex of indices.subarray(i * 3, i * 3 + 3)) {
      const offset = vertex * 3;
      selected.push(...positions.subarray(offset, offset + 3));
    }
  };
  const name = body.faceNames[face];
  if (!name || !parseFaceName(name)) {
    append(triangle);
    return new Float32Array(selected);
  }
  const edges = new Map<string, number[]>();
  const triangleEdges = new Map<number, string[]>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let i = 0; i < triFace.length; i++) {
    if (triFace[i] !== face) continue;
    const a = indices[i * 3];
    const b = indices[i * 3 + 1];
    const c = indices[i * 3 + 2];
    if (a === undefined || b === undefined || c === undefined) continue;
    const keys = [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)];
    triangleEdges.set(i, keys);
    for (const key of keys) {
      const adjacent = edges.get(key);
      if (adjacent) adjacent.push(i);
      else edges.set(key, [i]);
    }
  }

  const pending = [triangle];
  const visited = new Set(pending);
  while (pending.length) {
    const i = pending.pop();
    if (i === undefined) break;
    const keys = triangleEdges.get(i);
    if (!keys) continue;
    append(i);
    for (const key of keys) {
      for (const adjacent of edges.get(key) ?? []) {
        if (visited.has(adjacent)) continue;
        visited.add(adjacent);
        pending.push(adjacent);
      }
      edges.delete(key);
    }
  }
  return new Float32Array(selected);
}
