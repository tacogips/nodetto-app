import { expect, test } from "bun:test";
import { type Element, isPlainObject } from "@nodetto/ir";
import { contentKey, createCadMemo, evaluateCadPage } from "./index.ts";
import {
  bossOnFace,
  cadElement,
  extrude,
  plateElements,
  plateWithHoles,
  rectangle,
  sketch,
} from "./testing/documents.ts";
import { RecordingKernel } from "./testing/recording-kernel.ts";

function updateSemantic(
  element: Element,
  fields: Record<string, unknown>,
): Element {
  if (!isPlainObject(element.semantic))
    throw new Error("Expected CAD semantic fields");
  return { ...element, semantic: { ...element.semantic, ...fields } };
}

test("content keys use two deterministic FNV-1a passes and preserve part boundaries", () => {
  expect(contentKey([])).toBe("811c9dc5811c9dc5");
  expect(contentKey(["a"])).toMatch(/^[0-9a-f]{16}$/);
  expect(contentKey(["ab", "c"])).not.toBe(contentKey(["a", "bc"]));
  expect(contentKey(["", ""])).not.toBe(contentKey([""]));
});

const imported = cadElement("imported", "cad.mesh", "a0", {
  name: "Imported body",
  data: "nmesh1:AAAA",
});
const decodedMesh = {
  positions: Float64Array.of(0, 0, 0, 2, 0, 0, 0, 2, 0),
  triangles: Uint32Array.of(0, 1, 2),
  triFace: Uint32Array.of(7),
  faceNames: [],
};
const meshCut = [
  sketch("opening", "a1"),
  ...rectangle("opening", 1, 1, 2, 3),
  extrude("mesh-cut", "a2", {
    sketch: "opening",
    distance: 5,
    op: "cut",
    bodies: ["imported"],
  }),
];

test("a CAD mesh creates a named, memoized solid that can be cut", () => {
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel);
  const decoded: string[] = [];
  const options = {
    decodeMesh(data: string) {
      decoded.push(data);
      return decodedMesh;
    },
  };
  const first = evaluateCadPage([imported], kernel, memo, options);
  expect(first.bodies).toMatchObject([{ id: "imported", reference: false }]);
  expect(first.displayOnly).toEqual([]);
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toMatchObject([
    { mesh: { triFace: Uint32Array.of(0), faceNames: ["imported:mesh"] } },
  ]);

  kernel.calls.length = 0;
  const renamed = updateSemantic(imported, { name: "New name" });
  const unchanged = evaluateCadPage([renamed], kernel, memo, options);
  expect(unchanged.bodies).toEqual(first.bodies);
  expect(kernel.calls).toEqual([]);
  expect(decoded).toEqual([imported.semantic.data]);

  const cut = evaluateCadPage([renamed, ...meshCut], kernel, memo, options);
  expect(cut.status.get("mesh-cut")).toEqual({ ok: true });
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toMatchObject([
    { op: "cut", target: first.bodies[0]?.handle },
  ]);
  expect(
    evaluateCadPage([imported, ...meshCut], kernel, memo).status.get(
      "mesh-cut",
    ),
  ).toMatchObject({ code: "cad.body.missing" });

  const changed = updateSemantic(imported, { data: "nmesh1:BBBB" });
  expect(
    evaluateCadPage([changed], kernel, memo, options).bodies[0]?.key,
  ).not.toBe(first.bodies[0]?.key);
  expect(decoded).toEqual([imported.semantic.data, "nmesh1:BBBB"]);
});

test("failed mesh decoding stays local and suppressed meshes are skipped", () => {
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel);
  expect(
    evaluateCadPage([imported], kernel, memo).status.get("imported"),
  ).toMatchObject({ code: "cad.mesh.unsupported" });
  const decodeMesh = () => {
    throw new Error("Bad checksum");
  };
  const failed = evaluateCadPage([imported, ...plateElements()], kernel, memo, {
    decodeMesh,
  });
  expect(failed.status.get("imported")).toEqual({
    ok: false,
    code: "cad.mesh.invalid",
    detail: "Bad checksum",
  });
  expect(failed.bodies).toMatchObject([{ id: "ex1" }]);
  expect(failed.displayOnly).toEqual([]);
  const suppressed = updateSemantic(imported, { suppressed: true });
  const skipped = evaluateCadPage([suppressed, ...meshCut], kernel, memo, {
    decodeMesh,
  });
  expect(skipped.status.get("imported")).toEqual({ ok: true });
  expect(skipped.status.get("mesh-cut")).toMatchObject({
    code: "cad.body.missing",
  });
});

