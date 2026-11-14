import { expect, test } from "bun:test";
import { Editor, endpointReaderFor, resolveConnector } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { connectorArrangeDocument } from "./__fixtures__/connector-arrange.ts";
import { arrangeLayeredOrRoute } from "./arrange-modes.ts";
import { Batch } from "./edit/batch.ts";
import { exportCommand } from "./export-command.ts";

function pointsFromSvg(svg: string): { x: number; y: number }[][] {
  expect(svg).not.toMatch(/<path[^>]*fill="none"/);
  const result: { x: number; y: number }[][] = [];
  for (const match of svg.matchAll(/<polyline\b[^>]*points="([^"]+)"/g)) {
    result.push(
      match[1]!.split(" ").map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x: x!, y: y! };
      }),
    );
  }
  for (const match of svg.matchAll(/<line\b([^>]*)/g)) {
    const attrs = match[1]!;
    const value = (name: string) =>
      Number(attrs.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
    result.push([
      { x: value("x1"), y: value("y1") },
      { x: value("x2"), y: value("y2") },
    ]);
  }
  return result;
}

async function exportPoints(editor: Editor, edgeId: string) {
  const text = serializeDocument(editor.getSnapshot());
  const loaded = new Editor({ document: parseDocument(text) });
  const edge = loaded.store.get(edgeId);
  if (!edge) throw new Error(`Missing edge ${edgeId}`);
  const resolved = resolveConnector(
    edge,
    loaded.createShapeContext(),
    endpointReaderFor(edge.type),
  );
  if (!resolved) throw new Error("Missing resolved connector");
  const io = { readText: () => text, writeText: () => {} };
  const args = ["doc.jsonl", "--format", "svg", "--page", "Architecture"];
  const first = await exportCommand(io, args);
  const second = await exportCommand(io, args);
  expect(first.exitCode).toBe(0);
  expect(second.stdout).toBe(first.stdout);
  const expected = resolved.points.map(({ x, y }) => ({
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  }));
  const paths = pointsFromSvg(first.stdout);
  expect(paths).toContainEqual(expected);
  return expected;
}

function architecture() {
  const editor = new Editor({
    document: parseDocument(connectorArrangeDocument()),
  });
  editor.setCurrentPage("architecture");
  return editor;
}

test.each(["default", "convention"] as const)(
  "plain connect follows page %s around C in SVG",
  async (mode) => {
    const editor = architecture();
    const batch = new Batch(editor);
    if (mode === "default") {
      batch.apply(
        {
          op: "set-page-routing",
          id: "architecture",
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
        0,
      );
    } else {
      batch.apply(
        {
          op: "connect",
          from: "box-d",
          to: "box-b",
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
        0,
      );
    }
    batch.apply({ op: "connect", from: "box-a", to: "box-b" }, 1);
    const id = batch.created.at(-1)?.id;
    if (!id) throw new Error("Missing created edge");
    const points = await exportPoints(editor, id);
    expect(points.length).toBeGreaterThan(2);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      expect(
        a.y === b.y &&
          a.y > 0 &&
          a.y < 60 &&
          Math.min(a.x, b.x) < 420 &&
          Math.max(a.x, b.x) > 300,
      ).toBe(false);
      expect(
        a.x === b.x &&
          a.x > 300 &&
          a.x < 420 &&
          Math.min(a.y, b.y) < 60 &&
          Math.max(a.y, b.y) > 0,
      ).toBe(false);
    }
    batch.dispose();
  },
);

test.each(["semantic", "visual"] as const)(
  "stored %s orthogonal routing exports axis-aligned D to B",
  async (form) => {
    const editor = architecture();
    const routing = { routing: "orthogonal", routingAvoidObstacles: true };
    editor.createElement("edge.generic", {
      id: `edge-${form}`,
      page: "architecture",
      semantic: {
        from: "box-d",
        to: "box-b",
        ...(form === "semantic" ? routing : {}),
      },
      visual: form === "visual" ? { extensions: routing } : {},
    });
    const points = await exportPoints(editor, `edge-${form}`);
    expect(points.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < points.length; i++) {
      expect(
        points[i - 1]!.x === points[i]!.x || points[i - 1]!.y === points[i]!.y,
      ).toBe(true);
    }
  },
);

test("arranged fixture self loops use sides free of other connector ends", () => {
  let text = connectorArrangeDocument();
  const io = {
    readText: () => text,
    writeText: (_path: string, value: string) => {
      text = value;
    },
  };
  for (const mode of ["layered", "route"]) {
    expect(
      arrangeLayeredOrRoute(io, [
        "doc.jsonl",
        "--page",
        "States",
        "--mode",
        mode,
        "--write",
      ]).exitCode,
    ).toBe(0);
  }
  const editor = new Editor({ document: parseDocument(text) });
  const page = editor
    .getSnapshot()
    .pages.find((item) => item.name === "States");
  if (!page) throw new Error("Missing States page");
  const edges = editor.store
    .getPageElements(page.id)
    .filter((element) => element.type === "state.transition");
  const loops = edges.filter((element) => element.id.startsWith("loop-"));
  expect(loops).toHaveLength(4);
  for (const loop of loops) {
    const data = loop.semantic as Record<string, unknown>;
    expect(data.fromPort).toBeDefined();
    expect(data.toPort).toBe(data.fromPort);
    for (const edge of edges) {
      if (edge.id === loop.id) continue;
      const other = edge.semantic as Record<string, unknown>;
      if (other.from === data.from)
        expect(other.fromPort).not.toBe(data.fromPort);
      if (other.to === data.from) expect(other.toPort).not.toBe(data.fromPort);
    }
  }
});
