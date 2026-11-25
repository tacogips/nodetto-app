import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import {
  buildCadCaptureModel,
  CAPTURE_THEMES,
  type CaptureBody,
  type CaptureMeshTool,
  type CaptureSceneOptions,
  type CaptureTool,
  type CaptureView,
  captureCamera,
  writeCaptureScene,
} from "./index.ts";
import { capturePlateDocument } from "./testing/plate.ts";
import { captureSelectedLoopsDocument } from "./testing/selected-loops.ts";

const triangle: CaptureTool = {
  kind: "prism",
  feature: "triangle",
  frame: { o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] },
  t0: 0,
  t1: 1,
  // Nonzero view offsets exercise the bulk copy as well as the layout.
  loops: [
    {
      points: new Float64Array([99, 0, 0, 2, 0, 0, 3, 99]).subarray(1, 7),
      faces: new Uint32Array([99, 2, 3, 4, 99]).subarray(1, 4),
    },
  ],
};

const body: CaptureBody = {
  id: "triangle",
  name: "Triangle",
  reference: true,
  steps: [{ op: "union", tool: 0 }],
  bounds: { min: [0, 0, 0], max: [2, 3, 1] },
};

const model = { tools: [triangle], bodies: [body] };

const options: CaptureSceneOptions = {
  width: 64,
  height: 128,
  supersample: 2,
  camera: {
    right: [1, 0, 0],
    up: [0, 1, 0],
    forward: [0, 0, -1],
    centre: [1, 2, 0],
    mmPerPixel: 0.5,
    view: "top",
  },
  colours: CAPTURE_THEMES.light,
  referenceOpacity: 0.5,
  interference: null,
};

const analysis = {
  cellMm: 0.25,
  budgetMillionRays: 24,
  toleranceMm: 0.001,
  draw: true,
};
const fixtureDirectory = new URL(
  "../../../../crates/capture/tests/fixtures/",
  import.meta.url,
);

test("writes the NCS1 header and a padded three-point prism byte for byte", () => {
  const bytes = writeCaptureScene(model, options);
  const view = new DataView(bytes.buffer);
  expect([...bytes.slice(0, 8)]).toEqual([78, 67, 83, 49, 1, 0, 0, 0]);
  expect(
    [8, 12, 16, 20, 24, 28, 32, 36].map((offset) =>
      view.getUint32(offset, true),
    ),
  ).toEqual([64, 128, 2, 1, 1, 0, 0, 0]);
  expect(
    [136, 144, 152].map((offset) => view.getFloat64(offset, true)),
  ).toEqual([0.5, 0.001, 0.25]);
  expect([...bytes.slice(160, 176)]).toEqual([
    246, 244, 238, 255, 253, 248, 89, 99, 102, 51, 92, 103, 128, 0, 0, 0,
  ]);
  const expected = Buffer.from(
    [
      // Header, camera and options.
      "4e435331 01000000 40000000 80000000 02000000 01000000 01000000 00000000 00000000 00000000",
      "000000000000f03f 0000000000000000 0000000000000000",
      "0000000000000000 000000000000f03f 0000000000000000",
      "0000000000000000 0000000000000000 000000000000f0bf",
      "000000000000f03f 0000000000000040 0000000000000000",
      "000000000000e03f fca9f1d24d62503f 000000000000d03f",
      "f6f4ee fffdf8 596366 335c67 80 000000",
      // Prism kind and loop count, frame, and extrusion span.
      "00000000 01000000",
      "0000000000000000 0000000000000000 0000000000000000",
      "000000000000f03f 0000000000000000 0000000000000000",
      "0000000000000000 000000000000f03f 0000000000000000",
      "0000000000000000 0000000000000000 000000000000f03f",
      "0000000000000000 000000000000f03f",
      // Loop header, points, face IDs, padding, and one reference body.
      "03000000 00000000",
      "0000000000000000 0000000000000000 0000000000000040",
      "0000000000000000 0000000000000000 0000000000000840",
      "02000000 03000000 04000000 00000000",
      "01000000 01000000 00000000 00000000",
    ]
      .join("")
      .replaceAll(" ", ""),
    "hex",
  );
  expect(Buffer.from(bytes)).toEqual(expected);
});

