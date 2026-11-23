import type { Element, PageId } from "@nodetto/ir";
import {
  type CaptureCamera,
  type CaptureCameraRequest,
  captureCamera,
  captureFrame,
} from "./camera.ts";
import { writeCaptureScene } from "./scene-binary.ts";
import { type CadCaptureModel, buildCadCaptureModel } from "./scene.ts";
import { CAPTURE_THEMES, type CaptureTheme } from "./theme.ts";

export interface CadCaptureInterference {
  readonly cellMm: number;
  readonly bodies?: readonly string[];
}

export type CaptureMeshDecoder = (data: string) => {
  readonly positions: Float64Array;
  readonly triangles: Uint32Array;
};

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
      const names = model.bodies.map((body) => body.name).join(", ");
      const indices = new Set<number>();
      for (const query of bodies) {
        const matches = model.bodies.flatMap((body, index) =>
          body.id === query || body.id.startsWith(query) || body.name === query
            ? [index]
            : [],
        );
        if (query.length === 0 || matches.length !== 1)
          throw new CaptureInputError(
            `Body query "${query}" is unknown or ambiguous. Bodies: ${names}.`,
          );
        indices.add(matches[0] as number);
      }
      if (indices.size < 2)
        throw new CaptureInputError(
          `Select at least two distinct bodies. Bodies: ${names}.`,
        );
      selected = [...indices].sort((a, b) => a - b);
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
    const scene = writeCaptureScene(model, {
      width: request.width,
      height: request.height,
      camera,
      supersample: 2,
      colours: CAPTURE_THEMES[request.theme],
      referenceOpacity: 0.45,
      interference,
    });
    return { scene, model, camera, frame };
  } catch (error) {
    if (error instanceof RangeError)
      throw new CaptureInputError(error.message, undefined, true);
    throw error;
  }
}
