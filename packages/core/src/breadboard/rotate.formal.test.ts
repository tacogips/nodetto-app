import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  isBreadboardPartType,
  type BreadboardPartSemantic,
  type Element,
} from "@nodetto/ir";
import { Store } from "../store.ts";
import { breadboardLocalBox, breadboardPinDefs } from "./catalogue.ts";
import { planBreadboardRotation } from "./rotate.ts";

type Point = [number, number];
type Box = { x: number; y: number; width: number; height: number };
type Fixture = {
  fn: "fixture";
  in: {
    type: string;
    semantic: Record<string, unknown>;
    localBox2: Box;
    pinDefs2: Point[];
  };
  out: { ok: { cx: number; cy: number; pins: Point[] } };
};
type Rotation = {
  fn: "rotate";
  in: {
    fixture: string;
    x2: number;
    y2: number;
    turns: number;
    quarterTurns: 1 | -1;
  };
  out: { ok: { x2: number; y2: number; turns: number } };
};
type Vector = Fixture | Rotation;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);
const points = (v: unknown): v is Point[] =>
  Array.isArray(v) &&
  v.every(
    (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(number),
  );
function isVector(v: unknown): v is Vector {
  if (!record(v) || !record(v.in) || !record(v.out) || !record(v.out.ok))
    return false;
  const input = v.in;
  const out = v.out.ok;
  if (v.fn === "fixture") {
    const box = input.localBox2;
    return (
      typeof input.type === "string" &&
      isBreadboardPartType(input.type) &&
      record(input.semantic) &&
      record(box) &&
      number(box.x) &&
      number(box.y) &&
      number(box.width) &&
      number(box.height) &&
      points(input.pinDefs2) &&
      number(out.cx) &&
      number(out.cy) &&
      points(out.pins)
    );
  }
  return (
    v.fn === "rotate" &&
    typeof input.fixture === "string" &&
    number(input.x2) &&
    number(input.y2) &&
    number(input.turns) &&
    (input.quarterTurns === 1 || input.quarterTurns === -1) &&
    number(out.x2) &&
    number(out.y2) &&
    number(out.turns)
  );
}
const data: unknown = JSON.parse(
  readFileSync(
    new URL("../../../../formal/vectors/rotate.json", import.meta.url),
    "utf8",
  ),
);
if (
  !record(data) ||
  !Array.isArray(data.cases) ||
  !data.cases.every(isVector) ||
  data.cases.length === 0
)
  throw new Error("Invalid rotation vectors");
const vectors: Vector[] = data.cases;
const fixtures = new Map(
  vectors
    .filter((v): v is Fixture => v.fn === "fixture")
    .map((v) => [v.in.type.slice("breadboard.".length), v]),
);

describe("Lean rotation conformance", () => {
  for (const [index, vector] of vectors.entries()) {
    test(`${vector.fn} ${index}`, () => {
      if (vector.fn === "fixture") {
        const { type, semantic, localBox2, pinDefs2 } = vector.in;
        if (!isBreadboardPartType(type))
          throw new Error("Invalid fixture type");
        const typedSemantic = semantic as unknown as BreadboardPartSemantic;
        const box = breadboardLocalBox(type, typedSemantic);
        for (const key of ["x", "y", "width", "height"] as const)
          expect(2 * box[key]).toBe(localBox2[key]);
        const pins = breadboardPinDefs(type, typedSemantic);
        expect(pins.length).toBe(pinDefs2.length);
        for (const [i, pin] of pins.entries()) {
          expect(2 * pin.dx).toBe(pinDefs2[i]?.[0]);
          expect(2 * pin.dy).toBe(pinDefs2[i]?.[1]);
        }
        const geometry = {
          cx: 5 * localBox2.width,
          cy: 5 * localBox2.height,
          pins: pinDefs2.map(([x, y]) => [
            10 * (x - localBox2.x),
            10 * (y - localBox2.y),
          ]),
        };
        expect(geometry).toEqual(vector.out.ok);
        const first = geometry.pins[0];
        if (!first) throw new Error("Fixture has no pins");
        for (const pin of geometry.pins) {
          expect(Math.abs((pin[0]! - first[0]!) % 20)).toBe(0);
          expect(Math.abs((pin[1]! - first[1]!) % 20)).toBe(0);
        }
        return;
      }
      const fixture = fixtures.get(vector.in.fixture);
      if (!fixture) throw new Error(`Missing fixture ${vector.in.fixture}`);
      const element: Element = {
        id: "part",
        page: "page",
        type: fixture.in.type,
        index: "a1",
        semantic: fixture.in.semantic,
        visual: {
          x: vector.in.x2 / 2,
          y: vector.in.y2 / 2,
          rotation: vector.in.turns * 90,
        },
      };
      const store = new Store({
        schemaVersion: 1,
        id: "test",
        title: "Test",
        pages: [{ id: "page", name: "Page", kind: "breadboard" }],
        elements: [element],
      });
      const commands = planBreadboardRotation(
        store,
        [element.id],
        vector.in.quarterTurns,
      );
      expect(commands.length).toBe(1);
      const command = commands[0];
      if (!command || command.type !== "updateVisual")
        throw new Error("Expected updateVisual");
      expect(command.visual.x).toBe(vector.out.ok.x2 / 2);
      expect(command.visual.y).toBe(vector.out.ok.y2 / 2);
      expect(command.visual.rotation).toBe(vector.out.ok.turns * 90);
    });
  }
});
