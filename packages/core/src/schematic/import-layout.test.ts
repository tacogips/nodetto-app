import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  hasErrors,
  validateDocument,
  type BreadboardImportPart,
  type BreadboardImportPlan,
} from "@nodetto/ir";
import { serializeDocument } from "@nodetto/io";
import { importKicad } from "@nodetto/io/kicad";
import { computeSchematicConnectivity } from "./connectivity.ts";
import { layoutSchematicImport } from "./import-layout.ts";
import { toSchematicNetlist } from "./netlist.ts";

type Net = BreadboardImportPlan["target"]["nets"][number];
const part = (
  reference: string,
  type: BreadboardImportPart["type"],
): BreadboardImportPart => ({
  reference,
  type,
  value: reference,
  parameters: {},
});
const node = (reference: string, pin: number) => ({ reference, pin });
function plan(
  parts: BreadboardImportPart[],
  nets: Net[],
): BreadboardImportPlan {
  return {
    title: "Imported circuit",
    format: "kicad_net",
    source: "circuit.net",
    parts,
    target: {
      source: "circuit.net",
      format: "kicad_net",
      parts: parts.map(({ reference, type, value }) => ({
        reference,
        type,
        value,
      })),
      nets,
    },
  };
}
function layout(input: BreadboardImportPlan) {
  const result = layoutSchematicImport(input);
  expect(result.document).toBeDefined();
  if (!result.document) throw new Error("Expected schematic document");
  const document = result.document;
  const netlist = toSchematicNetlist(
    document,
    "page-1",
    computeSchematicConnectivity(document, "page-1"),
  );
  const nets = netlist.nets
    .map(({ name, nodes }) => ({
      name,
      nodes: nodes.map(({ reference, pin }) => `${reference}.${pin}`).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { ...result, document, netlist, nets };
}
const expected = (nets: readonly Net[]) =>
  nets
    .map(({ name, nodes }) => ({
      name,
      nodes: nodes.map(({ reference, pin }) => `${reference}.${pin}`).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

test("imports both supplied KiCad fixtures with their partitions and deterministic valid documents", () => {
  for (const filename of ["led-button.net", "led-button.kicad_sch"]) {
    const parsed = importKicad(
      readFileSync(`test-fixtures/kicad/${filename}`, "utf8"),
      { fileName: filename },
    );
    expect(parsed.plan).toBeDefined();
    if (!parsed.plan) throw new Error("Missing import plan");
    const first = layout(parsed.plan);
    // The breadboard push button uses pins 1 and 3; its schematic terminals are 1 and 2.
    const normalized = parsed.plan.target.nets.map((net) => ({
      ...net,
      nodes: net.nodes.map((n) =>
        n.reference === "SW1" && n.pin === 3 ? { ...n, pin: 2 } : n,
      ),
    }));
    expect(first.nets).toEqual(expected(normalized));
    expect(hasErrors(validateDocument(first.document))).toBe(false);
    expect(serializeDocument(first.document)).toBe(
      serializeDocument(layout(parsed.plan).document),
    );
  }
});

test("preserves switch terminals and falls back for split button bonds", () => {
  const input = plan(
    [
      part("SW1", "breadboard.button"),
      part("SW2", "breadboard.button"),
      part("SW3", "breadboard.button"),
    ],
    [
      { name: "LEFT", nodes: [node("SW1", 1)] },
      { name: "RIGHT", nodes: [node("SW1", 2)] },
      { name: "PUSH_L", nodes: [node("SW2", 1)] },
      { name: "PUSH_R", nodes: [node("SW2", 3)] },
      ...[1, 2, 3, 4].map((pin) => ({
        name: `S${pin}`,
        nodes: [node("SW3", pin)],
      })),
    ],
  );
  const result = layout(input);
  expect(result.nets).toEqual(
    expected(
      input.target.nets.map((net) => ({
        ...net,
        nodes: net.nodes.map((n) =>
          n.reference === "SW2" && n.pin === 3 ? { ...n, pin: 2 } : n,
        ),
      })),
    ),
  );
  expect(
    result.document.elements.filter((e) => e.type === "schematic.switch"),
  ).toHaveLength(2);
  expect(
    result.document.elements.filter((e) => e.type === "schematic.ic"),
  ).toHaveLength(1);
  expect(result.diagnostics.map((d) => d.code)).toContain(
    "schematic.importPartAsBox",
  );
});

test("keeps sparse IC pins and handles connector capacity", () => {
  const pins = (reference: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({
      name: i === count - 1 ? `${reference}_LAST` : `${reference}_${i + 1}`,
      nodes: [node(reference, i + 1)],
    }));
  const input = plan(
    [
      part("U1", "breadboard.ic"),
      part("J1", "breadboard.header"),
      part("J2", "breadboard.header"),
    ],
    [
      ...[1, 3, 7, 9].map((pin) => ({
        name: `U_${pin}`,
        nodes: [node("U1", pin)],
      })),
      ...pins("J1", 40),
      ...pins("J2", 41),
    ],
  );
  const result = layout(input);
  expect(result.nets).toEqual(expected(input.target.nets));
  expect(
    result.netlist.components
      .find((c) => c.reference === "U1")
      ?.pins.map((p) => p.number),
  ).toEqual([1, 3, 7, 9]);
  expect(
    result.netlist.components.find((c) => c.reference === "J1")?.type,
  ).toBe("schematic.connector");
  expect(
    result.netlist.components.find((c) => c.reference === "J2")?.type,
  ).toBe("schematic.ic");
  expect(result.diagnostics.map((d) => d.code)).toContain(
    "schematic.importPartAsBox",
  );
});

test("rejects a pin in two nets and more than 256 actual pins without a document", () => {
  const duplicate = layoutSchematicImport(
    plan(
      [part("R1", "breadboard.resistor")],
      [
        { name: "A", nodes: [node("R1", 1)] },
        { name: "B", nodes: [node("R1", 1)] },
      ],
    ),
  );
  expect(duplicate.document).toBeUndefined();
  expect(duplicate.diagnostics).toContainEqual(
    expect.objectContaining({
      code: "schematic.importPinInTwoNets",
      severity: "error",
    }),
  );
  const large = layoutSchematicImport(
    plan(
      [part("U1", "breadboard.ic")],
      Array.from({ length: 257 }, (_, i) => ({
        name: `N${i}`,
        nodes: [node("U1", i + 1)],
      })),
    ),
  );
  expect(large.document).toBeUndefined();
  expect(large.diagnostics).toContainEqual(
    expect.objectContaining({
      code: "schematic.importTooManyPins",
      severity: "error",
    }),
  );
});

test("retains singleton names and disambiguates trimmed and empty names", () => {
  const input = plan(
    [part("J1", "breadboard.header")],
    [
      { name: "SENSE", nodes: [node("J1", 1)] },
      { name: "A", nodes: [node("J1", 2)] },
      { name: " A ", nodes: [node("J1", 3)] },
      { name: "", nodes: [node("J1", 4)] },
    ],
  );
  const result = layout(input);
  expect(result.nets).toEqual(
    expected([
      { name: "SENSE", nodes: [node("J1", 1)] },
      { name: "A", nodes: [node("J1", 2)] },
      { name: "A_2", nodes: [node("J1", 3)] },
      { name: "N_J1_4", nodes: [node("J1", 4)] },
    ]),
  );
  expect(result.diagnostics.map((d) => d.code)).toEqual(
    expect.arrayContaining([
      "schematic.importRenamedNet",
      "schematic.importEmptyNetName",
    ]),
  );
});
