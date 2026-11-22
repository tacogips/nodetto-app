import { expect, test } from "bun:test";
import {
  type CadEvaluation,
  type CadIds,
  type KernelHandle,
  Store,
  applyCommands,
  circleCommands,
  collectCadInput,
  faceOutwardSign,
  releaseCadMemo,
  tessellateArc,
  createCadMemo,
  defaultExtrude,
  Editor,
  evaluateCadPage,
  extrudeCommands,
  extrudeIntent,
  rectangleCommands,
  sketchCommands,
  tessellateCircle,
} from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { CadXY, Document } from "@nodetto/ir";
import {
  CAD_TEST_PAGE,
  bossOnFace,
  cadElement,
  extrude,
  plateElements,
  plateWithHoles,
  rectangle,
  sketch,
} from "../../core/src/cad/testing/documents.ts";
import { extrudeFaceCases } from "../../core/src/cad/testing/extrude-faces.ts";
import { createManifoldKernel } from "./index.ts";
import { createWorkerHost } from "./worker-host.ts";

function roundTrip(document: Document): Document {
  return parseDocument(serializeDocument(document));
}

function onlyBody(result: CadEvaluation, id = "ex1"): KernelHandle {
  expect([...result.status.values()].filter(({ ok }) => !ok)).toEqual([]);
  expect(result.bodies).toMatchObject([{ id, reference: false }]);
  return result.bodies[0].handle;
}

function circleArea(radius: number): number {
  const points = tessellateCircle([0, 0], radius);
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 2) {
    const next = (i + 2) % points.length;
    twiceArea += points[i] * points[next + 1] - points[i + 1] * points[next];
  }
  return twiceArea / 2;
}

function expectVolume(actual: number, expected: number): void {
  expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-5);
}

function authoringIds(): CadIds {
  let next = 0;
  return {
    next: () => `authored-${++next}`,
    indexAfter: (index) => `${index ?? ""}a1`,
  };
}

test("builders author a plate through a named face, then edit, undo and redo its holes", async () => {
  const initial = plateWithHoles(0);
  const editor = new Editor({ document: { ...initial, elements: [] } });
  const page = CAD_TEST_PAGE.id;
  const ids = authoringIds();
  const get = (id: string) => {
    const element = editor.store.get(id);
    if (!element) throw new Error(`Missing authored element ${id}`);
    return element;
  };
  const insert = (result: ReturnType<typeof extrudeCommands>) => {
    expect(result.commands.length).toBe(1);
    editor.apply(result.commands);
    return get(result.id);
  };
  const outline = insert(sketchCommands(page, { base: "xy" }, "Outline", ids));
  editor.apply(rectangleCommands(page, outline, [0, 0], [100, 60], ids));
  const plate = insert(
    extrudeCommands(
      page,
      outline,
      {
        ...defaultExtrude(editor.store.listElements(), outline.id),
        name: "Plate",
        distance: 5,
      },
      ids,
    ),
  );
  const face = insert(
    sketchCommands(
      page,
      { face: { feature: plate.id, role: "end" } },
      "Holes",
      ids,
      plate.index,
    ),
  );
  const first = circleCommands(page, face, [20, 30], 3, ids);
  const second = circleCommands(page, face, [65, 30], 3, ids);
  const circle = first[0];
  if (circle?.type !== "createElement") throw new Error("Missing hole circle");
  editor.apply([...first, ...second]);
  const elements = editor.store.listElements();
  insert(
    extrudeCommands(
      page,
      face,
      {
        ...defaultExtrude(elements, face.id),
        name: "Through holes",
        distance: -5,
        op: extrudeIntent(elements, face, -5),
      },
      ids,
    ),
  );

  const kernel = await createManifoldKernel();
  const memo = createCadMemo(kernel);
  const volume = () =>
    kernel.measure(
      onlyBody(
        evaluateCadPage(roundTrip(editor.getSnapshot()).elements, kernel, memo),
        plate.id,
      ),
    ).volume;
  const baseline = volume();
  expectVolume(baseline, 30_000 - 10 * circleArea(3));
  const saved = serializeDocument(editor.getSnapshot());
  editor.apply([
    {
      type: "updateSemantic",
      id: circle.element.id,
      semantic: { sketch: face.id, c: [20, 30], r: 4 },
    },
  ]);
  const edited = volume();
  expectVolume(edited, 30_000 - 5 * (circleArea(4) + circleArea(3)));
  expect(editor.undo()).toBe(true);
  expect(serializeDocument(editor.getSnapshot())).toBe(saved);
  expect(volume()).toBe(baseline);
  expect(editor.redo()).toBe(true);
  expect(volume()).toBe(edited);
});

