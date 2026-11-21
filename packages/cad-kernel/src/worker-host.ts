import {
  cadEngineFailure,
  type CadEngineReply,
  type CadEngineRequest,
  type CadKernel,
  createCadMemo,
  displayBody,
  evaluateCadPage,
} from "@nodetto/core";
import { type Element, isPlainObject } from "@nodetto/ir";

function isElement(value: unknown): value is Element {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.page === "string" &&
    typeof value.type === "string" &&
    typeof value.index === "string" &&
    Object.hasOwn(value, "semantic") &&
    isPlainObject(value.visual)
  );
}

function isRequest(message: unknown): message is CadEngineRequest {
  if (!isPlainObject(message) || !Number.isSafeInteger(message.id))
    return false;
  const { input } = message;
  return (
    isPlainObject(input) &&
    Number.isSafeInteger(input.revision) &&
    typeof input.pageId === "string" &&
    Array.isArray(input.elements) &&
    input.elements.every(isElement)
  );
}

function transferableBuffer(view: ArrayBufferView): ArrayBuffer {
  const { buffer } = view;
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error("CAD display buffers must be transferable");
  }
  return buffer;
}

export function createWorkerHost(
  kernel: Promise<CadKernel>,
): (
  message: unknown,
  reply: (message: unknown, transfer: readonly ArrayBuffer[]) => void,
) => Promise<void> {
  let trap: WebAssembly.RuntimeError | undefined;
  function call<T>(operation: () => T): T {
    if (trap) throw trap;
    try {
      return operation();
    } catch (error) {
      if (error instanceof WebAssembly.RuntimeError) trap = error;
      throw error;
    }
  }
  const ready = kernel
    .then((instance) => {
      // The evaluator reports kernel exceptions as feature statuses. A WASM
      // trap additionally invalidates the instance and all its cached handles.
      const guarded: CadKernel = {
        id: instance.id,
        solid: (mesh) => call(() => instance.solid(mesh)),
        boolean: (op, target, tools) =>
          call(() => instance.boolean(op, target, tools)),
        mesh: (handle) => call(() => instance.mesh(handle)),
        measure: (handle) => call(() => instance.measure(handle)),
        release: (handle) => call(() => instance.release(handle)),
      };
      return { kernel: guarded, memo: createCadMemo(guarded) };
    })
    .catch(() => undefined);

  return async (message, reply) => {
    if (!isRequest(message)) {
      const id =
        isPlainObject(message) && typeof message.id === "number"
          ? message.id
          : -1;
      const input = isPlainObject(message) ? message.input : undefined;
      const revision =
        isPlainObject(input) && typeof input.revision === "number"
          ? input.revision
          : -1;
      reply(
        { id, result: cadEngineFailure(revision) } satisfies CadEngineReply,
        [],
      );
      return;
    }
    const {
      id,
      input: { revision, pageId, elements },
    } = message;
    let response: CadEngineReply;
    let transfer: ArrayBuffer[] = [];
    try {
      const state = await ready;
      if (!state) throw new Error("CAD kernel initialization failed");
      const pageElements = elements.filter(
        (element) => element.page === pageId,
      );
      const evaluation = evaluateCadPage(
        pageElements,
        state.kernel,
        state.memo,
      );
      if (trap) {
        response = {
          id,
          result: {
            ...cadEngineFailure(revision),
            status: [...evaluation.status],
          },
          restart: true,
        };
      } else {
        const bodies = evaluation.bodies.map(({ id, reference, handle }) =>
          displayBody(id, reference, state.kernel.mesh(handle)),
        );
        transfer = bodies.flatMap(({ positions, indices, triFace, edges }) =>
          [positions, indices, triFace, edges].map(transferableBuffer),
        );
        response = {
          id,
          result: { revision, status: [...evaluation.status], bodies },
        };
      }
    } catch {
      response = { id, result: cadEngineFailure(revision), restart: true };
    }
    reply(response, transfer);
  };
}
