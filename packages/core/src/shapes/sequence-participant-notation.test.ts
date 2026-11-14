import { expect, test } from "bun:test";
import { element } from "../test-helpers.ts";
import { sequenceParticipantNotation } from "./sequence-participant-notation.ts";

const box = { x: 10, y: 20, width: 120, height: 56 };
const participant = (kind?: string) =>
  element({
    id: "p",
    type: "sequence.participant",
    semantic: { name: "Widget", ...(kind ? { kind } : {}) },
    visual: { style: { stroke: "#123456" } },
  });
const notation = (kind?: string) =>
  sequenceParticipantNotation(participant(kind), box, {
    ink: "black",
    surface: "white",
  });

test("participant notation selects kinds and keeps geometry in the head band", () => {
  for (const kind of [undefined, "service", "other"])
    expect(notation(kind)).toBeNull();
  for (const kind of ["actor", "db"]) {
    const result = notation(kind);
    expect(result).not.toBeNull();
    if (!result) throw new Error("missing notation");
    expect(result.labelBox.x).toBeGreaterThanOrEqual(box.x);
    expect(result.labelBox.y).toBeGreaterThanOrEqual(box.y);
    expect(result.labelBox.x + result.labelBox.width).toBeLessThanOrEqual(
      box.x + box.width,
    );
    expect(result.labelBox.y + result.labelBox.height).toBeLessThanOrEqual(
      box.y + box.height,
    );
    for (const primitive of result.primitives)
      expect(primitive.stroke).toBe("#123456");
  }
  const actor = notation("actor");
  expect(actor?.primitives[0]).toMatchObject({
    kind: "circle",
    cx: 70,
    cy: 25,
    r: 5,
  });
  expect(actor?.primitives[1]).toMatchObject({
    kind: "path",
    d: "M70 30 L70 43.400000000000006 M58 34.4 L82 34.4 M70 43.400000000000006 L58 56 M70 43.400000000000006 L82 56",
    fill: "none",
  });
  expect(notation("db")?.primitives[0]).toMatchObject({
    kind: "path",
    d: "M10 28 A60 8 0 0 1 130 28 L130 68 A60 8 0 0 1 10 68 Z M130 28 A60 8 0 0 1 10 28",
  });
});
