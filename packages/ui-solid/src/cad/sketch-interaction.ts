import {
  arcCommands,
  type CadIds,
  circleCommands,
  type Command,
  lineCommands,
  rectangleCommands,
} from "@nodetto/core";
import type { CadXY, Element, PageId } from "@nodetto/ir";

export type SketchTool = "cad:line" | "cad:rect" | "cad:circle" | "cad:arc";
export type SketchEvent =
  | { type: "down" | "move" | "up"; p: CadXY }
  | { type: "escape" };

export interface SketchState {
  readonly tool: SketchTool;
  readonly points: readonly CadXY[];
  readonly hover?: CadXY;
}

type Commit =
  | { kind: "line" | "rect" | "circle"; points: readonly [CadXY, CadXY] }
  | { kind: "arc"; points: readonly [CadXY, CadXY, CadXY] };

export function sketchCommitCommands(
  commit: Commit,
  page: PageId,
  sketch: Element,
  ids: CadIds,
): Command[] {
  const [a, b] = commit.points;
  switch (commit.kind) {
    case "line":
      return lineCommands(page, sketch, a, b, ids);
    case "rect":
      return rectangleCommands(page, sketch, a, b, ids);
    case "circle":
      return circleCommands(
        page,
        sketch,
        a,
        Math.hypot(b[0] - a[0], b[1] - a[1]),
        ids,
      );
    case "arc":
      return arcCommands(page, sketch, a, b, commit.points[2], ids);
  }
}

export function isSketchTool(tool: string): tool is SketchTool {
  return (
    tool === "cad:line" ||
    tool === "cad:rect" ||
    tool === "cad:circle" ||
    tool === "cad:arc"
  );
}

function same(a: CadXY, b: CadXY): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function sketchStep(
  state: SketchState,
  event: SketchEvent,
): { state: SketchState; commit?: Commit } {
  const { tool, points } = state;
  if (event.type === "escape") {
    return { state: points.length ? { tool, points: [] } : state };
  }
  const { p } = event;
  if (event.type === "move") return { state: { ...state, hover: p } };
  if (event.type === "up" && tool !== "cad:rect") return { state };
  const first = points[0];
  if (!first) {
    return {
      state: event.type === "down" ? { tool, points: [p], hover: p } : state,
    };
  }

  switch (tool) {
    case "cad:line": {
      const last = points.at(-1) ?? first;
      if (same(last, p)) return { state };
      return {
        state: { tool, points: same(first, p) ? [] : [first, p], hover: p },
        commit: { kind: "line", points: [last, p] },
      };
    }
    case "cad:rect":
      if (first[0] === p[0] || first[1] === p[1]) return { state };
      return {
        state: { tool, points: [], hover: p },
        commit: { kind: "rect", points: [first, p] },
      };
    case "cad:circle":
      if (same(first, p)) return { state };
      return {
        state: { tool, points: [], hover: p },
        commit: { kind: "circle", points: [first, p] },
      };
    case "cad:arc": {
      const end = points[1];
      if (same(first, p) || (end && same(end, p))) return { state };
      if (!end) return { state: { tool, points: [first, p], hover: p } };
      return {
        state: { tool, points: [], hover: p },
        commit: { kind: "arc", points: [first, p, end] },
      };
    }
  }
}
