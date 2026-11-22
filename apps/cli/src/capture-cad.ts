import {
  type CadCaptureRequest,
  type CaptureCameraRequest,
  CaptureInputError,
  type CaptureView,
  parseSolidReport,
  prepareCadCapture,
} from "@nodetto/core";
import type { Element, Page } from "@nodetto/ir";
import type { CaptureBackend } from "./capture-command.ts";
import { shortIds } from "./ids.ts";

export const CAMERA_OPTIONS = [
  "--view",
  "--direction",
  "--eye",
  "--target",
  "--up",
  "--zoom",
] as const;

export const ARTWORK_OPTIONS = [
  "--element",
  "--padding",
  "--background",
  "--scale",
  "--font-dir",
] as const;

function view(value: string | undefined): CaptureView | undefined {
  switch (value) {
    case undefined:
    case "iso":
    case "front":
    case "back":
    case "left":
    case "right":
    case "top":
    case "bottom":
      return value;
    default:
      throw new CaptureInputError(
        "--view must be iso, front, back, left, right, top or bottom.",
      );
  }
}

function vector(
  options: ReadonlyMap<string, string>,
  option: string,
): readonly [number, number, number] | undefined {
  const value = options.get(option);
  if (value === undefined) return undefined;
  const parts = value.split(",");
  const [x, y, z] = parts.map(Number);
  if (
    parts.length !== 3 ||
    parts.some((part) => part.trim() === "") ||
    x === undefined ||
    y === undefined ||
    z === undefined ||
    ![x, y, z].every(Number.isFinite)
  )
    throw new CaptureInputError(
      `${option} must be three comma-separated finite numbers.`,
    );
  return [x, y, z];
}

export function cadCameraOptions(
  options: ReadonlyMap<string, string>,
): CaptureCameraRequest {
  const named = view(options.get("--view"));
  if (
    named !== undefined &&
    (options.has("--direction") || options.has("--eye"))
  )
    throw new CaptureInputError(
      "--view cannot be combined with --direction or --eye.",
    );
  if (options.has("--direction") && options.has("--eye"))
    throw new CaptureInputError(
      "--direction and --eye cannot be used together.",
    );
  const zoom = Number(options.get("--zoom") ?? "1");
  if (!Number.isFinite(zoom) || zoom < 0.01 || zoom > 1000)
    throw new CaptureInputError("--zoom must be between 0.01 and 1000.");
  return {
    view: named,
    direction: vector(options, "--direction"),
    eye: vector(options, "--eye"),
    target: vector(options, "--target"),
    up: vector(options, "--up"),
    zoom,
  };
}

function errorLines(
  elements: readonly Element[],
  errors: readonly { id: string; code: string }[],
): string[] {
  if (errors.length === 0) return [];
  const ids = shortIds(elements.map(({ id }) => id));
  return errors.map(({ id, code }) => `  ${ids.get(id) ?? id} ${code}`);
}

const STATE_NOTE = {
  drawn: "",
  hidden: " [hidden behind other bodies]",
  absent: " [not in the picture]",
  outside: " [outside the picture]",
  empty: " [no material]",
  unknown: " [not sampled]",
};

function textVector(values: readonly number[]): string {
  return values.map((value) => Number(value.toFixed(5))).join(",");
}

export function renderCadCapture(
  elements: readonly Element[],
  page: Page,
  request: CadCaptureRequest,
  renderSolid: NonNullable<CaptureBackend["renderSolid"]>,
  format: "png" | "jpg",
  quality: number,
) {
  const { scene, model, camera, frame } = prepareCadCapture(
    elements,
    page.id,
    request,
  );
  const rendered = renderSolid(scene, format, quality);
  const report = parseSolidReport(rendered.report);
  if (
    report.width !== request.width ||
    report.height !== request.height ||
    report.bodies.length !== model.bodies.length
  )
    throw new Error(
      "The solid capture report does not match the requested scene.",
    );
  const bodies = report.bodies.map(({ state }, index) => {
    const body = model.bodies[index];
    if (!body) throw new Error("Missing body in the solid capture scene.");
    return { id: body.id, name: body.name, state };
  });
  const names = bodies
    .slice(0, 8)
    .map(({ name, state }) => name + STATE_NOTE[state]);
  if (bodies.length > 8) names.push("...");
  const { view, forward: direction, right, up, centre, mmPerPixel } = camera;
  return {
    width: report.width,
    height: report.height,
    image: rendered.image,
    metadata: {
      camera: { view, direction, up, right, centre, mmPerPixel },
      frame,
      bodies,
      errors: model.errors,
    },
    lines: [
      `camera: view=${view} direction=${textVector(direction)} up=${textVector(up)} centre=${textVector(centre)} scale=${Number(mmPerPixel.toPrecision(4))} mm/px`,
      `frame: ${frame}`,
      `bodies: ${bodies.length} (${names.join(", ")})`,
      `errors: ${model.errors.length}`,
      ...errorLines(elements, model.errors),
    ],
  };
}

export function cadInputMessage(
  error: CaptureInputError,
  page: Page,
  elements: readonly Element[],
): string {
  if (!error.errors) return error.message;
  return [
    `Page ${JSON.stringify(page.name)} ${error.message}`,
    ...errorLines(elements, error.errors),
  ].join("\n");
}
