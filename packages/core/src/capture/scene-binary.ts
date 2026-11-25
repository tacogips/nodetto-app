import type { ElementId } from "@nodetto/ir";
import type { CaptureCamera } from "./camera.ts";
import type { CaptureBody, CaptureTool } from "./scene.ts";

export interface CaptureSceneOptions {
  readonly width: number;
  readonly height: number;
  readonly supersample: 1 | 2 | 3;
  readonly camera: CaptureCamera;
  readonly colours: {
    readonly background: string;
    readonly body: string;
    readonly edge: string;
    readonly interference: string;
  };
  readonly referenceOpacity: number;
  readonly interference: {
    readonly cellMm: number;
    readonly budgetMillionRays: number;
    readonly toleranceMm: number;
    readonly draw: boolean;
    /** Indices of the bodies that take part. Undefined means all. */
    readonly bodies?: readonly number[];
  } | null;
}

export interface CaptureMeshTool {
  readonly kind: "mesh";
  readonly feature: ElementId;
  readonly positions: Float64Array;
  readonly triangles: Uint32Array;
}

interface CaptureSceneModel {
  readonly tools: readonly (CaptureTool | CaptureMeshTool)[];
  readonly bodies: readonly CaptureBody[];
  readonly hiddenTargets?: readonly { readonly steps: CaptureBody["steps"] }[];
}

const HEADER_BYTES = 176;
const MAX_U32 = 0xffffffff;
export const MAX_POINTS = 4_000_000;
const OP = { union: 0, difference: 1, intersection: 2 } as const;

function boundedInteger(
  name: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new RangeError(
      `Capture scene ${name} must be an integer in ${min}..${max}.`,
    );
}

function boundedReal(
  name: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`Capture scene ${name} must be in ${min}..${max}.`);
}

function colour(value: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new RangeError("Capture scene colours must use #rrggbb.");
  return Number.parseInt(value.slice(1), 16);
}

export interface PointCharge {
  points: number;
}

export function chargeTool(
  state: PointCharge,
  tool:
    | { kind: "prism"; loopCounts: readonly number[] }
    | { kind: "mesh"; vertices: number; triangles: number },
): string | undefined {
  let points = state.points;
  try {
    if (tool.kind === "prism") {
      for (const count of tool.loopCounts) {
        boundedInteger("loop point count", count, 3, 20_000);
        points += count;
      }
    } else {
      boundedInteger("mesh vertex count", tool.vertices, 0, MAX_POINTS);
      boundedInteger("mesh triangle count", tool.triangles, 0, 2_000_000);
      points += tool.vertices;
    }
    boundedInteger("total point count", points, 0, MAX_POINTS);
  } catch (error) {
    if (error instanceof RangeError) return error.message;
    throw error;
  }
  state.points = points;
  return undefined;
}

function byteLength({
  tools,
  bodies,
  hiddenTargets = [],
}: CaptureSceneModel): number {
  let length = HEADER_BYTES;
  const state: PointCharge = { points: 0 };
  for (const tool of tools) {
    const error = chargeTool(
      state,
      tool.kind === "prism"
        ? {
            kind: "prism",
            loopCounts: tool.loops.map((loop) => loop.faces.length),
          }
        : {
            kind: "mesh",
            vertices: tool.positions.length / 3,
            triangles: tool.triangles.length / 3,
          },
    );
    if (error !== undefined) throw new RangeError(error);
    if (tool.kind === "prism") {
      length += 120;
      for (const loop of tool.loops) {
        const count = loop.faces.length;
        if (loop.points.length !== count * 2)
          throw new RangeError(
            "Capture scene loop points and faces do not match.",
          );
        length +=
          8 + loop.points.byteLength + loop.faces.byteLength + (count % 2) * 4;
      }
    } else {
      length +=
        16 +
        tool.positions.byteLength +
        tool.triangles.byteLength +
        (tool.triangles.length % 2) * 4;
    }
  }
  for (const { steps } of [...bodies, ...hiddenTargets]) {
    boundedInteger("body step count", steps.length, 1, MAX_U32);
    if (steps[0]?.op !== "union")
      throw new RangeError("Capture scene body must start with a union.");
    for (const step of steps)
      boundedInteger("step tool index", step.tool, 0, tools.length - 1);
    length += 8 + steps.length * 8;
  }
  boundedInteger("byte length", length, HEADER_BYTES, MAX_U32);
  return length;
}

class SceneWriter {
  private offset = 0;
  private readonly view: DataView;
  readonly bytes: Uint8Array;

  constructor(length: number) {
    this.bytes = new Uint8Array(length);
    this.view = new DataView(this.bytes.buffer);
  }

