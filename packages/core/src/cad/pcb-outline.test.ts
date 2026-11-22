import { expect, test } from "bun:test";
import { parseDocument } from "@nodetto/io";
import { pcbBoardOutline } from "./pcb-outline.ts";
import { edge, testBoard } from "./testing/pcb.ts";

const fixture = parseDocument(
  await Bun.file(
    new URL("../../../io/src/__fixtures__/cad3d.jsonl", import.meta.url),
  ).text(),
);

test("chains shuffled line endpoints on the micrometre grid and flips Y", () => {
  const edges = [
    edge("south", { kind: "line", start: [30, 15], end: [10, 15] }),
    edge("west", { kind: "line", start: [10, 15], end: [10, 5] }),
    edge("north", { kind: "line", start: [10, 5], end: [30.0002, 5] }),
    edge("east", { kind: "line", start: [30, 5], end: [30, 15] }),
  ];
  const board = testBoard(1.2);
  const outline = pcbBoardOutline([board, ...edges], board.id);
  if ("error" in outline) throw new Error(outline.error);
  expect(
    pcbBoardOutline([board, ...edges.slice().reverse()], board.id),
  ).toEqual(outline);
  expect(outline.thickness).toBe(1.2);
  expect(outline.loops).toHaveLength(1);
  expect(outline.loops[0]).toMatchObject({
    depth: 0,
    points: [20, 10, 0, 10, 0, 0, 20, 0],
    sources: ["north", "west", "south", "east"],
  });
});

test("chains the rounded board fixture and retains arc provenance", () => {
  const outline = pcbBoardOutline(fixture.elements, "controller");
  if ("error" in outline) throw new Error(outline.error);
  expect(outline.loops).toHaveLength(1);
  expect(
    outline.sources.filter((id) => id === "controller-arc-ne").length,
  ).toBeGreaterThan(4);
  expect(new Set(outline.sources).size).toBe(8);
  expect(outline.thickness).toBe(1.6);
});

test("supports a circular board and uses the default thickness", () => {
  const board = testBoard();
  const outline = pcbBoardOutline(
    [board, edge("rim", { kind: "circle", center: [10, 20], radius: 5 })],
    board.id,
  );
  if ("error" in outline) throw new Error(outline.error);
  expect(outline.thickness).toBe(1.6);
  expect(outline.loops[0]).toMatchObject({ depth: 0 });
  expect(new Set(outline.sources)).toEqual(new Set(["rim"]));
  expect(outline.loops[0]?.points.slice(0, 2)).toEqual([10, 5]);
});

test("detects cut-outs and supports rects and explicitly closed polygons", () => {
  const board = testBoard();
  const outer = edge("outer", { kind: "rect", start: [0, 0], end: [80, 50] });
  const inner = edge("inner", {
    kind: "polygon",
    points: [
      [5, 5],
      [10, 5],
      [10, 10],
      [5, 5],
    ],
  });
  const hole = edge("hole", { kind: "circle", center: [40, 20], radius: 2 });
  const outline = pcbBoardOutline([board, outer, inner, hole], board.id);
  if ("error" in outline) throw new Error(outline.error);
  expect(outline.loops.map(({ depth, members }) => [depth, members])).toEqual([
    [1, ["hole"]],
    [1, ["inner"]],
    [0, ["outer"]],
  ]);
});

test("reports missing boards, missing outlines and dangling or malformed edges", () => {
  const board = testBoard();
  const line = edge("edge", { kind: "line", start: [0, 0], end: [5, 5] });
  expect(pcbBoardOutline([], board.id)).toEqual({ error: "cad.pcb.noBoard" });
  expect(
    pcbBoardOutline([board, { ...line, visual: { hidden: true } }], board.id),
  ).toEqual({ error: "cad.pcb.noOutline" });
  expect(pcbBoardOutline([board, line], board.id)).toEqual({
    error: "cad.pcb.openOutline",
  });
  expect(
    pcbBoardOutline(
      [board, { ...line, semantic: { layer: "Edge.Cuts" } }],
      board.id,
    ),
  ).toEqual({ error: "cad.pcb.openOutline" });
});
