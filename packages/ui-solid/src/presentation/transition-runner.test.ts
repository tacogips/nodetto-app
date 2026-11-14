import { describe, expect, test } from "bun:test";
import { SlideTransitionRunner } from "./transition-runner.ts";

function fakeJob() {
  let finish = () => {};
  let reject = (_reason?: unknown) => {};
  let cancelled = 0;
  let cleaned = 0;
  const finished = new Promise<Animation>((resolve, fail) => {
    finish = () => resolve(animation);
    reject = fail;
  });
  const animation = {
    finished,
    cancel() {
      cancelled += 1;
      reject(new Error("cancelled"));
    },
  } as Animation;
  return {
    job: {
      target: { animate: () => animation },
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 100 },
      onFinish: () => {
        cleaned += 1;
      },
    },
    finish,
    get cancelled() {
      return cancelled;
    },
    get cleaned() {
      return cleaned;
    },
  };
}

describe("SlideTransitionRunner", () => {
  test("finishes all jobs and cleans each once", async () => {
    const runner = new SlideTransitionRunner();
    const a = fakeJob();
    const b = fakeJob();
    const play = runner.play([a.job, b.job]);
    a.finish();
    b.finish();
    expect(await play).toBe("finished");
    runner.cancel();
    expect([a.cleaned, b.cleaned]).toEqual([1, 1]);
  });
  test("cancellation cancels every animation and cleans once", async () => {
    const runner = new SlideTransitionRunner();
    const a = fakeJob();
    const b = fakeJob();
    const play = runner.play([a.job, b.job]);
    runner.cancel();
    runner.cancel();
    expect(await play).toBe("cancelled");
    expect([a.cancelled, b.cancelled, a.cleaned, b.cleaned]).toEqual([
      1, 1, 1, 1,
    ]);
  });
  test("a replacement play cannot report the stale play finished", async () => {
    const runner = new SlideTransitionRunner();
    const a = fakeJob();
    const b = fakeJob();
    const first = runner.play([a.job]);
    const second = runner.play([b.job]);
    b.finish();
    expect(await first).toBe("cancelled");
    expect(await second).toBe("finished");
    expect([a.cancelled, a.cleaned, b.cleaned]).toEqual([1, 1, 1]);
  });
});
