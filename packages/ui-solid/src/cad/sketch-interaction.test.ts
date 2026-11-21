import { expect, test } from "bun:test";
import type { CadXY } from "@nodetto/ir";
import { type SketchState, sketchStep } from "./sketch-interaction.ts";

const a: CadXY = [0, 0];
const b: CadXY = [6, 0];
const c: CadXY = [5, 4];

test("line chains successive clicks and ends after closing back to its origin", () => {
  const initial: SketchState = { tool: "cad:line", points: [] };
  const first = sketchStep(initial, { type: "down", p: a });
  const preview = sketchStep(first.state, { type: "move", p: b });
  expect(preview).toEqual({
    state: { tool: "cad:line", points: [a], hover: b },
  });
  const line = sketchStep(preview.state, { type: "down", p: b });
  expect(line.commit).toEqual({ kind: "line", points: [a, b] });
  const next = sketchStep(line.state, { type: "down", p: c });
  expect(next.commit?.points).toEqual([b, c]);
  const closed = sketchStep(next.state, { type: "down", p: a });
  expect(closed.commit?.points).toEqual([c, a]);
  expect(closed.state.points).toEqual([]);
});

test("escape cancels pending points before a second escape is handled by the caller", () => {
  const initial: SketchState = { tool: "cad:line", points: [a], hover: b };
  const cleared = sketchStep(initial, { type: "escape" });
  expect(cleared).toEqual({ state: { tool: "cad:line", points: [] } });
  expect(sketchStep(cleared.state, { type: "escape" }).state).toBe(
    cleared.state,
  );
});

test("rectangle accepts a drag or two clicks, but emits no zero-size rectangle", () => {
  const start = sketchStep(
    { tool: "cad:rect", points: [] },
    { type: "down", p: a },
  );
  expect(sketchStep(start.state, { type: "up", p: b }).commit).toBeUndefined();
  for (const type of ["down", "up"] as const) {
    expect(sketchStep(start.state, { type, p: c }).commit).toEqual({
      kind: "rect",
      points: [a, c],
    });
  }
});

test("circle takes its centre and radius point, while arc takes start, end, then midpoint", () => {
  const circle = sketchStep(
    { tool: "cad:circle", points: [a] },
    { type: "down", p: b },
  );
  expect(circle.commit).toEqual({ kind: "circle", points: [a, b] });
  const arc = sketchStep(
    { tool: "cad:arc", points: [a] },
    { type: "down", p: b },
  );
  expect(arc.commit).toBeUndefined();
  expect(sketchStep(arc.state, { type: "down", p: c }).commit).toEqual({
    kind: "arc",
    points: [a, c, b],
  });
});
