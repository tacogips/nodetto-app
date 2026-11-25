import { expect, test } from "bun:test";
import type { CadEngineInput, CadEngineReply } from "@nodetto/core";
import { readStl } from "@nodetto/io/stl";
import {
  CAD_TEST_PAGE,
  extrude,
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

test("shared emptying cut is rejected atomically", async () => {
  const evaluate = evaluator(createWorkerHost(createManifoldKernel()));
  const scene = (bodies: string[]) => [
    sketch("rail-profile", "a0"),
    ...rectangle("rail-profile", 0, 0, 20, 10),
    extrude("rail", "a1", { sketch: "rail-profile", distance: 4, op: "new" }),
    sketch("tab-profile", "a2"),
    ...rectangle("tab-profile", 1, 1, 2, 2),
    extrude("tab", "a3", { sketch: "tab-profile", distance: 4, op: "new" }),
    sketch("slot-profile", "a4"),
    ...rectangle("slot-profile", 0, 0, 5, 10),
    extrude("slot", "a5", {
      sketch: "slot-profile",
      distance: 4,
      op: "cut",
      bodies,
    }),
  ];
  const shared = await evaluate(scene(["rail", "tab"]), { bodyIds: ["rail"] });
  expect(shared.status).toContainEqual([
    "slot",
    expect.objectContaining({ code: "cad.result.empty" }),
  ]);
  expect(volumeOfStl(shared.stl)).toBeCloseTo(800, 6);
  const single = await evaluate(scene(["rail"]), { bodyIds: ["rail"] });
  expect(single.status).toContainEqual(["slot", { ok: true }]);
  expect(volumeOfStl(single.stl)).toBeCloseTo(600, 6);
});
