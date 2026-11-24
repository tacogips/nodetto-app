import { expect, test } from "bun:test";
import { CAD_TEST_PAGE, cadElement, sketch } from "../cad/testing/documents.ts";
import { boardReference, edge, testBoard } from "../cad/testing/pcb.ts";
import { CaptureInputError, prepareCadCapture } from "./cad-request.ts";
import { type CaptureCameraRequest, captureCamera } from "./camera.ts";
import { capturePlateDocument } from "./testing/plate.ts";
import { buildCadCaptureModel } from "./scene.ts";
import { type CaptureSceneOptions, writeCaptureScene } from "./scene-binary.ts";
import { CAPTURE_THEMES } from "./theme.ts";

const size = { width: 320, height: 240, theme: "dark" } as const;
const plate = capturePlateDocument();

test("serializes a decoded mesh-only page", () => {
  const mesh = cadElement("mesh", "cad.mesh", "a0", {
    name: "Mesh",
    data: "nmesh1:UExBVEU=",
  });
  const request = { ...size, camera: { view: "iso" } } as const;
  expect(() => prepareCadCapture([mesh], CAD_TEST_PAGE.id, request)).toThrow(
    CaptureInputError,
  );
  const result = prepareCadCapture([mesh], CAD_TEST_PAGE.id, {
    ...request,
    decodeMesh: () => ({
      vertexCount: 8,
      triangleCount: 12,
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      positions: new Float64Array([
        0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
      ]),
      triangles: new Uint32Array([
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
        2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
      ]),
    }),
  });
  expect(result.model.tools).toHaveLength(1);
  expect(result.model.tools[0]?.kind).toBe("mesh");
  const view = new DataView(
    result.scene.buffer,
    result.scene.byteOffset,
    result.scene.byteLength,
  );
  expect(view.getUint32(176, true)).toBe(1);
});

test.each([
  { view: "iso" },
  { view: "top" },
  { view: "bottom" },
  { view: "front" },
  { view: "back" },
  { view: "left" },
  { view: "right" },
  { direction: [0, 1, -0.15] },
  { eye: [100, 200, 300], target: [12, 6, 2] },
  { view: "front", up: [1, 0, 1], zoom: 3, target: [4, 9, 1] },
] satisfies CaptureCameraRequest[])(
  "serializes the requested camera, size and sampling for %j",
  (request) => {
    const { scene, camera, model } = prepareCadCapture(
      plate.elements,
      CAD_TEST_PAGE.id,
      { ...size, camera: request },
    );
    if (!model.bounds) throw new Error("Missing bounds");
    expect(camera).toEqual(
      captureCamera(
        request,
        model.bounds,
        size,
        model.bodies.map((body) => body.bounds),
      ),
    );
    const view = new DataView(scene.buffer, scene.byteOffset, scene.byteLength);
    expect(
      [8, 12, 16, 28].map((offset) => view.getUint32(offset, true)),
    ).toEqual([size.width, size.height, 2, 0]);
    expect(
      Array.from({ length: 13 }, (_, i) => view.getFloat64(40 + i * 8, true)),
    ).toEqual([
      ...camera.right,
      ...camera.up,
      ...camera.forward,
      ...camera.centre,
      camera.mmPerPixel,
    ]);
    expect([...scene.subarray(160, 163)]).toEqual([0x15, 0x19, 0x1b]);
    expect(scene[172]).toBe(115);
    expect(
      prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
        ...size,
        camera: request,
      }).scene,
    ).toEqual(scene);
  },
);

test("reports a sketch-only page and rejects a degenerate camera", () => {
  expect(() =>
    prepareCadCapture([sketch("base", "a1")], CAD_TEST_PAGE.id, {
      ...size,
      camera: {},
    }),
  ).toThrow("1 sketches, 0 features failed");
  const run = () =>
    prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
      ...size,
      camera: { view: "top", up: [0, 0, 2] },
    });
  expect(run).toThrow(CaptureInputError);
  expect(run).toThrow("must not be parallel");
});

test("prepares CAD capture using the outline on a separate PCB page", () => {
  const board = testBoard(1.6);
  const outline = edge("outline", {
    kind: "rect",
    start: [4, 8],
    end: [44, 38],
  });
  const reference = boardReference();
  const result = prepareCadCapture(
    [reference, board, outline],
    CAD_TEST_PAGE.id,
    {
      ...size,
      camera: { view: "top" },
    },
  );
  expect(result.model.errors).toEqual([]);
  expect(result.model.bodies).toMatchObject([
    {
      id: reference.id,
      reference: true,
      bounds: { min: [0, 0, 0], max: [40, 30, 1.6] },
    },
  ]);
  expect(result.frame).toBe("complete");
});

