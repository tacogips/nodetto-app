import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import { document, element } from "../test-helpers.ts";
import {
  firstSchematicPageId,
  schematicPcbParityFindings,
} from "./pcb-parity.ts";

const pages = [
  { id: "board", name: "Board", kind: "pcb" as const },
  { id: "sheet", name: "Sheet", kind: "schematic" as const },
];
const part = (reference: string, x: number, value = "1k") =>
  element({
    id: reference,
    type: "schematic.connector",
    page: "sheet",
    visual: { x, y: 0 },
    semantic: { reference, value, pinCount: 1 },
  });
const label = (id: string, x: number, net: string) =>
  element({
    id,
    type: "schematic.label",
    page: "sheet",
    visual: { x: x + 5, y: 5 },
    semantic: { net },
  });
const footprint = (reference: string, net: string | undefined, value = "1k") =>
  element({
    id: `fp-${reference}`,
    type: "pcb.footprint",
    page: "board",
    semantic: {
      reference,
      value,
      pads: net === undefined ? [] : [{ number: "1", net }],
    },
  });
const run = (elements: Element[]) =>
  schematicPcbParityFindings(document(elements, pages), "board", "sheet");
const schematic = () => [
  part("R1", 0),
  part("R2", 100),
  label("l1", 0, "A"),
  label("l2", 100, "A"),
];

test("matching board has no findings and missing parts target schematic page", () => {
  expect(
    run([...schematic(), footprint("R1", "N"), footprint("R2", "N")]),
  ).toEqual([]);
  expect(
    run(schematic()).map(({ ruleId, elementId, pageId }) => ({
      ruleId,
      elementId,
      pageId,
    })),
  ).toEqual([
    { ruleId: "pcb-parity-missing-part", elementId: "R1", pageId: "sheet" },
    { ruleId: "pcb-parity-missing-part", elementId: "R2", pageId: "sheet" },
  ]);
  const pcbOnly = document([footprint("R1", "N")], [pages[0]!]);
  expect(firstSchematicPageId(pcbOnly)).toBeUndefined();
  expect(schematicPcbParityFindings(pcbOnly, "board", "sheet")).toEqual([]);
});

test("missing pads and split PCB nets report missing connections", () => {
  for (const net of [undefined, "OTHER", ""]) {
    expect(
      run([...schematic(), footprint("R1", "N"), footprint("R2", net)]),
    ).toMatchObject([
      {
        ruleId: "pcb-parity-missing-connection",
        elementId: "fp-R2",
        pin: 1,
        severity: "warning",
      },
    ]);
  }
});

test("a PCB net joining distinct schematic nets reports one extra connection", () => {
  const separate = [part("R1", 0), part("R2", 100)];
  expect(
    run([...separate, footprint("R1", "N"), footprint("R2", "N")]),
  ).toMatchObject([
    {
      ruleId: "pcb-parity-extra-connection",
      elementId: "fp-R2",
      pin: 1,
      severity: "error",
    },
  ]);
  expect(run([...separate, footprint("R1", ""), footprint("R2", "")])).toEqual(
    [],
  );
});

test("extra parts and value mismatches are reported; equivalent values match", () => {
  expect(
    run([part("R1", 0), footprint("R1", "", "2k"), footprint("R3", "")]),
  ).toMatchObject([
    { ruleId: "pcb-parity-value-mismatch", elementId: "fp-R1" },
    { ruleId: "pcb-parity-extra-part", elementId: "fp-R3" },
  ]);
  expect(run([part("R1", 0), footprint("R1", "", "1000")])).toEqual([]);
});

test("first schematic page follows canonical page order", () => {
  const doc = document(
    [],
    [
      { id: "later", name: "Later", kind: "schematic", order: "b" },
      { id: "first", name: "First", kind: "schematic", order: "a" },
    ],
  );
  expect(firstSchematicPageId(doc)).toBe("first");
});
