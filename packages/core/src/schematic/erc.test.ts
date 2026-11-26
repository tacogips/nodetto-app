import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { element } from "../test-helpers.ts";
import { lintSchematicPage } from "./erc.ts";
const part = (id: string, reference: string, x: number) =>
  element({
    id,
    type: "schematic.connector",
    page: "p",
    visual: { x, y: 0 },
    semantic: { reference, value: "", pinCount: 1 },
  });
const mark = (id: string, type: string, x: number, y: number, net = "") =>
  element({
    id,
    type,
    page: "p",
    visual: {
      x: x + (type === "schematic.power" ? -15 : 0),
      y: y - (type === "schematic.power" ? 5 : 0),
    },
    semantic: { net, style: "ground" },
  });
const wire = (id: string, points: { x: number; y: number }[]) =>
  element({ id, type: "schematic.wire", page: "p", semantic: { points } });
const run = (elements: Element[]) =>
  lintSchematicPage({ elements } as unknown as Document, "p");
const rules = (elements: Element[], rule: string) =>
  run(elements).filter((f) => f.ruleId === rule);
test("unconnected and single-pin nets respect markers and power", () => {
  expect(rules([part("a", "J1", 0)], "unconnected-pin")).toMatchObject([
    { elementId: "a", pin: 1, severity: "warning" },
  ]);
  expect(
    rules(
      [part("a", "J1", 0), mark("n", "schematic.noConnect", 5, 5)],
      "unconnected-pin",
    ),
  ).toHaveLength(0);
  const connected = [
    part("a", "J1", 0),
    wire("w", [
      { x: 5, y: 5 },
      { x: 20, y: 5 },
    ]),
  ];
  expect(rules(connected, "single-pin-net")).toMatchObject([
    { elementId: "a", pin: 1, elementIds: ["a", "w"] },
  ]);
  expect(
    rules(
      [...connected, mark("pwr", "schematic.power", 20, 5, "SUPPLY")],
      "single-pin-net",
    ),
  ).toHaveLength(0);
  expect(
    rules(
      [...connected, mark("pwr", "schematic.power", 20, 5, "SUPPLY")],
      "unconnected-pin",
    ),
  ).toHaveLength(0);
});
test("dangling ends identify foreign bends and respect labels and junctions", () => {
  const base = wire("base", [
    { x: -10, y: 0 },
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
  const branch = wire("branch", [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
  ]);
  expect(
    rules([base, branch], "dangling-wire-end").filter(
      (f) => f.elementId === "branch",
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        elementIds: ["branch", "base"],
        message: expect.stringContaining("junction"),
      }),
    ]),
  );
  expect(
    rules(
      [base, branch, mark("j", "schematic.junction", 0, 0)],
      "dangling-wire-end",
    ).filter((f) => f.elementId === "branch"),
  ).toHaveLength(1);
  expect(
    rules(
      [base, branch, mark("l", "schematic.label", 0, 0, "A")],
      "dangling-wire-end",
    ).filter((f) => f.elementId === "branch"),
  ).toHaveLength(1);
});
test("duplicate references are exact and page local", () => {
  expect(
    rules(
      [part("a", "J1", 0), part("b", "J1", 100), part("c", "j1", 200)],
      "duplicate-reference",
    ),
  ).toMatchObject([{ elementId: "b", severity: "error" }]);
  expect(
    rules([part("a", "J1", 0), part("b", "J2", 100)], "duplicate-reference"),
  ).toHaveLength(0);
});
test("distinct trimmed power names short once; power no-connect does not exempt", () => {
  const p = mark("p", "schematic.power", 0, 0, " A ");
  const q = mark("q", "schematic.power", 0, 0, "B");
  expect(
    rules([p, q, mark("n", "schematic.noConnect", 0, 0)], "shorted-power-nets"),
  ).toMatchObject([
    { elementId: "q", elementIds: ["p", "q"], severity: "error" },
  ]);
  expect(
    rules([p, mark("q", "schematic.power", 0, 0, "A")], "shorted-power-nets"),
  ).toHaveLength(0);
  expect(
    rules(
      [
        mark("p", "schematic.power", 0, 0, " "),
        mark("q", "schematic.power", 0, 0, "B"),
      ],
      "shorted-power-nets",
    ),
  ).toHaveLength(1);
  expect(
    rules(
      [part("a", "J1", 0), mark("l", "schematic.label", 5, 5, " ")],
      "single-pin-net",
    ),
  ).toHaveLength(1);
});