test("a mesh rejected by the kernel is display-only and cannot be cut", () => {
  class RejectMeshKernel extends RecordingKernel {
    override solid(mesh: Parameters<RecordingKernel["solid"]>[0]): number {
      if (mesh.faceNames.includes("imported:mesh"))
        throw new Error("Not manifold");
      return super.solid(mesh);
    }
  }
  const kernel = new RejectMeshKernel();
  const result = evaluateCadPage(
    [imported, ...meshCut],
    kernel,
    createCadMemo(kernel),
    { decodeMesh: () => decodedMesh },
  );
  expect(result.bodies).toEqual([]);
  expect(result.displayOnly).toMatchObject([
    { id: "imported", mesh: { faceNames: ["imported:mesh"] } },
  ]);
  expect(result.status.get("imported")).toMatchObject({
    code: "cad.mesh.open",
  });
  expect(result.status.get("mesh-cut")).toMatchObject({
    code: "cad.body.missing",
  });
  expect(kernel.calls).toEqual([]);
});

test("a plate and six holes create seven prisms, then reuse every unchanged result", () => {
  const { elements } = plateWithHoles();
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel);
  const before = evaluateCadPage(elements, kernel, memo);
  expect([...before.status.values()].every(({ ok }) => ok)).toBe(true);
  expect(before.bodies).toMatchObject([{ id: "ex1", reference: false }]);
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toHaveLength(7);
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toMatchObject([
    { op: "add", tools: [3, 4, 5, 6, 7] },
    { op: "cut", target: 1, tools: [8] },
  ]);

  kernel.calls.length = 0;
  const reordered = elements
    .map((element) =>
      element.id === "ex2"
        ? extrude("ex2", "a4", {
            op: "cut",
            distance: -5,
            sketch: "holes",
            bodies: ["ex1"],
          })
        : element,
    )
    .reverse();
  expect(evaluateCadPage(reordered, kernel, memo).bodies).toEqual(
    before.bodies,
  );
  expect(kernel.calls).toEqual([]);

  const revised = elements.map((item) =>
    item.id === "hole-2"
      ? cadElement(item.id, item.type, item.index, {
          sketch: "holes",
          c: [25, 5],
          r: 4,
        })
      : item,
  );
  const after = evaluateCadPage(revised, kernel, memo);
  expect(after.bodies[0]?.key).not.toBe(before.bodies[0]?.key);
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toMatchObject([
    { mesh: { faceNames: ["ex2:start", "ex2:end", "ex2:side:hole-2"] } },
  ]);
  expect(
    kernel.calls.flatMap((call) => (call.kind === "boolean" ? [call.op] : [])),
  ).toEqual(["add", "cut"]);

  kernel.calls.length = 0;
  const unrelated = extrude("separate", "a5", {
    sketch: "base",
    distance: 2,
    op: "new",
  });
  const withSeparate = evaluateCadPage([...revised, unrelated], kernel, memo);
  expect(withSeparate.bodies.find(({ id }) => id === "ex1")).toEqual(
    after.bodies[0],
  );
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toMatchObject([
    { mesh: { faceNames: expect.arrayContaining(["separate:start"]) } },
  ]);
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toEqual([]);

  kernel.calls.length = 0;
  const longer = {
    ...unrelated,
    semantic: { ...unrelated.semantic, distance: 4 },
  };
  const changedSeparate = evaluateCadPage([...revised, longer], kernel, memo);
  expect(changedSeparate.bodies.find(({ id }) => id === "ex1")).toEqual(
    after.bodies[0],
  );
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toHaveLength(1);
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toEqual([]);
});

test("renames and explicit false feature flags reuse the same body", () => {
  const { elements } = plateWithHoles();
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel);
  const before = evaluateCadPage(elements, kernel, memo);
  const revised = elements.map((element) => {
    if (element.type === "cad.sketch")
      return updateSemantic(element, { name: "Sketch" });
    if (element.type === "cad.extrude")
      return updateSemantic(element, {
        name: "Extrude",
        suppressed: false,
        symmetric: false,
      });
    return element;
  });
  kernel.calls.length = 0;
  expect(evaluateCadPage(revised, kernel, memo)).toEqual(before);
  expect(kernel.calls).toEqual([]);
});

