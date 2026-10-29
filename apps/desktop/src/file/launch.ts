// Documents the OS asked the app to open: command-line paths and, on macOS,
// open-documents events (`open -a nodetto file.jsonl`, Finder "Open With"),
// plus nodetto://open links that also name a page. Rust queues the requests
// until the frontend takes them, so a request that arrives before the
// webview is listening is not lost.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const OPEN_REQUESTED_EVENT = "open-documents-requested";

/** A document to open; a link may also choose the page to show. */
export interface LaunchRequest {
  readonly path: string;
  /** Full or short page ID. */
  readonly page?: string;
  /** 1-based display position. */
  readonly pageNumber?: number;
}

export interface LaunchBackend {
  /** Remove and return the queued requests, oldest first. */
  takeRequests(): Promise<readonly LaunchRequest[]>;
  /**
   * Call `listener` when new paths were queued. Resolves to an unsubscribe
   * function once the listener is registered: only from then on is a newly
   * queued path guaranteed to wake it.
   */
  onOpenRequested(listener: () => void): Promise<() => void>;
}

export function createTauriLaunchBackend(): LaunchBackend {
  return {
    takeRequests: () => invoke<LaunchRequest[]>("take_launch_requests"),
    onOpenRequested: (listener) =>
      listen(OPEN_REQUESTED_EVENT, () => listener()).then(
        (stop: UnlistenFn) => () => stop(),
      ),
  };
}

export function createUnavailableLaunchBackend(): LaunchBackend {
  return {
    takeRequests: () => Promise.resolve([]),
    onOpenRequested: () => Promise.resolve(() => {}),
  };
}

export function createLaunchBackend(): LaunchBackend {
  return isTauri()
    ? createTauriLaunchBackend()
    : createUnavailableLaunchBackend();
}

/**
 * Take the queued requests and open the most recent one; earlier requests
 * are superseded because the editor holds one document at a time.
 */
export async function openRequestedDocument(
  backend: LaunchBackend,
  open: (request: LaunchRequest) => void,
): Promise<void> {
  const request = (await backend.takeRequests()).at(-1);
  if (request) open(request);
}

export interface OpenRequestWatcher {
  /** Open what was held back while `canOpen` said no; a no-op otherwise. */
  flush(): void;
  stop(): void;
}

/**
 * Open OS requests as they arrive. The listener is registered before the
 * queue is first drained, so a request queued in between still wakes it.
 * While `canOpen` is false (a cloud room owns the editor) nothing is taken:
 * the paths stay queued on the Rust side until `flush`.
 */
export function watchOpenRequests(
  backend: LaunchBackend,
  open: (request: LaunchRequest) => void,
  canOpen: () => boolean,
): OpenRequestWatcher {
  let stopped = false;
  let held = false;
  // A request already taken off the queue when ownership changed under the
  // take; it is opened on the next flush unless a newer request wins.
  let pending: LaunchRequest | null = null;
  let unlisten: (() => void) | null = null;
  const drain = (): void => {
    if (stopped) return;
    if (!canOpen()) {
      held = true;
      return;
    }
    held = false;
    void backend.takeRequests().then(
      (requests) => {
        if (stopped) return;
        const request = requests.at(-1) ?? pending;
        if (!request) return;
        if (!canOpen()) {
          pending = request;
          held = true;
          return;
        }
        pending = null;
        open(request);
      },
      () => {
        // Nothing was taken; whatever is pending stays for the next flush.
        if (pending) held = true;
      },
    );
  };
  void backend.onOpenRequested(drain).then(
    (stop) => {
      if (stopped) {
        stop();
        return;
      }
      unlisten = stop;
      drain();
    },
    // Without a listener the launch paths are still worth opening once.
    () => drain(),
  );
  return {
    flush: () => {
      if (held) drain();
    },
    stop: () => {
      stopped = true;
      unlisten?.();
      unlisten = null;
    },
  };
}
