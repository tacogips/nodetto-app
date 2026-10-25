import { expect, test } from "bun:test";
import type {
  BreadboardNetlist,
  BreadboardNetlistComponent,
} from "@nodetto/ir";
import {
  exportBreadboardBomCsv,
  exportBreadboardKicadNetlist,
  exportBreadboardSpiceNetlist,
} from "./index.ts";

function component(
  reference: string,
  type: BreadboardNetlistComponent["type"],
  value: string,
  names: readonly string[] = ["1", "2"],
): BreadboardNetlistComponent {
  return {
    elementId: reference,
    type,
    reference,
    value,
    description: type.slice("breadboard.".length),
    footprint: "nodetto:Part",
    partName: type.slice("breadboard.".length),
    pins: names.map((name, index) => ({ number: index + 1, name })),
  };
}

function netlist(
  components: readonly BreadboardNetlistComponent[],
  nets: BreadboardNetlist["nets"] = [],
): BreadboardNetlist {
  return {
    pageId: "page",
    pageName: "Prototype",
    documentTitle: "Demo",
    components,
    nets,
  };
}

test("BOM groups by part and orders groups and references naturally", () => {
  const report = exportBreadboardBomCsv(
    netlist([
      component("R2", "breadboard.resistor", "220"),
      component("D1", "breadboard.led", "red", ["A", "K"]),
      component("R1", "breadboard.resistor", "220"),
    ]),
  );
  expect(report.text).toBe(
    'Item,Qty,References,Value,Part,Footprint\n1,1,D1,red,led,nodetto:Part\n2,2,"R1, R2",220,resistor,nodetto:Part\n',
  );
});

test("BOM uses RFC 4180 quoting", () => {
  const report = exportBreadboardBomCsv(
    netlist([
      component("R1", "breadboard.resistor", "1,5k"),
      {
        ...component("R2", "breadboard.resistor", "220"),
        description: 'res "istor',
      },
    ]),
  );
  expect(report.text).toContain('1,1,R1,"1,5k",resistor,nodetto:Part');
  expect(report.text).toContain('2,1,R2,220,"res ""istor",nodetto:Part');
});

