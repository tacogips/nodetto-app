import { expect, test } from "bun:test";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { makeEditor } from "./test-helpers.ts";
import { renderPageSvg } from "./svg-export.ts";
import { resolveConnector } from "./shapes/connector/resolve.ts";
import { endpointReaderFor } from "./shapes/connector/util.ts";

function fixture(
  semantic: Record<string, unknown>,
  visual: Record<string, unknown> = {},
) {
  const editor = makeEditor();
  const a = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  editor.createElement("node.generic", {
    visual: { x: 200, y: 0, width: 100, height: 100 },
  });
  const b = editor.createElement("node.generic", {
    visual: { x: 400, y: 0, width: 100, height: 100 },
  });
  const id = editor.createElement("edge.generic", {
    semantic: { from: a, to: b, ...semantic },
    visual,
  });
  return { editor, id };
}
function resolved(editor: ReturnType<typeof makeEditor>, id: string) {
  const edge = editor.store.get(id);
  if (!edge) throw new Error("missing edge");
  const result = resolveConnector(
    edge,
    editor.createShapeContext(),
    endpointReaderFor(edge.type),
  );
  if (!result) throw new Error("missing route");
  return result;
}
test("stored routing is shared by SVG, visual and serialized extensions", () => {
  const semantic = fixture({
    routing: "orthogonal",
    routingAvoidObstacles: true,
  });
  const visual = fixture(
    {},
    { routing: "orthogonal", routingAvoidObstacles: true },
  );
  const route = resolved(semantic.editor, semantic.id);
  const other = resolved(visual.editor, visual.id);
  expect(other.points).toEqual(route.points);
  const svg = renderPageSvg(
    semantic.editor.store,
    semantic.editor.registry,
    semantic.editor.currentPageId,
  );
  expect(svg).toContain(
    `points="${route.points.map((p) => `${p.x},${p.y}`).join(" ")}"`,
  );
  expect(
    renderPageSvg(
      semantic.editor.store,
      semantic.editor.registry,
      semantic.editor.currentPageId,
    ),
  ).toBe(svg);
  const loaded = makeEditor({
    document: parseDocument(serializeDocument(visual.editor.getSnapshot())),
  });
  expect(resolved(loaded, visual.id).points).toEqual(route.points);
  const through = fixture(
    {},
    { routing: "orthogonal", routingAvoidObstacles: false },
  );
  expect(resolved(through.editor, through.id).points).not.toEqual(route.points);
  const straight = fixture({ routing: "straight" }, { routing: "orthogonal" });
  expect(resolved(straight.editor, straight.id).points).toHaveLength(2);
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1];
    const b = route.points[i];
    if (!a || !b) throw new Error("missing point");
    expect(
      a.y === b.y &&
        a.y > 0 &&
        a.y < 100 &&
        Math.min(a.x, b.x) < 300 &&
        Math.max(a.x, b.x) > 200,
    ).toBe(false);
    expect(
      a.x === b.x &&
        a.x > 200 &&
        a.x < 300 &&
        Math.min(a.y, b.y) < 100 &&
        Math.max(a.y, b.y) > 0,
    ).toBe(false);
  }
});
test("lanes preserve lane zero and offsets move labels", () => {
  const base = fixture({ routing: "orthogonal" });
  const zero = fixture({ routing: "orthogonal", routingLane: 0 });
  const one = fixture({ routing: "orthogonal", routingLane: 1 });
  expect(resolved(base.editor, base.id).points).toEqual(
    resolved(zero.editor, zero.id).points,
  );
  expect(resolved(base.editor, base.id).points).not.toEqual(
    resolved(one.editor, one.id).points,
  );
  const offset = fixture({
    routing: "orthogonal",
    labelOffsetX: 10,
    labelOffsetY: -5,
  });
  const a = resolved(base.editor, base.id).labelPoint;
  expect(resolved(offset.editor, offset.id).labelPoint).toEqual({
    x: a.x + 10,
    y: a.y - 5,
  });
});

test("all lanes avoid the neighbor and pinned routes leave outward", () => {
  for (let lane = 1; lane <= 8; lane++) {
    const input = fixture({
      routing: "orthogonal",
      routingLane: lane,
      fromPort: "right",
      toPort: "left",
    });
    const points = resolved(input.editor, input.id).points;
    const start = points[0];
    const next = points[1];
    if (!start || !next) throw new Error("missing first segment");
    expect(next.x).toBeGreaterThan(start.x);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (!a || !b) throw new Error("missing segment");
      expect(
        a.y === b.y &&
          a.y > 0 &&
          a.y < 100 &&
          Math.min(a.x, b.x) < 300 &&
          Math.max(a.x, b.x) > 200,
      ).toBe(false);
      expect(
        a.x === b.x &&
          a.x > 200 &&
          a.x < 300 &&
          Math.min(a.y, b.y) < 100 &&
          Math.max(a.y, b.y) > 0,
      ).toBe(false);
    }
  }
});
test("BPMN connector ignores label offsets", () => {
  const input = fixture({ routing: "orthogonal" });
  const original = input.editor.store.get(input.id);
  if (!original) throw new Error("missing edge");
  const context = input.editor.createShapeContext();
  const reader = endpointReaderFor("edge.generic");
  const bpmn = { ...original, type: "bpmn.sequenceFlow" };
  const withOffsets = {
    ...bpmn,
    semantic: {
      ...(bpmn.semantic as Record<string, unknown>),
      labelOffsetX: 10,
      labelOffsetY: -5,
    },
  };
  expect(resolveConnector(withOffsets, context, reader)?.labelPoint).toEqual(
    resolveConnector(bpmn, context, reader)?.labelPoint,
  );
});

