import { expect, test } from "bun:test";
import {
  pageTabFlingStep,
  pageTabScrollEdges,
  pageTabScrollStep,
  PageTabPan,
  type PageTabSpan,
} from "./page-tab-scroll.ts";

// Six 100px tabs with 2px gaps in a 250px strip.
const spans: PageTabSpan[] = Array.from({ length: 6 }, (_, index) => ({
  start: index * 102,
  end: index * 102 + 100,
}));
const view = (scrollLeft: number) => ({
  scrollLeft,
  width: 250,
  scrollWidth: 610,
});

test("edges report which way hidden tabs remain", () => {
  expect(pageTabScrollEdges(view(0))).toEqual({ back: false, forward: true });
  expect(pageTabScrollEdges(view(120))).toEqual({ back: true, forward: true });
  expect(pageTabScrollEdges(view(360))).toEqual({ back: true, forward: false });
  expect(
    pageTabScrollEdges({ scrollLeft: 0, width: 250, scrollWidth: 250.5 }),
  ).toEqual({ back: false, forward: false });
});

test("arrows shift one whole tab at a time in each direction", () => {
  expect(pageTabScrollStep(spans, view(0), 1)).toBe(102);
  expect(pageTabScrollStep(spans, view(102), 1)).toBe(204);
  expect(pageTabScrollStep(spans, view(204), 1)).toBe(306);
  // The last step stops where the final tab meets the right edge.
  expect(pageTabScrollStep(spans, view(306), 1)).toBe(360);
  expect(pageTabScrollStep(spans, view(360), 1)).toBe(360);

  expect(pageTabScrollStep(spans, view(360), -1)).toBe(306);
  expect(pageTabScrollStep(spans, view(306), -1)).toBe(204);
  // A partly hidden tab at the left edge comes fully into view first.
  expect(pageTabScrollStep(spans, view(150), -1)).toBe(102);
  expect(pageTabScrollStep(spans, view(102), -1)).toBe(0);
  expect(pageTabScrollStep(spans, view(0), -1)).toBe(0);
  // Mid-tab, forward aligns to the next tab start.
  expect(pageTabScrollStep(spans, view(150), 1)).toBe(204);
});

test("a right-button pan follows the pointer and glides on a fast release", () => {
  const pan = new PageTabPan();
  pan.start(1, 300, 100, 0);
  expect(pan.move(2, 200, 10)).toBeNull();
  expect(pan.move(1, 298, 10)).toBeNull();
  expect(pan.moved).toBe(false);
  expect(pan.move(1, 260, 20)).toBe(140);
  expect(pan.move(1, 200, 40)).toBe(200);
  expect(pan.finish(1, 40)).toBeCloseTo(2.5);
  expect(pan.owns(1)).toBe(false);
});

test("a pan that stops before release or never moves does not glide", () => {
  const pan = new PageTabPan();
  pan.start(1, 300, 0, 0);
  pan.move(1, 200, 20);
  pan.move(1, 200, 200);
  expect(pan.finish(1, 300)).toBe(0);

  pan.start(1, 300, 0, 0);
  pan.move(1, 302, 10);
  expect(pan.finish(1, 20)).toBe(0);
});

test("a glide decelerates and comes to rest", () => {
  let velocity = 2;
  let travelled = 0;
  let frames = 0;
  while (velocity !== 0 && frames < 10_000) {
    const step = pageTabFlingStep(velocity, 16);
    travelled += step.distance;
    velocity = step.velocity;
    frames += 1;
  }
  expect(velocity).toBe(0);
  expect(frames).toBeLessThan(200);
  expect(travelled).toBeGreaterThan(500);
  expect(travelled).toBeLessThan(1500);
});
