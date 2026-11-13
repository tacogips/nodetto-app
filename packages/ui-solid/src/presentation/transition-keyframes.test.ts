import { describe, expect, test } from "bun:test";
import {
  classifyDrawOn,
  drawOnKeyframes,
  poseTransform,
  shortestDelta,
  stepKeyframes,
  undrawKeyframes,
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
  test("scales around each slide origin and translates slide effects", () => {
    const origins = { from: { x: -10, y: 5 }, to: origin };
    const timing = { start: 30, duration: 200, easing: "ease-in-out" as const };
    const scaleIn = stepKeyframes(
      { kind: "scale-in", toBox: box, ...timing },
      origins,
    );
    expect(scaleIn.incoming?.keyframes).toEqual([
      {
        transform: "translate(160px, -10px) scale(0) translate(-160px, 10px)",
        opacity: 0,
      },
      {
        transform: "translate(160px, -10px) scale(1) translate(-160px, 10px)",
        opacity: 1,
      },
    ]);
    const scaleOut = stepKeyframes(
      { kind: "scale-out", fromBox: box, ...timing },
      origins,
    );
    expect(scaleOut.outgoing?.keyframes).toEqual([
      {
        transform: "translate(50px, 45px) scale(1) translate(-50px, -45px)",
        opacity: 1,
      },
      {
        transform: "translate(50px, 45px) scale(0) translate(-50px, -45px)",
        opacity: 0,
      },
    ]);
    const offset = { x: -120, y: 0 };
    expect(
      stepKeyframes({ kind: "slide-in", offset, ...timing }, origins).incoming
        ?.keyframes,
    ).toEqual([
      { transform: "translate(-120px, 0px)" },
      { transform: "translate(0px, 0px)" },
    ]);
    expect(
      stepKeyframes({ kind: "slide-out", offset, ...timing }, origins).outgoing
        ?.keyframes,
    ).toEqual([
      { transform: "translate(0px, 0px)" },
      { transform: "translate(-120px, 0px)" },
    ]);
    for (const kind of [
      "scale-in",
      "scale-out",
      "slide-in",
      "slide-out",
    ] as const)
      expect(stepKeyframes({ kind, ...timing }, origins)).toEqual({});
  });
  test("instant effects and slide fade use the expected targets and timing", () => {
    const origins = { from: origin, to: origin };
    const timing = { start: 85, duration: 0, easing: "ease-in-out" as const };
    const appear = stepKeyframes({ kind: "appear", ...timing }, origins);
    const disappear = stepKeyframes({ kind: "disappear", ...timing }, origins);
    const swap = stepKeyframes({ kind: "swap", ...timing }, origins);
    const incoming = [{ opacity: 0 }, { opacity: 1 }];
    const outgoing = [{ opacity: 1 }, { opacity: 0 }];
    expect(appear.incoming?.keyframes).toEqual(incoming);
    expect(appear.outgoing).toBeUndefined();
    expect(disappear.outgoing?.keyframes).toEqual(outgoing);
    expect(disappear.incoming).toBeUndefined();
    expect(swap.incoming?.keyframes).toEqual(incoming);
    expect(swap.outgoing?.keyframes).toEqual(outgoing);
    for (const frames of [
      appear.incoming,
      disappear.outgoing,
      swap.incoming,
      swap.outgoing,
    ])
      expect(frames?.options).toEqual({
        delay: 85,
        duration: 0,
        easing: "ease-in-out",
        fill: "both",
      });
    const fade = stepKeyframes(
      { kind: "slide-fade", ...timing, duration: 300 },
      origins,
    );
    expect(fade.incoming?.keyframes).toEqual(incoming);
    expect(fade.outgoing?.keyframes).toEqual(outgoing);
    expect(fade.incoming?.options.duration).toBe(300);
  });
  test("undraw exactly reverses draw-on and grow schedules", () => {
    for (const cls of ["outline", "fill", "other", "none"] as const) {
      for (const connector of [false, true]) {
        const forward = drawOnKeyframes(
          cls,
          probe,
          connector ? "grow" : "draw-on",
        );
        expect(undrawKeyframes(cls, probe, connector)).toEqual(
          forward
            .slice()
            .reverse()
            .map((frame) => ({ ...frame, offset: 1 - (frame.offset ?? 0) })),
        );
      }
    }
  });
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