test("all lanes route around a stack of neighboring boxes", () => {
  const editor = makeEditor();
  const from = editor.createElement("node.generic", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const to = editor.createElement("node.generic", {
    visual: { x: 400, y: 0, width: 100, height: 100 },
  });
  for (const y of [-120, 0, 120])
    editor.createElement("node.generic", {
      visual: { x: 200, y, width: 100, height: 100 },
    });
  for (let lane = 1; lane <= 8; lane++) {
    const id = editor.createElement("edge.generic", {
      semantic: { from, to, routing: "orthogonal", routingLane: lane },
    });
    const points = resolved(editor, id).points;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (!a || !b) throw new Error("missing segment");
      for (const y of [-120, 0, 120]) {
        expect(
          a.y === b.y &&
            a.y > y &&
            a.y < y + 100 &&
            Math.min(a.x, b.x) < 300 &&
            Math.max(a.x, b.x) > 200,
        ).toBe(false);
        expect(
          a.x === b.x &&
            a.x > 200 &&
            a.x < 300 &&
            Math.min(a.y, b.y) < y + 100 &&
            Math.max(a.y, b.y) > y,
        ).toBe(false);
      }
    }
  }
});

test("pinned lane escapes retain nearby obstacles", () => {
  for (const gap of [38, 40, 44, 48, 50, 55, 56, 60]) {
    const editor = makeEditor();
    const from = editor.createElement("node.generic", {
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const left = 100 + gap;
    editor.createElement("node.generic", {
      visual: { x: left, y: -20, width: 100, height: 140 },
    });
    const to = editor.createElement("node.generic", {
      visual: { x: 440, y: 0, width: 100, height: 100 },
    });
    const make = (lane?: number) =>
      editor.createElement("edge.generic", {
        semantic: {
          from,
          to,
          routing: "orthogonal",
          routingAvoidObstacles: true,
          fromPort: "right",
          toPort: "left",
          ...(lane === undefined ? {} : { routingLane: lane }),
        },
      });
    const absent = resolved(editor, make()).points;
    for (let lane = 0; lane <= 8; lane++) {
      const points = resolved(editor, make(lane)).points;
      if (lane === 0) expect(points).toEqual(absent);
      if (gap === 60 && lane === 8) expect(points[1]?.x).toBe(144);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a || !b) throw new Error("missing segment");
        const horizontal =
          a.y === b.y &&
          a.y > -20 &&
          a.y < 120 &&
          Math.min(a.x, b.x) < left + 100 &&
          Math.max(a.x, b.x) > left;
        const vertical =
          a.x === b.x &&
          a.x > left &&
          a.x < left + 100 &&
          Math.min(a.y, b.y) < 120 &&
          Math.max(a.y, b.y) > -20;
        expect(horizontal || vertical).toBe(false);
      }
    }
  }
});

test("pinned lane escapes avoid close neighbors when the target is below", () => {
  for (const side of ["right", "left"] as const) {
    for (let gap = 24; gap <= 37; gap++) {
      const editor = makeEditor();
      const from = editor.createElement("node.generic", {
        visual: { x: 0, y: 0, width: 100, height: 100 },
      });
      const left = side === "right" ? 100 + gap : -100 - gap;
      editor.createElement("node.generic", {
        visual: { x: left, y: -20, width: 100, height: 140 },
      });
      const to = editor.createElement("node.generic", {
        visual: { x: 0, y: 440, width: 100, height: 100 },
      });
      for (let lane = 0; lane <= 8; lane++) {
        const id = editor.createElement("edge.generic", {
          semantic: {
            from,
            to,
            routing: "orthogonal",
            routingAvoidObstacles: true,
            fromPort: side,
            toPort: "left",
            routingLane: lane,
          },
        });
        const points = resolved(editor, id).points;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1];
          const b = points[i];
          if (!a || !b) throw new Error("missing segment");
          const horizontal =
            a.y === b.y &&
            a.y > -20 &&
            a.y < 120 &&
            Math.min(a.x, b.x) < left + 100 &&
            Math.max(a.x, b.x) > left;
          const vertical =
            a.x === b.x &&
            a.x > left &&
            a.x < left + 100 &&
            Math.min(a.y, b.y) < 120 &&
            Math.max(a.y, b.y) > -20;
          expect(horizontal || vertical).toBe(false);
        }
      }
    }
  }
});
