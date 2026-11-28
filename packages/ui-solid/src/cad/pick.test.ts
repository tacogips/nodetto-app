import { expect, test } from "bun:test";
import type { CadDisplayBody } from "@nodetto/core";
import { pickBodies } from "./pick.ts";
import { connectedFacePositions } from "./inspection.ts";

function box(id: string, z: number): CadDisplayBody {
  return {
    id,
    reference: false,
    positions: new Float32Array([
      -1,
      -1,
      z,
      1,
      -1,
      z,
      1,
      1,
      z,
      -1,
      1,
      z,
      -1,
      -1,
      z + 1,
      1,
      -1,
      z + 1,
      1,
      1,
      z + 1,
      -1,
      1,
      z + 1,
    ]),
    indices: new Uint32Array([
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
      3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ]),
    triFace: new Uint32Array([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]),
    faceNames: ["bottom", "top", "front", "right", "back", "left"],
    edges: new Float32Array(),
  };
}

test("picks the nearest named box face, including back faces from inside", () => {
  const bodies = [box("box", 0)];
  expect(pickBodies(bodies, { origin: [0, 0, 8], dir: [0, 0, -2] })).toEqual({
    bodyId: "box",
    faceName: "top",
    triangle: 2,
    t: 3.5,
    point: [0, 0, 1],
  });
  expect(pickBodies(bodies, { origin: [0, 0, 0.5], dir: [0, 0, -1] })).toEqual({
    bodyId: "box",
    faceName: "bottom",
    triangle: 0,
    t: 0.5,
    point: [0, 0, 0],
  });
  expect(
    pickBodies(bodies, { origin: [0, 0, 1], dir: [0, 0, -1] }),
  ).toMatchObject({
    faceName: "bottom",
    t: 1,
  });
});

test("misses outside the box and ignores intersections behind the ray", () => {
  const bodies = [box("box", 0)];
  expect(pickBodies(bodies, { origin: [2, 0, 8], dir: [0, 0, -1] })).toBeNull();
  expect(pickBodies(bodies, { origin: [0, 0, 8], dir: [0, 0, 1] })).toBeNull();
  expect(pickBodies([], { origin: [0, 0, 8], dir: [0, 0, -1] })).toBeNull();
});

test("the nearest of two bodies wins in either order", () => {
  const far = box("far", -15);
  const near = box("near", -4);
  for (const bodies of [
    [far, near],
    [near, far],
  ]) {
    expect(pickBodies(bodies, { origin: [0, 0, 0], dir: [0, 0, -1] })).toEqual({
      bodyId: "near",
      faceName: "top",
      triangle: 2,
      t: 3,
      point: [0, 0, -3],
    });
  }
});

test("highlights only the connected patch with the picked face name", () => {
  const body: CadDisplayBody = {
    id: "tray",
    reference: false,
    positions: new Float32Array([
      0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 3, 0, 1, 4, 0, 1, 3, 1, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6]),
    triFace: new Uint32Array([0, 0, 0]),
    faceNames: ["posts:end"],
    edges: new Float32Array(),
  };
  expect(connectedFacePositions(body, 0)).toHaveLength(18);
  expect(connectedFacePositions(body, 2)).toEqual(body.positions.slice(12));
});

test("collapsed display triangles are skipped without discarding small valid faces", () => {
  const body: CadDisplayBody = {
    ...box("tiny", 0),
    positions: new Float32Array([
      0, 0, 2, 0, 0, 2, 0, 0.001, 2, 0, 0, 1, 0, 0.001, 1, 0.001, 0, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
    triFace: new Uint32Array([0, 1]),
  };
  expect(
    pickBodies([body], { origin: [0.00025, 0.00025, 3], dir: [0, 0, -1] }),
  ).toMatchObject({
    faceName: "top",
    t: 2,
  });
});

test("oblique rays on a shared triangle edge still pick the face", () => {
  const width = 28.271881103515625;
  const height = 15.241626739501953;
  const body: CadDisplayBody = {
    ...box("quad", 0),
    positions: new Float32Array([
      0,
      0,
      0,
      width,
      0,
      0,
      width,
      height,
      0,
      0,
      height,
      0,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    triFace: new Uint32Array([0, 0]),
    faceNames: ["quad face"],
  };
  const pick = pickBodies([body], {
    origin: [7.606671195526793, 6.303951435518857, 11.493416000240419],
    dir: [0.09141502133570611, -0.1755432109348476, -1.1728866456542164],
  });
  expect(pick).toMatchObject({ bodyId: "quad", faceName: "quad face" });
  expect(pick?.point[2]).toBeCloseTo(0, 12);
});

test("picks across 200,000 triangles within the 50 ms budget", () => {
  const count = 200_000;
  const positions = new Float32Array(count * 9);
  for (let i = 0; i < count; i++) {
    const z = -1 - (count - 1 - i) * 0.01;
    positions.set([-1, -1, z, 1, -1, z, 0, 1, z], i * 9);
  }
  const body: CadDisplayBody = {
    id: "stack",
    reference: false,
    positions,
    indices: Uint32Array.from({ length: count * 3 }, (_, i) => i),
    triFace: new Uint32Array(count),
    faceNames: ["layer"],
    edges: new Float32Array(),
  };
  const start = performance.now();
  const pick = pickBodies([body], { origin: [0, 0, 0], dir: [0, 0, -1] });
  const elapsed = performance.now() - start;
  expect(pick).toMatchObject({ bodyId: "stack", faceName: "layer", t: 1 });
  expect(
    elapsed,
    `200,000 triangles picked in ${elapsed.toFixed(2)} ms`,
  ).toBeLessThan(50);
});