test("writes a mesh with odd index padding, all operations and selected analysis bodies", () => {
  const mesh: CaptureMeshTool = {
    kind: "mesh",
    feature: "mesh",
    positions: new Float64Array([0, 0, 0, 2, 0, 0, 0, 3, 0]),
    triangles: new Uint32Array([2, 0, 1]),
  };
  const bodies: CaptureBody[] = [
    body,
    {
      ...body,
      reference: false,
      steps: [
        { op: "union", tool: 1 },
        { op: "difference", tool: 0 },
        { op: "intersection", tool: 1 },
      ],
    },
  ];
  const withAnalysis = {
    ...options,
    referenceOpacity: 1,
    interference: { ...analysis, bodies: [1] },
  };
  const data = writeCaptureScene(
    { tools: [triangle, mesh], bodies },
    withAnalysis,
  );
  const view = new DataView(data.buffer);
  expect(view.getUint32(28, true)).toBe(3);
  expect(view.getUint32(32, true)).toBe(24);
  expect(view.getUint8(172)).toBe(255);

  const meshOffset = 176 + 120 + 72;
  expect(
    [0, 4, 8, 12].map((offset) => view.getUint32(meshOffset + offset, true)),
  ).toEqual([1, 3, 1, 0]);
  expect(
    Array.from({ length: 9 }, (_, i) =>
      view.getFloat64(meshOffset + 16 + i * 8, true),
    ),
  ).toEqual([...mesh.positions]);
  const words = Array.from({ length: 16 }, (_, i) =>
    view.getUint32(meshOffset + 88 + i * 4, true),
  );
  expect(words).toEqual([
    2,
    0,
    1,
    0, // Triangle indices and padding.
    1,
    1,
    0,
    0, // Body 0: reference, not analysed.
    2,
    3,
    0,
    1,
    1,
    0,
    2,
    1, // Body 1: analysed.
  ]);
  const all = writeCaptureScene(
    { tools: [triangle, mesh], bodies },
    {
      ...withAnalysis,
      interference: { ...analysis, draw: false },
    },
  );
  const allView = new DataView(all.buffer);
  expect(allView.getUint32(28, true)).toBe(1);
  expect(allView.getUint32(meshOffset + 104, true)).toBe(3);
  expect(allView.getUint32(meshOffset + 120, true)).toBe(2);
});

test("rejects invalid writer options", () => {
  for (const [overrides, message] of [
    [{ width: 63 }, "width"],
    [{ height: 2049 }, "height"],
    [{ height: 128.5 }, "height"],
    [{ referenceOpacity: Number.NaN }, "reference opacity"],
    [{ referenceOpacity: 1.01 }, "reference opacity"],
    [{ camera: { ...options.camera, mmPerPixel: 0 } }, "camera scale"],
    [{ colours: { ...options.colours, body: "red" } }, "colours"],
    [{ interference: { ...analysis, budgetMillionRays: 0 } }, "budget"],
    [{ interference: { ...analysis, cellMm: 0.009 } }, "target cell"],
    [{ interference: { ...analysis, toleranceMm: 2 } }, "tolerance"],
    [{ interference: { ...analysis, bodies: [1] } }, "body index"],
  ] satisfies readonly [Partial<CaptureSceneOptions>, string][]) {
    expect(() =>
      writeCaptureScene(model, { ...options, ...overrides }),
    ).toThrow(new RegExp(message));
  }
});

test("checks counts, strides, prism span and body steps before emitting a scene", () => {
  const loop = {
    points: new Float64Array(40_000),
    faces: new Uint32Array(20_000),
  };
  const oversized = {
    kind: "prism",
    loops: Array.from({ length: 201 }, () => loop),
  } as const;
  const mesh: CaptureMeshTool = {
    kind: "mesh",
    feature: "bad",
    positions: new Float64Array(9),
    triangles: new Uint32Array(4),
  };
  expect(() =>
    writeCaptureScene(
      { ...model, tools: Array(20_001).fill(triangle) },
      options,
    ),
  ).toThrow("tool count");
  expect(() =>
    writeCaptureScene({ ...model, bodies: Array(20_001).fill(body) }, options),
  ).toThrow("body count");
  expect(() =>
    writeCaptureScene(
      { ...model, tools: [{ ...triangle, ...oversized }] },
      options,
    ),
  ).toThrow("total point count");
  expect(() =>
    writeCaptureScene({ ...model, tools: [{ ...triangle, t1: 0 }] }, options),
  ).toThrow("prism span");
  expect(() =>
    writeCaptureScene(
      {
        ...model,
        tools: [
          {
            ...triangle,
            loops: [{ points: new Float64Array(7), faces: new Uint32Array(3) }],
          },
        ],
      },
      options,
    ),
  ).toThrow("points and faces");
  for (const count of [2, 20_001]) {
    const loops = [
      { points: new Float64Array(count * 2), faces: new Uint32Array(count) },
    ];
    expect(() =>
      writeCaptureScene({ ...model, tools: [{ ...triangle, loops }] }, options),
    ).toThrow("loop point count");
  }
  expect(() => writeCaptureScene({ ...model, tools: [mesh] }, options)).toThrow(
    "triangle count",
  );
  expect(() =>
    writeCaptureScene({ ...model, bodies: [{ ...body, steps: [] }] }, options),
  ).toThrow("step count");
  expect(() =>
    writeCaptureScene(
      {
        ...model,
        bodies: [{ ...body, steps: [{ op: "difference", tool: 0 }] }],
      },
      options,
    ),
  ).toThrow("start with a union");
  expect(() =>
    writeCaptureScene(
      { ...model, bodies: [{ ...body, steps: [{ op: "union", tool: 1 }] }] },
      options,
    ),
  ).toThrow("step tool index");
});