  u8(value: number): void {
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  u16(value: number): void {
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  u32(value: number): void {
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  reals(values: readonly number[]): void {
    for (const value of values) {
      boundedReal("coordinate", value, -1e7, 1e7);
      this.view.setFloat64(this.offset, value, true);
      this.offset += 8;
    }
  }

  array(values: Float64Array | Uint32Array): void {
    if (this.offset % values.BYTES_PER_ELEMENT !== 0)
      throw new RangeError("Capture scene array is misaligned.");
    this.bytes.set(
      new Uint8Array(values.buffer, values.byteOffset, values.byteLength),
      this.offset,
    );
    this.offset += values.byteLength;
  }

  rgb(value: number): void {
    this.u8(value >>> 16);
    this.u8((value >>> 8) & 255);
    this.u8(value & 255);
  }

  indices(values: Uint32Array): void {
    this.array(values);
    if (values.length % 2 !== 0) this.u32(0);
  }
}

export function checkScenePreTool(
  {
    width,
    height,
    supersample,
    camera,
    referenceOpacity,
    interference,
  }: CaptureSceneOptions,
  counts: { tools: number; bodies: number; hidden?: number },
): void {
  boundedInteger("width", width, 64, 2048);
  boundedInteger("height", height, 64, 2048);
  boundedInteger("supersample", supersample, 1, 3);
  boundedReal("reference opacity", referenceOpacity, 0, 1);
  boundedReal("camera scale", camera.mmPerPixel, 0, 1e7);
  if (camera.mmPerPixel === 0)
    throw new RangeError("Capture scene camera scale must be positive.");
  const selected = interference?.bodies;
  if (interference) {
    boundedInteger("analysis budget", interference.budgetMillionRays, 1, 256);
    boundedReal("tolerance", interference.toleranceMm, 1e-6, 1);
    boundedReal("target cell", interference.cellMm, 0.01, 10);
    for (const index of selected ?? [])
      boundedInteger("analysis body index", index, 0, counts.bodies - 1);
  }
  boundedInteger("tool count", counts.tools, 0, 20_000);
  boundedInteger("body count", counts.bodies, 0, 20_000);
  boundedInteger("hidden body count", counts.hidden ?? 0, 0, 20_000);
}

/** Write the little-endian NCS1 scene. The native reader validates the geometry. */
export function writeCaptureScene(
  model: CaptureSceneModel,
  {
    width,
    height,
    supersample,
    camera,
    colours,
    referenceOpacity,
    interference,
  }: CaptureSceneOptions,
): Uint8Array {
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1)
    throw new RangeError("Capture scenes require a little-endian platform.");
  checkScenePreTool(
    {
      width,
      height,
      supersample,
      camera,
      colours,
      referenceOpacity,
      interference,
    },
    {
      tools: model.tools.length,
      bodies: model.bodies.length,
      hidden: model.hiddenTargets?.length ?? 0,
    },
  );
  const selected = interference?.bodies;
  const analysed = selected === undefined ? undefined : new Set(selected);
  const writer = new SceneWriter(byteLength(model));

  writer.u32(0x3153434e); // NCS1
  writer.u16(1);
  writer.u16(0);
  writer.u32(width);
  writer.u32(height);
  writer.u32(supersample);
  writer.u32(model.tools.length);
  writer.u32(model.bodies.length);
  writer.u32(interference ? (interference.draw ? 3 : 1) : 0);
  writer.u32(interference?.budgetMillionRays ?? 0);
  writer.u32(model.hiddenTargets?.length ?? 0);
  writer.reals(camera.right);
  writer.reals(camera.up);
  writer.reals(camera.forward);
  writer.reals(camera.centre);
  writer.reals([
    camera.mmPerPixel,
    interference?.toleranceMm ?? 0.001,
    interference?.cellMm ?? 0.25,
  ]);
  writer.rgb(colour(colours.background));
  writer.rgb(colour(colours.body));
  writer.rgb(colour(colours.edge));
  writer.rgb(colour(colours.interference));
  writer.u8(Math.round(referenceOpacity * 255));
  writer.u8(0);
  writer.u16(0);

  for (const tool of model.tools) {
    if (tool.kind === "mesh") {
      writer.u32(1);
      writer.u32(tool.positions.length / 3);
      writer.u32(tool.triangles.length / 3);
      writer.u32(0);
      writer.array(tool.positions);
      writer.indices(tool.triangles);
      continue;
    }
    writer.u32(0);
    writer.u32(tool.loops.length);
    writer.reals(tool.frame.o);
    writer.reals(tool.frame.u);
    writer.reals(tool.frame.v);
    writer.reals(tool.frame.n);
    if (tool.t0 === tool.t1)
      throw new RangeError("Capture scene prism span must be nonzero.");
    writer.reals([tool.t0, tool.t1]);
    for (const { points, faces } of tool.loops) {
      writer.u32(faces.length);
      writer.u32(0);
      writer.array(points);
      writer.indices(faces);
    }
  }

  for (const [index, body] of model.bodies.entries()) {
    const participates =
      interference !== null && (analysed?.has(index) ?? true);
    writer.u32(Number(body.reference) | (Number(participates) << 1));
    writer.u32(body.steps.length);
    for (const { op, tool } of body.steps) {
      writer.u32(OP[op]);
      writer.u32(tool);
    }
  }
  for (const body of model.hiddenTargets ?? []) {
    writer.u32(0);
    writer.u32(body.steps.length);
    for (const { op, tool } of body.steps) {
      writer.u32(OP[op]);
      writer.u32(tool);
    }
  }
  return writer.bytes;
}
