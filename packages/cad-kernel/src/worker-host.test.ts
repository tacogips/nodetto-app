import { expect, test } from "bun:test";
import {
  type CadEngineReply,
  type CadEngineInput,
  type CadKernel,
  collectCadInput,
} from "@nodetto/core";
import { stlToInlineMesh } from "@nodetto/io/cad-mesh";
import { canonicalize, encodeNmesh, toInline } from "@nodetto/io/nmesh";
import { readStl, writeBinaryStl } from "@nodetto/io/stl";
import {
  CAD_TEST_PAGE,
  cadElement,
  extrude,
  plateWithHoles,
  rectangle,
  sketch,
} from "../../core/src/cad/testing/documents.ts";
import { createManifoldKernel } from "./manifold-kernel.ts";
import { createWorkerHost } from "./worker-host.ts";

function evaluator(host: ReturnType<typeof createWorkerHost>) {
  let revision = 0;
  return async (
    elements: CadEngineInput["elements"],
    exportStl?: CadEngineInput["exportStl"],
  ) => {
    const id = ++revision;
    let result: CadEngineReply["result"] | undefined;
    await host(
      {
        id,
        input: { revision: id, pageId: CAD_TEST_PAGE.id, elements, exportStl },
      },
      (message, transfer) => {
        const reply = message as CadEngineReply;
        expect(reply.result.failure).toBeUndefined();
        expect(reply.result.revision).toBe(id);
        if (exportStl) {
          if (!reply.result.stl) throw new Error("Missing STL reply");
          const buffers: readonly ArrayBufferLike[] = transfer;
          expect(buffers).toEqual([reply.result.stl.buffer]);
        }
        result = structuredClone(reply.result, { transfer: [...transfer] });
      },
    );
    if (!result) throw new Error("Missing worker reply");
    return result;
  };
}

const box = {
  positions: Float64Array.of(
    0,
    0,
    0,
    12,
    0,
    0,
    12,
    10,
    0,
    0,
    10,
    0,
    0,
    0,
    5,
    12,
    0,
    5,
    12,
    10,
    5,
    0,
    10,
    5,
  ),
  triangles: Uint32Array.of(
    0,
    2,
    1,
    0,
    3,
    2,
    4,
    5,
    6,
    4,
    6,
    7,
    0,
    1,
    5,
    0,
    5,
    4,
    1,
    2,
    6,
    1,
    6,
    5,
    2,
    3,
    7,
    2,
    7,
    6,
    3,
    0,
    4,
    3,
    4,
    7,
  ),
};

function meshElement(mesh: typeof box) {
  return cadElement("mesh", "cad.mesh", "a0", {
    name: "Box",
    data: toInline(encodeNmesh(canonicalize(mesh))),
  });
}

function volumeOfStl(bytes: Uint8Array | undefined): number {
  if (!bytes) throw new Error("Missing STL");
  const { positions } = readStl(bytes);
  let volume = 0;
  for (let offset = 0; offset < positions.length; offset += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.subarray(
      offset,
      offset + 9,
    );
    volume +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return volume / 6;
}

test("a real imported box displays, exports, round-trips, and can be cut", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  const imported = meshElement(box);
  const original = await evaluate([imported]);
  expect(original.status).toEqual([["mesh", { ok: true }]]);
  expect(original.bodies).toHaveLength(1);
  const body = original.bodies[0];
  expect(body).toMatchObject({ reference: false, faceNames: ["mesh:mesh"] });
  const bounds = [0, 1, 2].map((axis) => {
    const values = body.positions.filter((_, i) => i % 3 === axis);
    return [Math.min(...values), Math.max(...values)];
  });
  expect(bounds).toEqual([
    [0, 12],
    [0, 10],
    [0, 5],
  ]);

  const options = { bodyIds: ["mesh"] };
  const { stl } = await evaluate([imported], options);
  expect(volumeOfStl(stl)).toBeCloseTo(600, 6);
  if (!stl) throw new Error("Missing STL");
  const reimported = {
    ...imported,
    semantic: { ...imported.semantic, data: stlToInlineMesh(stl) },
  };
  expect((await evaluate([reimported], options)).stl).toEqual(stl);

  const cut = [
    imported,
    sketch("opening", "a1"),
    ...rectangle("opening", 2, 2, 3, 4),
    extrude("cut", "a2", {
      sketch: "opening",
      distance: 5,
      op: "cut",
      bodies: ["mesh"],
    }),
  ];
  const machined = await evaluate(cut, options);
  expect(machined.status).toContainEqual(["cut", { ok: true }]);
  expect(volumeOfStl(machined.stl)).toBeCloseTo(600 - 3 * 4 * 5, 6);
});