for (const item of extrudeFaceCases()) {
  test(`real kernel adds outwards and cuts inwards on the ${item.label}`, async () => {
    const page = CAD_TEST_PAGE.id;
    const store = new Store(
      roundTrip({ ...plateWithHoles(0), elements: [...item.elements] }),
    );
    const ids = authoringIds();
    const kernel = await createManifoldKernel();
    const memo = createCadMemo(kernel);
    const volume = () =>
      kernel.measure(
        onlyBody(evaluateCadPage(store.listElements(), kernel, memo)),
      ).volume;
    expectVolume(volume(), item.volume);
    const face = sketchCommands(
      page,
      { face: item.face },
      "Face sketch",
      ids,
      "a5",
    );
    applyCommands(store, face.commands);
    const owner = store.get(face.id);
    if (!owner) throw new Error("Missing face sketch");
    const radius = item.label === "pocket floor" ? 3 : 0.75;
    const area = circleArea(radius);
    applyCommands(store, circleCommands(page, owner, item.centre, radius, ids));
    const elements = store.listElements();
    const params = defaultExtrude(elements, owner.id);
    const { id, commands } = extrudeCommands(
      page,
      owner,
      { ...params, name: "Face feature" },
      ids,
    );
    expect(params).toEqual({
      op: "add",
      distance: 10 * item.sign,
      bodies: ["ex1"],
    });
    applyCommands(store, commands);
    expectVolume(volume() - item.volume, 10 * area);
    const distance = -item.sign;
    const op = extrudeIntent(elements, owner, distance);
    expect(op).toBe("cut");
    applyCommands(store, [
      {
        type: "updateSemantic",
        id,
        semantic: {
          sketch: owner.id,
          name: "Face feature",
          bodies: params.bodies,
          distance,
          op,
        },
      },
    ]);
    expectVolume(item.volume - volume(), area);
  });
}

test("a JSONL plate has six named holes and regenerates after edit and undo", async () => {
  const store = new Store(roundTrip(plateWithHoles()));
  const kernel = await createManifoldKernel();
  const memo = createCadMemo(kernel);
  const evaluate = () =>
    onlyBody(
      evaluateCadPage(store.getPageElements(CAD_TEST_PAGE.id), kernel, memo),
    );

  const first = evaluate();
  const volume = kernel.measure(first).volume;
  const area = circleArea(3);
  expectVolume(volume, 30_000 - 6 * 5 * area);
  expect([...kernel.mesh(first).faceNames].sort()).toEqual(
    [
      "ex1:start",
      "ex1:end",
      ...Array.from({ length: 4 }, (_, i) => `ex1:side:base-edge-${i}`),
      ...Array.from({ length: 6 }, (_, i) => `ex2:side:hole-${i}`),
    ].sort(),
  );

  const { undo } = applyCommands(store, [
    {
      type: "updateSemantic",
      id: "hole-2",
      semantic: { sketch: "holes", c: [25, 5], r: 4 },
    },
  ]);
  const revised = evaluate();
  expect(revised).not.toBe(first);
  expectVolume(
    kernel.measure(revised).volume,
    30_000 - 5 * (5 * area + circleArea(4)),
  );
  applyCommands(store, undo);
  expect(kernel.measure(evaluate()).volume).toBe(volume);
});

test("an additive boss extrudes from the plate's named end face", async () => {
  const { elements } = roundTrip(bossOnFace());
  const kernel = await createManifoldKernel();
  const handle = onlyBody(
    evaluateCadPage(elements, kernel, createCadMemo(kernel)),
  );
  const mesh = kernel.mesh(handle);
  const top = mesh.positions.reduce(
    (max, v, index) => (index % 3 === 2 ? Math.max(max, v) : max),
    Number.NEGATIVE_INFINITY,
  );
  expect(top).toBe(15);
  expectVolume(kernel.measure(handle).volume, 30_000 + 40 * 20 * 10);
  expect(mesh.faceNames).toEqual(
    expect.arrayContaining(["ex1:start", "ex2:end"]),
  );
});

