import { expect, test } from "bun:test";
import type { invoke } from "@tauri-apps/api/core";
import { createTauriExportBackend } from "./backend";

test("capture sends raw scene and splits binary reply", async () => {
  const scene = new Uint8Array(1_179_856);
  const report = '{"message":"capture"}';
  const reportBytes = new TextEncoder().encode(report);
  const image = new Uint8Array([137, 80, 78, 71]);
  const packet = new Uint8Array(4 + reportBytes.length + image.length);
  new DataView(packet.buffer).setUint32(0, reportBytes.length, true);
  packet.set(reportBytes, 4);
  packet.set(image, 4 + reportBytes.length);
  let args: unknown[] = [];
  const fake = ((...values: unknown[]) => {
    args = values;
    return Promise.resolve(packet.buffer);
  }) as typeof invoke;
  const result = await createTauriExportBackend(fake).captureSolid?.(
    scene,
    "png",
    90,
  );
  expect(args).toEqual([
    "capture_solid",
    scene,
    {
      headers: {
        "x-nodetto-format": "png",
        "x-nodetto-quality": "90",
      },
    },
  ]);
  expect(args[1]).toBe(scene);
  expect(result).toEqual({ report, image });
});

test("capture rejects truncated reply packets", async () => {
  for (const packet of [new Uint8Array(3), new Uint8Array([5, 0, 0, 0, 1])]) {
    const fake = (() => Promise.resolve(packet.buffer)) as typeof invoke;
    await expect(
      createTauriExportBackend(fake).captureSolid?.(
        new Uint8Array(),
        "png",
        90,
      ),
    ).rejects.toThrow("Truncated solid capture packet.");
  }
});
