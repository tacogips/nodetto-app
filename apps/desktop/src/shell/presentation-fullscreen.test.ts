import { describe, expect, test } from "bun:test";
import {
  enterPresentationFullscreen,
  type PresentationFullscreenEnv,
  watchFullscreenExit,
} from "./presentation-fullscreen";

function fakeEnv(): PresentationFullscreenEnv {
  return {
    isTauri: () => false,
    tauriWindow: () => ({
      isFullscreen: async () => false,
      setFullscreen: async () => {},
    }),
    document: {
      fullscreenEnabled: false,
      fullscreenElement: null,
      documentElement: {},
    },
  };
}

describe("presentation fullscreen", () => {
  for (const prior of [false, true]) {
    test(`restores Tauri fullscreen to ${prior} once`, async () => {
      const env = fakeEnv();
      const calls: boolean[] = [];
      env.isTauri = () => true;
      env.tauriWindow = () => ({
        isFullscreen: async () => prior,
        setFullscreen: async (value) => {
          calls.push(value);
        },
      });
      env.document.documentElement.requestFullscreen = async () => {
        throw new Error("DOM path");
      };
      const session = await enterPresentationFullscreen(env);
      expect(session.mode).toBe("tauri");
      await session.restore();
      await session.restore();
      expect(calls).toEqual([true, prior]);
    });
  }

  test("falls back if Tauri operations fail and swallows restore errors", async () => {
    const env = fakeEnv();
    env.isTauri = () => true;
    env.tauriWindow = () => ({
      isFullscreen: async () => {
        throw new Error();
      },
      setFullscreen: async () => {},
    });
    expect((await enterPresentationFullscreen(env)).mode).toBe("none");
    env.tauriWindow = () => ({
      isFullscreen: async () => false,
      setFullscreen: async () => {
        throw new Error();
      },
    });
    expect((await enterPresentationFullscreen(env)).mode).toBe("none");
    let calls = 0;
    env.tauriWindow = () => ({
      isFullscreen: async () => false,
      setFullscreen: async () => {
        if (++calls > 1) throw new Error();
      },
    });
    const session = await enterPresentationFullscreen(env);
    await session.restore();
    await session.restore();
    expect(calls).toBe(2);
  });

  test("enters and restores DOM fullscreen only while active", async () => {
    const env = fakeEnv();
    let requests = 0;
    let exits = 0;
    env.document.fullscreenEnabled = true;
    env.document.documentElement.requestFullscreen = async () => {
      requests++;
    };
    env.document.exitFullscreen = async () => {
      exits++;
    };
    const session = await enterPresentationFullscreen(env);
    expect(session.mode).toBe("dom");
    expect(requests).toBe(1);
    env.document.fullscreenElement = {};
    await session.restore();
    await session.restore();
    expect(exits).toBe(1);
    const another = await enterPresentationFullscreen(env);
    env.document.fullscreenElement = null;
    await another.restore();
    expect(exits).toBe(1);
  });

  test("falls back when DOM fullscreen is unavailable or rejects", async () => {
    const env = fakeEnv();
    expect((await enterPresentationFullscreen(env)).mode).toBe("none");
    env.document.fullscreenEnabled = true;
    expect((await enterPresentationFullscreen(env)).mode).toBe("none");
    env.document.documentElement.requestFullscreen = async () => {
      throw new Error();
    };
    expect((await enterPresentationFullscreen(env)).mode).toBe("none");
  });

  test("watches a fullscreen exit once and removes the listener", () => {
    let listener: (() => void) | undefined;
    let exits = 0;
    const doc = {
      fullscreenElement: {} as unknown,
      addEventListener: (_type: "fullscreenchange", fn: () => void) => {
        listener = fn;
      },
      removeEventListener: (_type: "fullscreenchange", fn: () => void) => {
        if (listener === fn) listener = undefined;
      },
    };
    const remove = watchFullscreenExit(doc, () => {
      exits++;
    });
    listener?.();
    expect(exits).toBe(0);
    doc.fullscreenElement = null;
    listener?.();
    listener?.();
    expect(exits).toBe(1);
    remove();
    expect(listener).toBeUndefined();
  });
});