test("intersecting two plates returns the overlap with faces from both tools", async () => {
  const document = roundTrip({
    ...plateWithHoles(0),
    elements: [
      ...plateElements(),
      sketch("overlap", "a3"),
      ...rectangle("overlap", 50, 30, 100, 60),
      extrude("ex2", "a4", {
        sketch: "overlap",
        distance: 5,
        op: "intersect",
        bodies: ["ex1"],
      }),
    ],
  });
  const kernel = await createManifoldKernel();
  const handle = onlyBody(
    evaluateCadPage(document.elements, kernel, createCadMemo(kernel)),
  );
  expectVolume(kernel.measure(handle).volume, 50 * 30 * 5);
  const { faceNames } = kernel.mesh(handle);
  expect(faceNames.some((name) => name.startsWith("ex1:side:"))).toBe(true);
  expect(faceNames.some((name) => name.startsWith("ex2:side:"))).toBe(true);
});

test("a face-touching intersect keeps the plate and reports an empty result", async () => {
  const base = plateElements();
  const { elements } = roundTrip({
    ...plateWithHoles(0),
    elements: [
      ...base,
      sketch("adjacent", "a3"),
      ...rectangle("adjacent", 100, 0, 50, 60),
      extrude("ex2", "a4", {
        sketch: "adjacent",
        distance: 5,
        op: "intersect",
        bodies: ["ex1"],
      }),
    ],
  });
  const kernel = await createManifoldKernel();
  const memo = createCadMemo(kernel);
  const initial = evaluateCadPage(base, kernel, memo);
  const originalHandle = onlyBody(initial);
  const result = evaluateCadPage(elements, kernel, memo);

  expect(result.status.get("ex2")).toMatchObject({
    ok: false,
    code: "cad.result.empty",
  });
  expect(result.bodies).toEqual(initial.bodies);
  expectVolume(kernel.measure(originalHandle).volume, 30_000);
});

test("a decimal face contact is empty but a thin overlap still produces a solid", async () => {
  const distance = 7;
  function decimalRectangle(id: string, left: number, right: number) {
    const points: CadXY[] = [
      [left, -72.34],
      [right, -72.34],
      [right, 41.12],
      [left, 41.12],
    ];
    return points.map((a, i) =>
      cadElement(`${id}-edge-${i}`, "cad.line", "a1", {
        sketch: id,
        a,
        b: points[(i + 1) % points.length],
      }),
    );
  }
  const base = [
    sketch("base", "a1"),
    ...decimalRectangle("base", 73.56, 191.14),
    extrude("ex1", "a2", { sketch: "base", distance, op: "new" }),
  ];
  const kernel = await createManifoldKernel();
  const memo = createCadMemo(kernel);
  const original = evaluateCadPage(base, kernel, memo);
  function intersect(x: number): CadEvaluation {
    const { elements } = roundTrip({
      ...plateWithHoles(0),
      elements: [
        ...base,
        sketch("adjacent", "a3"),
        ...decimalRectangle("adjacent", x, 199.82),
        extrude("ex2", "a4", {
          sketch: "adjacent",
          distance,
          op: "intersect",
          bodies: ["ex1"],
        }),
      ],
    });
    return evaluateCadPage(elements, kernel, memo);
  }
  const contact = intersect(191.14);
  expect(contact.status.get("ex2")).toMatchObject({
    ok: false,
    code: "cad.result.empty",
  });
  expect(contact.bodies).toEqual(original.bodies);

  const overlap = intersect(191.139);
  const measure = kernel.measure(onlyBody(overlap));
  expect(measure.empty).toBe(false);
  expect(measure.volume).toBeGreaterThan(0);
  expect(measure.volume).toBeLessThan(1);
});