test("interference request preserves default fixture and selects bodies", async () => {
  const { readFileSync } = await import("node:fs");
  const { DEFAULT_CAD_INTERFERENCE } = await import("./cad-request.ts");
  const request = {
    width: 1024,
    height: 768,
    theme: "light",
    camera: { view: "iso" },
  } as const;
  const run = (
    interference?: import("./cad-request.ts").CadCaptureInterference | null,
  ) =>
    prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
      ...request,
      interference,
    });
  const fixture = new Uint8Array(
    readFileSync(
      new URL(
        "../../../../apps/cli/src/__fixtures__/capture-plate-no-interference.ncs1",
        import.meta.url,
      ),
    ),
  );
  expect(run().scene).toEqual(fixture);
  expect(run(null).scene).toEqual(fixture);
  expect(
    prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
      ...request,
      decodeMesh: () => {
        throw new Error("not called");
      },
    }).scene,
  ).toEqual(fixture);
  expect(Object.isFrozen(DEFAULT_CAD_INTERFERENCE)).toBe(true);
  const all = run(DEFAULT_CAD_INTERFERENCE);
  const defaultFixture = new Uint8Array(
    readFileSync(
      new URL(
        "../../../../apps/cli/src/__fixtures__/capture-plate-default.ncs1",
        import.meta.url,
      ),
    ),
  );
  expect(all.scene).toEqual(defaultFixture);
  const view = new DataView(
    all.scene.buffer,
    all.scene.byteOffset,
    all.scene.byteLength,
  );
  expect(view.getUint32(28, true)).toBe(3);
  expect(view.getUint32(32, true)).toBe(24);
  expect(view.getFloat64(144, true)).toBe(0.001);
  expect(view.getFloat64(152, true)).toBe(0.25);
  const bodyBytes = all.model.bodies.reduce(
    (sum, body) => sum + 8 + body.steps.length * 8,
    0,
  );
  const flags = (scene: Uint8Array) => {
    const data = new DataView(scene.buffer, scene.byteOffset, scene.byteLength);
    let offset = scene.length - bodyBytes;
    return all.model.bodies.map((body) => {
      const flag = data.getUint32(offset, true);
      offset += 8 + body.steps.length * 8;
      return flag & 2;
    });
  };
  expect(flags(all.scene)).toEqual(all.model.bodies.map(() => 2));
  expect(flags(run({ cellMm: 1, bodies: ["Plate", "blo"] }).scene)).toEqual([
    2, 2, 0,
  ]);
  for (const bodies of [["missing"], ["p"], ["Plate"], ["Plate", "plate"]]) {
    expect(() => run({ cellMm: 1, bodies })).toThrow(CaptureInputError);
    expect(() => run({ cellMm: 1, bodies })).toThrow("Plate, Block, Puck");
  }
  for (const cellMm of [0.009, 11, Number.NaN, Number.POSITIVE_INFINITY])
    expect(() => run({ cellMm })).toThrow(CaptureInputError);
});

function selectionDocument(count: number) {
  return Array.from({ length: count }, (_, i) =>
    cadElement(
      `part${String(i).padStart(5, "0")}-extra`,
      "cad.mesh",
      `a${String(i).padStart(5, "0")}`,
      {
        name: `Name ${i}`,
        data: "nmesh1:UExBVEU=",
      },
    ),
  );
}

const selectionMesh = () => ({
  vertexCount: 4,
  triangleCount: 4,
  bounds: { min: [0, 0, 0] as const, max: [1, 1, 1] as const },
  positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  triangles: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
});

test("body selection prioritizes exact ids and preserves ordered distinct results", () => {
  const elements = [
    cadElement("part", "cad.mesh", "a1", {
      name: "First",
      data: "nmesh1:UExBVEU=",
    }),
    cadElement("part-extra", "cad.mesh", "a2", {
      name: "part",
      data: "nmesh1:UExBVEU=",
    }),
  ];
  const run = (bodies: string[]) =>
    prepareCadCapture(elements, CAD_TEST_PAGE.id, {
      ...size,
      camera: {},
      decodeMesh: selectionMesh,
      interference: { cellMm: 1, bodies },
    });
  expect(run(["part", "part-extra"]).scene).toEqual(
    run(["part-extra", "part", "part"]).scene,
  );
  expect(() => run(["par", "part-extra"])).toThrow(
    'Body query "par" is unknown or ambiguous. Bodies: First, part.',
  );
  expect(() => run(["", "part"])).toThrow(
    'Body query "" is unknown or ambiguous. Bodies: First, part.',
  );
});

test("body selection uses bounded indexed lookups for large models", () => {
  const stats = { lookups: 0 };
  const queries = Array.from({ length: 500 }, (_, i) => {
    if (i % 3 === 0) return `part${String(i).padStart(5, "0")}-extra`;
    if (i % 3 === 1) return `Name ${i}`;
    return `part${String(i).padStart(5, "0")}-`;
  });
  const result = prepareCadCapture(selectionDocument(5000), CAD_TEST_PAGE.id, {
    ...size,
    camera: {},
    decodeMesh: selectionMesh,
    selectionStats: stats,
    interference: { cellMm: 1, bodies: queries },
  });
  expect(result.model.bodies).toHaveLength(5000);
  expect(stats.lookups).toBeLessThanOrEqual(
    500 * (2 + 2 * Math.ceil(Math.log2(5000))),
  );
});

test("writer header precedes pending point limit", () => {
  const elements = [
    cadElement("seed-limit", "cad.mesh", "a1", {
      name: "Seed",
      data: "nmesh1:UExBVEU=",
    }),
    cadElement("excess-limit", "cad.mesh", "a2", {
      name: "Excess",
      data: "nmesh1:UExBVEU=",
    }),
  ];
  let calls = 0;
  const decodeMesh = () => ({
    ...selectionMesh(),
    vertexCount: ++calls % 2 ? 4_000_000 : 4,
  });
  const model = buildCadCaptureModel(elements, CAD_TEST_PAGE.id, {
    decodeMesh,
  });
  expect(model.overLimit).toBe(
    "Capture scene total point count must be an integer in 0..4000000.",
  );
  const { camera } = prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
    ...size,
    camera: {},
  });
  expect(() =>
    writeCaptureScene(model, {
      width: size.width,
      height: size.height,
      camera,
      supersample: 4 as CaptureSceneOptions["supersample"],
      colours: CAPTURE_THEMES.dark,
      referenceOpacity: 0.45,
      interference: null,
    }),
  ).toThrow("Capture scene supersample must be an integer in 1..3.");
  calls = 0;
  expect(() =>
    prepareCadCapture(elements, CAD_TEST_PAGE.id, {
      ...size,
      camera: {},
      decodeMesh,
    }),
  ).toThrow(
    "Capture scene total point count must be an integer in 0..4000000.",
  );
});
