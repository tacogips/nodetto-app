import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface PresentationFullscreenSession {
  readonly mode: "tauri" | "dom" | "none";
  restore(): Promise<void>;
}

export interface PresentationFullscreenEnv {
  isTauri(): boolean;
  tauriWindow(): {
    isFullscreen(): Promise<boolean>;
    setFullscreen(value: boolean): Promise<void>;
  };
  document: {
    fullscreenEnabled?: boolean;
    fullscreenElement: unknown;
    documentElement: { requestFullscreen?(): Promise<void> };
    exitFullscreen?(): Promise<void>;
  };
}

export function defaultFullscreenEnv(): PresentationFullscreenEnv {
  return { isTauri, tauriWindow: getCurrentWindow, document };
}

export async function enterPresentationFullscreen(
  env?: PresentationFullscreenEnv,
): Promise<PresentationFullscreenSession> {
  let mode: PresentationFullscreenSession["mode"] = "none";
  let undo: () => Promise<void> = async () => {};
  try {
    const current = env ?? defaultFullscreenEnv();
    if (current.isTauri()) {
      const window = current.tauriWindow();
      const was = await window.isFullscreen();
      await window.setFullscreen(true);
      mode = "tauri";
      undo = () => window.setFullscreen(was);
    } else if (
      current.document.fullscreenEnabled &&
      current.document.documentElement.requestFullscreen
    ) {
      await current.document.documentElement.requestFullscreen();
      mode = "dom";
      undo = async () => {
        if (current.document.fullscreenElement != null)
          await current.document.exitFullscreen?.();
      };
    }
  } catch {
    // The viewport-filling overlay remains available without fullscreen.
  }
  let restored = false;
  return {
    mode,
    async restore() {
      if (restored) return;
      restored = true;
      try {
        await undo();
      } catch {
        // Restoring fullscreen is best effort.
      }
    },
  };
}

export function watchFullscreenExit(
  doc: {
    fullscreenElement: unknown;
    addEventListener(type: "fullscreenchange", fn: () => void): void;
    removeEventListener(type: "fullscreenchange", fn: () => void): void;
  },
  onExit: () => void,
): () => void {
  let fired = false;
  const listener = () => {
    if (!fired && doc.fullscreenElement == null) {
      fired = true;
      onExit();
    }
  };
  doc.addEventListener("fullscreenchange", listener);
  return () => doc.removeEventListener("fullscreenchange", listener);
}