test("nested loops subtract a hole then restore its island", () => {
  const kernel = new RecordingKernel();
  const result = evaluateCadPage(
    [
      ...plateElements(),
      cadElement("hole", "cad.circle", "a1", {
        sketch: "base",
        c: [15, 15],
        r: 9,
      }),
      cadElement("island", "cad.circle", "a1", {
        sketch: "base",
        c: [15, 15],
        r: 3,
      }),
    ],
    kernel,
    createCadMemo(kernel),
  );
  expect(result.status.get("ex1")).toEqual({ ok: true });
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toMatchObject([
    { op: "cut", target: 1, tools: [2] },
    { op: "add", target: 3, tools: [4] },
  ]);
});

test("on-face sketch frames are recomputed when the source plane moves", () => {
  const { elements } = bossOnFace();
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel);
  const evaluate = (model: readonly Element[]) => {
    expect(evaluateCadPage(model, kernel, memo).status.get("ex2")).toEqual({
      ok: true,
    });
    const prism = kernel.calls.find(
      (call) =>
        call.kind === "solid" && call.mesh.faceNames.includes("ex2:end"),
    );
    if (prism?.kind !== "solid") throw new Error("Expected the boss prism");
    return [prism.mesh.positions[2], prism.mesh.positions[14]];
  };
  expect(evaluate(elements)).toEqual([5, 15]);
  kernel.calls.length = 0;
  const raised = elements.map((item) =>
    item.id === "ex1"
      ? extrude("ex1", "a2", { sketch: "base", distance: 7, op: "new" })
      : item,
  );
  expect(evaluate(raised)).toEqual([7, 17]);
});

test("a long stack of face-based sketches resolves iteratively", () => {
  const kernel = new RecordingKernel();
  const elements: Element[] = [...plateElements()];
  let support = "ex1";
  for (let i = 0; i < 250; i += 1) {
    const index = `b${String(i).padStart(3, "0")}`;
    elements.push(
      sketch(`s-${i}`, `${index}a`, {
        face: { feature: support, role: "end" },
      }),
    );
    elements.push(...rectangle(`s-${i}`, 0, 0, 1, 1));
    support = `x-${i}`;
    elements.push(
      extrude(support, `${index}b`, {
        sketch: `s-${i}`,
        distance: 1,
        op: "add",
        bodies: ["ex1"],
      }),
    );
  }
  const result = evaluateCadPage(elements, kernel, createCadMemo(kernel));
  expect(result.status.get(support)).toEqual({ ok: true });
  const last = kernel.calls.find(
    (call) =>
      call.kind === "solid" && call.mesh.faceNames.includes(`${support}:end`),
  );
  expect(last?.kind === "solid" && last.mesh.positions[14]).toBe(255);
});

test.each([
  ["cad.circle", { sketch: "bad", r: 1 }, "cad.profile.invalid"],
  ["cad.line", { sketch: "bad", b: [1, 0] }, "cad.profile.invalid"],
  [
    "cad.arc",
    { sketch: "bad", a: [0, 0], m: [0, Number.NaN], b: [0, 1] },
    "cad.profile.invalid",
  ],
  ["cad.circle", { sketch: "bad", c: [0, 0], r: -1 }, "cad.profile.invalid"],
  ["cad.circle", { sketch: "bad", c: [0, 0], r: 1e9 }, "cad.limit"],
  ["cad.circle", { sketch: "bad", c: [9999, 0], r: 2 }, "cad.limit"],
] as const)(
  "a bad %s entity with %j reports %s before reaching the kernel",
  (type, semantic, code) => {
    const kernel = new RecordingKernel();
    const result = evaluateCadPage(
      [
        ...plateElements(),
        sketch("bad", "a3"),
        cadElement("bad-entity", type, "a1", semantic),
        extrude("bad-tool", "a4", { sketch: "bad", distance: 1, op: "new" }),
        sketch("dependent", "a5", {
          face: { feature: "bad-tool", role: "end" },
        }),
      ],
      kernel,
      createCadMemo(kernel),
    );
    expect(result.status.get("bad-tool")).toMatchObject({ code });
    expect(result.status.get("dependent")).toMatchObject({
      code: "cad.reference.failed",
    });
    expect(result.bodies.map(({ id }) => id)).toEqual(["ex1"]);
    expect(kernel.calls.filter(({ kind }) => kind === "solid")).toHaveLength(1);
  },
);

