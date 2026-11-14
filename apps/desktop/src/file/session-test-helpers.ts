// Shared harness for the document session tests.
//
// The backend is mocked with an in-memory filesystem and the autosave timer
// is driven by hand, so every branch — debounce, conflict, failed open —
// runs without a Tauri runtime and without waiting on wall-clock time.

import { createDefaultRegistry, Editor } from "@nodetto/core";
import { seed } from "../seed.ts";
import type {
  FileBackend,
  FileChangedListener,
  RecentEntry,
} from "./backend.ts";
import { DocumentSession, type TimerHandle } from "./session.ts";

export interface MockBackend extends FileBackend {
  readonly files: Map<string, string>;
  /** Binary files, read only through `readDocumentBytes`. */
  readonly binaries: Map<string, Uint8Array>;
  /** Queued dialog answers, consumed in order. */
  readonly openAnswers: (string | null)[];
  readonly saveAnswers: (string | null)[];
  readonly writes: { path: string; contents: string }[];
  readonly watched: (string | null)[];
  emitFileChanged(path: string): void;
  failNextRead(message: string): void;
  failNextWrite(message: string): void;
  /** Hold every subsequent write until `releaseWrites`. */
  blockWrites(): void;
  releaseWrites(): void;
}

/**
 * How the Rust `read_document` command reports a missing file; the session
 * matches this prefix to decide whether a recent entry is dead. Pinned on
 * the Rust side by `read_document_reports_a_missing_file`.
 */
const MISSING_FILE_ERROR = "file not found";

export function createMockBackend(): MockBackend {
  const files = new Map<string, string>();
  const binaries = new Map<string, Uint8Array>();
  const listeners = new Set<FileChangedListener>();
  let recent: RecentEntry[] = [];
  let clock = 0;
  let readFailure: string | null = null;
  let writeFailure: string | null = null;
  let writeGate: Promise<void> | null = null;
  let openWriteGate: (() => void) | null = null;

  const backend: MockBackend = {
    available: true,
    files,
    binaries,
    openAnswers: [],
    saveAnswers: [],
    writes: [],
    watched: [],
    emitFileChanged(path: string) {
      for (const listener of [...listeners]) {
        listener(path);
      }
    },
    failNextRead(message: string) {
      readFailure = message;
    },
    failNextWrite(message: string) {
      writeFailure = message;
    },
    blockWrites() {
      writeGate = new Promise((resolve) => {
        openWriteGate = resolve;
      });
    },
    releaseWrites() {
      openWriteGate?.();
      writeGate = null;
      openWriteGate = null;
    },
    pickOpenPath() {
      return Promise.resolve(backend.openAnswers.shift() ?? null);
    },
    pickSavePath() {
      return Promise.resolve(backend.saveAnswers.shift() ?? null);
    },
    readDocument(path: string) {
      if (readFailure !== null) {
        const message = readFailure;
        readFailure = null;
        return Promise.reject(new Error(message));
      }
      const contents = files.get(path);
      return contents === undefined
        ? Promise.reject(new Error(`${MISSING_FILE_ERROR}: ${path}`))
        : Promise.resolve(contents);
    },
    readDocumentBytes(path: string) {
      const contents = binaries.get(path);
      return contents === undefined
        ? Promise.reject(new Error(`${MISSING_FILE_ERROR}: ${path}`))
        : Promise.resolve(contents);
    },
    writeDocument(path: string, contents: string) {
      if (writeFailure !== null) {
        const message = writeFailure;
        writeFailure = null;
        return Promise.reject(new Error(message));
      }
      // Captured now: a write already waiting must not be freed by a gate
      // opened for a later one.
      return (writeGate ?? Promise.resolve()).then(() => {
        files.set(path, contents);
        backend.writes.push({ path, contents });
      });
    },
    listRecent() {
      return Promise.resolve(recent);
    },
    addRecent(path: string) {
      clock += 1;
      recent = [
        { path, openedAtMs: clock },
        ...recent.filter((entry) => entry.path !== path),
      ];
      return Promise.resolve(recent);
    },
    removeRecent(path: string) {
      recent = recent.filter((entry) => entry.path !== path);
      return Promise.resolve(recent);
    },
    watch(path: string) {
      backend.watched.push(path);
      return Promise.resolve();
    },
    unwatch() {
      backend.watched.push(null);
      return Promise.resolve();
    },
    onFileChanged(listener: FileChangedListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return backend;
}

/** A scheduler the test fires by hand, so debounce timing is exact. */
export function createTimers() {
  const pending = new Map<number, () => void>();
  let nextHandle = 0;
  return {
    get pendingCount(): number {
      return pending.size;
    },
    schedule(callback: () => void): TimerHandle {
      nextHandle += 1;
      pending.set(nextHandle, callback);
      return nextHandle;
    },
    cancel(handle: TimerHandle): void {
      pending.delete(handle as number);
    },
    /** Fire every scheduled callback, newest scheduling wins by insertion. */
    fire(): void {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) {
        callback();
      }
    },
  };
}

export interface Harness {
  readonly editor: Editor;
  readonly backend: MockBackend;
  readonly session: DocumentSession;
  readonly timers: ReturnType<typeof createTimers>;
  /** Let queued backend promises settle. */
  settle(): Promise<void>;
}

export function createHarness(options: { seeded?: boolean } = {}): Harness {
  const editor = new Editor({ registry: createDefaultRegistry() });
  if (options.seeded !== false) {
    seed(editor);
  }
  const backend = createMockBackend();
  const timers = createTimers();
  const session = new DocumentSession({
    editor,
    backend,
    autosaveDelayMs: 1000,
    scheduleTimer: (callback) => timers.schedule(callback),
    cancelTimer: (handle) => {
      timers.cancel(handle);
    },
  });
  return {
    editor,
    backend,
    session,
    timers,
    async settle() {
      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve();
      }
    },
  };
}

export function addShape(editor: Editor, label: string): void {
  editor.createElement("shape.geo", {
    visual: { x: 10, y: 10, width: 100, height: 60 },
    semantic: { geo: "rect", label },
  });
}
