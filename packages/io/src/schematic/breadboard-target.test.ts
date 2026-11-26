import { expect, test } from "bun:test";
import type { SchematicNetlist, SchematicNetlistComponent } from "@nodetto/ir";
import { importKicad } from "../kicad/index.ts";
import {
  breadboardTargetFromSchematic,
  exportSchematicKicadNetlist,
} from "./index.ts";

const component = (
  reference: string,
  partName: string,
  count: number,
  type: SchematicNetlistComponent["type"] = "schematic.ic",
): SchematicNetlistComponent => ({
  elementId: reference,
  type,
  reference,
  value: "",
  partName,
  description: "",
  footprint: "",
  pins: Array.from({ length: count }, (_, i) => ({ number: i + 1, name: "" })),
});
const makeNetlist = (
  components: SchematicNetlistComponent[],
): SchematicNetlist => ({
  pageId: "p",
  pageName: "Circuit",
  documentTitle: "Circuit",
  components,
  nets: components.flatMap((part) =>
    part.pins.map((pin) => ({
      code: pin.number,
      name: `${part.reference}_${pin.number}`,
      nodes: [
        { reference: part.reference, pin: pin.number, pinName: pin.name },
      ],
    })),
  ),
});

test("projects the same target as a KiCad round trip", () => {
  const input = makeNetlist([
    component("R1", "Resistor", 2, "schematic.resistor"),
    component("C1", "Capacitor", 2, "schematic.capacitor"),
    component("C2", "C_Polarized", 2, "schematic.capacitor"),
    component("D1", "D", 2, "schematic.diode"),
    component("D2", "LED", 2, "schematic.led"),
    component("Q2", "TransistorNPN", 3, "schematic.bjt"),
    component("Q3", "TransistorPNP", 3, "schematic.bjt"),
    component("Q4", "MOSFET_P", 3, "schematic.mosfet"),
    component("RV1", "R_Potentiometer", 3, "schematic.potentiometer"),
    component("BT1", "Battery", 2, "schematic.battery"),
    component("V1", "VoltageSource", 2, "schematic.voltageSource"),
    component("J1", "Conn_01x02", 2, "schematic.connector"),
    component("SW2", "SW_Push", 2, "schematic.switch"),
    component("SW1", "SW_Push", 2, "schematic.switch"),
    component("U1", "DIP", 8),
    component("U2", "Conn_01x05", 5),
    component("Q1", "MOSFET_N", 3, "schematic.mosfet"),
    component("L1", "Inductor", 2, "schematic.inductor"),
  ]);
  const result = breadboardTargetFromSchematic(input, { pageName: "Circuit" });
  expect(result.target).toEqual(
    importKicad(exportSchematicKicadNetlist(input).text, {
      fileName: "Circuit.net",
    }).plan?.target,
  );
  expect(result.target?.parts.find((p) => p.reference === "U1")?.type).toBe(
    "breadboard.ic",
  );
  expect(result.target?.parts.find((p) => p.reference === "U2")?.type).toBe(
    "breadboard.header",
  );
  expect(
    result.target?.nets.find((n) => n.name === "SW1_2")?.nodes[0]?.pin,
  ).toBe(3);
  expect(
    result.target?.nets
      .filter((n) => n.name.startsWith("U1_"))
      .map((n) => n.nodes[0]?.pin),
  ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test("rejects sparse, oversized, duplicate and unannotated parts", () => {
  const sparse = component("U1", "IC_Generic", 4);
  const input = makeNetlist([
    { ...sparse, pins: [1, 3, 7, 9].map((number) => ({ number, name: "" })) },
    component("U2", "IC_Generic", 48),
    component("R1", "Resistor", 2, "schematic.resistor"),
    {
      ...component("R1", "SW_Push", 2, "schematic.switch"),
      elementId: "second",
    },
    component("R?", "Resistor", 2, "schematic.resistor"),
  ]);
  const result = breadboardTargetFromSchematic(input, { pageName: "Circuit" });
  expect(result.target).toBeUndefined();
  expect(result.diagnostics.map((d) => d.code).sort()).toEqual([
    "schematic.duplicateReference",
    "schematic.unannotatedReference",
    "schematic.unprojectablePart",
    "schematic.unprojectablePart",
  ]);
  expect(
    result.diagnostics.find((d) => d.code === "schematic.duplicateReference")
      ?.message,
  ).toContain("R1, second");
});
