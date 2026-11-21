import { expect, test } from "bun:test";
import {
  type CadEngineReply,
  type CadKernel,
  collectCadInput,
} from "@nodetto/core";
import {
  CAD_TEST_PAGE,
  plateWithHoles,
} from "../../core/src/cad/testing/documents.ts";
import { createManifoldKernel } from "./manifold-kernel.ts";
import { createWorkerHost } from "./worker-host.ts";

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