test("a real inward-wound mesh exports outward and supports add and cut", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  const reversed = box.triangles.map((index, offset, indices) => {
    if (offset % 3 === 1) return indices[offset + 1];
    if (offset % 3 === 2) return indices[offset - 1];
    return index;
  });
  const imported = meshElement({ ...box, triangles: reversed });
  const selection = { bodyIds: ["mesh"] };
  const original = await evaluate([imported]);
  expect(original.status).toEqual([["mesh", { ok: true }]]);
  expect(original.bodies).toMatchObject([
    { reference: false, faceNames: ["mesh:mesh"] },
  ]);
  expect(volumeOfStl((await evaluate([imported], selection)).stl)).toBeCloseTo(
    600,
    6,
  );

  for (const [op, x, volume] of [
    ["add", 20, 660],
    ["cut", 2, 540],
  ] as const) {
    const elements = [
      imported,
      sketch("profile", "a1"),
      ...rectangle("profile", x, 2, 3, 4),
      extrude("feature", "a2", {
        sketch: "profile",
        distance: 5,
        op,
        bodies: ["mesh"],
      }),
    ];
    const result = await evaluate(elements, selection);
    expect(result.status).toContainEqual(["mesh", { ok: true }]);
    expect(result.status).toContainEqual(["feature", { ok: true }]);
    expect(volumeOfStl(result.stl)).toBeCloseTo(volume, 6);
  }
});

test("the worker displays an open mesh as reference geometry and omits it from STL", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  for (const triangles of [box.triangles.slice(3), box.triangles.slice(0, 3)]) {
    const open = meshElement({ ...box, triangles });
    const result = await evaluate([open]);
    expect(result.status).toContainEqual([
      "mesh",
      expect.objectContaining({ code: "cad.mesh.open" }),
    ]);
    expect(result.bodies).toMatchObject([
      {
        id: "mesh",
        reference: true,
        faceNames: ["mesh:mesh"],
      },
    ]);
    expect(result.bodies[0].indices.length).toBe(triangles.length);
    const { stl } = await evaluate([open], {
      bodyIds: ["mesh"],
      includeReference: true,
    });
    if (!stl) throw new Error("Missing STL");
    expect(readStl(stl).triangles.length).toBe(0);
  }
  const corrupt = cadElement("bad", "cad.mesh", "a0", {
    name: "Broken",
    data: "nmesh1:AAAA",
  });
  const result = await evaluate([corrupt]);
  expect(result.status).toContainEqual([
    "bad",
    expect.objectContaining({ code: "cad.mesh.invalid" }),
  ]);
  expect(result.bodies).toEqual([]);
});

test("STL output ignores interactive edit history and preserves sub-micrometre coordinates", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  const other = evaluator(createWorkerHost(createManifoldKernel()));
  const { elements } = plateWithHoles();
  function changeRadius(radius: number) {
    return elements.map((element) =>
      element.id === "hole-0"
        ? { ...element, semantic: { sketch: "holes", c: [5, 5], r: radius } }
        : element,
    );
  }
  await evaluate(changeRadius(2));
  await evaluate(elements);
  await other(changeRadius(4));
  await other(changeRadius(1));
  await other(elements);
  const selection = { bodyIds: ["ex1"] };
  const first = await evaluate(elements, selection);
  const second = await other(elements.slice().reverse(), selection);
  expect(first.stl?.byteLength).toBeGreaterThan(84);
  expect(first.stl).toEqual(second.stl);

  const fine = [
    sketch("fine", "a0"),
    ...rectangle("fine", 0.0004, 0, 2, 2),
    extrude("fine-body", "a2", { sketch: "fine", distance: 1, op: "new" }),
  ];
  const { bodies } = await evaluate(fine);
  expect(Math.min(...bodies[0].positions.filter((_, i) => i % 3 === 0))).toBe(
    0,
  );
  const { stl } = await evaluate(fine, { bodyIds: ["fine-body"] });
  if (!stl) throw new Error("Missing STL");
  expect(new TextDecoder().decode(stl.subarray(0, 7))).toBe("nodetto");
  const { positions } = readStl(stl);
  expect(Math.min(...positions.filter((_, i) => i % 3 === 0))).toBe(
    Math.fround(0.0004),
  );
});

