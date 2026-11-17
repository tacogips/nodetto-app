import { describe, expect, test } from "bun:test";
import { LAYER_WINDOW_THRESHOLD, layerWindow } from "./layer-window.ts";

const view = { scrollTop: 0, viewHeight: 600, rowsTop: 100, rowHeight: 24 };

describe("layer window", () => {
  test("a short list is mounted whole", () => {
    expect(
      layerWindow({ ...view, count: LAYER_WINDOW_THRESHOLD, scrollTop: 900 }),
    ).toEqual({ start: 0, end: LAYER_WINDOW_THRESHOLD, before: 0, after: 0 });
  });

  test("a long list mounts the rows around the view", () => {
    const window = layerWindow({ ...view, count: 5000, scrollTop: 24100 });
    // Row 1000 is at the top of the view; 25 rows fit.
    expect(window.start).toBeLessThan(1000);
    expect(window.start).toBeGreaterThan(1000 - 20);
    expect(window.end).toBeGreaterThan(1025);
    expect(window.end).toBeLessThan(1025 + 20);
  });

  test("padding stands in for the rows left out", () => {
    const count = 5000;
    const window = layerWindow({ ...view, count, scrollTop: 24100 });
    expect(window.before).toBe(window.start * view.rowHeight);
    expect(
      window.before +
        (window.end - window.start) * view.rowHeight +
        window.after,
    ).toBe(count * view.rowHeight);
  });

  test("the window stays inside the list at either end", () => {
    expect(layerWindow({ ...view, count: 5000 }).start).toBe(0);
    const tail = layerWindow({ ...view, count: 5000, scrollTop: 10_000_000 });
    expect(tail.end).toBe(5000);
    expect(tail.start).toBeLessThanOrEqual(tail.end);
    expect(tail.after).toBe(0);
  });

  test("a scroll offset past a shortened list still shows its last rows", () => {
    const count = 1000;
    const window = layerWindow({
      ...view,
      count,
      // Where the view was before a few hundred rows were deleted.
      scrollTop: view.rowsTop + 1300 * view.rowHeight,
    });
    expect(window.end).toBe(count);
    expect(window.end - window.start).toBeGreaterThanOrEqual(
      Math.ceil(view.viewHeight / view.rowHeight),
    );
  });

  test("unmeasured layout mounts the head of the list", () => {
    for (const unmeasured of [{ rowHeight: 0 }, { viewHeight: 0 }])
      expect(layerWindow({ ...view, ...unmeasured, count: 5000 })).toEqual({
        start: 0,
        end: LAYER_WINDOW_THRESHOLD,
        before: 0,
        after: 0,
      });
  });

  test("a kept row stays mounted wherever the view is", () => {
    const window = layerWindow({
      ...view,
      count: 5000,
      scrollTop: 24100,
      keep: 10,
    });
    expect(window.start).toBeLessThanOrEqual(10);
    expect(window.end).toBeGreaterThan(1025);
    const below = layerWindow({ ...view, count: 5000, keep: 4000 });
    expect(below.end).toBe(4001);
    // A row that is not in the list keeps nothing.
    expect(layerWindow({ ...view, count: 5000, keep: -1 })).toEqual(
      layerWindow({ ...view, count: 5000 }),
    );
  });
});