test("KiCad formatter emits deterministic S-expression and escapes strings", () => {
  const input = netlist(
    [component('R"1', "breadboard.resistor", "220")],
    [
      {
        code: 1,
        name: "GND",
        nodes: [{ reference: 'R"1', pin: 2, pinName: "2" }],
      },
    ],
  );
  const report = exportBreadboardKicadNetlist(input);
  expect(report.text).toContain('(design (source "Demo") (tool "nodetto"))');
  expect(report.text).toContain('(comp (ref "R\\"1") (value "220")');
  expect(report.text).toContain('(net (code "1") (name "GND")');
  expect(report.text).toContain(
    '(node (ref "R\\"1") (pin "2") (pinfunction "2"))',
  );
  expect(report.text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(report.text.endsWith("\n")).toBe(true);
});

test("KiCad formatter matches the complete two-component two-net structure", () => {
  const resistor = {
    ...component("R1", "breadboard.resistor", "220"),
    description: "Resistor 5%",
    footprint: "nodetto:Resistor_P4",
    partName: "Resistor",
  };
  const battery = {
    ...component("BT1", "breadboard.battery", "9V", ["+", "-"]),
    description: "Battery",
    footprint: "nodetto:Battery",
    partName: "Battery",
  };
  const report = exportBreadboardKicadNetlist(
    netlist(
      [resistor, battery],
      [
        {
          code: 1,
          name: "GND",
          nodes: [
            { reference: "BT1", pin: 2, pinName: "-" },
            { reference: "R1", pin: 1, pinName: "1" },
          ],
        },
        {
          code: 2,
          name: "VCC",
          nodes: [
            { reference: "BT1", pin: 1, pinName: "+" },
            { reference: "R1", pin: 2, pinName: "2" },
          ],
        },
      ],
    ),
  );

  expect(report.text).toBe(
    '(export (version "E")\n' +
      '  (design (source "Demo") (tool "nodetto"))\n' +
      "  (components\n" +
      '    (comp (ref "R1") (value "220") (footprint "nodetto:Resistor_P4")\n' +
      '      (libsource (lib "nodetto") (part "Resistor") (description "Resistor 5%")))\n' +
      '    (comp (ref "BT1") (value "9V") (footprint "nodetto:Battery")\n' +
      '      (libsource (lib "nodetto") (part "Battery") (description "Battery")))\n' +
      "  )\n" +
      "  (nets\n" +
      '    (net (code "1") (name "GND")\n' +
      '      (node (ref "BT1") (pin "2") (pinfunction "-"))\n' +
      '      (node (ref "R1") (pin "1") (pinfunction "1")))\n' +
      '    (net (code "2") (name "VCC")\n' +
      '      (node (ref "BT1") (pin "1") (pinfunction "+"))\n' +
      '      (node (ref "R1") (pin "2") (pinfunction "2")))\n' +
      "  )\n" +
      ")\n",
  );
  expect(report.warnings).toEqual([]);
});

test("SPICE formats values, GND, potentiometers and transistor models", () => {
  const report = exportBreadboardSpiceNetlist(
    netlist(
      [
        component("R1", "breadboard.resistor", "4.7k"),
        component("C1", "breadboard.capacitor", "100n"),
        component("R2", "breadboard.resistor", "1M"),
        component("RV1", "breadboard.potentiometer", "10k", ["1", "W", "3"]),
        component("Q1", "breadboard.transistor", "NPN", ["E", "B", "C"]),
        {
          ...component("Q2", "breadboard.transistor", "2N3906", [
            "E",
            "B",
            "C",
          ]),
          partName: "PNP transistor",
        },
      ],
      [
        {
          code: 1,
          name: "GND",
          nodes: [{ reference: "R1", pin: 1, pinName: "1" }],
        },
        {
          code: 2,
          name: "supply+",
          nodes: [{ reference: "R1", pin: 2, pinName: "2" }],
        },
        {
          code: 3,
          name: "n1",
          nodes: [{ reference: "RV1", pin: 1, pinName: "1" }],
        },
        {
          code: 4,
          name: "nW",
          nodes: [{ reference: "RV1", pin: 2, pinName: "W" }],
        },
        {
          code: 5,
          name: "n3",
          nodes: [{ reference: "RV1", pin: 3, pinName: "3" }],
        },
        {
          code: 6,
          name: "nE",
          nodes: [{ reference: "Q1", pin: 1, pinName: "E" }],
        },
        {
          code: 7,
          name: "nB",
          nodes: [{ reference: "Q1", pin: 2, pinName: "B" }],
        },
        {
          code: 8,
          name: "nC",
          nodes: [{ reference: "Q1", pin: 3, pinName: "C" }],
        },
      ],
    ),
  );
  expect(report.text).toContain("R1 0 supply_ 4.7k");
  expect(report.text).toContain("C1 NC NC 100n");
  expect(report.text).toContain("R2 NC NC 1Meg");
  expect(report.text).toContain("RRV1A n1 nW 5k");
  expect(report.text).toContain("RRV1B nW n3 5k");
  expect(report.text).toContain("Q1 nC nB nE QNPN");
  expect(report.text).toContain("Q2 NC NC NC QPNP");
  expect(report.text).toContain(".model QNPN NPN");
  expect(report.text).toContain(".model QPNP PNP");
  expect(report.text.endsWith(".end\n")).toBe(true);
});

test("SPICE comments invalid values and open switches, with reference warnings", () => {
  const report = exportBreadboardSpiceNetlist(
    netlist([
      component("R1", "breadboard.resistor", "abc"),
      component("SW1", "breadboard.button", "button", ["1", "2", "3", "4"]),
      component("R?", "breadboard.resistor", "1k"),
      component("R1", "breadboard.resistor", "2k"),
    ]),
  );
  expect(report.text).toContain("* R1 abc (value is not a number)");
  expect(report.text).toContain("* SW1 push button (open): 1-2 NC, 3-4 NC");
  expect(report.warnings).toContain('R1: value "abc" is not a number');
  expect(report.warnings).toContain("R?: unannotated reference");
  expect(report.warnings).toContain("R1: duplicate reference");
});
