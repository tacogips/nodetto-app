import { describe, expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import { planScale } from "./scale.ts";

function scaled(editor: Editor, ids: readonly string[], factor: number) {
  const plan = planScale(editor, ids, factor);
  if (!plan) throw new Error("nothing scaled");
  editor.apply(plan.commands, { placed: plan.placed });
  return plan;
}

describe("planScale", () => {
  test("scales boxes about the top-left of their bounds and text with them", () => {
    const editor = new Editor();
    const a = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "Gateway" },
      visual: { x: 100, y: 50, width: 80, height: 40 },
    });
    const b = editor.createElement("text.note", {
      semantic: { text: "Edge cache" },
      visual: {
        x: 300,
        y: 150,
        width: 120,
        height: 60,
        style: { fontSize: 20 },
      },
    });
    const plan = scaled(editor, [a, b], 1.25);
    expect(plan.origin).toEqual({ x: 100, y: 50 });
    expect(editor.store.get(a)?.visual).toMatchObject({
      x: 100,
      y: 50,
      width: 100,
      height: 50,
      style: { fontSize: 16.25 },
    });
    expect(editor.store.get(b)?.visual).toMatchObject({
      x: 350,
      y: 175,
      width: 150,
      height: 75,
      style: { fontSize: 25 },
    });
  });

  test("stretches path points with the box and moves free connector ends", () => {
    const editor = new Editor();
    const path = editor.createElement("draw.path", {
      visual: { x: 0, y: 0, width: 40, height: 40 },
    });
    const edge = editor.createElement("edge.generic", {
      semantic: { fromPoint: { x: 0, y: 0 }, toPoint: { x: 80, y: 40 } },
    });
    const before = editor.getBounds(path);
    scaled(editor, [path, edge], 2);
    expect(editor.getBounds(path)).toEqual({
      x: 0,
      y: 0,
      width: (before?.width ?? 0) * 2,
      height: (before?.height ?? 0) * 2,
    });
    expect(editor.store.get(edge)?.semantic).toMatchObject({
      fromPoint: { x: 0, y: 0 },
      toPoint: { x: 160, y: 80 },
    });
  });

  test("keeps derived table heights and rejects bad factors", () => {
    const editor = new Editor();
    const table = editor.createElement("erd.table", {
      semantic: { tableName: "accounts", columns: [] },
      visual: { x: 10, y: 10, width: 200 },
    });
    const height = editor.getBounds(table)?.height;
    scaled(editor, [table], 1.5);
    expect(editor.store.get(table)?.visual.width).toBe(300);
    expect(editor.getBounds(table)?.height).toBeGreaterThanOrEqual(height ?? 0);
    expect(planScale(editor, [table], 0)).toBeNull();
    expect(planScale(editor, [table], Number.NaN)).toBeNull();
    expect(planScale(editor, [], 2)).toBeNull();
  });
});