test.each([1e9, -1e9, 7000])(
  "distance %s cannot create out-of-bounds tool vertices",
  (distance) => {
    const kernel = new RecordingKernel();
    const result = evaluateCadPage(
      [
        sketch("raised", "a1", { base: "xy", offset: 4000 }),
        ...rectangle("raised", 0, 0, 1, 1),
        extrude("out-of-bounds", "a2", {
          sketch: "raised",
          distance,
          op: "new",
        }),
      ],
      kernel,
      createCadMemo(kernel),
    );
    expect(result.status.get("out-of-bounds")).toMatchObject({
      code: "cad.limit",
    });
    expect(kernel.calls).toEqual([]);
  },
);

test("an empty cut preserves every target and makes its dependent sketch fail", () => {
  const kernel = new RecordingKernel({
    booleanResult: (_op, target) => ({ empty: target === 2 }),
  });
  const memo = createCadMemo(kernel);
  const plate = [
    ...plateElements(),
    extrude("body2", "a3", { sketch: "base", distance: 5, op: "new" }),
  ];
  const before = evaluateCadPage(plate, kernel, memo);
  const after = evaluateCadPage(
    [
      ...plate,
      extrude("empty-cut", "a4", {
        sketch: "base",
        distance: 5,
        op: "cut",
        bodies: ["ex1", "body2"],
      }),
      sketch("dependent", "a5", {
        face: { feature: "empty-cut", role: "end" },
      }),
    ],
    kernel,
    memo,
  );
  expect(after.bodies).toEqual(before.bodies);
  expect(after.status.get("empty-cut")).toMatchObject({
    code: "cad.result.empty",
  });
  expect(after.status.get("dependent")).toMatchObject({
    code: "cad.reference.failed",
  });
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toMatchObject([
    { op: "cut", target: 1 },
    { op: "cut", target: 2 },
  ]);
  expect(kernel.calls.filter(({ kind }) => kind === "release")).toMatchObject([
    { handle: 5 },
  ]);
});

test("a body whose creator exceeds the extent fails dependent modifications", () => {
  const kernel = new RecordingKernel();
  const result = evaluateCadPage(
    [
      sketch("base", "a1"),
      ...rectangle("base", 0, 0, 1, 1),
      extrude("too-long", "a2", { sketch: "base", distance: 1e9, op: "new" }),
      extrude("dependent", "a3", {
        sketch: "base",
        distance: 1,
        op: "cut",
        bodies: ["too-long"],
      }),
    ],
    kernel,
    createCadMemo(kernel),
  );
  expect(result.status.get("too-long")).toMatchObject({ code: "cad.limit" });
  expect(result.status.get("dependent")).toMatchObject({
    code: "cad.reference.failed",
    detail: "too-long",
  });
  expect(kernel.calls).toEqual([]);
});

test("undefined alternatives in sketch planes do not shadow valid planes", () => {
  const { elements } = bossOnFace();
  const kernel = new RecordingKernel();
  const model = elements.map((item) => {
    if (item.id === "base")
      return cadElement(item.id, item.type, item.index, {
        name: "Base",
        plane: { base: "xy", face: undefined },
      });
    if (item.id === "boss")
      return cadElement(item.id, item.type, item.index, {
        name: "Boss",
        plane: { base: undefined, face: { feature: "ex1", role: "end" } },
      });
    return item;
  });
  expect(
    evaluateCadPage(model, kernel, createCadMemo(kernel)).status.get("ex2"),
  ).toEqual({ ok: true });
});

