import {
  type Element,
  type ElementId,
  isPlainObject,
  type Page,
  type PageId,
} from "@nodetto/ir";
import type { CadDisplayBody } from "./display.ts";
import type { CadStatus } from "./history.ts";

export interface CadEngineInput {
  readonly revision: number;
  readonly pageId: PageId;
  readonly elements: readonly Element[];
}

export interface CadEngineResult {
  readonly revision: number;
  readonly status: readonly (readonly [ElementId, CadStatus])[];
  readonly bodies: readonly CadDisplayBody[];
  readonly failure?: string;
}

export interface CadEngine {
  evaluate(input: CadEngineInput): Promise<CadEngineResult>;
  dispose(): void;
}

export interface CadTransport {
  post(message: unknown, transfer: readonly ArrayBuffer[]): void;
  onMessage(handler: (message: unknown) => void): void;
  onError?(handler: () => void): void;
  restart(): void;
  dispose?(): void;
}

export class CadSupersededError extends Error {
  constructor() {
    super("CAD evaluation superseded");
    this.name = "CadSupersededError";
  }
}

export interface CadEngineRequest {
  readonly id: number;
  readonly input: CadEngineInput;
}

export interface CadEngineReply {
  readonly id: number;
  readonly result: CadEngineResult;
  readonly restart?: boolean;
}

export function cadEngineFailure(revision: number): CadEngineResult {
  return { revision, status: [], bodies: [], failure: "cad.kernel.failed" };
}

export function collectCadInput(
  document: { pages: readonly Page[]; elements: readonly Element[] },
  pageId: PageId,
  revision: number,
): CadEngineInput {
  return {
    revision,
    pageId,
    elements: document.pages.some(
      (page) => page.id === pageId && page.kind === "cad3d",
    )
      ? document.elements.filter((element) => element.page === pageId)
      : [],
  };
}

function isStatus(value: unknown): value is CadStatus {
  return (
    isPlainObject(value) &&
    (value.ok === true ||
      (value.ok === false &&
        typeof value.code === "string" &&
        (value.detail === undefined || typeof value.detail === "string")))
  );
}

function isDisplayBody(value: unknown): value is CadDisplayBody {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.reference === "boolean" &&
    value.positions instanceof Float32Array &&
    value.indices instanceof Uint32Array &&
    value.triFace instanceof Uint32Array &&
    value.edges instanceof Float32Array &&
    Array.isArray(value.faceNames) &&
    value.faceNames.every((name) => typeof name === "string")
  );
}

function isReply(value: unknown): value is CadEngineReply {
  if (!isPlainObject(value) || typeof value.id !== "number") return false;
  const { result } = value;
  return (
    isPlainObject(result) &&
    Number.isSafeInteger(result.revision) &&
    (result.failure === undefined || typeof result.failure === "string") &&
    Array.isArray(result.status) &&
    result.status.every(
      (pair: unknown) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        isStatus(pair[1]),
    ) &&
    Array.isArray(result.bodies) &&
    result.bodies.every(isDisplayBody)
  );
}

interface Pending {
  readonly request: CadEngineRequest;
  readonly resolve: (result: CadEngineResult) => void;
  readonly reject: (error: Error) => void;
}

export function createCadEngineClient(
  transport: CadTransport,
  options: {
    timeoutMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (timer: unknown) => void;
  } = {},
): CadEngine {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer =
    options.clearTimer ??
    ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let sequence = 0;
  let pending: Pending | undefined;
  let active:
    | {
        readonly job: Pending;
        readonly deadline: number;
        readonly timer: unknown;
      }
    | undefined;
  let disposed = false;

  function finish(result: CadEngineResult, restart = false): void {
    if (!active) return;
    const { job, timer } = active;
    active = undefined;
    clearTimer(timer);
    if (restart) {
      try {
        transport.restart();
      } catch {
        // A failed recreation will be reported by the next post.
      }
    }
    if (pending) {
      const next = pending;
      pending = undefined;
      job.reject(new CadSupersededError());
      start(next);
    } else {
      job.resolve(result);
    }
  }

  function start(job: Pending): void {
    const { request } = job;
    const deadline = now() + timeoutMs;
    const fail = () => {
      if (active?.job === job)
        finish(cadEngineFailure(request.input.revision), true);
    };
    active = { job, deadline, timer: setTimer(fail, timeoutMs) };
    try {
      transport.post(request, []);
    } catch {
      fail();
    }
  }

  transport.onMessage((message) => {
    if (!active || !isReply(message)) return;
    const { request } = active.job;
    if (
      message.id !== request.id ||
      message.result.revision !== request.input.revision
    ) {
      return;
    }
    if (now() >= active.deadline) {
      finish(cadEngineFailure(request.input.revision), true);
      return;
    }
    finish(message.result, message.restart === true);
  });
  transport.onError?.(() => {
    if (active)
      finish(cadEngineFailure(active.job.request.input.revision), true);
  });

  return {
    evaluate(input) {
      return new Promise((resolve, reject) => {
        if (disposed) {
          reject(new Error("CAD engine disposed"));
          return;
        }
        const job = { request: { id: ++sequence, input }, resolve, reject };
        if (active) {
          pending?.reject(new CadSupersededError());
          pending = job;
        } else {
          start(job);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const error = new Error("CAD engine disposed");
      pending?.reject(error);
      pending = undefined;
      if (active) {
        clearTimer(active.timer);
        active.job.reject(error);
        active = undefined;
      }
      transport.dispose?.();
    },
  };
}
