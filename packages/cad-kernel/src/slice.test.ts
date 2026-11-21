import { expect, test } from "bun:test";
import {
  Store,
  applyCommands,
  createCadMemo,
  evaluateCadPage,
  tessellateCircle,
  type CadEvaluation,
  type KernelHandle,
} from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import type { Document } from "@nodetto/ir";
import {
  CAD_TEST_PAGE,
  bossOnFace,
  extrude,
  plateElements,
  plateWithHoles,
  rectangle,
  sketch,
} from "../../core/src/cad/testing/documents.ts";
import { createManifoldKernel } from "./index.ts";

function roundTrip(document: Document): Document {
  return parseDocument(serializeDocument(document));
}

function onlyBody(result: CadEvaluation): KernelHandle {
  expect([...result.status.values()].filter(({ ok }) => !ok)).toEqual([]);
  expect(result.bodies).toMatchObject([{ id: "ex1", reference: false }]);
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