test("suppressed tools, malformed inputs and kernel errors leave other bodies usable", () => {
  const kernel = new RecordingKernel({
    beforeMeasure(handle) {
      if (handle === 1) throw new Error("Measure failed");
    },
  });
  const result = evaluateCadPage(
    [
      ...plateElements(),
      sketch("dependent", "a3", { face: { feature: "ex1", role: "end" } }),
      extrude("suppressed", "a4", {
        sketch: "base",
        distance: 3,
        op: "new",
        suppressed: true,
      }),
      extrude("from-suppressed", "a5", {
        sketch: "base",
        distance: 2,
        op: "cut",
        bodies: ["suppressed"],
      }),
      extrude("independent", "a6", { sketch: "base", distance: 3, op: "new" }),
    ],
    kernel,
    createCadMemo(kernel),
  );
  expect(result.bodies.map(({ id }) => id)).toEqual(["independent"]);
  expect(result.status.get("ex1")).toEqual({
    ok: false,
    code: "cad.kernel.failed",
    detail: "Measure failed",
  });
  expect(result.status.get("dependent")).toMatchObject({
    code: "cad.reference.failed",
  });
  expect(result.status.get("suppressed")).toEqual({ ok: true });
  expect(result.status.get("from-suppressed")).toMatchObject({
    code: "cad.reference.failed",
  });
  expect(kernel.calls.filter(({ kind }) => kind === "release")).toMatchObject([
    { handle: 1 },
  ]);
});

test("a solid above the triangle limit is released and never published", () => {
  const kernel = new RecordingKernel({ triangles: 2_000_001 });
  const result = evaluateCadPage(
    plateElements(),
    kernel,
    createCadMemo(kernel),
  );
  expect(result.status.get("ex1")).toMatchObject({ code: "cad.limit" });
  expect(result.bodies).toEqual([]);
  expect(kernel.calls.filter(({ kind }) => kind === "release")).toMatchObject([
    { handle: 1 },
  ]);
});

test.each([{ entries: 1 }, { triangles: 100 }])(
  "LRU honors %j and each evicted handle is released once",
  (limits) => {
    const kernel = new RecordingKernel({ triangles: 60 });
    const memo = createCadMemo(kernel, limits);
    const elements = [
      ...plateElements(),
      extrude("body2", "a3", { sketch: "base", distance: 3, op: "new" }),
    ];
    const first = evaluateCadPage(elements, kernel, memo);
    expect(first.bodies.every(({ handle }) => kernel.isLive(handle))).toBe(
      true,
    );
    kernel.calls.length = 0;
    const second = evaluateCadPage(elements, kernel, memo);
    expect(second).toEqual(first);
    expect(second.bodies.every(({ handle }) => kernel.isLive(handle))).toBe(
      true,
    );
    expect(kernel.calls).toEqual([]);
    evaluateCadPage([], kernel, memo);
    const retained = evaluateCadPage(elements.slice(0, -1), kernel, memo);
    expect(retained.bodies.map(({ handle }) => handle)).toEqual([3]);
    const released = kernel.calls.flatMap((call) =>
      call.kind === "release" ? [call.handle] : [],
    );
    expect(released.sort((a, b) => a - b)).toEqual([1, 2]);
  },
);

function stackedPlate(count: number): Element[] {
  return [
    ...plateElements(),
    ...Array.from({ length: count }, (_, i) =>
      extrude(`layer-${i}`, `b${String(i).padStart(3, "0")}a`, {
        sketch: "base",
        distance: i + 6,
        op: "add",
        bodies: ["ex1"],
      }),
    ),
  ];
}

test.each([
  ["entry", 300, 12],
  ["triangle", 60, 100_000],
] as const)(
  "history beyond the %s limit reuses cached late body states",
  (_limit, count, triangles) => {
    const kernel = new RecordingKernel({ triangles });
    const memo = createCadMemo(kernel);
    const model = stackedPlate(count);
    const first = evaluateCadPage(model, kernel, memo);
    expect(first.bodies).toHaveLength(1);
    expect(kernel.calls.some(({ kind }) => kind === "release")).toBe(true);

    kernel.calls.length = 0;
    expect(evaluateCadPage(model, kernel, memo)).toEqual(first);
    expect(kernel.calls).toEqual([]);

    const last = `layer-${count - 1}`;
    const revised = model.map((element) =>
      element.id === last
        ? updateSemantic(element, { distance: 500 })
        : element,
    );
    const second = evaluateCadPage(revised, kernel, memo);
    expect(second.status.get(last)).toEqual({ ok: true });
    expect(second.bodies[0]?.key).not.toBe(first.bodies[0]?.key);
    expect(kernel.calls.filter(({ kind }) => kind === "solid")).toHaveLength(1);
    expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toHaveLength(
      1,
    );
    expect(second.bodies.every(({ handle }) => kernel.isLive(handle))).toBe(
      true,
    );
  },
);

