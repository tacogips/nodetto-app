// The geo primitives, pinned at one size.
//
// These numbers are what the canvas draws and what the SVG exporter writes,
// so a change here is a change to every rendered document.

import { describe, expect, test } from "bun:test";
import { GEO_KINDS } from "@nodetto/ir";
import type { Element } from "@nodetto/ir";
import { geoOutline } from "./geo-outline.ts";
import { geoShapeUtil } from "./geo.ts";

const WIDTH = 160;
const HEIGHT = 100;

describe("geoOutline at 160x100", () => {
  test("rect is inset by one unit and rounded", () => {
    expect(geoOutline("rect", WIDTH, HEIGHT)).toEqual({
      kind: "rect",
      x: 1,
      y: 1,
      width: 158,
      height: 98,
      rx: 4,
    });
  });

  test("ellipse fills the box with a one-unit inset radius", () => {
    expect(geoOutline("ellipse", WIDTH, HEIGHT)).toEqual({
      kind: "ellipse",
      cx: 80,
      cy: 50,
      rx: 79,
      ry: 49,
    });
  });

  test("diamond, triangle, hexagon and parallelogram are polygons", () => {
    expect(geoOutline("diamond", WIDTH, HEIGHT)).toEqual({
      kind: "polygon",
      points: "80,1 159,50 80,99 1,50",
    });
    expect(geoOutline("triangle", WIDTH, HEIGHT)).toEqual({
      kind: "polygon",
      points: "80,1 159,99 1,99",
    });
    expect(geoOutline("hexagon", WIDTH, HEIGHT)).toEqual({
      kind: "polygon",
      points: "40,1 120,1 159,50 120,99 40,99 1,50",
    });
    expect(geoOutline("parallelogram", WIDTH, HEIGHT)).toEqual({
      kind: "polygon",
      points: "40,1 159,1 120,99 1,99",
    });
  });

  test("cylinder carries a body path and a rim ellipse", () => {
    expect(geoOutline("cylinder", WIDTH, HEIGHT)).toEqual({
      kind: "cylinder",
      path: "M 1 15 A 79 15 0 0 1 159 15 L 159 85 A 79 15 0 0 1 1 85 Z",
      cap: { cx: 80, cy: 15, rx: 79, ry: 15 },
    });
  });

  test("a tall cylinder's rim stops growing at 18", () => {
    const outline = geoOutline("cylinder", 100, 400);
    expect(outline.kind).toBe("cylinder");
    if (outline.kind === "cylinder") {
      expect(outline.cap.ry).toBe(18);
    }
  });

  test("star has ten alternating points", () => {
    const outline = geoOutline("star", WIDTH, HEIGHT);
    expect(outline.kind).toBe("polygon");
    if (outline.kind === "polygon") {
      expect(outline.points.split(" ")).toHaveLength(10);
      expect(outline.points.startsWith("80,1")).toBe(true);
    }
  });

  test("every registered kind produces an outline", () => {
    for (const kind of GEO_KINDS) {
      expect(geoOutline(kind, WIDTH, HEIGHT).kind).toBeString();
    }
  });

  test("an unknown kind falls back to the rectangle", () => {
    expect(geoOutline("hypercube", WIDTH, HEIGHT)).toEqual(
      geoOutline("rect", WIDTH, HEIGHT),
    );
  });

  test("a degenerate box never produces a negative dimension", () => {
    expect(geoOutline("rect", 0, 0)).toMatchObject({ width: 0, height: 0 });
    expect(geoOutline("ellipse", 1, 1)).toMatchObject({ rx: 0, ry: 0 });
  });
});

function vertices(points: string): (readonly [number, number])[] {
  return points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return [x ?? Number.NaN, y ?? Number.NaN] as const;
  });
}