function checkFixture(name: string, bytes: Uint8Array) {
  const file = new URL(name, fixtureDirectory);
  if (process.env.UPDATE_CAPTURE_FIXTURES === "1") writeFileSync(file, bytes);
  expect(readFileSync(file)).toEqual(Buffer.from(bytes));
}

function fixtureModel(
  doc: ReturnType<typeof capturePlateDocument>,
  view: CaptureView,
  size: { width: number; height: number },
) {
  const model = buildCadCaptureModel(doc.elements, "cad");
  expect(model.errors).toEqual([]);
  if (model.bounds === null)
    throw new Error("Expected nonempty fixture geometry");
  return {
    model,
    camera: captureCamera(
      { view },
      model.bounds,
      size,
      model.bodies.map(({ bounds }) => bounds),
    ),
  };
}

test("the Plate fixture is stable and serializes within 100 ms", () => {
  const size = { width: 1024, height: 768 };
  const { model, camera } = fixtureModel(capturePlateDocument(), "iso", size);
  expect(model.tools.map(({ loops }) => loops.length)).toEqual([
    1, 60, 1, 2, 1, 1, 1,
  ]);
  expect(model.bodies.map(({ name, steps }) => [name, steps.length])).toEqual([
    ["Plate", 4],
    ["Block", 1],
    ["Puck", 2],
  ]);
  const start = performance.now();
  const bytes = writeCaptureScene(model, {
    ...options,
    ...size,
    camera,
    referenceOpacity: 0.45,
    interference: analysis,
  });
  expect(performance.now() - start).toBeLessThan(100);
  checkFixture("plate-iso.ncs1", bytes);
});

test("selected loops fixture encodes a disc and slab after normalisation", () => {
  const size = { width: 640, height: 480 };
  const { model, camera } = fixtureModel(
    captureSelectedLoopsDocument(),
    "top",
    size,
  );
  expect(model.tools.map(({ loops }) => loops.length)).toEqual([1, 1]);
  expect(model.bodies.map(({ name }) => name)).toEqual(["Disc", "Slab"]);
  expect(model.bodies.map(({ bounds }) => bounds)).toEqual([
    { min: [26, 16, 0], max: [34, 24, 4] },
    { min: [80, 0, 0], max: [140, 40, 4] },
  ]);
  checkFixture(
    "selected-loops-top.ncs1",
    writeCaptureScene(model, {
      ...options,
      ...size,
      camera,
      referenceOpacity: 0.45,
    }),
  );
});

test("checks the other side of writer option bounds and accepts uppercase hex", () => {
  for (const [overrides, message] of [
    [{ width: 2049 }, "width"],
    [{ height: 63 }, "height"],
    [{ camera: { ...options.camera, mmPerPixel: 1e7 + 1 } }, "camera scale"],
    [{ referenceOpacity: -0.01 }, "reference opacity"],
    [{ interference: { ...analysis, budgetMillionRays: 257 } }, "budget"],
    [{ interference: { ...analysis, toleranceMm: 0.5e-6 } }, "tolerance"],
    [{ interference: { ...analysis, cellMm: 10.01 } }, "target cell"],
    [{ interference: { ...analysis, bodies: [-1] } }, "body index"],
  ] satisfies readonly [Partial<CaptureSceneOptions>, string][]) {
    expect(() =>
      writeCaptureScene(model, { ...options, ...overrides }),
    ).toThrow(message);
  }
  for (const supersample of [0, 4]) {
    // A forged input at the boundary can bypass the static 1 | 2 | 3 type.
    expect(() =>
      writeCaptureScene(model, {
        ...options,
        supersample: supersample as CaptureSceneOptions["supersample"],
      }),
    ).toThrow("supersample");
  }
  const colours = { ...options.colours, body: "#A1B2C3" };
  const bytes = writeCaptureScene(model, { ...options, colours });
  expect([...bytes.subarray(163, 166)]).toEqual([0xa1, 0xb2, 0xc3]);
});

