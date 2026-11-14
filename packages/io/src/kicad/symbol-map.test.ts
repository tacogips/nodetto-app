import { describe, expect, test } from "bun:test";
import type { KicadSymbolInput } from "./symbol-map.ts";
import { mapKicadSymbol } from "./symbol-map.ts";

const pins = (...numbers: string[]) => numbers.map((number) => ({ number }));
const map = (
  name: string,
  reference: string,
  pinList: KicadSymbolInput["pins"],
  extra: Partial<Parameters<typeof mapKicadSymbol>[0]> = {},
) =>
  mapKicadSymbol({
    lib: "Device",
    name,
    reference,
    value: "value",
    pins: pinList,
    ...extra,
  });

describe("mapKicadSymbol", () => {
  test("maps the catalogue prefixes and default parameters", () => {
    expect(map("R", "R1", pins("1", "2"))).toMatchObject({
      kind: "part",
      type: "breadboard.resistor",
      parameters: { span: 4, bands: 4 },
    });
    expect(
      map("R", "R2", pins("1", "2"), { footprint: "Resistor_P7.62mm" }),
    ).toMatchObject({ kind: "part", parameters: { span: 7, bands: 4 } });
    expect(map("C", "C1", pins("1", "2"))).toMatchObject({
      kind: "part",
      type: "breadboard.capacitor",
      parameters: { style: "ceramic", span: 1 },
    });
    expect(
      map("C_Polarized", "C2", [
        { number: "1", name: "+" },
        { number: "2", name: "-" },
      ]),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.capacitor",
      parameters: { style: "electrolytic" },
      pinMap: new Map([
        ["1", 1],
        ["2", 2],
      ]),
    });
    expect(
      map("D", "D1", [
        { number: "1", name: "A" },
        { number: "2", name: "K" },
      ]),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.diode",
      parameters: { span: 4 },
      pinMap: new Map([
        ["1", 1],
        ["2", 2],
      ]),
    });
    expect(
      map("Battery", "BT1", [
        { number: "1", name: "+" },
        { number: "2", name: "-" },
      ]),
    ).toMatchObject({ kind: "part", type: "breadboard.battery" });
    expect(map("R_Potentiometer", "RV1", pins("1", "2", "3"))).toMatchObject({
      kind: "part",
      type: "breadboard.potentiometer",
    });
    expect(
      map("Conn_01x05", "J1", pins("1", "2", "3", "4", "5")),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.header",
      parameters: { pinCount: 5 },
    });
  });

  test("uses named LED pins and button contact numbering", () => {
    const led = map(
      "LED",
      "D1",
      [
        { number: "1", name: "K" },
        { number: "2", name: "A" },
      ],
      { value: "green" },
    );
    expect(led).toMatchObject({
      kind: "part",
      type: "breadboard.led",
      parameters: { color: "green" },
      pinMap: new Map([
        ["2", 1],
        ["1", 2],
      ]),
    });
    const button = map("SW_Push", "SW1", pins("1", "2"));
    expect(button).toMatchObject({
      kind: "part",
      type: "breadboard.button",
      pinMap: new Map([
        ["1", 1],
        ["2", 3],
      ]),
    });
    const fallback = map("LED", "D2", pins("1", "2"));
    expect(fallback.diagnostics.map((item) => item.code)).toContain(
      "kicad.pinNamesMissing",
    );
  });

  test("maps transistors and generic symbols with useful diagnostics", () => {
    const transistor = map(
      "Q_NPN_CBE",
      "Q1",
      [
        { number: "1", name: "C" },
        { number: "2", name: "B" },
        { number: "3", name: "E" },
      ],
      { value: "NPN" },
    );
    expect(transistor).toMatchObject({
      kind: "part",
      type: "breadboard.transistor",
      parameters: { polarity: "npn", pinout: "CBE" },
    });
    expect(
      map("MyChip", "U1", pins("1", "2", "3", "4", "5", "6", "7", "8")),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.ic",
      parameters: { pinCount: 8 },
    });
    const generic = map("Mystery", "X3", pins("1", "2", "3"));
    expect(generic).toMatchObject({
      kind: "part",
      type: "breadboard.header",
      parameters: { pinCount: 3 },
    });
    expect(generic.diagnostics.map((item) => item.code)).toContain(
      "kicad.unsupportedSymbol",
    );
    const fallback = map("R", "R3", pins("1", "2", "3"));
    expect(fallback).toMatchObject({ kind: "part", type: "breadboard.header" });
    expect(fallback.diagnostics.map((item) => item.code)).toContain(
      "kicad.unsupportedSymbol",
    );
    expect(map("Unknown", "X0", [])).toMatchObject({ kind: "skip" });
    expect(
      map(
        "Unknown",
        "X41",
        Array.from({ length: 41 }, (_, i) => ({ number: String(i + 1) })),
      ),
    ).toMatchObject({ kind: "skip" });
  });

  test("maps our catalogue rows by lib and known part name", () => {
    expect(
      map("resistor", "R1", pins("1", "2"), { lib: "nodetto", value: "220" }),
    ).toMatchObject({ kind: "part", type: "breadboard.resistor" });
    expect(
      map("breadboard.resistor", "R2", pins("1", "2"), { lib: "nodetto" }),
    ).toMatchObject({ kind: "part", type: "breadboard.resistor" });
    expect(
      map("DIP", "U1", pins("1", "2", "3", "4", "5", "6", "7", "8"), {
        lib: "nodetto",
      }),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.ic",
      parameters: { pinCount: 8 },
    });
  });

  test("maps catalogue part names that differ from the type name", () => {
    const button = map("PushButton", "SW1", pins("1", "2", "3", "4"), {
      lib: "nodetto",
    });
    expect(button).toMatchObject({ kind: "part", type: "breadboard.button" });
    if (button.kind === "part") {
      expect([...button.pinMap]).toEqual([
        ["1", 1],
        ["2", 2],
        ["3", 3],
        ["4", 4],
      ]);
      expect(button.diagnostics).toEqual([]);
    }
    expect(
      map("CapacitorPolarized", "C1", pins("1", "2"), { lib: "nodetto" }),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.capacitor",
      parameters: { style: "electrolytic" },
    });
    expect(
      map("TransistorPNP", "Q1", pins("1", "2", "3"), { lib: "nodetto" }),
    ).toMatchObject({
      kind: "part",
      type: "breadboard.transistor",
      parameters: { polarity: "pnp" },
    });
  });
});