describe("draw.io-style shape library", () => {
  const polygonKinds = GEO_KINDS.filter(
    (kind) => !["rect", "ellipse", "cylinder"].includes(kind),
  );

  test("every polygon kind stays inside the one-unit inset box", () => {
    for (const kind of polygonKinds) {
      const outline = geoOutline(kind, WIDTH, HEIGHT);
      if (outline.kind !== "polygon")
        throw new Error(`${kind} is not a polygon`);
      const points = vertices(outline.points);
      expect(points.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(WIDTH - 1);
        expect(y).toBeGreaterThanOrEqual(1);
        expect(y).toBeLessThanOrEqual(HEIGHT - 1);
      }
    }
  });

  test("curved kinds touch all four inset edges", () => {
    for (const kind of ["cloud", "document", "delay"]) {
      const outline = geoOutline(kind, WIDTH, HEIGHT);
      if (outline.kind !== "polygon")
        throw new Error(`${kind} is not a polygon`);
      const points = vertices(outline.points);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      expect(Math.min(...xs)).toBeCloseTo(1, 0);
      expect(Math.max(...xs)).toBeCloseTo(WIDTH - 1, 0);
      expect(Math.min(...ys)).toBeCloseTo(1, 0);
      expect(Math.max(...ys)).toBeCloseTo(HEIGHT - 1, 0);
    }
  });

  test("folded, layered and barred kinds carry open interior strokes", () => {
    for (const kind of [
      "note",
      "cube",
      "predefined-process",
      "internal-storage",
    ]) {
      const outline = geoOutline(kind, WIDTH, HEIGHT);
      expect(outline).toMatchObject({ kind: "polygon" });
      expect((outline as { detail?: string }).detail).toStartWith("M ");
    }
    expect(geoOutline("predefined-process", WIDTH, HEIGHT)).toMatchObject({
      detail: "M 15 1 L 15 99 M 145 1 L 145 99",
    });
  });

  test("flips mirror outline and detail about the box centre", () => {
    expect(geoOutline("note", WIDTH, HEIGHT, { x: true })).toEqual({
      kind: "polygon",
      points: "159,1 21,1 1,21 1,99 159,99",
      detail: "M 21 1 L 21 21 L 1 21",
    });
    expect(geoOutline("arrow", WIDTH, HEIGHT, { x: true, y: true })).toEqual({
      kind: "polygon",
      points: "159,70 64,70 64,99 1,50 64,1 64,30 159,30",
    });
    // Symmetric primitives are unchanged by the mirror they are symmetric in.
    const pointSet = (outline: ReturnType<typeof geoOutline>) =>
      outline.kind === "polygon" ? outline.points.split(" ").sort() : [];
    expect(
      pointSet(geoOutline("diamond", WIDTH, HEIGHT, { x: true, y: true })),
    ).toEqual(pointSet(geoOutline("diamond", WIDTH, HEIGHT)));
    expect(geoOutline("cylinder", WIDTH, HEIGHT, { y: true })).toEqual(
      geoOutline("cylinder", WIDTH, HEIGHT),
    );
  });

  test("picking follows the flipped outline", () => {
    const callout = (flipY: boolean): Element => ({
      id: "c",
      page: "p",
      type: "shape.geo",
      index: "a0",
      semantic: { geo: "callout", label: "" },
      visual: { x: 0, y: 0, width: WIDTH, height: HEIGHT, flipY },
    });
    const context = { zoom: 1, resolve: () => undefined, boundsOf: () => null };
    // Below the speech bubble's body, away from its tail.
    const belowBody = { x: 140, y: 90 };
    const aboveBody = { x: 140, y: 10 };
    expect(geoShapeUtil.hitTest(callout(false), belowBody, context)).toBe(
      false,
    );
    expect(geoShapeUtil.hitTest(callout(false), aboveBody, context)).toBe(true);
    expect(geoShapeUtil.hitTest(callout(true), belowBody, context)).toBe(true);
    expect(geoShapeUtil.hitTest(callout(true), aboveBody, context)).toBe(false);
  });
});