test("prism, tool and body keys for the same handle share one cache entry", () => {
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel, { entries: 3 });
  const model = stackedPlate(1);
  const first = evaluateCadPage(model, kernel, memo);
  expect(first.bodies).toHaveLength(1);
  expect(kernel.calls.filter(({ kind }) => kind === "release")).toEqual([]);

  kernel.calls.length = 0;
  evaluateCadPage(model.slice(0, -1), kernel, memo);
  expect(kernel.calls).toEqual([]);
  expect(evaluateCadPage(model, kernel, memo)).toEqual(first);
  expect(kernel.calls).toEqual([]);
});

test("editing a late multi-body feature builds one tool and one boolean per target", () => {
  const kernel = new RecordingKernel({ triangles: 100_000 });
  const memo = createCadMemo(kernel);
  const model = [
    ...stackedPlate(60),
    extrude("second", "c0a", { sketch: "base", distance: 3, op: "new" }),
    extrude("cut", "c1a", {
      sketch: "base",
      distance: 5,
      op: "cut",
      bodies: ["ex1", "second"],
    }),
  ];
  const before = evaluateCadPage(model, kernel, memo);
  kernel.calls.length = 0;
  expect(evaluateCadPage(model, kernel, memo)).toEqual(before);
  expect(kernel.calls).toEqual([]);

  const revised = model.map((element) =>
    element.id === "cut" ? updateSemantic(element, { distance: 7 }) : element,
  );
  const after = evaluateCadPage(revised, kernel, memo);
  expect(after.status.get("cut")).toEqual({ ok: true });
  expect(after.bodies.map(({ id }) => id)).toEqual(["ex1", "second"]);
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toHaveLength(1);
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toMatchObject([
    { op: "cut" },
    { op: "cut" },
  ]);
});

test("without a retained predecessor a last edit replays at most its body history", () => {
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel, { entries: 0 });
  const model = stackedPlate(4);
  const first = evaluateCadPage(model, kernel, memo);
  kernel.calls.length = 0;
  expect(evaluateCadPage(model, kernel, memo)).toEqual(first);
  expect(kernel.calls).toEqual([]);

  const revised = model.map((element) =>
    element.id === "layer-3"
      ? updateSemantic(element, { distance: 500 })
      : element,
  );
  const second = evaluateCadPage(revised, kernel, memo);
  expect(second.status.get("layer-3")).toEqual({ ok: true });
  expect(kernel.calls.filter(({ kind }) => kind === "solid")).toHaveLength(5);
  expect(kernel.calls.filter(({ kind }) => kind === "boolean")).toHaveLength(4);
  expect(first.bodies.every(({ handle }) => !kernel.isLive(handle))).toBe(true);
  expect(second.bodies.every(({ handle }) => kernel.isLive(handle))).toBe(true);
});

test("a replay failure is attributed to its feature and independent bodies survive", () => {
  let failReplay = false;
  const kernel = new RecordingKernel({
    beforeMeasure() {
      if (failReplay) {
        failReplay = false;
        throw new Error("Replay measure failed");
      }
    },
  });
  const memo = createCadMemo(kernel, { entries: 0 });
  const model = [
    ...stackedPlate(2),
    extrude("independent", "c0a", { sketch: "base", distance: 3, op: "new" }),
  ];
  const before = evaluateCadPage(model, kernel, memo);
  const revised = model.map((element) =>
    element.id === "layer-1"
      ? updateSemantic(element, { distance: 500 })
      : element,
  );
  failReplay = true;
  const failed = evaluateCadPage(revised, kernel, memo);
  expect(failed.status.get("ex1")).toEqual({
    ok: false,
    code: "cad.kernel.failed",
    detail: "Replay measure failed",
  });
  expect(failed.status.get("layer-1")).toMatchObject({
    code: "cad.reference.failed",
  });
  expect(failed.bodies).toEqual(
    before.bodies.filter(({ id }) => id === "independent"),
  );
  expect(failed.bodies.every(({ handle }) => kernel.isLive(handle))).toBe(true);
  expect(evaluateCadPage(revised, kernel, memo).status.get("layer-1")).toEqual({
    ok: true,
  });
});
