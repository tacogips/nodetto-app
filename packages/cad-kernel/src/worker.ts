/// <reference lib="webworker" />

import { isPlainObject } from "@nodetto/ir";
import { createManifoldKernel } from "./manifold-kernel.ts";
import { createWorkerHost } from "./worker-host.ts";

declare const self: DedicatedWorkerGlobalScope;
let receive: ReturnType<typeof createWorkerHost> | undefined;

self.onmessage = async ({ data }: MessageEvent<unknown>) => {
  if (
    isPlainObject(data) &&
    data.type === "init" &&
    typeof data.wasmUrl === "string"
  ) {
    receive ??= createWorkerHost(
      createManifoldKernel({ wasmUrl: data.wasmUrl }),
    );
    return;
  }
  await receive?.(data, (reply, transfer) =>
    self.postMessage(reply, [...transfer]),
  );
};