test("the real kernel host transfers a reference plate and a radius edit", async () => {
  const doc = plateWithHoles(60);
  const host = createWorkerHost(createManifoldKernel());
  async function evaluate(revision: number, document: typeof doc) {
    let response: CadEngineReply | undefined;
    const start = performance.now();
    await host(
      {
        id: revision,
        input: collectCadInput(document, CAD_TEST_PAGE.id, revision),
      },
      (message, transfer) => {
        const reply = message as CadEngineReply;
        expect(reply.id).toBe(revision);
        expect(reply.result.revision).toBe(revision);
        expect(reply.result.failure).toBeUndefined();
        expect(reply.result.status.filter(([, status]) => !status.ok)).toEqual(
          [],
        );
        expect(reply.result.bodies).toHaveLength(1);
        const body = reply.result.bodies[0];
        const buffers: readonly ArrayBufferLike[] = transfer;
        expect(buffers).toEqual([
          body.positions.buffer,
          body.indices.buffer,
          body.triFace.buffer,
          body.edges.buffer,
        ]);
        expect(new Set(transfer).size).toBe(4);
        response = structuredClone(reply, { transfer: [...transfer] });
        expect(body.positions.byteLength).toBe(0);
      },
    );
    const elapsed = performance.now() - start;
    if (!response) throw new Error("Expected an evaluation result");
    return { body: response.result.bodies[0], elapsed };
  }

  const first = await evaluate(1, doc);
  const edit = await evaluate(2, {
    ...doc,
    elements: doc.elements.map((element) =>
      element.id === "hole-0"
        ? { ...element, semantic: { sketch: "holes", c: [5, 5], r: 4 } }
        : element,
    ),
  });
  const timing = `60-hole plate: worker host + transfer initial ${first.elapsed.toFixed(1)} ms, radius edit ${edit.elapsed.toFixed(1)} ms`;
  await Bun.write(
    new URL("../../../tmp/cad3d/m7/roundtrip.log", import.meta.url),
    `${timing}\n`,
  );
  console.log(timing);
  expect(first.elapsed).toBeLessThan(2000);
  expect(edit.elapsed).toBeLessThan(2000);
  expect(edit.body.id).toBe("ex1");
  expect(edit.body.faceNames).toContain("ex2:side:hole-0");
  expect(edit.body.positions).not.toEqual(first.body.positions);
  expect(edit.body.edges.length).toBeGreaterThan(0);
});

test("malformed requests return failure without poisoning the host", async () => {
  const host = createWorkerHost(createManifoldKernel());
  const reply = (message: unknown, transfer: readonly ArrayBuffer[]) => {
    expect(message).toMatchObject({
      id: 1,
      result: { revision: 2, failure: "cad.kernel.failed" },
    });
    expect(transfer).toEqual([]);
  };
  await host(
    { id: 1, input: { revision: 2, pageId: "cad", elements: [null] } },
    reply,
  );
  await host(
    { id: 3, input: { revision: 4, pageId: "cad", elements: [] } },
    (message) => {
      expect(message).toEqual({
        id: 3,
        result: { revision: 4, status: [], bodies: [] },
      });
    },
  );
});

test("a WASM trap caught in feature evaluation still requests a worker restart", async () => {
  const kernel: CadKernel = {
    ...(await createManifoldKernel()),
    solid() {
      throw new WebAssembly.RuntimeError("unreachable");
    },
  };
  const host = createWorkerHost(Promise.resolve(kernel));
  const input = collectCadInput(plateWithHoles(), CAD_TEST_PAGE.id, 2);
  await host({ id: 1, input }, (message, transfer) => {
    expect(message).toMatchObject({
      id: 1,
      restart: true,
      result: {
        revision: 2,
        failure: "cad.kernel.failed",
        bodies: [],
        status: expect.arrayContaining([
          ["ex1", expect.objectContaining({ code: "cad.kernel.failed" })],
        ]),
      },
    });
    expect(transfer).toEqual([]);
  });
});

