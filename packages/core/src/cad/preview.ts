import {
  type CadExtrudeSemantic,
  type Element,
  type ElementId,
  getElementTypeDefinition,
} from "@nodetto/ir";
import { type CadFrame, extrudeSpan } from "./frames.ts";
import { extrudeGeometryOf } from "./history.ts";
import { prismTool } from "./tool-solid.ts";
import { coordinate } from "./vec.ts";

type PreviewMesh = { positions: Float32Array; indices: Uint32Array };
type PreviewError = { error: string };

interface PreparedPreview {
  readonly frame: CadFrame;
  mesh(distance: number): PreviewMesh | PreviewError;
}

// Cache the contour triangulation at the start of editing. The pointer only
// translates the two caps along the normal and uploads the new positions.
export function prepareExtrudePreview(
  elements: readonly Element[],
  extrude: CadExtrudeSemantic,
  id: ElementId,
): PreparedPreview | PreviewError {
  if (
    getElementTypeDefinition("cad.extrude")?.validateSemantic(
      extrude,
      "semantic",
    ).length !== 0
  )
    return { error: "cad.feature.invalid" };
  if (Math.abs(extrude.distance) > 10_000) return { error: "cad.limit" };
  const geometry = extrudeGeometryOf(elements, extrude);
  if ("ok" in geometry) return { error: geometry.code };
  const { frame, loops } = geometry;
  const first = loops.find(({ depth }) => depth % 2 === 0);
  if (!first) return { error: "cad.profile.empty" };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < first.points.length; i += 2) {
    const x = coordinate(first.points, i);
    const y = coordinate(first.points, i + 1);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const x = (minX + maxX) / 2;
  const y = (minY + maxY) / 2;
  const anchor: CadFrame = {
    ...frame,
    o: [
      frame.o[0] + frame.u[0] * x + frame.v[0] * y,
      frame.o[1] + frame.u[1] * x + frame.v[1] * y,
      frame.o[2] + frame.u[2] * x + frame.v[2] * y,
    ],
  };

  let tools: ReturnType<typeof prismTool>[];
  try {
    tools = loops.map((loop) => prismTool(loop, frame, { t0: 0, t1: 1 }, id));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { error: "cad.profile.invalid" };
  }
  const indices = new Uint32Array(
    tools.reduce((sum, tool) => sum + tool.triangles.length, 0),
  );
  let indexOffset = 0;
  let positionsLength = 0;
  for (const tool of tools) {
    const base = positionsLength / 3;
    for (const index of tool.triangles) indices[indexOffset++] = base + index;
    positionsLength += tool.positions.length;
  }
  const reversed = indices.slice();
  for (let i = 0; i < reversed.length; i += 3) {
    reversed[i + 1] = coordinate(indices, i + 2);
    reversed[i + 2] = coordinate(indices, i + 1);
  }
  return {
    frame: anchor,
    mesh(distance) {
      if (!Number.isFinite(distance) || distance === 0)
        return { error: "cad.feature.invalid" };
      if (Math.abs(distance) > 10_000) return { error: "cad.limit" };
      const { t0, t1 } = extrudeSpan({ ...extrude, distance });
      const positions = new Float32Array(positionsLength);
      let offset = 0;
      for (const tool of tools) {
        // Both planes use the same base coordinates.
        const capLength = tool.positions.length / 2;
        for (let i = 0; i < capLength; i += 3) {
          for (const axis of [0, 1, 2] as const) {
            const base = coordinate(tool.positions, i + axis);
            const start = base + frame.n[axis] * t0;
            const end = base + frame.n[axis] * t1;
            if (Math.max(Math.abs(start), Math.abs(end)) > 10_000 + 1e-9)
              return { error: "cad.limit" };
            positions[offset + i + axis] = start;
            positions[offset + capLength + i + axis] = end;
          }
        }
        offset += tool.positions.length;
      }
      return { positions, indices: distance > 0 ? indices : reversed };
    },
  };
}

export function extrudePreviewMesh(
  elements: readonly Element[],
  extrude: CadExtrudeSemantic,
  id: ElementId,
): PreviewMesh | PreviewError {
  const preview = prepareExtrudePreview(elements, extrude, id);
  return "error" in preview ? preview : preview.mesh(extrude.distance);
}
