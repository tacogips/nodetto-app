import { describe, expect, test } from "bun:test";
import { renderPageSvg } from "../svg-export.ts";
import { makeEditor } from "../test-helpers.ts";
import { connectorPath, connectorPathData } from "./connector-path.ts";

const crossbar = [
  [
    { x: 50, y: -40 },
    { x: 50, y: 40 },
  ],
];

describe("connectorPathData", () => {
  test("a plain route is a polyline path", () => {
    expect(
      connectorPathData([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ]),
    ).toBe("M 0 0 L 100 0 L 100 50");
  });

  test("bends are rounded, clamped to half of the shorter leg", () => {
    expect(
      connectorPathData(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 10 },
        ],
        { cornerRadius: 12 },
      ),
    ).toBe("M 0 0 L 95 0 Q 100 0 100 5 L 100 10");
  });

  test("arc jumps hop up over a lower connector, in either direction", () => {
    const right = connectorPathData(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { lineJumps: "arc", crossings: crossbar },
    );
    expect(right).toBe("M 0 0 L 44 0 A 6 6 0 0 1 56 0 L 100 0");
    const left = connectorPathData(
      [
        { x: 100, y: 0 },
        { x: 0, y: 0 },
      ],
      { lineJumps: "arc", crossings: crossbar },
    );
    // Same bulge side when drawn right-to-left.
    expect(left).toBe("M 100 0 L 56 0 A 6 6 0 0 0 44 0 L 0 0");
  });

  test("gap jumps break the line, and crossings near ends or each other are skipped", () => {
    expect(
      connectorPathData(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        {
          lineJumps: "gap",
          crossings: [
            ...crossbar,
            // Too close to the previous crossing to jump separately.
            [
              { x: 54, y: -10 },
              { x: 54, y: 10 },
            ],
            // Too close to the end to fit a jump.
            [
              { x: 97, y: -10 },
              { x: 97, y: 10 },
            ],
            // Shares the route's start point: not a crossing.
            [
              { x: 0, y: 0 },
              { x: 0, y: 50 },
            ],
          ],
        },
      ),
    ).toBe("M 0 0 L 44 0 M 56 0 L 100 0");
  });

  test("degenerate routes draw nothing", () => {
    expect(connectorPathData([{ x: 1, y: 1 }])).toBe("");
    expect(
      connectorPathData([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toBe("");
  });
});

describe("connector style in documents", () => {
  test("only the upper connector jumps over the lower one", () => {
    const editor = makeEditor();
    const lower = editor.buildElement("edge.generic", {
      index: "a1",
      semantic: {
        fromPoint: { x: 100, y: 0 },
        toPoint: { x: 100, y: 200 },
        arrowheads: { end: "arrow" },
      },
      visual: { style: { lineJumps: "arc" } },
    });
    const upper = editor.buildElement("edge.generic", {
      index: "a2",
      semantic: {
        fromPoint: { x: 0, y: 100 },
        toPoint: { x: 200, y: 100 },
        arrowheads: { end: "arrow" },
      },
      visual: { style: { lineJumps: "arc" } },
    });
    editor.apply([
      { type: "createElement", element: lower },
      { type: "createElement", element: upper },
    ]);
    const context = editor.createShapeContext();
    const lowerElement = editor.store.get(lower.id);
    const upperElement = editor.store.get(upper.id);
    if (!lowerElement || !upperElement) throw new Error("missing connector");
    expect(
      connectorPath(
        lowerElement,
        [
          { x: 100, y: 0 },
          { x: 100, y: 200 },
        ],
        context,
      ),
    ).not.toContain(" A ");
    expect(
      connectorPath(
        upperElement,
        [
          { x: 0, y: 100 },
          { x: 200, y: 100 },
        ],
        context,
      ),
    ).toContain("A 6 6 0 0 1 106 100");

    const svg =
      renderPageSvg(editor.store, editor.registry, editor.currentPageId) ?? "";
    expect(svg).toContain('d="M 0 100 L 94 100 A 6 6 0 0 1 106 100 L 200 100"');
    // The arrowhead still lands on the path.
    expect(svg).toMatch(
      /<path d="M 0 100[^"]*"[^>]*marker-end="url\(#nodetto-arrow\)"/,
    );
  });

  test("a connector without bend or jump style keeps its polyline markup", () => {
    const editor = makeEditor();
    const edge = editor.buildElement("edge.generic", {
      semantic: { fromPoint: { x: 0, y: 0 }, toPoint: { x: 50, y: 0 } },
    });
    editor.apply([{ type: "createElement", element: edge }]);
    const element = editor.store.get(edge.id);
    if (!element) throw new Error("missing connector");
    expect(
      connectorPath(
        element,
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        editor.createShapeContext(),
      ),
    ).toBeNull();
  });
});