test("the real worker agrees with capture mesh eligibility fixtures", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  for (const [fixture, eligible] of [
    ["tetrahedron", true],
    ["tetrahedron-reversed", true],
    ["tetrahedron-mixed", false],
    ["triangle", false],
    ["double-sided-triangle", false],
    ["coplanar-tetrahedron", false],
    ["thin-bar", true],
    ["translated-flat-shell", false],
    ["translated-thin-bar", true],
  ] as const) {
    const data = (
      await Bun.file(
        new URL(
          `../../../crates/capture/tests/fixtures/${fixture}.nmesh.txt`,
          import.meta.url,
        ),
      ).text()
    ).trim();
    const mesh = cadElement("mesh", "cad.mesh", "a0", { name: fixture, data });
    const result = await evaluate([mesh]);
    expect(result.status).toContainEqual([
      "mesh",
      eligible
        ? { ok: true }
        : expect.objectContaining({ code: "cad.mesh.open" }),
    ]);
    const shared = await evaluate([
      sketch("base", "a1"),
      ...rectangle("base", 0, 0, 10, 10),
      extrude("block", "a2", { sketch: "base", distance: 5, op: "new" }),
      { ...mesh, index: "a3" },
      sketch("opening", "a4"),
      ...rectangle("opening", 2, 2, 2, 3),
      extrude("cut", "a5", {
        sketch: "opening",
        distance: 5,
        op: "cut",
        bodies: ["block", "mesh"],
      }),
      sketch("face", "a6", { face: { feature: "cut", role: "end" } }),
    ]);
    expect(shared.status).toContainEqual([
      "cut",
      eligible
        ? { ok: true }
        : expect.objectContaining({ code: "cad.body.missing" }),
    ]);
    expect(shared.status).toContainEqual([
      "face",
      eligible
        ? { ok: true }
        : expect.objectContaining({ code: "cad.reference.failed" }),
    ]);
  }
});

function contactBox(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  crossed = false,
) {
  return {
    positions: Float64Array.of(
      x0,
      y0,
      0,
      x1,
      y0,
      0,
      x1,
      y1,
      0,
      x0,
      y1,
      0,
      x0,
      y0,
      5,
      x1,
      y0,
      5,
      x1,
      y1,
      5,
      x0,
      y1,
      5,
    ),
    triangles: Uint32Array.from([
      0,
      2,
      1,
      0,
      3,
      2,
      4,
      5,
      6,
      4,
      6,
      7,
      0,
      1,
      5,
      0,
      5,
      4,
      1,
      2,
      6,
      1,
      6,
      5,
      2,
      3,
      7,
      2,
      7,
      6,
      ...(crossed ? [3, 0, 7, 0, 4, 7] : [3, 0, 4, 3, 4, 7]),
    ]),
  };
}

test("the real worker cuts touching shell meshes and the plate", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  for (const [name, other] of [
    ["edge", contactBox(10, 20, 10, 20)],
    ["face", contactBox(10, 20, 0, 10)],
    ["crossed", contactBox(10, 20, 0, 10, true)],
  ] as const) {
    const data = stlToInlineMesh(
      writeBinaryStl([contactBox(0, 10, 0, 10), other]),
    );
    const elements = [
      cadElement("mesh", "cad.mesh", "a0", { name, data }),
      sketch("base", "a1", { base: "xy", offset: 5 }),
      ...rectangle("base", 0, 0, 10, 10),
      extrude("plate", "a2", { sketch: "base", distance: 5, op: "new" }),
      sketch("opening", "a3"),
      ...rectangle("opening", 1, 1, 2, 2),
      extrude("cut", "a4", {
        sketch: "opening",
        distance: 10,
        op: "cut",
        bodies: ["mesh", "plate"],
      }),
    ];
    const result = await evaluate(elements, { bodyIds: ["plate"] });
    expect(result.status, name).toContainEqual(["cut", { ok: true }]);
    expect(volumeOfStl(result.stl), name).toBeCloseTo(480, 6);
  }
});
