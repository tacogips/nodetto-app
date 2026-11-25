import { createHash } from "node:crypto";
import type { Element, Page } from "@nodetto/ir";
import { prepareCadCapture } from "../capture/cad-request.ts";
import { collectCadInput } from "./engine.ts";
import { createCadMemo, evaluateCadPage, releaseCadMemo } from "./evaluate.ts";
import { CAD_TEST_PAGE, cadElement } from "./testing/documents.ts";
import { RecordingKernel } from "./testing/recording-kernel.ts";
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
    at: line.id,
  });
  expect(
    pcbBoardOutline(
      [board, { ...line, semantic: { layer: "Edge.Cuts" } }],
      board.id,
    ),
  ).toEqual({ error: "cad.pcb.openOutline", at: line.id });
});

const request = {
  width: 320,
  height: 240,
  theme: "dark",
  camera: { view: "iso" },
} as const;

function measuredFixture(n: number, shared: boolean) {
  let reads = 0;
  const pages: Page[] = [CAD_TEST_PAGE];
  const elements: Element[] = [];
  const boards = shared ? 1 : n;
  for (let i = 0; i < boards; i++) {
    const page = `pcb-${i}`;
    pages.push({ id: page, name: page, kind: "pcb" });
    elements.push({ ...testBoard(), id: `board-${i}`, page });
    const count = shared ? n : 1;
    for (let j = 0; j < count; j++) {
      const shape = shared
        ? {
            kind: "line" as const,
            start: [j, 0] as [number, number],
            end: [j + 1, 0] as [number, number],
          }
        : {
            kind: "rect" as const,
            start: [0, 0] as [number, number],
            end: [4, 4] as [number, number],
          };
      const graphic = edge(`edge-${i}-${String(j).padStart(3, "0")}`, shape);
      const semantic = graphic.semantic;
      elements.push({
        ...graphic,
        page,
        get semantic() {
          reads++;
          return semantic;
        },
      });
    }
    if (shared) {
      for (const [id, start, end] of [
        ["right", [n, 0], [n, 4]],
        ["top", [n, 4], [0, 4]],
        ["left", [0, 4], [0, 0]],
      ] as const) {
        const graphic = edge(id, { kind: "line", start, end });
        const semantic = graphic.semantic;
        elements.push({
          ...graphic,
          page,
          get semantic() {
            reads++;
            return semantic;
          },
        });
      }
    }
  }
  for (let i = 0; i < n; i++)
    elements.push(
      cadElement(`ref-${String(i).padStart(3, "0")}`, "cad.pcb", "a0", {
        name: `ref-${i}`,
        board: `board-${shared ? 0 : i}`,
        thickness: i % 2 ? 3 : 1,
      }),
    );
  const input = collectCadInput(
    { pages, elements },
    CAD_TEST_PAGE.id,
    0,
  ).elements;
  return {
    input,
    reset: () => {
      reads = 0;
    },
    reads: () => reads,
  };
}

function captureMeasurement(n: number, shared: boolean) {
  const fixture = measuredFixture(n, shared);
  fixture.reset();
  const result = prepareCadCapture(fixture.input, CAD_TEST_PAGE.id, request);
  return { ...result, reads: fixture.reads() };
}

test("PCB capture reads grow linearly and preserve shared scene and thickness", () => {
  const small = captureMeasurement(32, false);
  const large = captureMeasurement(128, false);
  const shared = captureMeasurement(32, true);
  const sharedLarge = captureMeasurement(128, true);
  const digest = createHash("sha256").update(shared.scene).digest("hex");
  console.log(
    "PCB capture reads and digest",
    small.reads,
    large.reads,
    shared.reads,
    sharedLarge.reads,
    digest,
  );
  expect(shared.model.errors).toEqual([]);
  expect(shared.model.bodies.map((body) => body.bounds?.max[2])).toEqual(
    Array.from({ length: 32 }, (_, i) => (i % 2 ? 3 : 1)),
  );
  expect(
    createHash("sha256")
      .update(captureMeasurement(32, true).scene)
      .digest("hex"),
  ).toBe(digest);
  expect(digest).toBe(
    "f41508a20cd44bcd36306b9bfe9bd62077b8e8f313cad23a566b66773b978834",
  );
  expect(large.reads).toBeLessThanOrEqual(small.reads * 4.5);
  expect(sharedLarge.reads).toBeLessThanOrEqual(shared.reads * 4.5);
});

test("PCB evaluation reads grow linearly for a shared outline", () => {
  function measure(n: number) {
    const fixture = measuredFixture(n, true);
    const kernel = new RecordingKernel();
    const memo = createCadMemo(kernel);
    fixture.reset();
    try {
      evaluateCadPage(fixture.input, kernel, memo);
      return fixture.reads();
    } finally {
      releaseCadMemo(memo);
    }
  }
  const small = measure(32);
  const large = measure(128);
  console.log("PCB evaluation reads", small, large);
  expect(large).toBeLessThanOrEqual(small * 4.5);
});

test("closed board widening invalidates capture and the evaluator memo", () => {
  const board = testBoard();
  const ref = cadElement("ref", "cad.pcb", "a0", {
    name: "ref",
    board: board.id,
  });
  function lines(width: number) {
    return [
      edge("bottom", { kind: "line", start: [0, 0], end: [width, 0] }),
      edge("right", { kind: "line", start: [width, 0], end: [width, 4] }),
      edge("top", { kind: "line", start: [width, 4], end: [0, 4] }),
      edge("left", { kind: "line", start: [0, 4], end: [0, 0] }),
    ];
  }
  const before = [ref, board, ...lines(4)];
  const after = [ref, board, ...lines(5)];
  const firstCapture = prepareCadCapture(before, CAD_TEST_PAGE.id, request);
  const nextCapture = prepareCadCapture(after, CAD_TEST_PAGE.id, request);
  expect(nextCapture.model.errors).toEqual([]);
  expect(nextCapture.model.bounds?.max[0]).toBe(
    (firstCapture.model.bounds?.max[0] ?? 0) + 1,
  );
  const kernel = new RecordingKernel();
  const memo = createCadMemo(kernel);
  try {
    const first = evaluateCadPage(before, kernel, memo);
    kernel.calls.length = 0;
    const control = evaluateCadPage(before, kernel, memo);
    expect(control.bodies.map((body) => body.key)).toEqual(
      first.bodies.map((body) => body.key),
    );
    expect(kernel.calls).toEqual([]);
    const changed = evaluateCadPage(after, kernel, memo);
    expect(changed.bodies[0]?.key).not.toBe(first.bodies[0]?.key);
    expect(kernel.calls.some(({ kind }) => kind === "solid")).toBe(true);
  } finally {
    releaseCadMemo(memo);
  }
});