test("rejects bypassed mesh triangle and vertex bounds and invalid frame reals", () => {
  const mesh: CaptureMeshTool = {
    kind: "mesh",
    feature: "bounds",
    positions: new Float64Array(9),
    triangles: new Uint32Array(2_000_001 * 3),
  };
  expect(() =>
    writeCaptureScene({ tools: [mesh], bodies: [] }, options),
  ).toThrow("triangle count");
  expect(() =>
    writeCaptureScene(
      {
        tools: [
          {
            ...mesh,
            positions: new Float64Array(10),
            triangles: new Uint32Array(3),
          },
        ],
        bodies: [],
      },
      options,
    ),
  ).toThrow("vertex count");
  for (const value of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1e7 - 1,
    1e7 + 1,
  ]) {
    const tool: CaptureTool = {
      ...triangle,
      frame: { ...triangle.frame, o: [value, 0, 0] },
    };
    expect(() =>
      writeCaptureScene({ ...model, tools: [tool] }, options),
    ).toThrow("coordinate");
  }
});

test("shared point accounting preserves bounds and failure state", async () => {
  const { MAX_POINTS, chargeTool } = await import("./scene-binary.ts");
  expect(MAX_POINTS).toBe(4_000_000);
  const state = { points: MAX_POINTS - 3 };
  expect(chargeTool(state, { kind: "prism", loopCounts: [3] })).toBeUndefined();
  expect(state.points).toBe(MAX_POINTS);
  expect(chargeTool(state, { kind: "mesh", vertices: 1, triangles: 0 })).toBe(
    "Capture scene total point count must be an integer in 0..4000000.",
  );
  expect(state.points).toBe(MAX_POINTS);
  expect(chargeTool(state, { kind: "prism", loopCounts: [20_001] })).toBe(
    "Capture scene loop point count must be an integer in 3..20000.",
  );
  expect(state.points).toBe(MAX_POINTS);
});

test("header validation precedes tool count", async () => {
  const { checkScenePreTool } = await import("./scene-binary.ts");
  expect(() =>
    checkScenePreTool(
      { ...options, supersample: 4 as CaptureSceneOptions["supersample"] },
      { tools: 20_001, bodies: 0 },
    ),
  ).toThrow("Capture scene supersample must be an integer in 1..3.");
});

test("existing writer scenes retain baseline sha256", async () => {
  const { createHash } = await import("node:crypto");
  const cases = [
    {
      doc: capturePlateDocument(),
      view: "iso" as const,
      size: { width: 1024, height: 768 },
      interference: analysis,
      digest:
        "855b169a9485379de21b4dc78aa90c6879728a6dcaed70fb6704ccf830a342c9",
    },
    {
      doc: captureSelectedLoopsDocument(),
      view: "top" as const,
      size: { width: 640, height: 480 },
      interference: null,
      digest:
        "365d6eb54ecd35dddcac7a0c47a0b75df86c42574ed1b156d4ce1a951b510052",
    },
  ];
  for (const { doc, view, size, interference, digest } of cases) {
    const { model, camera } = fixtureModel(doc, view, size);
    const bytes = writeCaptureScene(model, {
      ...options,
      ...size,
      camera,
      referenceOpacity: 0.45,
      interference,
    });
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(digest);
  }
});

test("writes and validates trailing hidden target records", () => {
  const hiddenTargets = [
    {
      steps: [
        { op: "union" as const, tool: 0 },
        { op: "difference" as const, tool: 0 },
      ],
    },
  ];
  const bytes = writeCaptureScene({ ...model, hiddenTargets }, options);
  const view = new DataView(bytes.buffer);
  expect(view.getUint32(36, true)).toBe(1);
  expect(
    Array.from({ length: 6 }, (_, i) =>
      view.getUint32(bytes.length - 24 + i * 4, true),
    ),
  ).toEqual([0, 2, 0, 0, 1, 0]);
  expect(() =>
    writeCaptureScene(
      {
        ...model,
        hiddenTargets: Array.from({ length: 20_001 }, () => hiddenTargets[0]!),
      },
      options,
    ),
  ).toThrow(RangeError);
  expect(() =>
    writeCaptureScene(
      { ...model, hiddenTargets: [{ steps: [{ op: "difference", tool: 0 }] }] },
      options,
    ),
  ).toThrow(RangeError);
});
