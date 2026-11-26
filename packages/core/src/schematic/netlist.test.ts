import { expect, test } from "bun:test";
import type { Document, Element } from "@nodetto/ir";
import { element } from "../test-helpers.ts";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { toSchematicNetlist } from "./netlist.ts";

const part = (id: string, reference: string, x: number) =>
  element({
    id,
    type: "schematic.connector",
    page: "p",
    visual: { x, y: 0 },
    semantic: { reference, value: "", pinCount: 1 },
  });
const label = (id: string, x: number, net: string, type = "schematic.label") =>
  element({
    id,
    type,
    page: "p",
    visual: {
      x: x + (type === "schematic.power" ? -15 : 0),
      y: type === "schematic.power" ? 0 : 5,
    },
    semantic: { net, style: "ground" },
  });
function run(elements: Element[]) {
  const document = {
    elements,
    pages: [{ id: "p", name: "Sheet" }],
    title: "Circuit",
  } as unknown as Document;
  return toSchematicNetlist(
    document,
    "p",
    computeSchematicConnectivity(document, "p"),
  );
}
test("reserves explicit names before second-order generated collisions", () => {
  const parts = [
    part("j1", "J1", 0),
    part("j2", "J2", 100),
    part("j3", "J3", 200),
  ];
  const pins = parts.map((p) => ({
    x: (p.visual.x ?? 0) + 5,
    y: p.visual.y ?? 0,
  }));
  const result = run([
    ...parts,
    label("l1", pins[0]?.x ?? 0, "N_J3_1_3"),
    label("l2", pins[1]?.x ?? 0, "N_J3_1"),
  ]);
  expect(result.nets.map((net) => net.name)).toEqual([
    "N_J3_1_3",
    "N_J3_1",
    "N_J3_1_3_2",
  ]);
  expect(
    result.nets.map((net) => net.nodes.map((node) => node.reference)),
  ).toEqual([["J1"], ["J2"], ["J3"]]);
});
test("power wins over labels and labels choose alphabetically; references order naturally", () => {
  const result = run([
    part("r10", "R10", 100),
    part("rq", "R?", 200),
    part("r2", "R2", 0),
    label("z", 5, "Z"),
    label("a", 5, "A"),
    label("power", 5, "PWR", "schematic.power"),
    label("z2", 105, "Z2"),
    label("a2", 105, "A2"),
  ]);
  expect(result.components.map((component) => component.reference)).toEqual([
    "R2",
    "R10",
    "R?",
  ]);
  expect(result.nets.map((net) => net.name)).toEqual(["PWR", "A2", "N_R?_1"]);
  expect(result.nets.map((net) => net.code)).toEqual([1, 2, 3]);
});
