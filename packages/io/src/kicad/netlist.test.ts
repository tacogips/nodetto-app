import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { importKicad } from "./index.ts";
import { importNetlist } from "./netlist.ts";
import { readSexpr } from "./sexpr.ts";

const fixture = (name: string) =>
  readFileSync(`test-fixtures/kicad/${name}`, "utf8");
const from = (source: string, fileName = "circuit.net") => {
  const parsed = readSexpr(source);
  const diagnostics = [...parsed.diagnostics];
  const plan = parsed.root
    ? importNetlist(parsed.root, fileName, diagnostics)
    : undefined;
  return { plan, diagnostics };
};

describe("KiCad netlist import", () => {
  test("imports the fixed circuit and keeps source net names", () => {
    const result = from(fixture("led-button.net"), "led-button.net");
    expect(
      result.plan?.parts.map(({ reference, value, type }) => [
        reference,
        value,
        type,
      ]),
    ).toEqual([
      ["BT1", "5V", "breadboard.battery"],
      ["D1", "red", "breadboard.led"],
      ["R1", "220", "breadboard.resistor"],
      ["SW1", "PUSH", "breadboard.button"],
    ]);
    expect(result.plan?.target.nets).toEqual([
      {
        name: "+5V",
        nodes: [
          { reference: "BT1", pin: 1 },
          { reference: "SW1", pin: 1 },
        ],
      },
      {
        name: "GND",
        nodes: [
          { reference: "BT1", pin: 2 },
          { reference: "D1", pin: 2 },
        ],
      },
      {
        name: "LED_A",
        nodes: [
          { reference: "D1", pin: 1 },
          { reference: "R1", pin: 2 },
        ],
      },
      {
        name: "SW_OUT",
        nodes: [
          { reference: "R1", pin: 1 },
          { reference: "SW1", pin: 3 },
        ],
      },
    ]);
    expect(result.plan).toMatchObject({
      title: "led-button",
      format: "kicad_net",
      source: "led-button.net",
    });
  });

  test("reports skipped, duplicate and unmapped data while keeping singletons", () => {
    const result = from(fixture("unknown-symbols.net"));
    expect(result.plan?.parts.map((part) => part.reference)).toEqual([
      "L1",
      "R1",
      "U1",
    ]);
    expect(result.plan?.target.nets).toContainEqual({
      name: "SINGLE",
      nodes: [{ reference: "L1", pin: 2 }],
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "kicad.unsupportedSymbol",
        "kicad.skippedSymbol",
        "kicad.unmappedPin",
        "kicad.duplicateReference",
      ]),
    );
  });

  test("drops unknown node references and diagnoses missing component references", () => {
    const result = from(
      "(export (components (comp (value 10k) (libsource (lib Device) (part R)))) (nets (net (name X) (node (ref #PWR01) (pin 1)))))",
    );
    expect(result.diagnostics.map((item) => item.code)).toContain(
      "kicad.missingReference",
    );
    expect(result.plan?.parts).toEqual([]);
    expect(result.plan?.target.nets).toEqual([]);
  });

  test("returns errors without a plan for legacy and unknown roots", () => {
    expect(
      importKicad(fixture("legacy.sch"), { fileName: "legacy.sch" }),
    ).toMatchObject({
      diagnostics: [{ code: "kicad.legacyFormat", severity: "error" }],
    });
    expect(importKicad("(foo)", { fileName: "x.net" })).toMatchObject({
      diagnostics: [{ code: "kicad.unknownRoot", severity: "error" }],
    });
  });
});
