import { describe, expect, test } from "bun:test";
import {
  classifyDrawOn,
  drawOnKeyframes,
  poseTransform,
  shortestDelta,
  stepKeyframes,
  type DrawOnProbe,
} from "./transition-keyframes.ts";

const box = { x: 10, y: 20, width: 100, height: 40, rotation: 0 };
const origin = { x: 100, y: -50 };
const probe: DrawOnProbe = {
  tag: "path",
  fill: "red",
  stroke: "black",
  strokeWidth: 2,
  dasharray: null,
  fillOpacity: 0.4,
  length: 400,
};

describe("slide transition keyframes", () => {
  test("poses preserve identity, translation, zero width and shortest rotation", () => {
    expect(poseTransform(box, box, origin)).toBe(
      "translate(160px, -10px) rotate(0deg) scale(1, 1) rotate(0deg) translate(-160px, 10px)",
    );
    expect(poseTransform({ ...box, x: 30 }, box, origin)).toContain(
      "translate(180px, -10px)",
    );
    expect(poseTransform(box, { ...box, width: 0 }, origin)).toContain(
      "scale(1, 1)",
    );
    expect(shortestDelta(10, 350)).toBe(20);
    expect(
      poseTransform(
        { ...box, rotation: 10 },
        { ...box, rotation: 350 },
        origin,
      ),
    ).toContain("rotate(370deg)");
  });
  test("transform and crossfade retain timing and opacity", () => {
    const frames = stepKeyframes(
      {
        kind: "transform",
        fromBox: box,
        toBox: { ...box, x: 40 },
        appearanceChanged: true,
        start: 60,
        duration: 700,
        easing: "ease-in-out",
      },
      { from: origin, to: origin },
    );
    expect(frames.incoming?.options).toEqual({
      delay: 60,
      duration: 700,
      easing: "ease-in-out",
      fill: "both",
    });
    expect(frames.incoming?.keyframes.map((frame) => frame.opacity)).toEqual([
      0, 1,
    ]);
    expect(frames.outgoing?.keyframes.map((frame) => frame.opacity)).toEqual([
      1, 0,
    ]);
    const unchanged = stepKeyframes(
      {
        kind: "transform",
        fromBox: box,
        toBox: box,
        start: 0,
        duration: 1,
        easing: "ease-in-out",
      },
      { from: origin, to: origin },
    );
    expect(unchanged.outgoing).toBeUndefined();
    expect(
      stepKeyframes(
        { kind: "crossfade", start: 0, duration: 1, easing: "ease-in-out" },
        { from: origin, to: origin },
      ).outgoing?.keyframes,
    ).toEqual([{ opacity: 1 }, { opacity: 0 }]);
  });
  test("classifies painted nodes and holds fill until the outline draws", () => {
    const probes = [
      probe,
      { ...probe, stroke: "none" },
      { ...probe, tag: "text" },
      { ...probe, fill: "none", stroke: "none" },
      { ...probe, dasharray: "5 3" },
      { ...probe, length: null },
    ];
    expect(classifyDrawOn(probes)).toEqual([
      "outline",
      "fill",
      "other",
      "none",
      "other",
      "other",
    ]);
    expect(drawOnKeyframes("fill", probe, "draw-on")).toEqual([
      { offset: 0, fillOpacity: 0 },
      { offset: 0.5, fillOpacity: 0 },
      { offset: 1, fillOpacity: 0.4 },
    ]);
    expect(
      drawOnKeyframes("outline", { ...probe, fill: "none" }, "draw-on")[1]
        ?.offset,
    ).toBe(0.6);
    expect(
      drawOnKeyframes("outline", { ...probe, fill: "none" }, "grow")[1]?.offset,
    ).toBe(1);
  });
});
