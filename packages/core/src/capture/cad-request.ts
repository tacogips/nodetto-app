import type { Element, PageId } from "@nodetto/ir";
import {
  type CaptureCamera,
  type CaptureCameraRequest,
  captureCamera,
  captureFrame,
} from "./camera.ts";
import {
  type CaptureSceneOptions,
  checkScenePreTool,
  writeCaptureScene,
} from "./scene-binary.ts";
import { type CadCaptureModel, buildCadCaptureModel } from "./scene.ts";
import { CAPTURE_THEMES, type CaptureTheme } from "./theme.ts";

export interface CadCaptureInterference {
  readonly cellMm: number;
  readonly bodies?: readonly string[];
}

export interface CaptureMeshDecodeOptions {
  readonly maxVertices?: number;
  readonly needTarget?: boolean;
}

export interface CaptureMeshDecodeResult {
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  } | null;
  readonly booleanTarget?: boolean;
  readonly positions?: Float64Array;
  readonly triangles?: Uint32Array;
}

export type CaptureMeshDecoder = (
  data: string,
  options: CaptureMeshDecodeOptions,
) => CaptureMeshDecodeResult;

export const DEFAULT_CAD_INTERFERENCE: CadCaptureInterference = Object.freeze({
  cellMm: 0.25,
});

export interface CadCaptureRequest {
  readonly camera: CaptureCameraRequest;
  readonly width: number;
  readonly height: number;
  readonly theme: CaptureTheme;
  readonly interference?: CadCaptureInterference | null;
  readonly decodeMesh?: CaptureMeshDecoder;
  // Test-only counter for indexed body selection.
  readonly selectionStats?: { lookups: number };
}

export interface PreparedCadCapture {
  readonly scene: Uint8Array;
  readonly model: CadCaptureModel;
  readonly camera: CaptureCamera;
  readonly frame: "complete" | "cropped";
}

export class CaptureInputError extends Error {
  constructor(
    message: string,
    // Present for the no-body case, including when no features failed.
    readonly errors?: CadCaptureModel["errors"],
    // The document exceeds a capture limit; the options are not at fault.
    readonly limit = false,
  ) {
    super(message);
    this.name = "CaptureInputError";
  }
}

function resolveInterferenceBodies(
  bodies: CadCaptureModel["bodies"],
  queries: readonly string[],
  stats?: { lookups: number },
): number[] {
  const ids = new Map<string, number>();
  const names = new Map<string, number[]>();
  const sorted: Array<readonly [string, number]> = [];
  bodies.forEach((body, index) => {
    ids.set(body.id, index);
    const matches = names.get(body.name) ?? [];
    matches.push(index);
    names.set(body.name, matches);
    sorted.push([body.id, index]);
  });
  sorted.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const probe = () => {
    if (stats) stats.lookups++;
  };
  const lowerBound = (value: string, afterPrefix: boolean): number => {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      probe();
      const mid = Math.floor((low + high) / 2);
      const id = sorted[mid]?.[0];
      if (
        id !== undefined &&
        (id < value || (afterPrefix && id.startsWith(value)))
      )
        low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const bodyNames = () => bodies.map((body) => body.name).join(", ");
  const selected = new Set<number>();
  for (const query of new Set(queries)) {
    probe();
    const exact = ids.get(query);
    if (query.length > 0 && exact !== undefined) {
      selected.add(exact);
      continue;
    }
    probe();
    const matches = new Set(names.get(query) ?? []);
    if (query.length > 0) {
      const start = lowerBound(query, false);
      const end = lowerBound(query, true);
      for (let i = start; i < end && matches.size < 2; i++) {
        const entry = sorted[i];
        if (entry) matches.add(entry[1]);
      }
    }
    if (query.length === 0 || matches.size !== 1)
      throw new CaptureInputError(
        `Body query "${query}" is unknown or ambiguous. Bodies: ${bodyNames()}.`,
      );
    for (const index of matches) selected.add(index);
  }
  if (selected.size < 2)
    throw new CaptureInputError(
      `Select at least two distinct bodies. Bodies: ${bodyNames()}.`,
    );
  return [...selected].sort((a, b) => a - b);
}

export function prepareCadCapture(
  elements: readonly Element[],
  pageId: PageId,
  request: CadCaptureRequest,
): PreparedCadCapture {
  const model = buildCadCaptureModel(elements, pageId, {
    decodeMesh: request.decodeMesh,
  });
  if (model.bounds === null)
    throw new CaptureInputError(
      `has no solid body yet (${model.sketches} sketches, ${model.errors.length} features failed). Add an extrude with op "new", or fix the errors below; sketches alone cannot be captured yet.`,
      model.errors,
    );

  let interference: {
    cellMm: number;
    budgetMillionRays: number;
    toleranceMm: number;
    draw: boolean;
    bodies?: readonly number[];
  } | null = null;
  if (request.interference != null) {
    const { cellMm, bodies } = request.interference;
    if (!Number.isFinite(cellMm) || cellMm < 0.01 || cellMm > 10)
      throw new CaptureInputError("Interference cell must be in 0.01..10 mm.");
    let selected: number[] | undefined;
    if (bodies !== undefined) {
      selected = resolveInterferenceBodies(
        model.bodies,
        bodies,
        request.selectionStats,
      );
    }
    interference = {
      cellMm,
      budgetMillionRays: 24,
      toleranceMm: 0.001,
      draw: true,
      bodies: selected,
    };
  }
  const boxes = model.bodies.map(({ bounds }) => bounds);
  try {
    const camera = captureCamera(request.camera, model.bounds, request, boxes);
    const frame = captureFrame(camera, boxes, request);
    const options: CaptureSceneOptions = {
      width: request.width,
      height: request.height,
      camera,
      supersample: 2,
      colours: CAPTURE_THEMES[request.theme],
      referenceOpacity: 0.45,
      interference,
    };
    checkScenePreTool(options, {
      tools: model.toolCount,
      bodies: model.bodies.length,
    });
    if (model.overLimit) throw new RangeError(model.overLimit);
    const scene = writeCaptureScene(model, options);
    return { scene, model, camera, frame };
  } catch (error) {
    if (error instanceof RangeError)
      throw new CaptureInputError(error.message, undefined, true);
    throw error;
  }
}