test("two fresh kernels produce byte-identical meshes from the same JSONL", async () => {
  const { elements } = roundTrip(plateWithHoles());
  async function mesh() {
    const kernel = await createManifoldKernel();
    return kernel.mesh(
      onlyBody(evaluateCadPage(elements, kernel, createCadMemo(kernel))),
    );
  }
  const first = await mesh();
  const second = await mesh();
  for (const field of ["positions", "triangles", "triFace"] as const) {
    const a = first[field];
    const b = second[field];
    expect(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).toEqual(
      Buffer.from(b.buffer, b.byteOffset, b.byteLength),
    );
  }
  expect(second.faceNames).toEqual(first.faceNames);
});

test("the 60-hole reference plate regenerates within 2 seconds", async () => {
  const { elements } = roundTrip(plateWithHoles(60));
  const loadStart = performance.now();
  const kernel = await createManifoldKernel();
  const loadMs = performance.now() - loadStart;
  const memo = createCadMemo(kernel);
  const start = performance.now();
  const result = evaluateCadPage(elements, kernel, memo);
  const elapsed = performance.now() - start;
  console.log(
    `60-hole plate: WASM load ${loadMs.toFixed(1)} ms, regeneration ${elapsed.toFixed(1)} ms`,
  );
  expect(elapsed).toBeLessThan(2000);
  expectVolume(
    kernel.measure(onlyBody(result)).volume,
    30_000 - 60 * 5 * circleArea(3),
  );
});

test("the rounded PCB is a live worker reference and supplies the enclosure pocket plane", async () => {
  const source = await Bun.file(
    new URL("../../io/src/__fixtures__/cad3d.jsonl", import.meta.url),
  ).text();
  const fixture = parseDocument(source);
  const face = { feature: "board-reference", role: "start" } as const;
  const model = roundTrip({
    ...fixture,
    elements: [
      ...fixture.elements.filter(
        ({ page, id }) => page !== "part" || id === "board-reference",
      ),
      ...[
        sketch("enclosure-sketch", "aC", { base: "xy", offset: -3 }),
        ...rectangle("enclosure-sketch", -5, -5, 90, 60),
        extrude("enclosure", "aD", {
          sketch: "enclosure-sketch",
          distance: 3,
          op: "new",
        }),
        sketch("pocket-sketch", "aE", { face }),
        ...rectangle("pocket-sketch", 4, 4, 80, 40),
      ].map((element) => ({ ...element, page: "part" })),
    ],
  });
  const direction = faceOutwardSign(model.elements, face);
  expect(direction).toBe(-1);
  const pocket = {
    ...extrude("pocket", "aF", {
      sketch: "pocket-sketch",
      distance: 2 * direction,
      op: "cut",
      bodies: ["enclosure"],
    }),
    page: "part",
  };
  const input = collectCadInput(
    { ...model, elements: [...model.elements, pocket] },
    "part",
    1,
  );
  const kernel = await createManifoldKernel();
  const memo = createCadMemo(kernel);
  try {
    const result = evaluateCadPage(input.elements, kernel, memo);
    expect([...result.status.values()].filter(({ ok }) => !ok)).toEqual([]);
    const board = result.bodies.find(({ reference }) => reference);
    const enclosure = result.bodies.find(({ id }) => id === "enclosure");
    if (!board || !enclosure) throw new Error("Missing board or enclosure");
    const arc = tessellateArc([0, 0], [3.535534, 1.464466], [5, 5]);
    if (!arc) throw new Error("Missing corner arc");
    // Translate the corner center to the origin and sum the triangle fan.
    let fan = 0;
    for (let i = 0; i < arc.length - 2; i += 2)
      fan += arc[i] * (arc[i + 3] - 5) - (arc[i + 1] - 5) * arc[i + 2];
    const boardVolume = (80 * 50 - 4 * (25 - fan / 2)) * 1.6;
    expectVolume(kernel.measure(board.handle).volume, boardVolume);
    expectVolume(
      kernel.measure(enclosure.handle).volume,
      90 * 60 * 3 - 80 * 40 * 2,
    );
    const worker = createWorkerHost(Promise.resolve(kernel));
    await worker({ id: 1, input }, (reply) => {
      expect(reply).toMatchObject({
        result: {
          bodies: [
            { id: "board-reference", reference: true },
            { id: "enclosure", reference: false },
          ],
        },
      });
    });
  } finally {
    releaseCadMemo(memo);
  }
});
