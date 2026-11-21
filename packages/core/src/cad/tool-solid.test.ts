import { expect, test } from "bun:test";
import { baseFrame, buildLoops, faceName, prismTool } from "./index.ts";
import { rectangle } from "./testing/documents.ts";

test("face names keep separator and escape characters inside ids distinct", () => {
  expect(faceName("a:side:b", "start")).toBe("a%3Aside%3Ab:start");
  expect(faceName("a", "side", "b:start")).toBe("a:side:b%3Astart");
  expect(faceName("a%3A", "end")).toBe("a%253A:end");
});

test.each([5, -5])(
  "a prism with distance %d is closed and outward",
  (distance) => {
    const profile = buildLoops(rectangle("profile", 0, 0, 4, 3));
    if ("error" in profile || !profile.loops[0])
      throw new Error("Expected a loop");
    const mesh = prismTool(
      profile.loops[0],
      baseFrame("yz", 1),
      { t0: 0, t1: distance },
      "ex1",
    );
    expect(mesh.positions).toHaveLength(24);
    expect(mesh.triangles).toHaveLength(36);
    expect(mesh.faceNames).toHaveLength(6);

    const directedEdges = new Set<string>();
    let volume = 0;
    const faces: string[] = [];
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const [a, b, c] = mesh.triangles.slice(i, i + 3);
      if (a === undefined || b === undefined || c === undefined)
        throw new Error("Expected a triangle");
      for (const [from, to] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const edge = `${from}:${to}`;
        expect(directedEdges.has(edge)).toBe(false);
        directedEdges.add(edge);
      }
      const [ax = 0, ay = 0, az = 0] = mesh.positions.slice(a * 3, a * 3 + 3);
      const [bx = 0, by = 0, bz = 0] = mesh.positions.slice(b * 3, b * 3 + 3);
      const [cx = 0, cy = 0, cz = 0] = mesh.positions.slice(c * 3, c * 3 + 3);
      volume +=
        (ax * (by * cz - bz * cy) +
          ay * (bz * cx - bx * cz) +
          az * (bx * cy - by * cx)) /
        6;
      const face = mesh.faceNames[mesh.triFace[i / 3] ?? -1];
      if (!face) throw new Error("Expected a named face");
      faces.push(face);
      if (face === "ex1:start") expect([ax, bx, cx]).toEqual([1, 1, 1]);
      if (face === "ex1:end")
        expect([ax, bx, cx]).toEqual([
          1 + distance,
          1 + distance,
          1 + distance,
        ]);
    }
    for (const edge of directedEdges)
      expect(directedEdges.has(edge.split(":").reverse().join(":"))).toBe(true);
    expect(volume).toBe(60);
    expect(faces.sort()).toEqual([
      "ex1:end",
      "ex1:end",
      "ex1:side:profile-edge-0",
      "ex1:side:profile-edge-0",
      "ex1:side:profile-edge-1",
      "ex1:side:profile-edge-1",
      "ex1:side:profile-edge-2",
      "ex1:side:profile-edge-2",
      "ex1:side:profile-edge-3",
      "ex1:side:profile-edge-3",
      "ex1:start",
      "ex1:start",
    ]);
  },
);
