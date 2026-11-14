import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sequenceParticipantNotation } from "@nodetto/core";
import type { Element } from "@nodetto/ir";
import { sequenceParticipantViewModel } from "./shapes/SequenceParticipantView.tsx";

const box = { x: 42, y: 80, width: 120, height: 200 };
const participant = (kind?: string): Element => ({
  id: "participant",
  page: "page",
  index: "a1",
  type: "sequence.participant",
  semantic: { name: "Widget", ...(kind ? { kind } : {}) },
  visual: { style: { stroke: "#123456" } },
});

test("service and missing kind keep the existing view", () => {
  expect(sequenceParticipantViewModel(participant("service"), box)).toBeNull();
  expect(sequenceParticipantViewModel(participant(), box)).toBeNull();
});

test("actor and db use the shared local head band and stroke override", () => {
  for (const kind of ["actor", "db"]) {
    const element = participant(kind);
    const model = sequenceParticipantViewModel(element, box);
    const shared = sequenceParticipantNotation(
      element,
      { x: 0, y: 0, width: 120, height: 54 },
      { ink: "var(--nodetto-ink)", surface: "var(--nodetto-surface)" },
    );
    expect(model).toEqual(shared);
    expect(model?.primitives.map((p) => p.kind)).toEqual(
      kind === "actor" ? ["circle", "path"] : ["path"],
    );
    expect(model?.primitives.every((p) => p.stroke === "#123456")).toBe(true);
    expect(model?.labelBox.x).toBe(0);
    expect(model?.labelBox.y).toBeGreaterThan(0);
    expect((model?.labelBox.y ?? 0) + (model?.labelBox.height ?? 0)).toBe(54);
    if (kind === "actor") {
      const head = model?.primitives[0];
      expect(head?.kind).toBe("circle");
      if (head?.kind === "circle") {
        expect(head.cx - head.r).toBeGreaterThanOrEqual(0);
        expect(head.cx + head.r).toBeLessThanOrEqual(120);
        expect(head.cy - head.r).toBeGreaterThanOrEqual(0);
        expect(head.cy + head.r).toBeLessThanOrEqual(54);
      }
      const limbs = model?.primitives[1];
      expect(limbs?.kind).toBe("path");
      if (limbs?.kind === "path") {
        const points = [...limbs.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
        expect(points.length).toBeGreaterThan(0);
        for (const point of points) {
          expect(Number(point[1])).toBeGreaterThanOrEqual(0);
          expect(Number(point[1])).toBeLessThanOrEqual(120);
          expect(Number(point[2])).toBeGreaterThanOrEqual(0);
          expect(Number(point[2])).toBeLessThanOrEqual(54);
        }
      }
    } else {
      const cylinder = model?.primitives[0];
      expect(cylinder?.kind).toBe("path");
      if (cylinder?.kind === "path") {
        const arcs = [
          ...cylinder.d.matchAll(
            /A(-?[\d.]+) (-?[\d.]+) 0 0 1 (-?[\d.]+) (-?[\d.]+)/g,
          ),
        ];
        expect(arcs.length).toBeGreaterThan(0);
        for (const arc of arcs) {
          const ry = Number(arc[2]);
          const x = Number(arc[3]);
          const y = Number(arc[4]);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(120);
          expect(y - ry).toBeGreaterThanOrEqual(0);
          expect(y + ry).toBeLessThanOrEqual(54);
        }
        const top = arcs[0];
        expect(model?.labelBox.y).toBeGreaterThanOrEqual(
          Number(top?.[4]) + Number(top?.[2]),
        );
      }
    }
  }
});

test("canvas wiring preserves lifeline and limits smart paint", () => {
  const shape = readFileSync(
    "packages/ui-solid/src/shapes/ShapeView.tsx",
    "utf8",
  );
  const view = readFileSync(
    "packages/ui-solid/src/shapes/SequenceParticipantView.tsx",
    "utf8",
  );
  const css = readFileSync("apps/desktop/src/styles/canvas.css", "utf8");
  expect(shape).toContain(
    "<SequenceParticipantView element={props.element} box={props.box} />",
  );
  expect(css).toMatch(/\.nodetto-sequence-lifeline\s*\{[^}]*top:\s*54px/s);
  expect(css).toContain(".nodetto-sequence-participant-actor");
  expect(css).toContain(".nodetto-sequence-participant-db");
  expect(view).toContain("primitiveAttributes");
  expect(view).toContain("data-smart-text");
  expect(view).toMatch(
    /primitive\.role === "participant-head"\s*\? "svg"\s*:\s*undefined/,
  );
  expect(view).toMatch(
    /primitive\.role === "participant-cylinder"\s*\? "svg"\s*:\s*undefined/,
  );
  expect(view).not.toContain('primitive.role === "participant-body" ? "svg"');
});
