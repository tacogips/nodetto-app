import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { importKicad } from "./index.ts";

const fixture = (name: string) =>
  readFileSync(`test-fixtures/kicad/${name}`, "utf8");
const codes = (text: string) =>
  importKicad(text, { fileName: "inline.kicad_sch" }).diagnostics.map(
    (item) => item.code,
  );

describe("KiCad schematic import", () => {
  test("imports fixed parts, net names and rotated/mirrored pin geometry", () => {
    const result = importKicad(fixture("led-button.kicad_sch"), {
      fileName: "led-button.kicad_sch",
    });
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
        name: "N_D1_1",
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
    expect(result.diagnostics.map((item) => item.code)).not.toContain(
      "kicad.pinNamesMissing",
    );
  });

  test("maps 90 and 270 degree pin rotations in the specified screen direction", () => {
    const assertJoin = (angle: 90 | 270, capacitorY: -10 | 10) => {
      const source = `(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2")))) (symbol "Device:C" (symbol "C_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:R") (at 20 0 ${angle}) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:C") (at 20 ${capacitorY} 0) (property "Reference" "C1") (property "Value" "1u")))`;
      const nets = importKicad(source, { fileName: "rotation.kicad_sch" }).plan
        ?.target.nets;
      expect(nets).toContainEqual({
        name: "N_C1_1",
        nodes: [
          { reference: "C1", pin: 1 },
          { reference: "R1", pin: 2 },
        ],
      });
    };

    assertJoin(90, -10);
    assertJoin(270, 10);
  });

  test("joins power symbols with equal values into one named net", () => {
    const source =
      '(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2")))) (symbol "power:GND" (power) (symbol "GND_0_1" (pin power_in line (at 0 0 0) (name "GND") (number "1"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 0 50 0) (property "Reference" "R2") (property "Value" "1k")) (symbol (lib_id "power:GND") (at 0 0 0) (property "Reference" "#PWR01") (property "Value" "GND")) (symbol (lib_id "power:GND") (at 0 50 0) (property "Reference" "#PWR02") (property "Value" "GND")) (label "SIG" (at 10 0 0)) (label "SIG" (at 10 50 0)))';
    const nets = importKicad(source, { fileName: "power.kicad_sch" }).plan
      ?.target.nets;

    expect(nets).toEqual([
      {
        name: "GND",
        nodes: [
          { reference: "R1", pin: 1 },
          { reference: "R2", pin: 1 },
        ],
      },
      {
        name: "SIG",
        nodes: [
          { reference: "R1", pin: 2 },
          { reference: "R2", pin: 2 },
        ],
      },
    ]);
    expect(nets?.some(({ name }) => name.startsWith("GND_"))).toBe(false);
  });

  test("joins a label whose text matches a power value", () => {
    const source =
      '(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2")))) (symbol "power:GND" (power) (symbol "GND_0_1" (pin power_in line (at 0 0 0) (name "GND") (number "1"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 0 50 0) (property "Reference" "R2") (property "Value" "1k")) (symbol (lib_id "power:GND") (at 0 0 0) (property "Reference" "#PWR01") (property "Value" "GND")) (label "GND" (at 0 50 0)))';
    const nets = importKicad(source, { fileName: "label-power.kicad_sch" }).plan
      ?.target.nets;

    expect(nets).toContainEqual({
      name: "GND",
      nodes: [
        { reference: "R1", pin: 1 },
        { reference: "R2", pin: 1 },
      ],
    });
  });

  test("does not join crossing wire interiors unless a junction is present", () => {
    const base =
      '(kicad_sch (lib_symbols (symbol "Device:R" (symbol "R_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:R") (at 0 0 0) (property "Reference" "R1") (property "Value" "1k")) (symbol (lib_id "Device:R") (at 20 0 0) (property "Reference" "R2") (property "Value" "1k"))';
    const wires =
      " (wire (pts (xy 0 0) (xy 20 20))) (wire (pts (xy 0 20) (xy 20 0)))";
    const crossing = importKicad(`${base}${wires})`, {
      fileName: "cross.kicad_sch",
    }).plan?.target.nets;
    const joined = importKicad(`${base}${wires} (junction (at 10 10)))`, {
      fileName: "joined.kicad_sch",
    }).plan?.target.nets;
    expect(crossing?.length).toBeGreaterThan(joined?.length ?? 0);
  });

  test("merges units with the same reference and maps the full symbol pin count", () => {
    const source =
      '(kicad_sch (lib_symbols (symbol "Device:DIP" (symbol "DIP_1_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))) (symbol "DIP_2_1" (pin passive line (at 0 0 0) (name "3") (number "3")) (pin passive line (at 10 0 0) (name "4") (number "4"))))) (symbol (lib_id "Device:DIP") (unit 1) (at 0 0 0) (property "Reference" "U1") (property "Value" "IC")) (symbol (lib_id "Device:DIP") (unit 2) (at 20 0 0) (property "Reference" "U1") (property "Value" "IC")))';
    const result = importKicad(source, { fileName: "multi.kicad_sch" });
    expect(result.plan?.parts).toHaveLength(1);
    expect(result.plan?.parts[0]).toMatchObject({
      reference: "U1",
      type: "breadboard.ic",
      parameters: { pinCount: 4 },
    });
    expect(
      result.plan?.target.nets
        .flatMap((net) => net.nodes.map((node) => node.pin))
        .sort(),
    ).toEqual([1, 2, 3, 4]);
  });

  test("reports malformed structure, missing symbols, bad numbers, angles and unsupported constructs", () => {
    const malformed = importKicad(fixture("malformed.kicad_sch"), {
      fileName: "malformed.kicad_sch",
    });
    expect(malformed.plan).toBeDefined();
    expect(malformed.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "sexpr.unterminatedString",
        "sexpr.unclosedList",
      ]),
    );
    expect(
      codes(
        '(kicad_sch (bus) (bus_entry) (sheet) (wire (pts (xy abc 1) (xy 2 3))) (symbol (lib_id "Missing:X") (at 0 0 45) (property "Reference" "R1") (property "Value" "x")))',
      ),
    ).toEqual(
      expect.arrayContaining([
        "kicad.bus",
        "kicad.hierarchicalSheet",
        "kicad.invalidNumber",
        "kicad.unsupportedAngle",
        "kicad.missingLibSymbol",
      ]),
    );
    expect(
      codes(
        '(kicad_sch (lib_symbols (symbol "Device:LED" (symbol "LED_0_1" (pin passive line (at 0 0 0) (name "") (number "1"))))) (symbol (lib_id "Device:LED") (at 0 0 45) (property "Reference" "D1") (property "Value" "red")))',
      ),
    ).toEqual(
      expect.arrayContaining([
        "kicad.unsupportedAngle",
        "kicad.unsupportedSymbol",
      ]),
    );
    expect(
      codes(
        '(kicad_sch (lib_symbols (symbol "Device:LED" (symbol "LED_0_1" (pin passive line (at 0 0 0) (name "1") (number "1")) (pin passive line (at 10 0 0) (name "2") (number "2"))))) (symbol (lib_id "Device:LED") (at 0 0 0) (property "Reference" "D1") (property "Value" "red")))',
      ),
    ).toContain("kicad.pinNamesMissing");
  });
});
