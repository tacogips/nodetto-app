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

export interface CadCaptureRequest {
  readonly camera: CaptureCameraRequest;
  readonly width: number;
  readonly height: number;
  readonly theme: CaptureTheme;
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
  const model = buildCadCaptureModel(elements, pageId);
  if (model.bounds === null)
    throw new CaptureInputError(
      `has no solid body yet (${model.sketches} sketches, ${model.errors.length} features failed). Add an extrude with op "new", or fix the errors below; sketches alone cannot be captured yet.`,
      model.errors,
    );

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
      interference: null,
    });
    return { scene, model, camera, frame };
  } catch (error) {
    if (error instanceof RangeError) throw new CaptureInputError(error.message);
    throw error;
  }
}
