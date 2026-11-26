import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { element } from "../test-helpers.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
const wire = (id: string, points: { x: number; y: number }[]) =>
  element({ id, type: "schematic.wire", page: "p", semantic: { points } });
const mark = (id: string, type: string, x: number, y: number, net = "") =>
  element({ id, type, page: "p", visual: { x, y }, semantic: { net } });
const run = (elements: Element[]) =>
  computeSchematicConnectivity({ elements } as unknown as Document, "p");
const h = () =>
  wire("h", [
    { x: -10, y: 0 },
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
const v = () =>
  wire("v", [
    { x: 0, y: -10 },
    { x: 0, y: 0 },
    { x: 0, y: 10 },
  ]);
test("crossings and bends require junctions; labels attach once", () => {
  const a = run([
    h(),
    v(),
    mark("a", "schematic.label", 0, 0, "A"),
    mark("b", "schematic.label", 0, 0, "B"),
  ]);
  expect(a.netOfElement("h")).not.toBe(a.netOfElement("v"));
  expect(a.netOfElement("a")).toBe(a.netOfElement("h"));
  expect(a.netOfElement("b")).toBe(a.netOfElement("h"));
  const b = run([h(), v(), mark("j", "schematic.junction", 0, 0)]);
  expect(b.netOfElement("h")).toBe(b.netOfElement("v"));
});
test("T ends are separate with a hint until a junction joins them", () => {
  const t = wire("t", [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
  ]);
  const a = run([h(), t]);
  expect(a.netOfElement("h")).not.toBe(a.netOfElement("t"));
  expect(a.wireEndAttached("t", 0)).toBe(false);
  expect(a.wireEndOnPathOf("t", 0)).toBe("h");
  const b = run([h(), t, mark("j", "schematic.junction", 0, 0)]);
  expect(b.netOfElement("h")).toBe(b.netOfElement("t"));
  expect(b.wireEndAttached("t", 0)).toBe(true);
});
test("endpoint pins, labels, power and markers", () => {
  const r = element({
    id: "r",
    type: "schematic.resistor",
    page: "p",
    semantic: {},
    visual: { x: -5, y: -15 },
  });
  const w = wire("w", [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
  const other = wire("other", [
    { x: 100, y: 0 },
    { x: 110, y: 0 },
  ]);
  const p = element({
    id: "power",
    type: "schematic.power",
    page: "p",
    semantic: { style: "ground", net: "GND" },
    visual: { x: 200, y: 0 },
  });
  const c = run([
    r,
    w,
    other,
    p,
    mark("l1", "schematic.label", 10, 0, " GND "),
    mark("l2", "schematic.label", 100, 0, "GND"),
    mark("nc", "schematic.noConnect", 0, 0),
  ]);
  expect(c.netOfPin({ elementId: "r", pin: 1 })).toBe(c.netOfElement("w"));
  expect(c.netOfElement("w")).toBe(c.netOfElement("other"));
  expect(c.netOfElement("w")).toBe(c.netOfElement("power"));
  expect(c.noConnectAt({ elementId: "r", pin: 1 })).toBe(true);
  expect(c.wireEndAttached("w", 0)).toBe(true);
});
test("hidden elements ignored and sweep work bounded", () => {
  const elements: Element[] = [];
  for (let i = 0; i < 1000; i++) {
    elements.push(
      wire(`w${i}`, [
        { x: i * 30, y: 0 },
        { x: i * 30 + 10, y: 0 },
      ]),
    );
    elements.push(mark(`l${i}`, "schematic.label", i * 30 + 5, 0, `N${i}`));
  }
  elements.push(
    element({
      id: "hidden",
      type: "schematic.junction",
      page: "p",
      semantic: {},
      visual: { hidden: true },
    }),
  );
  const c = run(elements);
  expect(c.netOfElement("hidden")).toBeUndefined();
  expect(c.stats.sweepWork).toBeLessThanOrEqual(4000);
  expect(c.netOfElement("l999")).toBe(c.netOfElement("w999"));
});
test("wire endpoints join while plain crossing labels select one wire", () => {
  const a = wire("a", [
    { x: -10, y: 0 },
    { x: 10, y: 0 },
  ]);
  const b = wire("b", [
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ]);
  const c = wire("c", [
    { x: 0, y: -10 },
    { x: 0, y: 10 },
  ]);
  const result = run([a, b, c, mark("label", "schematic.label", 0, 0, "X")]);
  expect(result.netOfElement("a")).toBe(result.netOfElement("b"));
  expect(result.wireEndAttached("a", 1)).toBe(true);
  expect(result.netOfElement("a")).not.toBe(result.netOfElement("c"));
  expect(result.netOfElement("label")).toBe(result.netOfElement("a"));
});
