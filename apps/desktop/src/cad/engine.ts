import {
  type CadEngine,
  type CadTransport,
  createCadEngineClient,
} from "@nodetto/core";
import CadWorker from "@nodetto/cad-kernel/worker?worker";
import wasmAsset from "manifold-3d/manifold.wasm?url";

/** Each caller owns its worker so an export cannot supersede a viewport request. */
export function getCadEngine(): CadEngine {
  let worker: Worker | undefined;
  let handler: (message: unknown) => void;
  let onError: () => void;
  function close(): void {
    worker?.terminate();
    worker = undefined;
  }
  function open(): Worker {
    if (worker) return worker;
    const current = new CadWorker({ name: "nodetto-cad" });
    worker = current;
    const fail = () => {
      if (worker !== current) return;
      close();
      onError();
    };
    current.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (worker === current) handler(data);
    };
    current.onerror = (event) => {
      event.preventDefault();
      fail();
    };
    current.onmessageerror = fail;
    try {
      current.postMessage({
        type: "init",
        wasmUrl: new URL(wasmAsset, document.baseURI).href,
      });
    } catch (error) {
      close();
      throw error;
    }
    return current;
  }

  const transport: CadTransport = {
    post(message, transfer) {
      open().postMessage(message, [...transfer]);
    },
    onMessage(callback) {
      handler = callback;
    },
    onError(callback) {
      onError = callback;
    },
    restart() {
      close();
      open();
    },
    dispose: close,
  };
  const engine = createCadEngineClient(transport);
  try {
    open();
  } catch {
    // The first evaluation will surface worker startup failure to the viewport.
  }
  return engine;
}
